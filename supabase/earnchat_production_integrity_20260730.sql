-- Run after earnchat_production_features_20260730.sql
begin;

-- Stable referral codes for existing profiles.
update public.profiles
set referral_code=upper(substr(md5(id::text),1,10)),updated_at=now()
where referral_code is null;

-- Credit must be all-or-nothing and idempotent. Partial rewards create mismatches.
create or replace function public.earnchat_credit(
 p_user uuid,p_wallet text,p_source text,p_source_id uuid,p_amount bigint,p_country text,p_description text
) returns bigint language plpgsql security definer set search_path=public as $$
declare curr text:=case when p_country='KE' then 'KES' else 'NGN' end;cap bigint;earned bigint;inserted_id uuid;
begin
 if p_amount<=0 then raise exception 'Invalid credit';end if;
 if p_wallet not in('work','referral') then raise exception 'Invalid wallet';end if;
 if p_wallet='work' then
  select public.earnchat_country_amount(daily_cap_ngn,p_country) into cap from public.earnchat_business_settings where id=true;
  select coalesce(sum(amount),0) into earned from public.earnchat_ledger
  where user_id=p_user and wallet_type='work' and entry_type='credit' and status='approved' and created_at::date=current_date;
  if earned+p_amount>cap then raise exception 'Daily earning cap reached';end if;
 end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(p_user,p_wallet,'credit',p_source,p_source_id,p_amount,curr,p_country,'approved',p_description,now())
 on conflict do nothing returning id into inserted_id;
 if inserted_id is null then return 0;end if;
 if p_wallet='work' then
  update public.profiles set work_available_balance=work_available_balance+p_amount,
   approved_tasks_count=approved_tasks_count+case when p_source='task' then 1 else 0 end,
   approved_chats_count=approved_chats_count+case when p_source='chat' then 1 else 0 end,
   updated_at=now() where id=p_user;
 else
  update public.profiles set referral_available_balance=referral_available_balance+p_amount,updated_at=now() where id=p_user;
 end if;
 perform public.evaluate_earnchat_level(p_user);
 return p_amount;
end;$$;

-- Idempotent profile creation and signup bonus.
create or replace function public.ensure_earnchat_profile(p_full_name text default null,p_country text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();u auth.users%rowtype;row public.profiles%rowtype;cc text;bonus bigint;bonus_source uuid;
begin
 if uid is null then raise exception 'Authentication required';end if;
 select * into u from auth.users where id=uid;
 cc:=case when upper(coalesce(p_country,u.raw_user_meta_data->>'country','NG'))='KE' then 'KE' else 'NG' end;
 insert into public.profiles(id,email,full_name,country,currency,referral_code,account_created_at,updated_at)
 values(uid,coalesce(u.email,''),coalesce(nullif(trim(p_full_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(coalesce(u.email,''),'@',1)),cc,case when cc='KE' then 'KES' else 'NGN' end,upper(substr(md5(uid::text),1,10)),coalesce(u.created_at,now()),now())
 on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),referral_code=coalesce(public.profiles.referral_code,excluded.referral_code),updated_at=now();
 select * into row from public.profiles where id=uid for update;
 if row.work_available_balance=0 and not exists(select 1 from public.earnchat_ledger where user_id=uid and source_type='signup_bonus' and entry_type='credit') then
  select public.earnchat_country_amount(signup_bonus_ngn,row.country) into bonus from public.earnchat_business_settings where id=true;
  bonus_source:=uid;
  perform public.earnchat_credit(uid,'work','signup_bonus',bonus_source,bonus,row.country,'Starting balance');
 end if;
 select * into row from public.profiles where id=uid;
 return to_jsonb(row);
end;$$;

-- Referral Day 2 creates a pending referral amount exactly once.
create or replace function public.refresh_earnchat_referral_qualification(p_user uuid default auth.uid())
returns void language plpgsql security definer set search_path=public as $$
declare r public.earnchat_referrals%rowtype;days date[];reward bigint;curr text;
begin
 select * into r from public.earnchat_referrals where referred_id=p_user for update;
 if not found or r.status in('qualified','disqualified') then return;end if;
 select array_agg(activity_date order by activity_date) into days from public.earnchat_active_days where user_id=p_user;
 if coalesce(array_length(days,1),0)>=1 and r.first_active_date is null then
  update public.earnchat_referrals set first_active_date=days[1],status='active_day_1' where id=r.id returning * into r;
 end if;
 if coalesce(array_length(days,1),0)>=2 and r.second_active_date is null then
  reward:=public.earnchat_country_amount((select referral_reward_ngn from public.earnchat_business_settings where id=true),coalesce(r.country_code,'NG'));
  curr:=case when coalesce(r.country_code,'NG')='KE' then 'KES' else 'NGN' end;
  update public.earnchat_referrals set second_active_date=days[2],status='under_review',qualification_at=now(),reward_amount=reward,currency=curr where id=r.id;
  update public.profiles set referral_pending_balance=referral_pending_balance+reward,updated_at=now() where id=r.referrer_id;
 end if;
end;$$;

create or replace function public.admin_review_earnchat_referral(p_referral uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r public.earnchat_referrals%rowtype;credited bigint:=0;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_decision not in('qualified','disqualified') then raise exception 'Invalid decision';end if;
 select * into r from public.earnchat_referrals where id=p_referral for update;
 if not found or r.status<>'under_review' then raise exception 'Referral is not under review';end if;
 update public.profiles set referral_pending_balance=greatest(0,referral_pending_balance-r.reward_amount),updated_at=now() where id=r.referrer_id;
 if p_decision='qualified' then
  if r.second_active_date is null then raise exception 'Two separate active days are required';end if;
  credited:=public.earnchat_credit(r.referrer_id,'referral','referral',r.id,r.reward_amount,coalesce(r.country_code,'NG'),'Qualified referral reward');
  update public.earnchat_referrals set status='qualified',reward_amount=credited,review_reason=p_reason where id=r.id;
 else
  update public.earnchat_referrals set status='disqualified',review_reason=p_reason,reward_amount=0 where id=r.id;
 end if;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details)
 values(uid,'referral_'||p_decision,'referral',r.id,jsonb_build_object('reason',p_reason,'credited',credited));
 return jsonb_build_object('ok',true,'status',p_decision,'credited',credited);
end;$$;

create or replace function public.admin_delete_earnchat_task(p_task uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();changed boolean;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if exists(select 1 from public.earnchat_task_claims where task_id=p_task) then
  update public.earnchat_tasks set status='ended',updated_at=now() where id=p_task;changed:=found;
 else
  delete from public.earnchat_tasks where id=p_task;changed:=found;
 end if;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id) values(uid,'task_delete_or_end','task',p_task);
 return changed;
end;$$;

grant execute on function public.admin_delete_earnchat_task(uuid) to authenticated;
commit;
