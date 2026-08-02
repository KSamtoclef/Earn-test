-- Earn Chat final country, referral and runtime configuration enforcement
-- Idempotent. Run after all 20260801 migrations and take a database backup first.
begin;

alter table public.earnchat_referrals
 add column if not exists qualifying_active_days_count integer not null default 0;

update public.profiles
set country=case when upper(coalesce(country,'NG'))='KE' then 'KE' else 'NG' end,
    currency=case when upper(coalesce(country,'NG'))='KE' then 'KES' else 'NGN' end,
    updated_at=now()
where currency is distinct from case when upper(coalesce(country,'NG'))='KE' then 'KES' else 'NGN' end;

create or replace function public.earnchat_convert_country_amount(p_amount bigint,p_from_country text,p_to_country text)
returns bigint
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare from_multiplier numeric;to_multiplier numeric;base_amount numeric;
begin
 if coalesce(p_amount,0)<=0 then return 0; end if;
 from_multiplier:=greatest(.01,coalesce(public.earnchat_multiplier(p_from_country),1));
 to_multiplier:=greatest(.01,coalesce(public.earnchat_multiplier(p_to_country),1));
 base_amount:=p_amount/from_multiplier;
 return greatest(0,round(base_amount*to_multiplier)::bigint);
end$$;

create or replace function public.earnchat_assert_runtime_available(p_feature text default null)
returns void
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare s public.earnchat_business_settings%rowtype;maintenance boolean;message text;enabled boolean;
begin
 select * into s from public.earnchat_business_settings where id=true;
 maintenance:=coalesce((coalesce(s.general_config,'{}'::jsonb)->>'maintenance_mode')::boolean,false);
 message:=coalesce(nullif(coalesce(s.general_config,'{}'::jsonb)->>'maintenance_message',''),'Earn Chat is temporarily unavailable. Please try again shortly.');
 if maintenance then raise exception '%',message using errcode='55000'; end if;
 if nullif(trim(coalesce(p_feature,'')),'') is not null then
  enabled:=coalesce((coalesce(s.feature_flags,'{}'::jsonb)->>p_feature)::boolean,true);
  if not enabled then raise exception 'This feature is temporarily unavailable' using errcode='55000'; end if;
 end if;
end$$;

