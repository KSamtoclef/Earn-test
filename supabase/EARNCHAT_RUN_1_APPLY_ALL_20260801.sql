-- Earn Chat production upgrade bundle — RUN FIRST
-- Generated from authoritative repository SQL files.
-- Back up the Supabase database before running.
-- Do not edit this bundle directly; edit the source migrations and regenerate.
-- Included files, in order:
-- 1. supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql
-- 2. supabase/earnchat_level_chat_upgrade_20260731.sql
-- 3. supabase/earnchat_configuration_control_upgrade_20260801.sql
-- 4. supabase/earnchat_dynamic_chat_contract_20260801.sql
-- 5. supabase/earnchat_task_restart_contract_20260801.sql
-- 6. supabase/earnchat_dynamic_operations_contract_20260801.sql

-- ============================================================================
-- BEGIN 1: supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql
-- ============================================================================
-- Earn Chat consolidated KYC, recovery and bulk administrator upgrade
-- Safe to rerun after earnchat_production_install.sql.
begin;

-- KYC configuration.
alter table public.earnchat_business_settings add column if not exists kyc_enabled boolean not null default true;
alter table public.earnchat_business_settings add column if not exists kyc_provider_ng text not null default 'Approved verification provider';
alter table public.earnchat_business_settings add column if not exists kyc_provider_ke text not null default 'Approved verification provider';
alter table public.earnchat_business_settings add column if not exists kyc_url_ng text;
alter table public.earnchat_business_settings add column if not exists kyc_url_ke text;
alter table public.earnchat_business_settings add column if not exists kyc_instructions_ng text not null default 'Open the approved verification page, complete the required steps, then return with your reference.';
alter table public.earnchat_business_settings add column if not exists kyc_instructions_ke text not null default 'Open the approved verification page, complete the required steps, then return with your reference.';
alter table public.earnchat_business_settings add column if not exists kyc_reference_required boolean not null default true;
alter table public.earnchat_business_settings add column if not exists kyc_review_hours integer not null default 48;

create or replace function public.get_earnchat_kyc_config()
returns jsonb
language sql
security definer
set search_path=public,pg_temp
as $$
 select jsonb_build_object(
  'enabled',coalesce(s.kyc_enabled,true),
  'reference_required',coalesce(s.kyc_reference_required,true),
  'review_hours',coalesce(s.kyc_review_hours,48),
  'NG',jsonb_build_object('provider',s.kyc_provider_ng,'url',s.kyc_url_ng,'instructions',s.kyc_instructions_ng),
  'KE',jsonb_build_object('provider',s.kyc_provider_ke,'url',s.kyc_url_ke,'instructions',s.kyc_instructions_ke)
 )
 from public.earnchat_business_settings s where s.id=true
$$;

grant execute on function public.get_earnchat_kyc_config() to anon,authenticated;

create or replace function public.admin_update_earnchat_kyc_config(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();ng text:=nullif(trim(p_payload->>'url_ng'),'');ke text:=nullif(trim(p_payload->>'url_ke'),'');
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if ng is not null and ng !~* '^https://[^[:space:]]+$' then raise exception 'Nigeria KYC URL must use HTTPS'; end if;
 if ke is not null and ke !~* '^https://[^[:space:]]+$' then raise exception 'Kenya KYC URL must use HTTPS'; end if;
 update public.earnchat_business_settings set
  kyc_enabled=coalesce((p_payload->>'enabled')::boolean,kyc_enabled),
  kyc_provider_ng=coalesce(nullif(trim(p_payload->>'provider_ng'),''),kyc_provider_ng),
  kyc_provider_ke=coalesce(nullif(trim(p_payload->>'provider_ke'),''),kyc_provider_ke),
  kyc_url_ng=ng,kyc_url_ke=ke,
  kyc_instructions_ng=coalesce(nullif(trim(p_payload->>'instructions_ng'),''),kyc_instructions_ng),
  kyc_instructions_ke=coalesce(nullif(trim(p_payload->>'instructions_ke'),''),kyc_instructions_ke),
  kyc_reference_required=coalesce((p_payload->>'reference_required')::boolean,kyc_reference_required),
  kyc_review_hours=greatest(1,coalesce((p_payload->>'review_hours')::integer,kyc_review_hours)),updated_at=now()
 where id=true;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,details) values(uid,'kyc_configuration_updated','business_settings',coalesce(p_payload,'{}'::jsonb));
 return public.get_earnchat_kyc_config();
end$$;

grant execute on function public.admin_update_earnchat_kyc_config(jsonb) to authenticated;

-- Recoverable task claims with server expiry.
alter table public.earnchat_task_claims add column if not exists expires_at timestamptz;
update public.earnchat_task_claims c
set expires_at=coalesce(c.expires_at,c.started_at+make_interval(secs=>greatest(1800,coalesce(t.required_seconds,0)+1800)))
from public.earnchat_tasks t
where t.id=c.task_id and c.expires_at is null;
update public.earnchat_task_claims set status='expired' where status='started' and expires_at<=now();
with ranked as(
 select id,row_number() over(partition by user_id order by started_at desc,id desc) rn
 from public.earnchat_task_claims where status='started'
)
update public.earnchat_task_claims c set status='expired' from ranked r where c.id=r.id and r.rn>1;
create unique index if not exists earnchat_one_started_task_per_user on public.earnchat_task_claims(user_id) where status='started';
create index if not exists earnchat_open_task_expiry_idx on public.earnchat_task_claims(user_id,status,expires_at);

create or replace function public.start_earnchat_task(p_task uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();t public.earnchat_tasks%rowtype;p public.profiles%rowtype;ur int;tr int;dc int;tc int;reward bigint;cid uuid;started timestamptz;expiry timestamptz;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.profiles where id=uid for update;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 update public.earnchat_task_claims set status='expired' where user_id=uid and status='started' and coalesce(expires_at,started_at+interval '30 minutes')<=now();
 if exists(select 1 from public.earnchat_task_claims where user_id=uid and status='started') then raise exception 'Finish your current task first'; end if;
 select * into t from public.earnchat_tasks where id=p_task and status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now());
 if not found or t.country_code not in('ALL',p.country) then raise exception 'Task unavailable'; end if;
 select rank into ur from public.earnchat_level_settings where level_name=p.level_name;
 select rank into tr from public.earnchat_level_settings where level_name=t.required_level;
 if ur<tr then raise exception 'Required level: %',t.required_level; end if;
 select count(*) into dc from public.earnchat_task_claims where task_id=t.id and user_id=uid and started_at::date=current_date and status not in('rejected','expired','cancelled');
 if dc>=t.daily_claim_limit then raise exception 'Daily claim limit reached'; end if;
 if t.total_claim_limit is not null then
  select count(*) into tc from public.earnchat_task_claims where task_id=t.id and status in('started','pending','approved');
  if tc>=t.total_claim_limit then raise exception 'Task capacity reached'; end if;
 end if;
 reward:=public.earnchat_country_amount(t.base_reward_ngn,p.country);
 expiry:=now()+make_interval(secs=>greatest(1800,t.required_seconds+1800));
 insert into public.earnchat_task_claims(task_id,user_id,reward_amount,currency,country_code,expires_at)
 values(t.id,uid,reward,p.currency,p.country,expiry) returning id,started_at into cid,started;
 return jsonb_build_object('claim_id',cid,'task_id',t.id,'title',t.title,'description',t.description,'url',t.external_url,'provider_name',t.provider_name,'category',t.category,'required_level',t.required_level,'started_at',started,'expires_at',expiry,'required_seconds',t.required_seconds,'reward',reward,'base_reward_ngn',t.base_reward_ngn,'currency',p.currency,'country_code',p.country,'approval_type',t.approval_type,'proof_type',t.proof_type,'proof_required',t.proof_required,'instructions',t.instructions);
