-- Earn Chat coordinated economy migration
-- Review in a staging Supabase project before production execution.
begin;
create extension if not exists pgcrypto;

create table if not exists public.earnchat_business_settings (
 id boolean primary key default true check (id),version text not null default '2026-07-30-economy-1',
 nigeria_multiplier numeric(8,4) not null default 1,kenya_multiplier numeric(8,4) not null default 0.6,
 daily_cap_ngn bigint not null default 20000,referral_reward_ngn bigint not null default 2000,
 referral_withdraw_min_ngn bigint not null default 40000,referral_required_active_days int not null default 2,
 referrer_account_days int not null default 5,updated_at timestamptz not null default now());
insert into public.earnchat_business_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.earnchat_level_settings (
 level_name text primary key check(level_name in('Starter','Active','Pro','Elite')),rank int not null unique,
 chat_limit int not null,chat_reward_ngn bigint not null,task_min_ngn bigint not null,task_max_ngn bigint not null,
 withdraw_min_ngn bigint not null,withdraw_max_ngn bigint not null,account_days int not null default 0,
 active_days int not null default 0,approved_chats int not null default 0,approved_tasks int not null default 0,
 kyc_requirement text not null default 'none',qualification_mission text,updated_at timestamptz not null default now());
insert into public.earnchat_level_settings(level_name,rank,chat_limit,chat_reward_ngn,task_min_ngn,task_max_ngn,withdraw_min_ngn,withdraw_max_ngn,account_days,active_days,approved_chats,approved_tasks,kyc_requirement,qualification_mission) values
('Starter',0,4,250,100,500,40000,120000,0,0,0,0,'none',null),
('Active',1,6,300,200,700,40000,180000,5,3,12,15,'submitted',null),
('Pro',2,8,500,500,1500,50000,300000,10,7,25,35,'approved','pro'),
('Elite',3,10,700,700,3000,60000,500000,20,15,50,80,'approved','elite')
on conflict(level_name) do update set rank=excluded.rank,chat_limit=excluded.chat_limit,chat_reward_ngn=excluded.chat_reward_ngn,
 task_min_ngn=excluded.task_min_ngn,task_max_ngn=excluded.task_max_ngn,withdraw_min_ngn=excluded.withdraw_min_ngn,
 withdraw_max_ngn=excluded.withdraw_max_ngn,account_days=excluded.account_days,active_days=excluded.active_days,
 approved_chats=excluded.approved_chats,approved_tasks=excluded.approved_tasks,kyc_requirement=excluded.kyc_requirement,
 qualification_mission=excluded.qualification_mission,updated_at=now();

alter table if exists public.profiles add column if not exists level_name text default 'Starter';
alter table if exists public.profiles add column if not exists account_created_at timestamptz default now();
alter table if exists public.profiles add column if not exists active_days_count int default 0;
alter table if exists public.profiles add column if not exists approved_chats_count int default 0;
alter table if exists public.profiles add column if not exists approved_tasks_count int default 0;
alter table if exists public.profiles add column if not exists work_available_balance bigint default 0;
alter table if exists public.profiles add column if not exists work_pending_balance bigint default 0;
alter table if exists public.profiles add column if not exists referral_available_balance bigint default 0;
alter table if exists public.profiles add column if not exists referral_pending_balance bigint default 0;
alter table if exists public.profiles add column if not exists total_withdrawn bigint default 0;
alter table if exists public.profiles add column if not exists payout_method text;
alter table if exists public.profiles add column if not exists payout_details jsonb default '{}'::jsonb;
alter table if exists public.profiles add column if not exists security_review_required boolean default false;
alter table if exists public.profiles add column if not exists pro_mission_status text default 'not_started';
alter table if exists public.profiles add column if not exists elite_mission_status text default 'not_started';

