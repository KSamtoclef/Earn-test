-- Earn Chat welcome bonus, activity points, earned levels, direct-referral commissions and compact guided-chat upgrade
-- Safe to rerun after the production installer and consolidated KYC/recovery upgrade.
begin;

alter table public.profiles add column if not exists activity_points integer not null default 0;
alter table public.earnchat_level_settings add column if not exists points_required integer not null default 0;
alter table public.earnchat_level_settings add column if not exists referral_commission_percent numeric(5,2) not null default 0;

create table if not exists public.earnchat_point_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_type text not null,
 source_key text not null,
 points integer not null check(points>0),
 description text,
 created_at timestamptz not null default now(),
 unique(user_id,source_type,source_key)
);
create index if not exists earnchat_point_events_user_created_idx on public.earnchat_point_events(user_id,created_at desc);
alter table public.earnchat_point_events enable row level security;
drop policy if exists earnchat_point_events_own_read on public.earnchat_point_events;
create policy earnchat_point_events_own_read on public.earnchat_point_events for select to authenticated using(user_id=auth.uid());

update public.earnchat_business_settings
set signup_bonus_ngn=2000,
    referral_reward_ngn=500,
    version='20260731-member-motivation-r2',
    updated_at=now()
where id=true;

update public.earnchat_level_settings set points_required=0,referral_commission_percent=1,updated_at=now() where level_name='Starter';
update public.earnchat_level_settings set account_days=4,active_days=4,approved_chats=8,approved_tasks=6,kyc_requirement='submitted',max_rejection_rate=50,points_required=50,referral_commission_percent=3,updated_at=now() where level_name='Active';
update public.earnchat_level_settings set points_required=150,referral_commission_percent=5,updated_at=now() where level_name='Pro';
update public.earnchat_level_settings set points_required=300,referral_commission_percent=7,updated_at=now() where level_name='Elite';

create or replace function public.earnchat_award_points(p_user uuid,p_source_type text,p_source_key text,p_points integer,p_description text default null)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare inserted uuid;
begin
 if p_user is null or nullif(trim(p_source_type),'') is null or nullif(trim(p_source_key),'') is null or coalesce(p_points,0)<=0 then return 0; end if;
 insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
 values(p_user,trim(p_source_type),trim(p_source_key),p_points,p_description)
 on conflict(user_id,source_type,source_key) do nothing returning id into inserted;
 if inserted is null then return 0; end if;
 update public.profiles set activity_points=activity_points+p_points,updated_at=now() where id=p_user;
 return p_points;
end$$;

create or replace function public.earnchat_grant_signup_bonus(p_user uuid)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare p public.profiles%rowtype;base bigint;amount bigint;inserted uuid;
begin
 select * into p from public.profiles where id=p_user for update;
 if not found then return 0; end if;
 select signup_bonus_ngn into base from public.earnchat_business_settings where id=true;
 amount:=public.earnchat_country_amount(coalesce(base,2000),p.country);
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at,metadata)
 values(p.id,'work','credit','signup_bonus',p.id,amount,p.currency,p.country,'approved','Welcome registration bonus',now(),jsonb_build_object('withdrawal_locked_until_eligible',true))
 on conflict do nothing returning id into inserted;
 if inserted is null then return 0; end if;
 update public.profiles set work_available_balance=work_available_balance+amount,updated_at=now() where id=p.id;
 return amount;
end$$;