end$$;

grant execute on function public.start_earnchat_task(uuid) to authenticated;

create or replace function public.get_my_open_task_claim()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
 select case when c.id is null then null else jsonb_build_object(
  'claim_id',c.id,'task_id',c.task_id,'title',t.title,'description',t.description,'url',t.external_url,
  'provider_name',t.provider_name,'category',t.category,'required_level',t.required_level,
  'started_at',c.started_at,'expires_at',c.expires_at,'required_seconds',t.required_seconds,
  'reward',c.reward_amount,'base_reward_ngn',t.base_reward_ngn,'currency',c.currency,'country_code',c.country_code,
  'approval_type',t.approval_type,'proof_type',t.proof_type,'proof_required',t.proof_required,'instructions',t.instructions
 ) end
 from (select * from public.earnchat_task_claims where user_id=auth.uid() and status='started' and coalesce(expires_at,started_at+interval '30 minutes')>now() order by started_at desc limit 1)c
 join public.earnchat_tasks t on t.id=c.task_id
$$;

grant execute on function public.get_my_open_task_claim() to authenticated;

create or replace function public.cancel_earnchat_task_claim(p_claim uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 update public.earnchat_task_claims set status='cancelled',returned_at=now() where id=p_claim and user_id=auth.uid() and status='started';
 if not found then raise exception 'Open task claim not found'; end if;
 return jsonb_build_object('ok',true,'claim_id',p_claim,'status','cancelled');
end$$;

grant execute on function public.cancel_earnchat_task_claim(uuid) to authenticated;

create or replace function public.submit_earnchat_task(p_claim uuid,p_proof jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;t public.earnchat_tasks%rowtype;s text;credited bigint:=0;
begin
 select * into c from public.earnchat_task_claims where id=p_claim and user_id=uid for update;
 if not found or c.status<>'started' then raise exception 'Invalid claim'; end if;
 if c.expires_at is not null and c.expires_at<=now() then update public.earnchat_task_claims set status='expired' where id=c.id;raise exception 'Task claim expired'; end if;
 select * into t from public.earnchat_tasks where id=c.task_id;
 if extract(epoch from(now()-c.started_at))<t.required_seconds then raise exception 'Required time not completed'; end if;
 if t.proof_type='text' and length(trim(coalesce(p_proof->>'text','')))<3 then raise exception 'A text answer is required'; end if;
 if t.proof_type='reference' and length(trim(coalesce(p_proof->>'reference',p_proof->>'text','')))<3 then raise exception 'A completion reference is required'; end if;
 if t.proof_type='partner' and coalesce(p_proof->>'partner_token','')='' then raise exception 'Partner verification is required'; end if;
 s:=case when t.approval_type='instant' then 'approved' else 'pending' end;
 update public.earnchat_task_claims set returned_at=now(),submitted_at=now(),status=s,proof=coalesce(p_proof,'{}'::jsonb) where id=c.id;
 if s='approved' then credited:=public.earnchat_credit(uid,'work','task',c.id,c.reward_amount,c.country_code,'Approved linked task');perform public.mark_earnchat_active_day(uid);
 else update public.profiles set work_pending_balance=work_pending_balance+c.reward_amount,updated_at=now() where id=uid;
 end if;
 return jsonb_build_object('ok',true,'status',s,'amount',credited,'pending_amount',case when s='pending' then c.reward_amount else 0 end,'currency',c.currency);
end$$;

-- Recoverable guided-chat attempts.
create index if not exists earnchat_open_chat_expiry_idx on public.earnchat_chat_attempts(user_id,status,expires_at);

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
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
 return jsonb_build_object('attempt_id',aid,'partner',p_partner,'started_at',started,'expires_at',expires,'required_replies',4,'minimum_seconds',120,'daily_limit',l.chat_limit,'remaining',l.chat_limit-cnt);
end$$;

grant execute on function public.start_earnchat_chat(text) to authenticated;

create or replace function public.get_my_open_chat_attempt()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.earnchat_chat_attempts%rowtype;
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,'required_replies',4,'minimum_seconds',120);
end$$;

grant execute on function public.get_my_open_chat_attempt() to authenticated;

create or replace function public.cancel_earnchat_chat_attempt(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 update public.earnchat_chat_attempts set status='cancelled',completed_at=now() where id=p_attempt and user_id=auth.uid() and status='started';
 if not found then raise exception 'Open chat attempt not found'; end if;
 return jsonb_build_object('ok',true,'attempt_id',p_attempt,'status','cancelled');
end$$;

grant execute on function public.cancel_earnchat_chat_attempt(uuid) to authenticated;

-- Detailed bulk administrator responses.
create or replace function public.admin_bulk_review_earnchat_kyc(p_submissions uuid[],p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;succeeded int:=0;failed int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid KYC decision'; end if;
 foreach item in array coalesce(p_submissions,array[]::uuid[]) loop
  begin perform public.admin_review_earnchat_kyc(item,p_decision,p_reason);succeeded:=succeeded+1;
  exception when others then failed:=failed+1;failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'reason',sqlerrm));end;
 end loop;
 return jsonb_build_object('ok',failed=0,'succeeded',succeeded,'failed',failed,'failures',failures);
end$$;

create or replace function public.admin_bulk_review_task_claims(p_claims uuid[],p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;succeeded int:=0;failed int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid task decision'; end if;
 foreach item in array coalesce(p_claims,array[]::uuid[]) loop
  begin perform public.admin_review_task_claim(item,p_decision,p_reason);succeeded:=succeeded+1;
  exception when others then failed:=failed+1;failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'reason',sqlerrm));end;
 end loop;
 return jsonb_build_object('ok',failed=0,'succeeded',succeeded,'failed',failed,'failures',failures);
end$$;

