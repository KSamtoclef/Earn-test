-- Earn Chat full economy migration. Review in staging before production.
begin;
create extension if not exists pgcrypto;

create table if not exists public.earnchat_business_settings(
 id boolean primary key default true check(id),version text not null default '2026-07-30-economy-3',
 signup_bonus_ngn bigint not null default 2000,nigeria_multiplier numeric(8,4) not null default 1,
 kenya_multiplier numeric(8,4) not null default .6,daily_cap_ngn bigint not null default 20000,
 referral_reward_ngn bigint not null default 2000,referral_withdraw_min_ngn bigint not null default 40000,
 referral_required_active_days int not null default 2,referrer_account_days int not null default 5,
 updated_at timestamptz not null default now());
insert into public.earnchat_business_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.earnchat_level_settings(
 level_name text primary key check(level_name in('Starter','Active','Pro','Elite')),rank int not null unique,
 chat_limit int not null,chat_reward_ngn bigint not null,task_min_ngn bigint not null,task_max_ngn bigint not null,
 withdraw_min_ngn bigint not null,withdraw_max_ngn bigint not null,account_days int not null default 0,
 active_days int not null default 0,approved_chats int not null default 0,approved_tasks int not null default 0,
 kyc_requirement text not null default 'none',qualification_mission text,updated_at timestamptz not null default now());
insert into public.earnchat_level_settings values
('Starter',0,4,250,100,500,40000,120000,0,0,0,0,'none',null,now()),
('Active',1,6,300,200,700,40000,180000,5,3,12,15,'submitted',null,now()),
('Pro',2,8,500,500,1500,50000,300000,10,7,25,35,'approved','pro',now()),
('Elite',3,10,700,700,3000,60000,500000,20,15,50,80,'approved','elite',now())
on conflict(level_name) do update set rank=excluded.rank,chat_limit=excluded.chat_limit,chat_reward_ngn=excluded.chat_reward_ngn,
 task_min_ngn=excluded.task_min_ngn,task_max_ngn=excluded.task_max_ngn,withdraw_min_ngn=excluded.withdraw_min_ngn,
 withdraw_max_ngn=excluded.withdraw_max_ngn,account_days=excluded.account_days,active_days=excluded.active_days,
 approved_chats=excluded.approved_chats,approved_tasks=excluded.approved_tasks,kyc_requirement=excluded.kyc_requirement,
 qualification_mission=excluded.qualification_mission,updated_at=now();

alter table if exists public.profiles add column if not exists country text default 'NG';
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
update public.profiles set work_available_balance=coalesce(balance,0) where coalesce(work_available_balance,0)=0 and coalesce(balance,0)>0;