create or replace function public.ensure_earnchat_profile(p_full_name text default null,p_country text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();u auth.users%rowtype;cc text;r public.profiles%rowtype;bonus bigint;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into u from auth.users where id=uid;
 cc:=case when upper(coalesce(p_country,u.raw_user_meta_data->>'country','NG'))='KE' then 'KE' else 'NG' end;
 insert into public.profiles(id,email,full_name,country,currency,referral_code,account_created_at,updated_at)
 values(uid,coalesce(u.email,''),coalesce(nullif(trim(p_full_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(coalesce(u.email,''),'@',1)),cc,case when cc='KE' then 'KES' else 'NGN' end,upper(substr(md5(uid::text),1,10)),coalesce(u.created_at,now()),now())
 on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),referral_code=coalesce(public.profiles.referral_code,excluded.referral_code),updated_at=now();
 bonus:=public.earnchat_grant_signup_bonus(uid);
 select * into r from public.profiles where id=uid;
 return to_jsonb(r)||jsonb_build_object('welcome_bonus_credited',bonus);
end$$;

grant execute on function public.ensure_earnchat_profile(text,text) to authenticated;

create or replace function public.get_my_earnchat_state()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
 select jsonb_build_object(
  'profile',to_jsonb(p),
  'wallet',jsonb_build_object('work_available',p.work_available_balance,'work_pending',p.work_pending_balance,'referral_available',p.referral_available_balance,'referral_pending',p.referral_pending_balance,'total_withdrawn',p.total_withdrawn),
  'today_chats',(select count(*) from public.earnchat_chat_sessions c where c.user_id=p.id and c.session_date=current_date and c.status='approved'),
  'today_tasks',(select count(*) from public.earnchat_task_claims t where t.user_id=p.id and t.submitted_at::date=current_date and t.status='approved'),
  'welcome_bonus',(select coalesce(sum(amount),0) from public.earnchat_ledger l where l.user_id=p.id and l.source_type='signup_bonus' and l.entry_type='credit' and l.status='approved'),
  'point_events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) from(select source_type,points,description,created_at from public.earnchat_point_events where user_id=p.id order by created_at desc limit 20)e),
  'config',public.get_earnchat_business_config()
 ) from public.profiles p where p.id=auth.uid()
$$;

grant execute on function public.get_my_earnchat_state() to authenticated;

create or replace function public.evaluate_earnchat_level(p_user uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;chosen text:='Starter';days int;attempts int;rejects int;rate numeric;
begin
 select * into p from public.profiles where id=p_user for update;
 if not found then return chosen; end if;
 days:=current_date-p.account_created_at::date;
 attempts:=p.approved_tasks_count+p.task_rejection_count+p.approved_chats_count+p.chat_rejection_count;
 rejects:=p.task_rejection_count+p.chat_rejection_count;
 rate:=case when attempts=0 then 0 else rejects::numeric*100/attempts end;
 for l in select * from public.earnchat_level_settings order by rank loop
  if p.activity_points>=coalesce(l.points_required,0)
   and days>=l.account_days and p.active_days_count>=l.active_days and p.approved_chats_count>=l.approved_chats and p.approved_tasks_count>=l.approved_tasks and rate<=l.max_rejection_rate
   and (l.kyc_requirement='none' or (l.kyc_requirement='submitted' and p.kyc_status in('submitted','under_review','approved')) or (l.kyc_requirement='approved' and p.kyc_status='approved'))
   and (l.qualification_mission is null or (l.qualification_mission='pro' and p.pro_mission_status='approved') or (l.qualification_mission='elite' and p.elite_mission_status='approved'))
   and not p.security_review_required and p.fraud_review_status='clear' and not p.earning_suspended then chosen:=l.level_name;
  end if;
 end loop;
 update public.profiles set level_name=chosen,updated_at=now() where id=p_user;
 return chosen;
end$$;

create or replace function public.mark_earnchat_active_day(p_user uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare first_action boolean;
begin
 select not exists(select 1 from public.earnchat_active_days where user_id=p_user and activity_date=current_date) into first_action;
 insert into public.earnchat_active_days(user_id,activity_date,qualifying_actions) values(p_user,current_date,1)
 on conflict(user_id,activity_date) do update set qualifying_actions=earnchat_active_days.qualifying_actions+1;
 if first_action then perform public.earnchat_award_points(p_user,'active_day',current_date::text,5,'Qualifying active day'); end if;
 update public.profiles set active_days_count=(select count(*) from public.earnchat_active_days where user_id=p_user),updated_at=now() where id=p_user;
 perform public.refresh_earnchat_referral_qualification(p_user);
 perform public.evaluate_earnchat_level(p_user);
end$$;

create or replace function public.earnchat_credit(p_user uuid,p_wallet text,p_source text,p_source_id uuid,p_amount bigint,p_country text,p_description text)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare curr text:=case when p_country='KE' then 'KES' else 'NGN' end;cap bigint;earned bigint;inserted uuid;referral public.earnchat_referrals%rowtype;rate numeric;commission bigint;ref_country text;
begin
 if p_amount<=0 or p_wallet not in('work','referral') then raise exception 'Invalid credit'; end if;
 if p_wallet='work' then
  select public.earnchat_country_amount(daily_cap_ngn,p_country) into cap from public.earnchat_business_settings where id=true;
  select coalesce(sum(amount),0) into earned from public.earnchat_ledger where user_id=p_user and wallet_type='work' and entry_type='credit' and status='approved' and created_at::date=current_date;
  if earned+p_amount>cap then raise exception 'Daily earning cap reached'; end if;
 end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(p_user,p_wallet,'credit',p_source,p_source_id,p_amount,curr,p_country,'approved',p_description,now())
 on conflict do nothing returning id into inserted;
 if inserted is null then return 0; end if;
 if p_wallet='work' then
  update public.profiles set work_available_balance=work_available_balance+p_amount,approved_tasks_count=approved_tasks_count+case when p_source='task' then 1 else 0 end,approved_chats_count=approved_chats_count+case when p_source='chat' then 1 else 0 end,updated_at=now() where id=p_user;
  if p_source='chat' then perform public.earnchat_award_points(p_user,'chat',p_source_id::text,2,'Approved guided conversation'); end if;
  if p_source='task' then perform public.earnchat_award_points(p_user,'task',p_source_id::text,3,'Approved task'); end if;
  if p_source in('chat','task') then
   select * into referral from public.earnchat_referrals where referred_id=p_user and status='qualified' limit 1;
   if found then
    select l.referral_commission_percent,p.country into rate,ref_country from public.profiles p join public.earnchat_level_settings l on l.level_name=p.level_name where p.id=referral.referrer_id;
    commission:=floor(p_amount*coalesce(rate,0)/100)::bigint;
    if commission>0 then perform public.earnchat_credit(referral.referrer_id,'referral','referral_commission',p_source_id,commission,coalesce(ref_country,'NG'),format('Direct referral commission (%s%%)',rate)); end if;
   end if;
  end if;
 else
  update public.profiles set referral_available_balance=referral_available_balance+p_amount,updated_at=now() where id=p_user;
 end if;
 perform public.evaluate_earnchat_level(p_user);
 return p_amount;
end$$;

create or replace function public.admin_review_earnchat_referral(p_referral uuid,p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();r public.earnchat_referrals%rowtype;credited bigint:=0;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 select * into r from public.earnchat_referrals where id=p_referral for update;
 if not found or r.status<>'under_review' or p_decision not in('qualified','disqualified') then raise exception 'Referral is not ready for review'; end if;
 update public.profiles set referral_pending_balance=greatest(0,referral_pending_balance-r.reward_amount) where id=r.referrer_id;
 if p_decision='qualified' then
  credited:=public.earnchat_credit(r.referrer_id,'referral','referral',r.id,r.reward_amount,coalesce(r.country_code,'NG'),'Qualified direct referral reward');
  perform public.earnchat_award_points(r.referrer_id,'qualified_referral',r.id::text,10,'Qualified direct referral');
  update public.earnchat_referrals set status='qualified',reward_amount=credited,review_reason=p_reason where id=r.id;
 else
  update public.earnchat_referrals set status='disqualified',reward_amount=0,review_reason=p_reason where id=r.id;
 end if;
 perform public.evaluate_earnchat_level(r.referrer_id);
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'referral_'||p_decision,'referral',r.id,jsonb_build_object('reason',p_reason,'credited',credited));
 return jsonb_build_object('ok',true,'credited',credited);
end$$;

grant execute on function public.admin_review_earnchat_referral(uuid,text,text) to authenticated;

create or replace function public.admin_review_earnchat_kyc(p_submission uuid,p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();k public.earnchat_kyc_submissions%rowtype;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 select * into k from public.earnchat_kyc_submissions where id=p_submission for update;
 if not found or p_decision not in('approved','rejected') then raise exception 'Invalid KYC review'; end if;
 update public.earnchat_kyc_submissions set status=p_decision,review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=k.id;
 update public.profiles set kyc_status=p_decision,updated_at=now() where id=k.user_id;
 if p_decision='approved' then perform public.earnchat_award_points(k.user_id,'kyc',k.id::text,10,'Approved identity verification'); end if;
 perform public.evaluate_earnchat_level(k.user_id);
 return jsonb_build_object('ok',true);
end$$;

grant execute on function public.admin_review_earnchat_kyc(uuid,text,text) to authenticated;

create or replace function public.admin_update_earnchat_level(p_level text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 update public.earnchat_level_settings set
  chat_limit=coalesce((p_payload->>'chat_limit')::int,chat_limit),chat_reward_ngn=coalesce((p_payload->>'chat_reward_ngn')::bigint,chat_reward_ngn),
  task_min_ngn=coalesce((p_payload->>'task_min_ngn')::bigint,task_min_ngn),task_max_ngn=coalesce((p_payload->>'task_max_ngn')::bigint,task_max_ngn),
  withdraw_min_ngn=coalesce((p_payload->>'withdraw_min_ngn')::bigint,withdraw_min_ngn),withdraw_max_ngn=coalesce((p_payload->>'withdraw_max_ngn')::bigint,withdraw_max_ngn),
  account_days=coalesce((p_payload->>'account_days')::int,account_days),active_days=coalesce((p_payload->>'active_days')::int,active_days),
  approved_chats=coalesce((p_payload->>'approved_chats')::int,approved_chats),approved_tasks=coalesce((p_payload->>'approved_tasks')::int,approved_tasks),
  points_required=coalesce((p_payload->>'points_required')::int,points_required),referral_commission_percent=coalesce((p_payload->>'referral_commission_percent')::numeric,referral_commission_percent),updated_at=now()
 where level_name=p_level;
 return(select to_jsonb(l) from public.earnchat_level_settings l where level_name=p_level);
end$$;

grant execute on function public.admin_update_earnchat_level(text,jsonb) to authenticated;

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;aid uuid;started timestamptz;expires timestamptz;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 update public.earnchat_chat_attempts set status='expired' where user_id=uid and status='started' and expires_at<=now();
 if exists(select 1 from public.earnchat_chat_attempts where user_id=uid and status='started' and expires_at>now()) then raise exception 'Finish your current guided chat first'; end if;
 insert into public.earnchat_chat_attempts(user_id,partner_key) values(uid,p_partner) returning id,started_at,expires_at into aid,started,expires;
 return jsonb_build_object('attempt_id',aid,'partner',p_partner,'started_at',started,'expires_at',expires,'required_replies',4,'minimum_seconds',45,'daily_limit',l.chat_limit,'remaining',l.chat_limit-cnt);
end$$;

grant execute on function public.start_earnchat_chat(text) to authenticated;

create or replace function public.get_my_open_chat_attempt()
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare a public.earnchat_chat_attempts%rowtype;
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,'required_replies',4,'minimum_seconds',45);
end$$;

grant execute on function public.get_my_open_chat_attempt() to authenticated;

create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();a public.earnchat_chat_attempts%rowtype;p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;reward bigint;sid uuid;credited bigint;distinct_count int;short_count int;
begin
 select * into a from public.earnchat_chat_attempts where id=p_attempt and user_id=uid for update;
 if not found or a.status<>'started' or a.expires_at<now() then raise exception 'Chat attempt unavailable'; end if;
 if jsonb_typeof(p_replies)<>'array' or jsonb_array_length(p_replies)<>4 then raise exception 'Four replies are required'; end if;
 select count(distinct lower(trim(value))),count(*) filter(where length(trim(value))<12) into distinct_count,short_count from jsonb_array_elements_text(p_replies);
 if distinct_count<4 or short_count>0 then raise exception 'Use four different meaningful replies'; end if;
 if extract(epoch from(now()-a.started_at))<45 then raise exception 'Complete the 45-second guided conversation'; end if;
 select * into p from public.profiles where id=uid;
 if p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);
 insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags)
 values(uid,p.level_name,4,floor(extract(epoch from(now()-a.started_at)))::int,'approved',reward,p.currency,p.country,jsonb_build_object('reply_hashes',(select jsonb_agg(md5(lower(trim(value)))) from jsonb_array_elements_text(p_replies)),'client',coalesce(p_quality,'{}'::jsonb))) returning id into sid;
 credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided conversation');
 update public.earnchat_chat_attempts set status='completed',completed_at=now() where id=a.id;
 perform public.mark_earnchat_active_day(uid);
 return jsonb_build_object('ok',true,'session_id',sid,'amount',credited,'currency',p.currency,'remaining',l.chat_limit-cnt-1,'minimum_seconds',45);
end$$;

grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;

-- Backfill welcome bonuses and auditable points for existing members.
select public.earnchat_grant_signup_bonus(id) from public.profiles;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
select user_id,'active_day',activity_date::text,5,'Qualifying active day' from public.earnchat_active_days on conflict do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
select user_id,'chat',id::text,2,'Approved guided conversation' from public.earnchat_chat_sessions where status='approved' on conflict do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
select user_id,'task',id::text,3,'Approved task' from public.earnchat_task_claims where status='approved' on conflict do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
select user_id,'kyc',id::text,10,'Approved identity verification' from public.earnchat_kyc_submissions where status='approved' on conflict do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
select referrer_id,'qualified_referral',id::text,10,'Qualified direct referral' from public.earnchat_referrals where status='qualified' on conflict do nothing;
update public.profiles p set activity_points=coalesce((select sum(e.points) from public.earnchat_point_events e where e.user_id=p.id),0),updated_at=now();
select public.evaluate_earnchat_level(id) from public.profiles;

revoke all on function public.earnchat_award_points(uuid,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.earnchat_grant_signup_bonus(uuid) from public,anon,authenticated;
revoke all on function public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.mark_earnchat_active_day(uuid) from public,anon,authenticated;
revoke all on function public.evaluate_earnchat_level(uuid) from public,anon,authenticated;

commit;
select 'Earn Chat welcome bonus, points, direct referral commissions and 45-second chat upgrade completed' as result;