create or replace function public.admin_bulk_update_user_control(p_users uuid[],p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;succeeded int:=0;failed int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_action not in('review_on','review_off','suspend','restore') then raise exception 'Invalid user-control action'; end if;
 foreach item in array coalesce(p_users,array[]::uuid[]) loop
  begin perform public.admin_update_earnchat_user_control(item,p_action,p_reason);succeeded:=succeeded+1;
  exception when others then failed:=failed+1;failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'reason',sqlerrm));end;
 end loop;
 return jsonb_build_object('ok',failed=0,'succeeded',succeeded,'failed',failed,'failures',failures);
end$$;

grant execute on function public.admin_bulk_review_earnchat_kyc(uuid[],text,text) to authenticated;
grant execute on function public.admin_bulk_review_task_claims(uuid[],text,text) to authenticated;
grant execute on function public.admin_bulk_update_user_control(uuid[],text,text) to authenticated;

-- Server-side payout validation and sanitization.
create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;
 mn bigint;mx bigint;available bigint;wid uuid;account_name text;account_number text;provider text;clean_payout jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.profiles where id=uid for update;
 if not found then raise exception 'Profile unavailable'; end if;
 if current_date-p.account_created_at::date<5 or p.kyc_status<>'approved' or p.security_review_required or p.earning_suspended or coalesce(p.fraud_review_status,'clear')<>'clear' then raise exception 'Withdrawal eligibility requirements are not complete'; end if;
 if jsonb_typeof(coalesce(p_payout,'{}'::jsonb))<>'object' then raise exception 'Invalid payout details'; end if;
 account_name:=nullif(trim(p_payout->>'account_name'),'');
 account_number:=regexp_replace(coalesce(p_payout->>'account_number',''),'[^0-9]','','g');
 provider:=nullif(trim(p_payout->>'provider'),'');
 if account_name is null or length(account_name)>120 then raise exception 'Enter a valid registered account name'; end if;
 if p.country='NG' then
  if p_method<>'bank' then raise exception 'Choose bank transfer'; end if;
  if account_number!~'^[0-9]{10}$' then raise exception 'Enter a valid 10-digit Nigerian account number'; end if;
  if provider is null or length(provider)>120 then raise exception 'Enter a valid Nigerian bank name'; end if;
 elsif p.country='KE' then
  if p_method='mpesa' then
   if account_number!~'^254[17][0-9]{8}$' then raise exception 'Enter a valid Kenyan Safaricom number in 254 format'; end if;
   provider:='Safaricom';
  elsif p_method='bank' then
   if account_number!~'^[0-9]{5,30}$' then raise exception 'Enter a valid Kenyan bank account number'; end if;
   if provider is null or length(provider)>120 then raise exception 'Enter a valid Kenyan bank name'; end if;
  else raise exception 'Choose M-Pesa or bank';
  end if;
 else raise exception 'Unsupported country';
 end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if p_wallet='referral' then
  mn:=public.earnchat_country_amount((select referral_withdraw_min_ngn from public.earnchat_business_settings where id=true),p.country);mx:=9223372036854775807;available:=p.referral_available_balance;
 elsif p_wallet='work' then
  mn:=public.earnchat_country_amount(l.withdraw_min_ngn,p.country);mx:=public.earnchat_country_amount(l.withdraw_max_ngn,p.country);available:=p.work_available_balance;
 else raise exception 'Invalid wallet';
 end if;
 if p_amount is null or p_amount<=0 or p_amount<mn or p_amount>mx or p_amount>available then raise exception 'Withdrawal amount is outside the allowed range'; end if;
 clean_payout:=jsonb_build_object('account_name',account_name,'account_number',account_number,'provider',provider);
 insert into public.earnchat_withdrawals(user_id,wallet_type,amount,currency,country_code,payout_method,payout_snapshot)
 values(uid,p_wallet,p_amount,p.currency,p.country,p_method,clean_payout) returning id into wid;
 if p_wallet='work' then update public.profiles set work_available_balance=work_available_balance-p_amount,updated_at=now() where id=uid;
 else update public.profiles set referral_available_balance=referral_available_balance-p_amount,updated_at=now() where id=uid;end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description)
 values(uid,p_wallet,'hold','withdrawal',wid,p_amount,p.currency,p.country,'approved','Withdrawal request hold');
 return jsonb_build_object('ok',true,'withdrawal_id',wid,'status','submitted');
end$$;

grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated;

-- Ensure every SECURITY DEFINER function uses a safe search path, including functions installed by older versions.
do $$
declare f record;
begin
 for f in
  select p.oid::regprocedure as signature
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
 loop
  execute format('alter function %s set search_path=public,pg_temp',f.signature);
 end loop;
end$$;

update public.earnchat_business_settings set version='2026-07-31-production-certification-r1',updated_at=now() where id=true;
commit;
select 'Earn Chat consolidated KYC, recovery and bulk upgrade completed' as status;
-- ============================================================================
-- END 1: supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql
-- ============================================================================

-- ============================================================================
-- BEGIN 2: supabase/earnchat_level_chat_upgrade_20260731.sql
-- ============================================================================
-- Earn Chat final member-motivation, referral commission, guided-chat and Admin overview upgrade
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
    version='20260731-production-complete-r1',
    updated_at=now()
where id=true;

update public.earnchat_level_settings set points_required=0,referral_commission_percent=1,updated_at=now() where level_name='Starter';
update public.earnchat_level_settings set account_days=4,active_days=4,approved_chats=8,approved_tasks=6,kyc_requirement='submitted',max_rejection_rate=50,points_required=50,referral_commission_percent=3,updated_at=now() where level_name='Active';
update public.earnchat_level_settings set points_required=150,referral_commission_percent=5,updated_at=now() where level_name='Pro';
update public.earnchat_level_settings set points_required=300,referral_commission_percent=7,updated_at=now() where level_name='Elite';