create table if not exists public.earnchat_active_days(user_id uuid not null references auth.users(id) on delete cascade,activity_date date not null,qualifying_actions int not null default 0,created_at timestamptz not null default now(),primary key(user_id,activity_date));
create table if not exists public.earnchat_tasks(id uuid primary key default gen_random_uuid(),title text not null,description text not null default '',external_url text not null check(external_url~'^https?://'),provider_name text,country_code text not null default 'ALL' check(country_code in('ALL','NG','KE')),base_reward_ngn bigint not null check(base_reward_ngn>0),required_level text not null default 'Starter' references public.earnchat_level_settings(level_name),required_seconds int not null default 0 check(required_seconds>=0),daily_claim_limit int not null default 1 check(daily_claim_limit>0),total_claim_limit int,approval_type text not null default 'pending' check(approval_type in('instant','pending','partner')),proof_required boolean not null default false,instructions text not null default '',starts_at timestamptz,ends_at timestamptz,status text not null default 'active' check(status in('active','paused','ended')),created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.earnchat_task_claims(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.earnchat_tasks(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,started_at timestamptz not null default now(),returned_at timestamptz,submitted_at timestamptz,status text not null default 'started' check(status in('started','pending','approved','rejected','reversed')),reward_amount bigint not null default 0,currency text not null,country_code text not null check(country_code in('NG','KE')),proof jsonb default '{}'::jsonb,review_reason text,reviewed_by uuid references auth.users(id),reviewed_at timestamptz,created_at timestamptz not null default now());
create index if not exists earnchat_task_claim_lookup on public.earnchat_task_claims(task_id,user_id,started_at);
create table if not exists public.earnchat_chat_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,session_date date not null default current_date,level_name text not null references public.earnchat_level_settings(level_name),message_count int not null,duration_seconds int not null,status text not null check(status in('approved','rejected','reversed')),reward_amount bigint not null,currency text not null,country_code text not null check(country_code in('NG','KE')),quality_flags jsonb default '{}'::jsonb,rejection_reason text,created_at timestamptz not null default now(),completed_at timestamptz not null default now());
create index if not exists earnchat_chat_daily_idx on public.earnchat_chat_sessions(user_id,session_date,status);
create table if not exists public.earnchat_referrals(id uuid primary key default gen_random_uuid(),referrer_id uuid not null references auth.users(id) on delete cascade,referred_id uuid not null unique references auth.users(id) on delete cascade,referral_code text,signup_at timestamptz not null default now(),first_active_date date,second_active_date date,status text not null default 'signed_up' check(status in('signed_up','active_day_1','qualified','under_review','disqualified')),qualification_at timestamptz,reward_amount bigint not null default 0,currency text,country_code text check(country_code in('NG','KE')),review_reason text,created_at timestamptz not null default now(),check(referrer_id<>referred_id));
create index if not exists earnchat_referrals_referrer_idx on public.earnchat_referrals(referrer_id,status);
create table if not exists public.earnchat_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,wallet_type text not null check(wallet_type in('work','referral')),entry_type text not null check(entry_type in('credit','debit','hold','release','reversal')),source_type text not null,source_id uuid,amount bigint not null check(amount>0),currency text not null check(currency in('NGN','KES')),country_code text not null check(country_code in('NG','KE')),status text not null default 'approved' check(status in('pending','approved','rejected','reversed')),description text,metadata jsonb default '{}'::jsonb,created_at timestamptz not null default now(),approved_at timestamptz);
create unique index if not exists earnchat_ledger_unique_source on public.earnchat_ledger(user_id,wallet_type,source_type,source_id,entry_type) where source_id is not null;
create table if not exists public.earnchat_withdrawals(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,wallet_type text not null check(wallet_type in('work','referral')),amount bigint not null check(amount>0),currency text not null check(currency in('NGN','KES')),country_code text not null check(country_code in('NG','KE')),payout_method text not null check(payout_method in('bank','mpesa')),payout_snapshot jsonb not null,status text not null default 'submitted' check(status in('submitted','under_review','approved','processing','paid','rejected','cancelled')),review_reason text,transaction_reference text,created_at timestamptz not null default now(),reviewed_at timestamptz,paid_at timestamptz);
create unique index if not exists earnchat_one_open_withdrawal on public.earnchat_withdrawals(user_id,wallet_type) where status in('submitted','under_review','approved','processing');
create table if not exists public.earnchat_payment_activity(id uuid primary key default gen_random_uuid(),withdrawal_id uuid unique references public.earnchat_withdrawals(id) on delete set null,masked_name text not null,country_code text not null check(country_code in('NG','KE')),amount bigint not null,currency text not null check(currency in('NGN','KES')),payout_method text not null,masked_reference text,paid_at timestamptz not null,is_visible boolean not null default true,is_verified boolean not null default true);
create table if not exists public.earnchat_member_feedback(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,quote text not null,country_code text not null check(country_code in('NG','KE')),verified_paid_member boolean not null default false,is_visible boolean not null default false,created_at timestamptz not null default now());

create or replace function public.earnchat_multiplier(p_country text) returns numeric language sql stable as $$select case when upper(p_country)='KE' then kenya_multiplier else nigeria_multiplier end from public.earnchat_business_settings where id=true$$;
create or replace function public.earnchat_country_amount(p_ngn bigint,p_country text) returns bigint language sql stable as $$select round(p_ngn*public.earnchat_multiplier(p_country))::bigint$$;
create or replace function public.get_earnchat_business_config() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('settings',(select to_jsonb(s) from public.earnchat_business_settings s where id=true),'levels',(select jsonb_object_agg(level_name,to_jsonb(l)-'level_name') from public.earnchat_level_settings l))$$;