create or replace function public.refresh_earnchat_referral_qualification(p_user uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 r public.earnchat_referrals%rowtype;
 active_dates date[];
 active_count integer:=0;
 required_days integer:=2;
 required_referrer_days integer:=5;
 referrer_age integer:=0;
 reward bigint;
 ref_country text;
begin
 select * into r from public.earnchat_referrals where referred_id=p_user for update;
 if not found or r.status in('under_review','qualified','disqualified') then return; end if;
 select greatest(1,least(365,coalesce(referral_required_active_days,2))),
        greatest(0,least(365,coalesce(referrer_account_days,5)))
 into required_days,required_referrer_days
 from public.earnchat_business_settings where id=true;
 select coalesce(array_agg(activity_date order by activity_date),'{}'::date[]),count(*)
 into active_dates,active_count
 from public.earnchat_active_days where user_id=p_user;
 select country,current_date-account_created_at::date into ref_country,referrer_age
 from public.profiles where id=r.referrer_id;
 update public.earnchat_referrals set
  first_active_date=case when active_count>=1 then active_dates[1] else first_active_date end,
  second_active_date=case when active_count>=2 then active_dates[2] else second_active_date end,
  qualifying_active_days_count=active_count,
  status=case when active_count>0 then 'active_day_1' else status end
 where id=r.id returning * into r;
 if active_count<required_days or referrer_age<required_referrer_days then return; end if;
 reward:=public.earnchat_country_amount((select referral_reward_ngn from public.earnchat_business_settings where id=true),coalesce(ref_country,'NG'));
 update public.earnchat_referrals set
  status='under_review',qualification_at=now(),reward_amount=reward,
  currency=case when ref_country='KE' then 'KES' else 'NGN' end,
  country_code=coalesce(ref_country,'NG'),qualifying_active_days_count=active_count
 where id=r.id;
 update public.profiles set referral_pending_balance=referral_pending_balance+reward,updated_at=now() where id=r.referrer_id;
end$$;

create or replace function public.earnchat_credit(p_user uuid,p_wallet text,p_source text,p_source_id uuid,p_amount bigint,p_country text,p_description text)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 curr text:=case when p_country='KE' then 'KES' else 'NGN' end;
 cap bigint;earned bigint;inserted uuid;
 referral public.earnchat_referrals%rowtype;
 rate numeric;commission bigint;ref_country text;base_commission bigint;
begin
 if p_amount<=0 or p_wallet not in('work','referral') then raise exception 'Invalid credit'; end if;
 if p_wallet='work' then
  select public.earnchat_country_amount(daily_cap_ngn,p_country) into cap from public.earnchat_business_settings where id=true;
  select coalesce(sum(amount),0) into earned from public.earnchat_ledger
   where user_id=p_user and wallet_type='work' and entry_type='credit' and status='approved'
   and source_type in('chat','task') and created_at::date=current_date;
  if earned+p_amount>cap then raise exception 'Daily earning cap reached'; end if;
 end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(p_user,p_wallet,'credit',p_source,p_source_id,p_amount,curr,p_country,'approved',p_description,now())
 on conflict do nothing returning id into inserted;
 if inserted is null then return 0; end if;
 if p_wallet='work' then
  update public.profiles set
   work_available_balance=work_available_balance+p_amount,
   approved_tasks_count=approved_tasks_count+case when p_source='task' then 1 else 0 end,
   approved_chats_count=approved_chats_count+case when p_source='chat' then 1 else 0 end,
   updated_at=now() where id=p_user;
  if p_source='chat' then perform public.earnchat_award_points(p_user,'chat',p_source_id::text,2,'Approved guided conversation'); end if;
  if p_source='task' then perform public.earnchat_award_points(p_user,'task',p_source_id::text,3,'Approved task'); end if;
  if p_source in('chat','task') then
   select * into referral from public.earnchat_referrals where referred_id=p_user and status='qualified' limit 1;
   if found then
    select l.referral_commission_percent,p.country into rate,ref_country
    from public.profiles p join public.earnchat_level_settings l on l.level_name=p.level_name
    where p.id=referral.referrer_id;
    base_commission:=floor(public.earnchat_convert_country_amount(p_amount,p_country,'NG')*coalesce(rate,0)/100)::bigint;
    commission:=public.earnchat_country_amount(base_commission,coalesce(ref_country,'NG'));
    if commission>0 then
     perform public.earnchat_credit(referral.referrer_id,'referral','referral_commission',p_source_id,commission,coalesce(ref_country,'NG'),format('Direct referral commission (%s%%)',rate));
    end if;
   end if;
  end if;
 else
  update public.profiles set referral_available_balance=referral_available_balance+p_amount,updated_at=now() where id=p_user;
 end if;
 perform public.evaluate_earnchat_level(p_user);
 return p_amount;
end$$;

-- Rename existing customer RPCs once, then expose guarded wrappers.
do $$begin
 if to_regprocedure('public.start_earnchat_task_core_20260802(uuid)') is null and to_regprocedure('public.start_earnchat_task(uuid)') is not null then alter function public.start_earnchat_task(uuid) rename to start_earnchat_task_core_20260802; end if;
 if to_regprocedure('public.submit_earnchat_task_core_20260802(uuid,jsonb)') is null and to_regprocedure('public.submit_earnchat_task(uuid,jsonb)') is not null then alter function public.submit_earnchat_task(uuid,jsonb) rename to submit_earnchat_task_core_20260802; end if;
 if to_regprocedure('public.start_earnchat_chat_core_20260802(text)') is null and to_regprocedure('public.start_earnchat_chat(text)') is not null then alter function public.start_earnchat_chat(text) rename to start_earnchat_chat_core_20260802; end if;
 if to_regprocedure('public.complete_earnchat_chat_core_20260802(uuid,jsonb,jsonb)') is null and to_regprocedure('public.complete_earnchat_chat(uuid,jsonb,jsonb)') is not null then alter function public.complete_earnchat_chat(uuid,jsonb,jsonb) rename to complete_earnchat_chat_core_20260802; end if;
 if to_regprocedure('public.register_earnchat_referral_core_20260802(text)') is null and to_regprocedure('public.register_earnchat_referral(text)') is not null then alter function public.register_earnchat_referral(text) rename to register_earnchat_referral_core_20260802; end if;
 if to_regprocedure('public.request_earnchat_withdrawal_core_20260802(text,bigint,text,jsonb)') is null and to_regprocedure('public.request_earnchat_withdrawal(text,bigint,text,jsonb)') is not null then alter function public.request_earnchat_withdrawal(text,bigint,text,jsonb) rename to request_earnchat_withdrawal_core_20260802; end if;
 if to_regprocedure('public.submit_earnchat_kyc_core_20260802(text,jsonb)') is null and to_regprocedure('public.submit_earnchat_kyc(text,jsonb)') is not null then alter function public.submit_earnchat_kyc(text,jsonb) rename to submit_earnchat_kyc_core_20260802; end if;
 if to_regprocedure('public.start_earnchat_qualification_core_20260802(uuid)') is null and to_regprocedure('public.start_earnchat_qualification(uuid)') is not null then alter function public.start_earnchat_qualification(uuid) rename to start_earnchat_qualification_core_20260802; end if;
 if to_regprocedure('public.submit_earnchat_qualification_core_20260802(uuid,jsonb)') is null and to_regprocedure('public.submit_earnchat_qualification(uuid,jsonb)') is not null then alter function public.submit_earnchat_qualification(uuid,jsonb) rename to submit_earnchat_qualification_core_20260802; end if;
end$$;

create or replace function public.start_earnchat_task(p_task uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare category text;begin select t.category into category from public.earnchat_tasks t where t.id=p_task;perform public.earnchat_assert_runtime_available(case when category='Visit' then 'sponsored_visits' else 'tasks' end);return public.start_earnchat_task_core_20260802(p_task);end$$;
create or replace function public.submit_earnchat_task(p_claim uuid,p_proof jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare category text;begin select t.category into category from public.earnchat_task_claims c join public.earnchat_tasks t on t.id=c.task_id where c.id=p_claim;perform public.earnchat_assert_runtime_available(case when category='Visit' then 'sponsored_visits' else 'tasks' end);return public.submit_earnchat_task_core_20260802(p_claim,p_proof);end$$;
create or replace function public.start_earnchat_chat(p_partner text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('guided_chat');return public.start_earnchat_chat_core_20260802(p_partner);end$$;
create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('guided_chat');return public.complete_earnchat_chat_core_20260802(p_attempt,p_replies,p_quality);end$$;
create or replace function public.register_earnchat_referral(p_code text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('referrals');return public.register_earnchat_referral_core_20260802(p_code);end$$;
create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('withdrawals');return public.request_earnchat_withdrawal_core_20260802(p_wallet,p_amount,p_method,p_payout);end$$;
create or replace function public.submit_earnchat_kyc(p_reference text default null,p_metadata jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('kyc');return public.submit_earnchat_kyc_core_20260802(p_reference,p_metadata);end$$;
create or replace function public.start_earnchat_qualification(p_mission uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('qualifications');return public.start_earnchat_qualification_core_20260802(p_mission);end$$;
create or replace function public.submit_earnchat_qualification(p_submission uuid,p_proof jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin perform public.earnchat_assert_runtime_available('qualifications');return public.submit_earnchat_qualification_core_20260802(p_submission,p_proof);end$$;

revoke all on function public.start_earnchat_task_core_20260802(uuid) from public,anon,authenticated;
revoke all on function public.submit_earnchat_task_core_20260802(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.start_earnchat_chat_core_20260802(text) from public,anon,authenticated;
revoke all on function public.complete_earnchat_chat_core_20260802(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.register_earnchat_referral_core_20260802(text) from public,anon,authenticated;
revoke all on function public.request_earnchat_withdrawal_core_20260802(text,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.submit_earnchat_kyc_core_20260802(text,jsonb) from public,anon,authenticated;
revoke all on function public.start_earnchat_qualification_core_20260802(uuid) from public,anon,authenticated;
revoke all on function public.submit_earnchat_qualification_core_20260802(uuid,jsonb) from public,anon,authenticated;

grant execute on function public.start_earnchat_task(uuid) to authenticated;
grant execute on function public.submit_earnchat_task(uuid,jsonb) to authenticated;
grant execute on function public.start_earnchat_chat(text) to authenticated;
grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.register_earnchat_referral(text) to authenticated;
grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated;
grant execute on function public.submit_earnchat_kyc(text,jsonb) to authenticated;
grant execute on function public.start_earnchat_qualification(uuid) to authenticated;
grant execute on function public.submit_earnchat_qualification(uuid,jsonb) to authenticated;

update public.earnchat_business_settings set version='20260802-final-completion-r1',updated_at=now() where id=true;
commit;