create or replace function public.earnchat_award_points(p_user uuid,p_source_type text,p_source_key text,p_points integer,p_description text default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
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
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
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
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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

create or replace function public.get_my_earnchat_state()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
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

create or replace function public.evaluate_earnchat_level(p_user uuid default auth.uid())
returns text language plpgsql security definer set search_path=public,pg_temp as $$
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
   and (l.kyc_requirement='none' or(l.kyc_requirement='submitted' and p.kyc_status in('submitted','under_review','approved'))or(l.kyc_requirement='approved' and p.kyc_status='approved'))
   and (l.qualification_mission is null or(l.qualification_mission='pro' and p.pro_mission_status='approved')or(l.qualification_mission='elite' and p.elite_mission_status='approved'))
   and not p.security_review_required and p.fraud_review_status='clear' and not p.earning_suspended then chosen:=l.level_name;
  end if;
 end loop;
 update public.profiles set level_name=chosen,updated_at=now() where id=p_user;
 return chosen;
end$$;

create or replace function public.mark_earnchat_active_day(p_user uuid default auth.uid())
returns void language plpgsql security definer set search_path=public,pg_temp as $$
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
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare curr text:=case when p_country='KE' then 'KES' else 'NGN' end;cap bigint;earned bigint;inserted uuid;referral public.earnchat_referrals%rowtype;rate numeric;commission bigint;ref_country text;
begin
 if p_amount<=0 or p_wallet not in('work','referral') then raise exception 'Invalid credit'; end if;
 if p_wallet='work' then
  select public.earnchat_country_amount(daily_cap_ngn,p_country) into cap from public.earnchat_business_settings where id=true;
  select coalesce(sum(amount),0) into earned from public.earnchat_ledger where user_id=p_user and wallet_type='work' and entry_type='credit' and status='approved' and source_type in('chat','task') and created_at::date=current_date;
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
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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

create or replace function public.admin_review_earnchat_kyc(p_submission uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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

create or replace function public.admin_update_earnchat_level(p_level text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
 if not found then raise exception 'Unknown level'; end if;
 if exists(select 1 from public.earnchat_level_settings where points_required<0 or referral_commission_percent not between 1 and 7) then raise exception 'Invalid points or commission value'; end if;
 return(select to_jsonb(l) from public.earnchat_level_settings l where level_name=p_level);
end$$;

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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

create or replace function public.get_my_open_chat_attempt()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.earnchat_chat_attempts%rowtype;
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,'required_replies',4,'minimum_seconds',45);
end$$;

create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
 credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided chat');
 update public.earnchat_chat_attempts set status='completed',completed_at=now() where id=a.id;
 perform public.mark_earnchat_active_day(uid);
 return jsonb_build_object('ok',true,'session_id',sid,'amount',credited,'currency',p.currency,'remaining',l.chat_limit-cnt-1,'minimum_seconds',45);
end$$;

create or replace function public.admin_get_earnchat_overview()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 return jsonb_build_object(
  'total_users',(select count(*) from public.profiles),
  'online_now',(select count(distinct coalesce(user_id::text,visitor_id,session_id)) from public.earnchat_site_presence where is_visible and last_seen>now()-interval '90 seconds'),
  'pending_tasks',(select count(*) from public.earnchat_task_claims where status='pending'),
  'pending_withdrawals',(select count(*) from public.earnchat_withdrawals where status in('submitted','under_review','approved','processing')),
  'pending_kyc',(select count(*) from public.earnchat_kyc_submissions where status in('submitted','under_review')),
  'suspicious_accounts',(select count(*) from public.profiles where security_review_required or earning_suspended or coalesce(fraud_review_status,'clear')<>'clear'),
  'work_liability_ngn',(select coalesce(sum(work_available_balance+work_pending_balance),0) from public.profiles where country='NG'),
  'referral_liability_ngn',(select coalesce(sum(referral_available_balance+referral_pending_balance),0) from public.profiles where country='NG'),
  'work_liability_kes',(select coalesce(sum(work_available_balance+work_pending_balance),0) from public.profiles where country='KE'),
  'referral_liability_kes',(select coalesce(sum(referral_available_balance+referral_pending_balance),0) from public.profiles where country='KE')
 );
end$$;

-- Backfill idempotent bonus and point history for existing members.
do $$declare r record;begin for r in select id from public.profiles loop perform public.earnchat_grant_signup_bonus(r.id);end loop;end$$;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description,created_at)
select user_id,'chat',id::text,2,'Approved guided conversation',coalesce(completed_at,created_at) from public.earnchat_chat_sessions where status='approved'
on conflict(user_id,source_type,source_key) do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description,created_at)
select user_id,'task',id::text,3,'Approved task',coalesce(reviewed_at,submitted_at,created_at) from public.earnchat_task_claims where status='approved'
on conflict(user_id,source_type,source_key) do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description,created_at)
select user_id,'active_day',activity_date::text,5,'Qualifying active day',created_at from public.earnchat_active_days
on conflict(user_id,source_type,source_key) do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description,created_at)
select user_id,'kyc',id::text,10,'Approved identity verification',coalesce(reviewed_at,created_at) from public.earnchat_kyc_submissions where status='approved'
on conflict(user_id,source_type,source_key) do nothing;
insert into public.earnchat_point_events(user_id,source_type,source_key,points,description,created_at)
select referrer_id,'qualified_referral',id::text,10,'Qualified direct referral',coalesce(qualification_at,created_at) from public.earnchat_referrals where status='qualified'
on conflict(user_id,source_type,source_key) do nothing;
update public.profiles p set activity_points=coalesce((select sum(e.points) from public.earnchat_point_events e where e.user_id=p.id),0),updated_at=now();
do $$declare r record;begin for r in select id from public.profiles loop perform public.evaluate_earnchat_level(r.id);end loop;end$$;