create table if not exists public.earnchat_active_days(user_id uuid not null references auth.users(id) on delete cascade,activity_date date not null,qualifying_actions int not null default 0,created_at timestamptz not null default now(),primary key(user_id,activity_date));
create table if not exists public.earnchat_tasks(id uuid primary key default gen_random_uuid(),title text not null,description text not null default '',external_url text not null check(external_url~'^https?://'),provider_name text,country_code text not null default 'ALL' check(country_code in('ALL','NG','KE')),base_reward_ngn bigint not null check(base_reward_ngn>0),required_level text not null default 'Starter' references public.earnchat_level_settings(level_name),required_seconds int not null default 0 check(required_seconds>=0),daily_claim_limit int not null default 1 check(daily_claim_limit>0),total_claim_limit int,approval_type text not null default 'pending' check(approval_type in('instant','pending','partner')),proof_required boolean not null default false,instructions text not null default '',starts_at timestamptz,ends_at timestamptz,status text not null default 'active' check(status in('active','paused','ended')),created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.earnchat_task_claims(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.earnchat_tasks(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,started_at timestamptz not null default now(),returned_at timestamptz,submitted_at timestamptz,status text not null default 'started' check(status in('started','submitted','pending','approved','rejected','reversed')),reward_amount bigint not null default 0,currency text not null,country_code text not null check(country_code in('NG','KE')),proof jsonb default '{}'::jsonb,review_reason text,reviewed_by uuid references auth.users(id),reviewed_at timestamptz,created_at timestamptz not null default now());
create index if not exists earnchat_task_claim_lookup on public.earnchat_task_claims(task_id,user_id,started_at);
create table if not exists public.earnchat_chat_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,session_date date not null default current_date,level_name text not null references public.earnchat_level_settings(level_name),message_count int not null default 0,duration_seconds int not null default 0,status text not null default 'in_progress' check(status in('in_progress','submitted','approved','rejected','reversed')),reward_amount bigint not null default 0,currency text not null,country_code text not null check(country_code in('NG','KE')),quality_flags jsonb default '{}'::jsonb,rejection_reason text,created_at timestamptz not null default now(),completed_at timestamptz);
create index if not exists earnchat_chat_daily_idx on public.earnchat_chat_sessions(user_id,session_date,status);
create table if not exists public.earnchat_referrals(id uuid primary key default gen_random_uuid(),referrer_id uuid not null references auth.users(id) on delete cascade,referred_id uuid not null unique references auth.users(id) on delete cascade,referral_code text,signup_at timestamptz not null default now(),first_active_date date,second_active_date date,status text not null default 'signed_up' check(status in('signed_up','active_day_1','qualified','under_review','disqualified')),qualification_at timestamptz,reward_amount bigint not null default 0,currency text,country_code text check(country_code in('NG','KE')),review_reason text,created_at timestamptz not null default now(),check(referrer_id<>referred_id));
create index if not exists earnchat_referrals_referrer_idx on public.earnchat_referrals(referrer_id,status);
create table if not exists public.earnchat_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,wallet_type text not null check(wallet_type in('work','referral')),entry_type text not null check(entry_type in('credit','debit','hold','release','reversal')),source_type text not null,source_id uuid,amount bigint not null check(amount>0),currency text not null check(currency in('NGN','KES')),country_code text not null check(country_code in('NG','KE')),status text not null default 'approved' check(status in('pending','approved','rejected','reversed')),description text,metadata jsonb default '{}'::jsonb,created_at timestamptz not null default now(),approved_at timestamptz);
create unique index if not exists earnchat_ledger_unique_source on public.earnchat_ledger(user_id,wallet_type,source_type,source_id,entry_type) where source_id is not null;
create table if not exists public.earnchat_withdrawals(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,wallet_type text not null check(wallet_type in('work','referral')),amount bigint not null check(amount>0),currency text not null check(currency in('NGN','KES')),country_code text not null check(country_code in('NG','KE')),payout_method text not null check(payout_method in('bank','mpesa')),payout_snapshot jsonb not null default '{}'::jsonb,status text not null default 'submitted' check(status in('submitted','under_review','approved','processing','paid','rejected','cancelled')),review_reason text,transaction_reference text,created_at timestamptz not null default now(),reviewed_at timestamptz,paid_at timestamptz);
create unique index if not exists earnchat_one_open_withdrawal on public.earnchat_withdrawals(user_id,wallet_type) where status in('submitted','under_review','approved','processing');
create table if not exists public.earnchat_payment_activity(id uuid primary key default gen_random_uuid(),withdrawal_id uuid unique references public.earnchat_withdrawals(id) on delete set null,masked_name text not null,country_code text not null check(country_code in('NG','KE')),amount bigint not null,currency text not null check(currency in('NGN','KES')),payout_method text not null,masked_reference text,paid_at timestamptz not null,is_visible boolean not null default true,is_verified boolean not null default true);
create table if not exists public.earnchat_member_feedback(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,quote text not null,country_code text not null check(country_code in('NG','KE')),verified_paid_member boolean not null default false,is_visible boolean not null default false,created_at timestamptz not null default now());

create or replace function public.earnchat_multiplier(p_country text) returns numeric language sql stable as $$select case when upper(p_country)='KE' then kenya_multiplier else nigeria_multiplier end from public.earnchat_business_settings where id=true$$;
create or replace function public.earnchat_country_amount(p_ngn bigint,p_country text) returns bigint language sql stable as $$select round(p_ngn*public.earnchat_multiplier(p_country))::bigint$$;
create or replace function public.get_earnchat_business_config() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('settings',(select to_jsonb(s) from public.earnchat_business_settings s where id=true),'levels',(select jsonb_object_agg(level_name,to_jsonb(l)-'level_name') from public.earnchat_level_settings l))$$;

