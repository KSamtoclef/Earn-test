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