revoke all on function public.earnchat_award_points(uuid,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.earnchat_grant_signup_bonus(uuid) from public,anon,authenticated;
revoke all on function public.mark_earnchat_active_day(uuid) from public,anon,authenticated;
revoke all on function public.evaluate_earnchat_level(uuid) from public,anon,authenticated;
revoke all on function public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.ensure_earnchat_profile(text,text) to authenticated;
grant execute on function public.get_my_earnchat_state() to authenticated;
grant execute on function public.start_earnchat_chat(text) to authenticated;
grant execute on function public.get_my_open_chat_attempt() to authenticated;
grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.admin_review_earnchat_referral(uuid,text,text) to authenticated;
grant execute on function public.admin_review_earnchat_kyc(uuid,text,text) to authenticated;
grant execute on function public.admin_update_earnchat_level(text,jsonb) to authenticated;
grant execute on function public.admin_get_earnchat_overview() to authenticated;

commit;
select 'Earn Chat production-complete bonus, points, commissions, 45-second chat and Admin overview upgrade completed' as result;
-- ============================================================================
-- END 2: supabase/earnchat_level_chat_upgrade_20260731.sql
-- ============================================================================

-- ============================================================================
-- BEGIN 3: supabase/earnchat_configuration_control_upgrade_20260801.sql
-- ============================================================================
-- Earn Chat authoritative Admin configuration upgrade
-- Idempotent. Review and run in Supabase SQL Editor after taking a database backup.
begin;

alter table public.earnchat_business_settings add column if not exists configuration_version bigint not null default 1;
alter table public.earnchat_business_settings add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.earnchat_business_settings add column if not exists general_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists landing_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists chat_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists task_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists referral_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists withdrawal_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists kyc_config jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists feature_flags jsonb not null default '{}'::jsonb;
alter table public.earnchat_business_settings add column if not exists customer_copy jsonb not null default '{}'::jsonb;

update public.earnchat_business_settings
set
 configuration_version=greatest(coalesce(configuration_version,1),1),
 general_config=coalesce(general_config,'{}'::jsonb),
 landing_config=coalesce(landing_config,'{}'::jsonb),
 chat_config=coalesce(chat_config,'{}'::jsonb),
 task_config=coalesce(task_config,'{}'::jsonb),
 referral_config=coalesce(referral_config,'{}'::jsonb),
 withdrawal_config=coalesce(withdrawal_config,'{}'::jsonb),
 kyc_config=coalesce(kyc_config,'{}'::jsonb),
 feature_flags=coalesce(feature_flags,'{}'::jsonb),
 customer_copy=coalesce(customer_copy,'{}'::jsonb)
where id=true;

create or replace function public.earnchat_assert_admin()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
 if auth.uid() is null or not exists(
  select 1 from public.profiles p where p.id=auth.uid() and coalesce(p.is_admin,false)
 ) then
  raise exception 'Administrator permission required' using errcode='42501';
 end if;
end;
$$;

create or replace function public.earnchat_validate_https_or_empty(value text, field_name text)
returns text
language plpgsql
immutable
as $$
declare cleaned text:=trim(coalesce(value,''));
begin
 if cleaned='' then return ''; end if;
 if cleaned !~* '^https://[^[:space:]]+$' then
  raise exception '% must be a complete HTTPS URL', field_name using errcode='22023';
 end if;
 return cleaned;
end;
$$;

create or replace function public.earnchat_validate_known_keys(payload jsonb, allowed text[], section_name text)
returns void
language plpgsql
immutable
as $$
declare key text;
begin
 if payload is null then return; end if;
 if jsonb_typeof(payload)<>'object' then
  raise exception '% configuration must be an object',section_name using errcode='22023';
 end if;
 for key in select jsonb_object_keys(payload) loop
  if not key=any(allowed) then
   raise exception 'Unknown % configuration field: %',section_name,key using errcode='22023';
  end if;
 end loop;
end;
$$;

create or replace function public.earnchat_validate_configuration_section(section_name text,payload jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare result jsonb:=coalesce(payload,'{}'::jsonb); seconds int; replies int; reply_length int; countries jsonb;
begin
 case section_name
 when 'general' then
  perform public.earnchat_validate_known_keys(result,array['platform_name','production_origin','support_email','maintenance_mode','maintenance_message','registration_enabled','enabled_countries','default_country','terms_url','privacy_url','support_url'],'general');
  if result ? 'production_origin' then result:=jsonb_set(result,'{production_origin}',to_jsonb(public.earnchat_validate_https_or_empty(result->>'production_origin','Production origin'))); end if;
  if result ? 'terms_url' then result:=jsonb_set(result,'{terms_url}',to_jsonb(public.earnchat_validate_https_or_empty(result->>'terms_url','Terms URL'))); end if;
  if result ? 'privacy_url' then result:=jsonb_set(result,'{privacy_url}',to_jsonb(public.earnchat_validate_https_or_empty(result->>'privacy_url','Privacy URL'))); end if;
  if result ? 'support_url' then result:=jsonb_set(result,'{support_url}',to_jsonb(public.earnchat_validate_https_or_empty(result->>'support_url','Support URL'))); end if;
  if result ? 'default_country' and result->>'default_country' not in('NG','KE') then raise exception 'Default country must be NG or KE' using errcode='22023'; end if;
  if result ? 'enabled_countries' then
   countries:=result->'enabled_countries';
   if jsonb_typeof(countries)<>'array' or jsonb_array_length(countries)=0 or exists(select 1 from jsonb_array_elements_text(countries) c where c not in('NG','KE')) then
    raise exception 'Enabled countries must contain only NG and KE' using errcode='22023';
   end if;
  end if;
 when 'landing' then
  perform public.earnchat_validate_known_keys(result,array['headline','subheadline','cta_label','social_proof_enabled','verified_payments_enabled','member_feedback_enabled','country_copy'],'landing');
 when 'chat' then
  perform public.earnchat_validate_known_keys(result,array['enabled','minimum_seconds','required_replies','minimum_reply_length','attempt_expiry_minutes','recovery_expiry_minutes','activity_points','completion_wording','pending_wording','prompt_sets','partners'],'chat');
  seconds:=coalesce((result->>'minimum_seconds')::int,45); replies:=coalesce((result->>'required_replies')::int,4); reply_length:=coalesce((result->>'minimum_reply_length')::int,12);
  if seconds<30 or seconds>900 then raise exception 'Chat minimum seconds must be between 30 and 900' using errcode='22023'; end if;
  if replies<1 or replies>10 then raise exception 'Chat required replies must be between 1 and 10' using errcode='22023'; end if;
  if reply_length<1 or reply_length>500 then raise exception 'Chat minimum reply length must be between 1 and 500' using errcode='22023'; end if;
  if result ? 'prompt_sets' and jsonb_typeof(result->'prompt_sets')<>'array' then raise exception 'Chat prompt sets must be an array' using errcode='22023'; end if;
  if result ? 'partners' and jsonb_typeof(result->'partners')<>'array' then raise exception 'Chat partners must be an array' using errcode='22023'; end if;
 when 'tasks' then
  perform public.earnchat_validate_known_keys(result,array['enabled','visits_enabled','default_attempt_expiry_minutes','incomplete_attempt_policy','restart_required_message','pending_review_message','approved_message','rejected_message','show_status_filters','featured_task_limit'],'tasks');
  if result ? 'incomplete_attempt_policy' and result->>'incomplete_attempt_policy' not in('restart','resume') then raise exception 'Task incomplete policy must be restart or resume' using errcode='22023'; end if;
 when 'referrals' then
  perform public.earnchat_validate_known_keys(result,array['enabled','fixed_reward_ngn','required_active_days','referrer_account_days','direct_referral_only','sharing_copy','qualification_explanation','automatic_review_enabled','fraud_review_threshold'],'referrals');
  if result ? 'direct_referral_only' and coalesce((result->>'direct_referral_only')::boolean,true)=false then raise exception 'Earn Chat supports direct referrals only' using errcode='22023'; end if;
 when 'withdrawals' then
  perform public.earnchat_validate_known_keys(result,array['enabled','maintenance_message','maximum_open_requests','referral_minimum_ngn','review_hours','bank_transfer_enabled','mpesa_enabled','instructions_ng','instructions_ke'],'withdrawals');
 when 'kyc' then
  perform public.earnchat_validate_known_keys(result,array['enabled','provider_ng','provider_ke','provider_url_ng','provider_url_ke','instructions_ng','instructions_ke','reference_required','review_hours','maintenance_message','submitted_status_message','under_review_status_message','approved_status_message','rejected_status_message'],'kyc');
  if result ? 'provider_url_ng' then result:=jsonb_set(result,'{provider_url_ng}',to_jsonb(public.earnchat_validate_https_or_empty(result->>'provider_url_ng','Nigeria KYC provider URL'))); end if;
  if result ? 'provider_url_ke' then result:=jsonb_set(result,'{provider_url_ke}',to_jsonb(public.earnchat_validate_https_or_empty(result->>'provider_url_ke','Kenya KYC provider URL'))); end if;
 when 'feature_flags' then
  perform public.earnchat_validate_known_keys(result,array['guided_chat','tasks','sponsored_visits','referrals','withdrawals','qualifications','social_proof','member_feedback','kyc','upgrade','admin_analytics','public_registration'],'feature flags');
 else
  raise exception 'Unsupported configuration section: %',section_name using errcode='22023';
 end case;
 return result;
exception when invalid_text_representation then
 raise exception 'Configuration field has an invalid number or boolean value' using errcode='22023';
end;
$$;

create or replace function public.get_earnchat_business_config()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
 select jsonb_build_object(
  'version',coalesce(s.version,'unknown'),
  'configuration_version',coalesce(s.configuration_version,1),
  'updated_at',s.updated_at,
  'settings',to_jsonb(s)-'updated_by',
  'general',coalesce(s.general_config,'{}'::jsonb),
  'landing',coalesce(s.landing_config,'{}'::jsonb),
  'chat',coalesce(s.chat_config,'{}'::jsonb),
  'tasks',coalesce(s.task_config,'{}'::jsonb),
  'referrals',coalesce(s.referral_config,'{}'::jsonb),
  'withdrawals',coalesce(s.withdrawal_config,'{}'::jsonb),
  'kyc',coalesce(s.kyc_config,'{}'::jsonb),
  'feature_flags',coalesce(s.feature_flags,'{}'::jsonb),
  'customer_copy',coalesce(s.customer_copy,'{}'::jsonb),
  'levels',coalesce((select jsonb_object_agg(l.level_name,to_jsonb(l)) from public.earnchat_level_settings l),'{}'::jsonb)
 )
 from public.earnchat_business_settings s where s.id=true;
$$;

create or replace function public.admin_update_earnchat_configuration(p_section text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare clean jsonb; before_value jsonb; after_value jsonb; column_name text; new_version bigint;
begin
 perform public.earnchat_assert_admin();
 clean:=public.earnchat_validate_configuration_section(p_section,coalesce(p_payload,'{}'::jsonb));
 column_name:=case p_section when 'general' then 'general_config' when 'landing' then 'landing_config' when 'chat' then 'chat_config' when 'tasks' then 'task_config' when 'referrals' then 'referral_config' when 'withdrawals' then 'withdrawal_config' when 'kyc' then 'kyc_config' when 'feature_flags' then 'feature_flags' else null end;
 if column_name is null then raise exception 'Unsupported configuration section: %',p_section using errcode='22023'; end if;
 execute format('select coalesce(%I,''{}''::jsonb) from public.earnchat_business_settings where id=true',column_name) into before_value;
 after_value:=coalesce(before_value,'{}'::jsonb)||clean;
 execute format('update public.earnchat_business_settings set %I=$1,configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid() where id=true returning configuration_version',column_name) using after_value into new_version;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details)
 values(auth.uid(),'configuration_updated','business_configuration',null,jsonb_build_object('section',p_section,'before',before_value,'after',after_value,'configuration_version',new_version));
 return public.get_earnchat_business_config();
end;
$$;

create or replace function public.admin_update_earnchat_business_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare allowed text[]:=array['signup_bonus_ngn','nigeria_multiplier','kenya_multiplier','daily_cap_ngn','referral_reward_ngn','referral_withdraw_min_ngn','referral_required_active_days','referrer_account_days','presence_online_seconds','presence_heartbeat_seconds']; key text; old_row jsonb; new_version bigint;
begin
 perform public.earnchat_assert_admin();
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Business settings payload must be an object' using errcode='22023'; end if;
 for key in select jsonb_object_keys(p_payload) loop if not key=any(allowed) then raise exception 'Unknown business setting: %',key using errcode='22023'; end if; end loop;
 select to_jsonb(s) into old_row from public.earnchat_business_settings s where id=true;
 update public.earnchat_business_settings set
  signup_bonus_ngn=case when p_payload?'signup_bonus_ngn' then greatest(0,(p_payload->>'signup_bonus_ngn')::bigint) else signup_bonus_ngn end,
  nigeria_multiplier=case when p_payload?'nigeria_multiplier' then greatest(.01,(p_payload->>'nigeria_multiplier')::numeric) else nigeria_multiplier end,
  kenya_multiplier=case when p_payload?'kenya_multiplier' then greatest(.01,(p_payload->>'kenya_multiplier')::numeric) else kenya_multiplier end,
  daily_cap_ngn=case when p_payload?'daily_cap_ngn' then greatest(0,(p_payload->>'daily_cap_ngn')::bigint) else daily_cap_ngn end,
  referral_reward_ngn=case when p_payload?'referral_reward_ngn' then greatest(0,(p_payload->>'referral_reward_ngn')::bigint) else referral_reward_ngn end,
  referral_withdraw_min_ngn=case when p_payload?'referral_withdraw_min_ngn' then greatest(0,(p_payload->>'referral_withdraw_min_ngn')::bigint) else referral_withdraw_min_ngn end,
  referral_required_active_days=case when p_payload?'referral_required_active_days' then greatest(0,(p_payload->>'referral_required_active_days')::int) else referral_required_active_days end,
  referrer_account_days=case when p_payload?'referrer_account_days' then greatest(0,(p_payload->>'referrer_account_days')::int) else referrer_account_days end,
  presence_online_seconds=case when p_payload?'presence_online_seconds' then greatest(30,(p_payload->>'presence_online_seconds')::int) else presence_online_seconds end,
  presence_heartbeat_seconds=case when p_payload?'presence_heartbeat_seconds' then greatest(15,(p_payload->>'presence_heartbeat_seconds')::int) else presence_heartbeat_seconds end,
  configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid()
 where id=true returning configuration_version into new_version;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details)
 values(auth.uid(),'business_settings_updated','business_configuration',null,jsonb_build_object('before',old_row,'payload',p_payload,'configuration_version',new_version));
 return public.get_earnchat_business_config();
exception when invalid_text_representation then raise exception 'Business setting has an invalid numeric value' using errcode='22023';
end;
$$;

revoke all on function public.earnchat_assert_admin() from public;
revoke all on function public.admin_update_earnchat_configuration(text,jsonb) from public;
revoke all on function public.admin_update_earnchat_business_settings(jsonb) from public;
grant execute on function public.get_earnchat_business_config() to anon,authenticated;
grant execute on function public.admin_update_earnchat_configuration(text,jsonb) to authenticated;
grant execute on function public.admin_update_earnchat_business_settings(jsonb) to authenticated;

commit;
-- ============================================================================
-- END 3: supabase/earnchat_configuration_control_upgrade_20260801.sql
-- ============================================================================

-- ============================================================================
-- BEGIN 4: supabase/earnchat_dynamic_chat_contract_20260801.sql
-- ============================================================================
-- Earn Chat dynamic guided-chat contract
-- Run after earnchat_configuration_control_upgrade_20260801.sql.
-- Idempotent. Back up the database before applying production migrations.
begin;

create or replace function public.earnchat_chat_contract()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
 select jsonb_build_object(
  'enabled',coalesce((s.chat_config->>'enabled')::boolean,true),
  'minimum_seconds',greatest(30,least(900,coalesce((s.chat_config->>'minimum_seconds')::int,45))),
  'required_replies',greatest(1,least(10,coalesce((s.chat_config->>'required_replies')::int,4))),
  'minimum_reply_length',greatest(1,least(500,coalesce((s.chat_config->>'minimum_reply_length')::int,12))),
  'attempt_expiry_minutes',greatest(5,least(1440,coalesce((s.chat_config->>'attempt_expiry_minutes')::int,30))),
  'activity_points',greatest(0,least(1000,coalesce((s.chat_config->>'activity_points')::int,2)))
 )
 from public.earnchat_business_settings s where s.id=true;
$$;

create or replace function public.earnchat_reconcile_points(
 p_user uuid,
 p_source_type text,
 p_source_key text,
 p_points integer,
 p_description text default null
)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare current_points integer:=0;difference integer:=0;event_id uuid;
begin
 if p_user is null or nullif(trim(p_source_type),'') is null or nullif(trim(p_source_key),'') is null then return 0; end if;
 p_points:=greatest(0,coalesce(p_points,0));
 select id,points into event_id,current_points
 from public.earnchat_point_events
 where user_id=p_user and source_type=trim(p_source_type) and source_key=trim(p_source_key)
 for update;
 if event_id is null then
  if p_points=0 then return 0; end if;
  insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
  values(p_user,trim(p_source_type),trim(p_source_key),p_points,p_description)
  returning id into event_id;
  difference:=p_points;
 else
  difference:=p_points-current_points;
  update public.earnchat_point_events
  set points=p_points,description=coalesce(p_description,description)
  where id=event_id;
 end if;
 if difference<>0 then
  update public.profiles set activity_points=greatest(0,activity_points+difference),updated_at=now() where id=p_user;
 end if;
 return p_points;
end$$;

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 cnt int;
 aid uuid;
 started timestamptz;
 expires timestamptz;
 contract jsonb:=public.earnchat_chat_contract();
 expiry_minutes int;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if coalesce((contract->>'enabled')::boolean,true)=false then raise exception 'Guided Chat is temporarily unavailable'; end if;
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 update public.earnchat_chat_attempts set status='expired' where user_id=uid and status='started' and expires_at<=now();
 if exists(select 1 from public.earnchat_chat_attempts where user_id=uid and status='started' and expires_at>now()) then raise exception 'Finish your current guided chat first'; end if;
 expiry_minutes:=coalesce((contract->>'attempt_expiry_minutes')::int,30);
 insert into public.earnchat_chat_attempts(user_id,partner_key,expires_at)
 values(uid,nullif(trim(p_partner),''),now()+make_interval(mins=>expiry_minutes))
 returning id,started_at,expires_at into aid,started,expires;
 return jsonb_build_object(
  'attempt_id',aid,'partner',p_partner,'started_at',started,'expires_at',expires,
  'required_replies',(contract->>'required_replies')::int,
  'minimum_seconds',(contract->>'minimum_seconds')::int,
  'minimum_reply_length',(contract->>'minimum_reply_length')::int,
  'daily_limit',l.chat_limit,'remaining',l.chat_limit-cnt
 );
end$$;

create or replace function public.get_my_open_chat_attempt()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.earnchat_chat_attempts%rowtype;contract jsonb:=public.earnchat_chat_contract();
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object(
  'attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,
  'required_replies',(contract->>'required_replies')::int,
  'minimum_seconds',(contract->>'minimum_seconds')::int,
  'minimum_reply_length',(contract->>'minimum_reply_length')::int
 );
end$$;

create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 a public.earnchat_chat_attempts%rowtype;
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 cnt int;
 reward bigint;
 sid uuid;
 credited bigint;
 distinct_count int;
 short_count int;
 contract jsonb:=public.earnchat_chat_contract();
 required_replies int;
 minimum_seconds int;
 minimum_reply_length int;
 configured_points int;
 duration_seconds int;
begin
 required_replies:=(contract->>'required_replies')::int;
 minimum_seconds:=(contract->>'minimum_seconds')::int;
 minimum_reply_length:=(contract->>'minimum_reply_length')::int;
 configured_points:=(contract->>'activity_points')::int;
 if coalesce((contract->>'enabled')::boolean,true)=false then raise exception 'Guided Chat is temporarily unavailable'; end if;
 select * into a from public.earnchat_chat_attempts where id=p_attempt and user_id=uid for update;
 if not found or a.status<>'started' or a.expires_at<now() then raise exception 'Chat attempt unavailable'; end if;
 if jsonb_typeof(p_replies)<>'array' or jsonb_array_length(p_replies)<>required_replies then
  raise exception '% replies are required',required_replies;
 end if;
 select count(distinct lower(trim(value))),count(*) filter(where length(trim(value))<minimum_reply_length)
 into distinct_count,short_count from jsonb_array_elements_text(p_replies);
 if distinct_count<required_replies or short_count>0 then
  raise exception 'Use % different replies of at least % characters',required_replies,minimum_reply_length;
 end if;
 duration_seconds:=floor(extract(epoch from(now()-a.started_at)))::int;
 if duration_seconds<minimum_seconds then raise exception 'Complete the % second guided conversation',minimum_seconds; end if;
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);
 insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags)
 values(uid,p.level_name,required_replies,duration_seconds,'approved',reward,p.currency,p.country,jsonb_build_object(
  'reply_hashes',(select jsonb_agg(md5(lower(trim(value)))) from jsonb_array_elements_text(p_replies)),
  'client',coalesce(p_quality,'{}'::jsonb),
  'contract',contract
 )) returning id into sid;
 credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided chat');
 perform public.earnchat_reconcile_points(uid,'chat',sid::text,configured_points,'Approved guided conversation');
 update public.earnchat_chat_attempts set status='completed',completed_at=now() where id=a.id;
 perform public.mark_earnchat_active_day(uid);
 return jsonb_build_object(
  'ok',true,'session_id',sid,'amount',credited,'currency',p.currency,
  'remaining',l.chat_limit-cnt-1,'minimum_seconds',minimum_seconds,
  'required_replies',required_replies,'minimum_reply_length',minimum_reply_length,
  'activity_points',configured_points
 );