create or replace function public.earnchat_credit(p_user uuid,p_wallet text,p_source text,p_source_id uuid,p_amount bigint,p_country text,p_description text) returns void language plpgsql security definer set search_path=public as $$
declare curr text:=case when p_country='KE' then 'KES' else 'NGN' end;
begin
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at) values(p_user,p_wallet,'credit',p_source,p_source_id,p_amount,curr,p_country,'approved',p_description,now()) on conflict do nothing;
 if found then
  if p_wallet='work' then update public.profiles set work_available_balance=coalesce(work_available_balance,0)+p_amount,approved_tasks_count=case when p_source='task' then coalesce(approved_tasks_count,0)+1 else approved_tasks_count end,approved_chats_count=case when p_source='chat' then coalesce(approved_chats_count,0)+1 else approved_chats_count end where id=p_user;
  else update public.profiles set referral_available_balance=coalesce(referral_available_balance,0)+p_amount where id=p_user;end if;
 end if;
end;$$;

create or replace function public.credit_qualified_referral(p_referral_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.earnchat_referrals%rowtype;reward bigint;curr text;
begin
 select * into r from public.earnchat_referrals where id=p_referral_id for update;
 if not found or r.status<>'qualified' then raise exception 'Referral is not qualified';end if;
 reward:=public.earnchat_country_amount((select referral_reward_ngn from public.earnchat_business_settings where id=true),coalesce(r.country_code,'NG'));curr:=case when coalesce(r.country_code,'NG')='KE' then 'KES' else 'NGN' end;
 perform public.earnchat_credit(r.referrer_id,'referral','referral',r.id,reward,coalesce(r.country_code,'NG'),'Qualified referral reward');
 update public.earnchat_referrals set reward_amount=reward,currency=curr where id=r.id;
 return jsonb_build_object('ok',true,'amount',reward,'currency',curr);
end;$$;

create or replace function public.mark_earnchat_active_day(p_action text) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r public.earnchat_referrals%rowtype;d date:=current_date;
begin
 if uid is null then raise exception 'Authentication required';end if;
 insert into public.earnchat_active_days(user_id,activity_date,qualifying_actions) values(uid,d,1) on conflict(user_id,activity_date) do update set qualifying_actions=public.earnchat_active_days.qualifying_actions+1;
 update public.profiles set active_days_count=(select count(*) from public.earnchat_active_days a where a.user_id=uid) where id=uid;
 select * into r from public.earnchat_referrals where referred_id=uid for update;
 if found then
  if r.first_active_date is null then update public.earnchat_referrals set first_active_date=d,status='active_day_1' where id=r.id;
  elsif r.second_active_date is null and d<>r.first_active_date then update public.earnchat_referrals set second_active_date=d,status='qualified',qualification_at=now() where id=r.id;perform public.credit_qualified_referral(r.id);
  end if;
 end if;
 return jsonb_build_object('ok',true,'date',d,'action',p_action);
end;$$;

create or replace function public.register_earnchat_referral(p_referrer uuid,p_code text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c text;
begin
 if uid is null or p_referrer is null or uid=p_referrer then raise exception 'Invalid referral';end if;
 select country into c from public.profiles where id=uid;
 insert into public.earnchat_referrals(referrer_id,referred_id,referral_code,country_code) values(p_referrer,uid,p_code,coalesce(c,'NG')) on conflict(referred_id) do nothing;
 return jsonb_build_object('ok',true);
end;$$;

create or replace function public.start_earnchat_task(p_task uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();t public.earnchat_tasks%rowtype;p public.profiles%rowtype;user_rank int;task_rank int;cnt int;reward bigint;curr text;claim_id uuid;
begin
 if uid is null then raise exception 'Authentication required';end if;select * into p from public.profiles where id=uid;select * into t from public.earnchat_tasks where id=p_task and status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now());if not found then raise exception 'Task unavailable';end if;
 if t.country_code not in('ALL',coalesce(p.country,'NG')) then raise exception 'Task unavailable in your country';end if;
 select rank into user_rank from public.earnchat_level_settings where level_name=coalesce(p.level_name,'Starter');select rank into task_rank from public.earnchat_level_settings where level_name=t.required_level;if user_rank<task_rank then raise exception 'Required level: %',t.required_level;end if;
 select count(*) into cnt from public.earnchat_task_claims where task_id=t.id and user_id=uid and started_at::date=current_date;if cnt>=t.daily_claim_limit then raise exception 'Daily claim limit reached';end if;
 reward:=public.earnchat_country_amount(t.base_reward_ngn,coalesce(p.country,'NG'));curr:=case when coalesce(p.country,'NG')='KE' then 'KES' else 'NGN' end;
 insert into public.earnchat_task_claims(task_id,user_id,reward_amount,currency,country_code) values(t.id,uid,reward,curr,coalesce(p.country,'NG')) returning id into claim_id;
 return jsonb_build_object('claim_id',claim_id,'url',t.external_url,'required_seconds',t.required_seconds,'reward',reward,'currency',curr,'approval_type',t.approval_type);
end;$$;

create or replace function public.submit_earnchat_task(p_claim uuid,p_proof jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;t public.earnchat_tasks%rowtype;new_status text;
begin
 select * into c from public.earnchat_task_claims where id=p_claim and user_id=uid for update;if not found or c.status<>'started' then raise exception 'Invalid claim';end if;select * into t from public.earnchat_tasks where id=c.task_id;if extract(epoch from(now()-c.started_at))<t.required_seconds then raise exception 'Required time not completed';end if;if t.proof_required and(p_proof is null or p_proof='{}'::jsonb) then raise exception 'Proof required';end if;
 new_status:=case when t.approval_type='instant' then 'approved' else 'pending' end;update public.earnchat_task_claims set returned_at=now(),submitted_at=now(),status=new_status,proof=coalesce(p_proof,'{}'::jsonb) where id=c.id;
 if new_status='approved' then perform public.earnchat_credit(uid,'work','task',c.id,c.reward_amount,c.country_code,'Approved linked task');perform public.mark_earnchat_active_day('task');else update public.profiles set work_pending_balance=coalesce(work_pending_balance,0)+c.reward_amount where id=uid;end if;
 return jsonb_build_object('ok',true,'status',new_status,'amount',c.reward_amount,'currency',c.currency);
end;$$;

create or replace function public.complete_earnchat_chat(p_messages int,p_duration_seconds int,p_quality jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;reward bigint;curr text;sid uuid;
begin
 if p_messages<4 or p_duration_seconds<120 then raise exception 'Complete the full guided session';end if;select * into p from public.profiles where id=uid;select * into l from public.earnchat_level_settings where level_name=coalesce(p.level_name,'Starter');select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';if cnt>=l.chat_limit then raise exception 'Daily chat limit reached';end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,coalesce(p.country,'NG'));curr:=case when coalesce(p.country,'NG')='KE' then 'KES' else 'NGN' end;insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags) values(uid,l.level_name,p_messages,p_duration_seconds,'approved',reward,curr,coalesce(p.country,'NG'),coalesce(p_quality,'{}'::jsonb)) returning id into sid;perform public.earnchat_credit(uid,'work','chat',sid,reward,coalesce(p.country,'NG'),'Approved guided chat');perform public.mark_earnchat_active_day('chat');return jsonb_build_object('ok',true,'session_id',sid,'amount',reward,'currency',curr,'remaining',l.chat_limit-cnt-1);
end;$$;

create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;minimum bigint;maximum bigint;available bigint;curr text;wid uuid;age_days int;
begin
 if p_wallet not in('work','referral') then raise exception 'Invalid wallet';end if;select * into p from public.profiles where id=uid for update;if not found then raise exception 'Profile unavailable';end if;age_days:=current_date-coalesce(p.account_created_at::date,current_date);if age_days<5 then raise exception 'Account must be at least 5 days old';end if;if not coalesce(p.kyc_done,false) then raise exception 'KYC approval required';end if;if coalesce(p.security_review_required,false) then raise exception 'Account is under review';end if;if coalesce(p.country,'NG')='KE' and p_method not in('mpesa','bank') then raise exception 'Choose M-Pesa or bank';end if;if coalesce(p.country,'NG')='NG' and p_method<>'bank' then raise exception 'Choose bank transfer';end if;
 select * into l from public.earnchat_level_settings where level_name=coalesce(p.level_name,'Starter');if p_wallet='referral' then minimum:=public.earnchat_country_amount((select referral_withdraw_min_ngn from public.earnchat_business_settings where id=true),coalesce(p.country,'NG'));maximum:=9223372036854775807;available:=coalesce(p.referral_available_balance,0);else minimum:=public.earnchat_country_amount(l.withdraw_min_ngn,coalesce(p.country,'NG'));maximum:=public.earnchat_country_amount(l.withdraw_max_ngn,coalesce(p.country,'NG'));available:=coalesce(p.work_available_balance,0);end if;
 if p_amount<minimum or p_amount>maximum or p_amount>available then raise exception 'Withdrawal amount is outside the allowed range';end if;curr:=case when coalesce(p.country,'NG')='KE' then 'KES' else 'NGN' end;
 insert into public.earnchat_withdrawals(user_id,wallet_type,amount,currency,country_code,payout_method,payout_snapshot) values(uid,p_wallet,p_amount,curr,coalesce(p.country,'NG'),p_method,p_payout) returning id into wid;
 if p_wallet='work' then update public.profiles set work_available_balance=work_available_balance-p_amount where id=uid;else update public.profiles set referral_available_balance=referral_available_balance-p_amount where id=uid;end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description) values(uid,p_wallet,'hold','withdrawal',wid,p_amount,curr,coalesce(p.country,'NG'),'approved','Withdrawal request hold');return jsonb_build_object('ok',true,'withdrawal_id',wid,'status','submitted');
end;$$;

create or replace function public.get_my_earnchat_wallet() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('level',level_name,'country',country,'work_available',work_available_balance,'work_pending',work_pending_balance,'referral_available',referral_available_balance,'referral_pending',referral_pending_balance,'total_withdrawn',total_withdrawn,'account_created_at',account_created_at,'active_days',active_days_count,'approved_chats',approved_chats_count,'approved_tasks',approved_tasks_count,'kyc_done',kyc_done,'security_review_required',security_review_required) from public.profiles where id=auth.uid()$$;

alter table public.earnchat_active_days enable row level security;alter table public.earnchat_tasks enable row level security;alter table public.earnchat_task_claims enable row level security;alter table public.earnchat_chat_sessions enable row level security;alter table public.earnchat_referrals enable row level security;alter table public.earnchat_ledger enable row level security;alter table public.earnchat_withdrawals enable row level security;alter table public.earnchat_payment_activity enable row level security;alter table public.earnchat_member_feedback enable row level security;
drop policy if exists active_days_own_select on public.earnchat_active_days;create policy active_days_own_select on public.earnchat_active_days for select using(auth.uid()=user_id);
drop policy if exists tasks_public_active_select on public.earnchat_tasks;create policy tasks_public_active_select on public.earnchat_tasks for select using(status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now()));
drop policy if exists task_claims_own_select on public.earnchat_task_claims;create policy task_claims_own_select on public.earnchat_task_claims for select using(auth.uid()=user_id);
drop policy if exists chats_own_select on public.earnchat_chat_sessions;create policy chats_own_select on public.earnchat_chat_sessions for select using(auth.uid()=user_id);
drop policy if exists referrals_own_select on public.earnchat_referrals;create policy referrals_own_select on public.earnchat_referrals for select using(auth.uid()=referrer_id or auth.uid()=referred_id);
drop policy if exists ledger_own_select on public.earnchat_ledger;create policy ledger_own_select on public.earnchat_ledger for select using(auth.uid()=user_id);
drop policy if exists withdrawals_own_select on public.earnchat_withdrawals;create policy withdrawals_own_select on public.earnchat_withdrawals for select using(auth.uid()=user_id);
drop policy if exists payment_activity_public_select on public.earnchat_payment_activity;create policy payment_activity_public_select on public.earnchat_payment_activity for select using(is_visible and is_verified);
drop policy if exists feedback_public_select on public.earnchat_member_feedback;create policy feedback_public_select on public.earnchat_member_feedback for select using(is_visible and verified_paid_member);

grant execute on function public.get_earnchat_business_config() to anon,authenticated;
grant execute on function public.register_earnchat_referral(uuid,text) to authenticated;
grant execute on function public.start_earnchat_task(uuid) to authenticated;
grant execute on function public.submit_earnchat_task(uuid,jsonb) to authenticated;
grant execute on function public.complete_earnchat_chat(int,int,jsonb) to authenticated;
grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated;
grant execute on function public.get_my_earnchat_wallet() to authenticated;
revoke all on function public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.credit_qualified_referral(uuid) from public,anon,authenticated;
commit;