create or replace function public.mark_earnchat_active_day(p_action text) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r public.earnchat_referrals%rowtype;d date:=current_date;
begin
 if uid is null then raise exception 'Authentication required';end if;
 insert into public.earnchat_active_days(user_id,activity_date,qualifying_actions) values(uid,d,1) on conflict(user_id,activity_date) do update set qualifying_actions=public.earnchat_active_days.qualifying_actions+1;
 update public.profiles set active_days_count=(select count(*) from public.earnchat_active_days a where a.user_id=uid) where id=uid;
 select * into r from public.earnchat_referrals where referred_id=uid for update;
 if found then
  if r.first_active_date is null then update public.earnchat_referrals set first_active_date=d,status='active_day_1' where id=r.id;
  elsif r.second_active_date is null and d<>r.first_active_date then update public.earnchat_referrals set second_active_date=d,status='qualified',qualification_at=now() where id=r.id;
  end if;
 end if;
 return jsonb_build_object('ok',true,'date',d,'action',p_action);
end;$$;

create or replace function public.credit_qualified_referral(p_referral_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.earnchat_referrals%rowtype;reward bigint;curr text;existing uuid;
begin
 select * into r from public.earnchat_referrals where id=p_referral_id for update;
 if not found or r.status<>'qualified' then raise exception 'Referral is not qualified';end if;
 select id into existing from public.earnchat_ledger where source_type='referral' and source_id=r.id and entry_type='credit';
 if existing is not null then return jsonb_build_object('ok',true,'already_credited',true);end if;
 reward:=public.earnchat_country_amount((select referral_reward_ngn from public.earnchat_business_settings where id=true),coalesce(r.country_code,'NG'));
 curr:=case when coalesce(r.country_code,'NG')='KE' then 'KES' else 'NGN' end;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at) values(r.referrer_id,'referral','credit','referral',r.id,reward,curr,coalesce(r.country_code,'NG'),'approved','Qualified referral reward',now());
 update public.earnchat_referrals set reward_amount=reward,currency=curr where id=r.id;
 update public.profiles set referral_available_balance=coalesce(referral_available_balance,0)+reward where id=r.referrer_id;
 return jsonb_build_object('ok',true,'amount',reward,'currency',curr);
end;$$;

alter table public.earnchat_active_days enable row level security;alter table public.earnchat_tasks enable row level security;alter table public.earnchat_task_claims enable row level security;alter table public.earnchat_chat_sessions enable row level security;alter table public.earnchat_referrals enable row level security;alter table public.earnchat_ledger enable row level security;alter table public.earnchat_withdrawals enable row level security;alter table public.earnchat_payment_activity enable row level security;alter table public.earnchat_member_feedback enable row level security;

drop policy if exists active_days_own_select on public.earnchat_active_days;create policy active_days_own_select on public.earnchat_active_days for select using(auth.uid()=user_id);
drop policy if exists tasks_public_active_select on public.earnchat_tasks;create policy tasks_public_active_select on public.earnchat_tasks for select using(status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now()));
drop policy if exists task_claims_own_select on public.earnchat_task_claims;create policy task_claims_own_select on public.earnchat_task_claims for select using(auth.uid()=user_id);
drop policy if exists task_claims_own_insert on public.earnchat_task_claims;create policy task_claims_own_insert on public.earnchat_task_claims for insert with check(auth.uid()=user_id);
drop policy if exists chats_own_select on public.earnchat_chat_sessions;create policy chats_own_select on public.earnchat_chat_sessions for select using(auth.uid()=user_id);
drop policy if exists chats_own_insert on public.earnchat_chat_sessions;create policy chats_own_insert on public.earnchat_chat_sessions for insert with check(auth.uid()=user_id);
drop policy if exists referrals_referrer_select on public.earnchat_referrals;create policy referrals_referrer_select on public.earnchat_referrals for select using(auth.uid()=referrer_id or auth.uid()=referred_id);
drop policy if exists ledger_own_select on public.earnchat_ledger;create policy ledger_own_select on public.earnchat_ledger for select using(auth.uid()=user_id);
drop policy if exists withdrawals_own_select on public.earnchat_withdrawals;create policy withdrawals_own_select on public.earnchat_withdrawals for select using(auth.uid()=user_id);
drop policy if exists withdrawals_own_insert on public.earnchat_withdrawals;create policy withdrawals_own_insert on public.earnchat_withdrawals for insert with check(auth.uid()=user_id);
drop policy if exists payment_activity_public_select on public.earnchat_payment_activity;create policy payment_activity_public_select on public.earnchat_payment_activity for select using(is_visible and is_verified);
drop policy if exists feedback_public_select on public.earnchat_member_feedback;create policy feedback_public_select on public.earnchat_member_feedback for select using(is_visible and verified_paid_member);

grant execute on function public.get_earnchat_business_config() to anon,authenticated;
grant execute on function public.mark_earnchat_active_day(text) to authenticated;
revoke all on function public.credit_qualified_referral(uuid) from public,anon,authenticated;
commit;