end$$;

revoke all on function public.earnchat_chat_contract() from public;
revoke all on function public.earnchat_reconcile_points(uuid,text,text,integer,text) from public;
grant execute on function public.start_earnchat_chat(text) to authenticated;
grant execute on function public.get_my_open_chat_attempt() to authenticated;
grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;

commit;
-- ============================================================================
-- END 4: supabase/earnchat_dynamic_chat_contract_20260801.sql
-- ============================================================================

-- ============================================================================
-- BEGIN 5: supabase/earnchat_task_restart_contract_20260801.sql
-- ============================================================================
-- Earn Chat task restart contract
-- Run after the configuration-control upgrade.
-- Idempotent. Back up the database before applying production migrations.
begin;

create or replace function public.cancel_earnchat_task_claim(p_claim uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare c public.earnchat_task_claims%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into c from public.earnchat_task_claims where id=p_claim and user_id=auth.uid() for update;
 if not found then raise exception 'Task attempt not found'; end if;
 if c.status<>'started' then raise exception 'Only an incomplete task can be restarted'; end if;
 update public.earnchat_task_claims
 set status='expired',review_reason='Restarted by member',returned_at=coalesce(returned_at,now())
 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',c.id,'status','expired');
end$$;

revoke all on function public.cancel_earnchat_task_claim(uuid) from public,anon;
grant execute on function public.cancel_earnchat_task_claim(uuid) to authenticated;

commit;
-- ============================================================================
-- END 5: supabase/earnchat_task_restart_contract_20260801.sql
-- ============================================================================

-- ============================================================================
-- BEGIN 6: supabase/earnchat_dynamic_operations_contract_20260801.sql
-- ============================================================================
-- Earn Chat dynamic withdrawal and KYC contracts
-- Run after earnchat_configuration_control_upgrade_20260801.sql.
-- Idempotent. Back up the database before applying production migrations.
begin;

create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 settings public.earnchat_business_settings%rowtype;
 cfg jsonb;
 mn bigint;
 mx bigint;
 available bigint;
 wid uuid;
 max_open int;
 open_count int;
 enabled boolean;
 bank_enabled boolean;
 mpesa_enabled boolean;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into settings from public.earnchat_business_settings where id=true;
 cfg:=coalesce(settings.withdrawal_config,'{}'::jsonb);
 enabled:=coalesce((cfg->>'enabled')::boolean,true);
 bank_enabled:=coalesce((cfg->>'bank_transfer_enabled')::boolean,true);
 mpesa_enabled:=coalesce((cfg->>'mpesa_enabled')::boolean,true);
 max_open:=greatest(1,least(10,coalesce((cfg->>'maximum_open_requests')::int,1)));
 if not enabled then raise exception '%',coalesce(nullif(cfg->>'maintenance_message',''),'Withdrawals are temporarily unavailable'); end if;

 select * into p from public.profiles where id=uid for update;
 if not found then raise exception 'Profile unavailable'; end if;
 if current_date-p.account_created_at::date<5 or p.kyc_status<>'approved' or p.security_review_required or p.earning_suspended then
  raise exception 'Withdrawal eligibility requirements are not complete';
 end if;
 if p_method='bank' and not bank_enabled then raise exception 'Bank transfer is temporarily unavailable'; end if;
 if p_method='mpesa' and not mpesa_enabled then raise exception 'M-Pesa is temporarily unavailable'; end if;
 if p.country='KE' and p_method not in('mpesa','bank') then raise exception 'Choose an available Kenyan payout method'; end if;
 if p.country='NG' and p_method<>'bank' then raise exception 'Choose bank transfer'; end if;

 select count(*) into open_count from public.earnchat_withdrawals
 where user_id=uid and status in('submitted','under_review','approved','processing');
 if open_count>=max_open then raise exception 'You already have the maximum number of open withdrawal requests'; end if;

 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 if p_wallet='referral' then
  mn:=public.earnchat_country_amount(coalesce((cfg->>'referral_minimum_ngn')::bigint,settings.referral_withdraw_min_ngn,40000),p.country);
  mx:=9223372036854775807;
  available:=p.referral_available_balance;
 elsif p_wallet='work' then
  mn:=public.earnchat_country_amount(l.withdraw_min_ngn,p.country);
  mx:=public.earnchat_country_amount(l.withdraw_max_ngn,p.country);
  available:=p.work_available_balance;
 else
  raise exception 'Invalid wallet';
 end if;
 if p_amount<mn or p_amount>mx or p_amount>available then raise exception 'Withdrawal amount is outside the allowed range'; end if;
 if coalesce(jsonb_typeof(p_payout),'null')<>'object' then raise exception 'Payout details are invalid'; end if;
 if nullif(trim(coalesce(p_payout->>'account_name','')),'') is null then raise exception 'Account name is required'; end if;
 if nullif(trim(coalesce(p_payout->>'account_number','')),'') is null then raise exception 'Account number is required'; end if;

 insert into public.earnchat_withdrawals(user_id,wallet_type,amount,currency,country_code,payout_method,payout_snapshot)
 values(uid,p_wallet,p_amount,p.currency,p.country,p_method,p_payout) returning id into wid;
 if p_wallet='work' then
  update public.profiles set work_available_balance=work_available_balance-p_amount,updated_at=now() where id=uid;
 else
  update public.profiles set referral_available_balance=referral_available_balance-p_amount,updated_at=now() where id=uid;
 end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description)
 values(uid,p_wallet,'hold','withdrawal',wid,p_amount,p.currency,p.country,'approved','Withdrawal request hold');
 return jsonb_build_object('ok',true,'withdrawal_id',wid,'status','submitted','review_hours',coalesce((cfg->>'review_hours')::int,48));
end$$;

create or replace function public.submit_earnchat_kyc(p_reference text default null,p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 settings public.earnchat_business_settings%rowtype;
 cfg jsonb;
 enabled boolean;
 reference_required boolean;
 kid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into settings from public.earnchat_business_settings where id=true;
 cfg:=coalesce(settings.kyc_config,'{}'::jsonb);
 enabled:=coalesce((cfg->>'enabled')::boolean,true);
 reference_required:=coalesce((cfg->>'reference_required')::boolean,true);
 if not enabled then raise exception '%',coalesce(nullif(cfg->>'maintenance_message',''),'Identity verification is temporarily unavailable'); end if;
 if reference_required and nullif(trim(coalesce(p_reference,'')),'') is null then raise exception 'Verification reference is required'; end if;
 if exists(select 1 from public.earnchat_kyc_submissions where user_id=uid and status in('submitted','under_review')) then
  raise exception 'A verification submission is already under review';
 end if;
 insert into public.earnchat_kyc_submissions(user_id,provider_reference,metadata)
 values(uid,nullif(trim(p_reference),''),coalesce(p_metadata,'{}'::jsonb)) returning id into kid;
 update public.profiles set kyc_status='submitted',updated_at=now() where id=uid;
 return jsonb_build_object('ok',true,'submission_id',kid,'status','submitted','review_hours',coalesce((cfg->>'review_hours')::int,48));
end$$;

grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated;
grant execute on function public.submit_earnchat_kyc(text,jsonb) to authenticated;

commit;
-- ============================================================================
-- END 6: supabase/earnchat_dynamic_operations_contract_20260801.sql
-- ============================================================================
