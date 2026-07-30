-- Earn Chat production rebuild migration
-- Run after taking a database backup. Safe to rerun where stated.
begin;
create extension if not exists pgcrypto;

-- Canonical profile fields
alter table public.profiles add column if not exists country text not null default 'NG' check (country in ('NG','KE'));
alter table public.profiles add column if not exists currency text not null default 'NGN' check (currency in ('NGN','KES'));
alter table public.profiles add column if not exists level_name text not null default 'Starter';
alter table public.profiles add column if not exists account_created_at timestamptz not null default now();
alter table public.profiles add column if not exists active_days_count int not null default 0;
alter table public.profiles add column if not exists approved_chats_count int not null default 0;
alter table public.profiles add column if not exists approved_tasks_count int not null default 0;
alter table public.profiles add column if not exists task_rejection_count int not null default 0;
alter table public.profiles add column if not exists chat_rejection_count int not null default 0;
alter table public.profiles add column if not exists work_available_balance bigint not null default 0;
alter table public.profiles add column if not exists work_pending_balance bigint not null default 0;
alter table public.profiles add column if not exists referral_available_balance bigint not null default 0;
alter table public.profiles add column if not exists referral_pending_balance bigint not null default 0;
alter table public.profiles add column if not exists total_withdrawn bigint not null default 0;
alter table public.profiles add column if not exists kyc_status text not null default 'not_submitted' check (kyc_status in ('not_submitted','submitted','under_review','approved','rejected'));
alter table public.profiles add column if not exists payout_method text;
alter table public.profiles add column if not exists payout_details jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists security_review_required boolean not null default false;
alter table public.profiles add column if not exists fraud_review_status text not null default 'clear' check (fraud_review_status in ('clear','review','blocked'));
alter table public.profiles add column if not exists earning_suspended boolean not null default false;
alter table public.profiles add column if not exists pro_mission_status text not null default 'not_started';
alter table public.profiles add column if not exists elite_mission_status text not null default 'not_started';
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists last_visit_at timestamptz;
alter table public.profiles add column if not exists last_page text not null default 'home';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists profiles_referral_code_key on public.profiles(referral_code) where referral_code is not null;

-- Canonical configuration
create table if not exists public.earnchat_business_settings(
 id boolean primary key default true check(id), version text not null default '2026-07-30-production-1',
 signup_bonus_ngn bigint not null default 2000, nigeria_multiplier numeric(8,4) not null default 1,
 kenya_multiplier numeric(8,4) not null default .6, daily_cap_ngn bigint not null default 20000,
 referral_reward_ngn bigint not null default 2000, referral_withdraw_min_ngn bigint not null default 40000,
 referral_required_active_days int not null default 2, referrer_account_days int not null default 5,
 presence_online_seconds int not null default 90, presence_heartbeat_seconds int not null default 60,
 updated_at timestamptz not null default now());
insert into public.earnchat_business_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.earnchat_level_settings(
 level_name text primary key check(level_name in('Starter','Active','Pro','Elite')), rank int not null unique,
 chat_limit int not null, chat_reward_ngn bigint not null, task_min_ngn bigint not null, task_max_ngn bigint not null,
 withdraw_min_ngn bigint not null, withdraw_max_ngn bigint not null, account_days int not null default 0,
 active_days int not null default 0, approved_chats int not null default 0, approved_tasks int not null default 0,
 kyc_requirement text not null default 'none', qualification_mission text, max_rejection_rate numeric(5,2) not null default 100,
 updated_at timestamptz not null default now());
insert into public.earnchat_level_settings values
('Starter',0,4,250,100,500,40000,120000,0,0,0,0,'none',null,100,now()),
('Active',1,6,300,200,700,40000,180000,5,3,12,15,'submitted',null,50,now()),
('Pro',2,8,500,500,1500,50000,300000,10,7,25,35,'approved','pro',20,now()),
('Elite',3,10,700,700,3000,60000,500000,20,15,50,80,'approved','elite',10,now())
on conflict(level_name) do update set rank=excluded.rank,chat_limit=excluded.chat_limit,chat_reward_ngn=excluded.chat_reward_ngn,
task_min_ngn=excluded.task_min_ngn,task_max_ngn=excluded.task_max_ngn,withdraw_min_ngn=excluded.withdraw_min_ngn,
withdraw_max_ngn=excluded.withdraw_max_ngn,account_days=excluded.account_days,active_days=excluded.active_days,
approved_chats=excluded.approved_chats,approved_tasks=excluded.approved_tasks,kyc_requirement=excluded.kyc_requirement,
qualification_mission=excluded.qualification_mission,max_rejection_rate=excluded.max_rejection_rate,updated_at=now();

-- Production tables
create table if not exists public.earnchat_active_days(user_id uuid not null references auth.users(id) on delete cascade,activity_date date not null,qualifying_actions int not null default 0,created_at timestamptz not null default now(),primary key(user_id,activity_date));
create table if not exists public.earnchat_tasks(id uuid primary key default gen_random_uuid(),title text not null,description text not null default '',external_url text not null check(external_url~'^https?://'),provider_name text,category text not null default 'Other' check(category in('Visit','Review','Media','Registration','Testing','Reading','Survey','Other')),country_code text not null default 'ALL' check(country_code in('ALL','NG','KE')),base_reward_ngn bigint not null check(base_reward_ngn>0),required_level text not null default 'Starter' references public.earnchat_level_settings(level_name),required_seconds int not null default 0 check(required_seconds>=0),daily_claim_limit int not null default 1 check(daily_claim_limit>0),total_claim_limit int,approval_type text not null default 'pending' check(approval_type in('instant','pending','partner')),proof_type text not null default 'none' check(proof_type in('none','text','reference','screenshot','partner')),proof_required boolean not null default false,instructions text not null default '',starts_at timestamptz,ends_at timestamptz,status text not null default 'active' check(status in('active','paused','ended')),created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.earnchat_task_claims(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.earnchat_tasks(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,started_at timestamptz not null default now(),returned_at timestamptz,submitted_at timestamptz,status text not null default 'started' check(status in('started','pending','approved','rejected','reversed')),reward_amount bigint not null default 0,currency text not null,country_code text not null check(country_code in('NG','KE')),proof jsonb not null default '{}'::jsonb,review_reason text,reviewed_by uuid references auth.users(id),reviewed_at timestamptz,created_at timestamptz not null default now());
create index if not exists earnchat_task_claim_lookup on public.earnchat_task_claims(task_id,user_id,started_at);
create table if not exists public.earnchat_chat_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,session_date date not null default current_date,level_name text not null references public.earnchat_level_settings(level_name),message_count int not null,duration_seconds int not null,status text not null check(status in('approved','rejected','reversed')),reward_amount bigint not null,currency text not null,country_code text not null check(country_code in('NG','KE')),quality_flags jsonb not null default '{}'::jsonb,rejection_reason text,created_at timestamptz not null default now(),completed_at timestamptz not null default now());
create index if not exists earnchat_chat_daily_idx on public.earnchat_chat_sessions(user_id,session_date,status);
create table if not exists public.earnchat_referrals(id uuid primary key default gen_random_uuid(),referrer_id uuid not null references auth.users(id) on delete cascade,referred_id uuid not null unique references auth.users(id) on delete cascade,referral_code text,signup_at timestamptz not null default now(),first_active_date date,second_active_date date,status text not null default 'signed_up' check(status in('signed_up','active_day_1','under_review','qualified','disqualified')),qualification_at timestamptz,reward_amount bigint not null default 0,currency text,country_code text check(country_code in('NG','KE')),fraud_flags jsonb not null default '{}'::jsonb,review_reason text,created_at timestamptz not null default now(),check(referrer_id<>referred_id));
create table if not exists public.earnchat_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,wallet_type text not null check(wallet_type in('work','referral')),entry_type text not null check(entry_type in('credit','debit','hold','release','reversal')),source_type text not null,source_id uuid,amount bigint not null check(amount>0),currency text not null check(currency in('NGN','KES')),country_code text not null check(country_code in('NG','KE')),status text not null default 'approved' check(status in('pending','approved','rejected','reversed')),description text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),approved_at timestamptz);
create unique index if not exists earnchat_ledger_unique_source on public.earnchat_ledger(user_id,wallet_type,source_type,source_id,entry_type) where source_id is not null;
create table if not exists public.earnchat_withdrawals(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,wallet_type text not null check(wallet_type in('work','referral')),amount bigint not null check(amount>0),currency text not null check(currency in('NGN','KES')),country_code text not null check(country_code in('NG','KE')),payout_method text not null check(payout_method in('bank','mpesa')),payout_snapshot jsonb not null,status text not null default 'submitted' check(status in('submitted','under_review','approved','processing','paid','rejected','cancelled')),review_reason text,transaction_reference text,created_at timestamptz not null default now(),reviewed_at timestamptz,paid_at timestamptz);
create unique index if not exists earnchat_one_open_withdrawal on public.earnchat_withdrawals(user_id,wallet_type) where status in('submitted','under_review','approved','processing');
create table if not exists public.earnchat_payment_activity(id uuid primary key default gen_random_uuid(),withdrawal_id uuid unique references public.earnchat_withdrawals(id) on delete set null,masked_name text not null,country_code text not null check(country_code in('NG','KE')),amount bigint not null,currency text not null check(currency in('NGN','KES')),payout_method text not null,masked_reference text,paid_at timestamptz not null,is_visible boolean not null default true,is_verified boolean not null default true);
create table if not exists public.earnchat_member_feedback(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,quote text not null,country_code text not null check(country_code in('NG','KE')),verified_paid_member boolean not null default false,is_visible boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.earnchat_kyc_submissions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,status text not null default 'submitted' check(status in('submitted','under_review','approved','rejected')),provider_reference text,metadata jsonb not null default '{}'::jsonb,review_reason text,reviewed_by uuid references auth.users(id),created_at timestamptz not null default now(),reviewed_at timestamptz);
create unique index if not exists earnchat_one_open_kyc on public.earnchat_kyc_submissions(user_id) where status in('submitted','under_review');
create table if not exists public.earnchat_site_presence(session_id text primary key,visitor_id text,user_id uuid references auth.users(id) on delete set null,page_id text not null default 'landing',is_visible boolean not null default true,first_seen timestamptz not null default now(),last_seen timestamptz not null default now(),country_code text,device_category text,source text);
create index if not exists earnchat_presence_last_seen_idx on public.earnchat_site_presence(last_seen desc);
create table if not exists public.earnchat_admin_audit(id uuid primary key default gen_random_uuid(),admin_id uuid not null references auth.users(id),action text not null,target_type text,target_id uuid,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());

-- Helpers
create or replace function public.earnchat_is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select is_admin from public.profiles where id=auth.uid()),false)$$;
create or replace function public.earnchat_multiplier(p_country text) returns numeric language sql stable security definer set search_path=public as $$select case when upper(p_country)='KE' then kenya_multiplier else nigeria_multiplier end from public.earnchat_business_settings where id=true$$;
create or replace function public.earnchat_country_amount(p_ngn bigint,p_country text) returns bigint language sql stable security definer set search_path=public as $$select round(p_ngn*public.earnchat_multiplier(p_country))::bigint$$;
create or replace function public.get_earnchat_business_config() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('settings',(select to_jsonb(s) from public.earnchat_business_settings s where id=true),'levels',(select jsonb_object_agg(level_name,to_jsonb(l)-'level_name') from public.earnchat_level_settings l))$$;

create or replace function public.ensure_earnchat_profile(p_full_name text default null,p_country text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();u auth.users%rowtype;row public.profiles%rowtype;cc text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into u from auth.users where id=uid; cc:=case when upper(coalesce(p_country,u.raw_user_meta_data->>'country','NG'))='KE' then 'KE' else 'NG' end;
 insert into public.profiles(id,email,full_name,country,currency,referral_code,account_created_at,updated_at)
 values(uid,coalesce(u.email,''),coalesce(nullif(trim(p_full_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(coalesce(u.email,''),'@',1)),cc,case when cc='KE' then 'KES' else 'NGN' end,upper(substr(replace(uid::text,'-',''),1,8)),coalesce(u.created_at,now()),now())
 on conflict(id) do update set email=excluded.email,full_name=coalesce(nullif(public.profiles.full_name,''),excluded.full_name),updated_at=now();
 select * into row from public.profiles where id=uid;
 return to_jsonb(row);
end;$$;

create or replace function public.get_my_earnchat_state() returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('profile',to_jsonb(p),'wallet',jsonb_build_object('work_available',p.work_available_balance,'work_pending',p.work_pending_balance,'referral_available',p.referral_available_balance,'referral_pending',p.referral_pending_balance,'total_withdrawn',p.total_withdrawn),'today_chats',(select count(*) from public.earnchat_chat_sessions c where c.user_id=p.id and c.session_date=current_date and c.status='approved'),'config',public.get_earnchat_business_config()) from public.profiles p where p.id=auth.uid()$$;

create or replace function public.evaluate_earnchat_level(p_user uuid default auth.uid()) returns text language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;chosen text:='Starter';account_days int;attempts int;rejections int;rate numeric;
begin
 select * into p from public.profiles where id=p_user for update; if not found then raise exception 'Profile unavailable'; end if;
 account_days:=current_date-p.account_created_at::date; attempts:=p.approved_tasks_count+p.task_rejection_count+p.approved_chats_count+p.chat_rejection_count; rejections:=p.task_rejection_count+p.chat_rejection_count; rate:=case when attempts=0 then 0 else rejections::numeric*100/attempts end;
 for l in select * from public.earnchat_level_settings order by rank loop
  if account_days>=l.account_days and p.active_days_count>=l.active_days and p.approved_chats_count>=l.approved_chats and p.approved_tasks_count>=l.approved_tasks and rate<=l.max_rejection_rate
   and (l.kyc_requirement='none' or (l.kyc_requirement='submitted' and p.kyc_status in('submitted','under_review','approved')) or (l.kyc_requirement='approved' and p.kyc_status='approved'))
   and (l.qualification_mission is null or (l.qualification_mission='pro' and p.pro_mission_status='approved') or (l.qualification_mission='elite' and p.elite_mission_status='approved'))
   and not p.security_review_required and p.fraud_review_status='clear' and not p.earning_suspended then chosen:=l.level_name;
  end if;
 end loop;
 update public.profiles set level_name=chosen,updated_at=now() where id=p_user; return chosen;
end;$$;

create or replace function public.mark_earnchat_active_day(p_user uuid default auth.uid()) returns void language plpgsql security definer set search_path=public as $$
begin insert into public.earnchat_active_days(user_id,activity_date,qualifying_actions) values(p_user,current_date,1) on conflict(user_id,activity_date) do update set qualifying_actions=earnchat_active_days.qualifying_actions+1; update public.profiles set active_days_count=(select count(*) from public.earnchat_active_days where user_id=p_user),updated_at=now() where id=p_user; end;$$;

create or replace function public.earnchat_credit(p_user uuid,p_wallet text,p_source text,p_source_id uuid,p_amount bigint,p_country text,p_description text) returns bigint language plpgsql security definer set search_path=public as $$
declare curr text:=case when p_country='KE' then 'KES' else 'NGN' end;allowed bigint:=p_amount;cap bigint;earned bigint;
begin
 if p_amount<=0 then raise exception 'Invalid credit'; end if;
 if p_wallet='work' then select public.earnchat_country_amount(daily_cap_ngn,p_country) into cap from public.earnchat_business_settings where id=true; select coalesce(sum(amount),0) into earned from public.earnchat_ledger where user_id=p_user and wallet_type='work' and entry_type='credit' and status='approved' and created_at::date=current_date; allowed:=greatest(0,least(p_amount,cap-earned)); if allowed=0 then raise exception 'Daily earning cap reached'; end if; end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at) values(p_user,p_wallet,'credit',p_source,p_source_id,allowed,curr,p_country,'approved',p_description,now()) on conflict do nothing;
 if found then if p_wallet='work' then update public.profiles set work_available_balance=work_available_balance+allowed,approved_tasks_count=approved_tasks_count+case when p_source='task' then 1 else 0 end,approved_chats_count=approved_chats_count+case when p_source='chat' then 1 else 0 end,updated_at=now() where id=p_user; else update public.profiles set referral_available_balance=referral_available_balance+allowed,updated_at=now() where id=p_user; end if; end if;
 perform public.evaluate_earnchat_level(p_user); return allowed;
end;$$;

-- Customer task RPCs
create or replace function public.list_earnchat_tasks() returns setof public.earnchat_tasks language sql stable security definer set search_path=public as $$select * from public.earnchat_tasks where status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now()) order by created_at desc$$;
create or replace function public.start_earnchat_task(p_task uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();t public.earnchat_tasks%rowtype;p public.profiles%rowtype;ur int;tr int;daily_count int;total_count int;reward bigint;curr text;claim_id uuid;
begin
 if uid is null then raise exception 'Authentication required';end if; select * into p from public.profiles where id=uid; if p.earning_suspended or p.security_review_required then raise exception 'Earning is unavailable while account review is active';end if;
 select * into t from public.earnchat_tasks where id=p_task and status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now());if not found then raise exception 'Task unavailable';end if;
 if t.country_code not in('ALL',p.country) then raise exception 'Task unavailable in your country';end if; select rank into ur from public.earnchat_level_settings where level_name=p.level_name;select rank into tr from public.earnchat_level_settings where level_name=t.required_level;if ur<tr then raise exception 'Required level: %',t.required_level;end if;
 select count(*) into daily_count from public.earnchat_task_claims where task_id=t.id and user_id=uid and started_at::date=current_date and status<>'rejected';if daily_count>=t.daily_claim_limit then raise exception 'Daily claim limit reached';end if;
 if t.total_claim_limit is not null then select count(*) into total_count from public.earnchat_task_claims where task_id=t.id and status in('started','pending','approved');if total_count>=t.total_claim_limit then raise exception 'Task capacity reached';end if;end if;
 reward:=public.earnchat_country_amount(t.base_reward_ngn,p.country);curr:=case when p.country='KE' then 'KES' else 'NGN' end;insert into public.earnchat_task_claims(task_id,user_id,reward_amount,currency,country_code) values(t.id,uid,reward,curr,p.country) returning id into claim_id;
 return jsonb_build_object('claim_id',claim_id,'url',t.external_url,'required_seconds',t.required_seconds,'reward',reward,'currency',curr,'approval_type',t.approval_type,'proof_type',t.proof_type,'instructions',t.instructions);
end;$$;
create or replace function public.submit_earnchat_task(p_claim uuid,p_proof jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;t public.earnchat_tasks%rowtype;new_status text;credited bigint:=0;
begin
 select * into c from public.earnchat_task_claims where id=p_claim and user_id=uid for update;if not found or c.status<>'started' then raise exception 'Invalid claim';end if;select * into t from public.earnchat_tasks where id=c.task_id;if extract(epoch from(now()-c.started_at))<t.required_seconds then raise exception 'Required time not completed';end if;if t.proof_required and(p_proof is null or p_proof='{}'::jsonb) then raise exception 'Proof required';end if;
 new_status:=case when t.approval_type='instant' then 'approved' else 'pending' end;update public.earnchat_task_claims set returned_at=now(),submitted_at=now(),status=new_status,proof=coalesce(p_proof,'{}'::jsonb) where id=c.id;
 if new_status='approved' then credited:=public.earnchat_credit(uid,'work','task',c.id,c.reward_amount,c.country_code,'Approved linked task');perform public.mark_earnchat_active_day(uid);else update public.profiles set work_pending_balance=work_pending_balance+c.reward_amount,updated_at=now() where id=uid;end if;
 return jsonb_build_object('ok',true,'status',new_status,'amount',credited,'pending_amount',case when new_status='pending' then c.reward_amount else 0 end,'currency',c.currency);
end;$$;

-- Chat completion
create or replace function public.complete_earnchat_chat(p_messages int,p_duration_seconds int,p_quality jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;reward bigint;curr text;sid uuid;credited bigint;
begin
 if uid is null then raise exception 'Authentication required';end if;if p_messages<4 or p_duration_seconds<120 then raise exception 'Complete four meaningful replies and two minutes';end if;if coalesce((p_quality->>'duplicate_replies')::boolean,false) then raise exception 'Repeated replies are not allowed';end if;
 select * into p from public.profiles where id=uid;if p.earning_suspended or p.security_review_required then raise exception 'Earning is unavailable while account review is active';end if;select * into l from public.earnchat_level_settings where level_name=p.level_name;select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';if cnt>=l.chat_limit then raise exception 'Daily chat limit reached';end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);curr:=case when p.country='KE' then 'KES' else 'NGN' end;insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags) values(uid,l.level_name,p_messages,p_duration_seconds,'approved',reward,curr,p.country,coalesce(p_quality,'{}'::jsonb)) returning id into sid;credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided chat');perform public.mark_earnchat_active_day(uid);return jsonb_build_object('ok',true,'session_id',sid,'amount',credited,'currency',curr,'remaining',l.chat_limit-cnt-1);
end;$$;

-- Referral attribution and qualification
create or replace function public.register_earnchat_referral(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();referrer uuid;cc text;
begin if uid is null or nullif(trim(p_code),'') is null then raise exception 'Invalid referral';end if;select id into referrer from public.profiles where referral_code=upper(trim(p_code));if referrer is null or referrer=uid then raise exception 'Invalid referral';end if;select country into cc from public.profiles where id=uid;insert into public.earnchat_referrals(referrer_id,referred_id,referral_code,country_code) values(referrer,uid,upper(trim(p_code)),coalesce(cc,'NG')) on conflict(referred_id) do nothing;return jsonb_build_object('ok',true);end;$$;
create or replace function public.refresh_earnchat_referral_qualification(p_user uuid default auth.uid()) returns void language plpgsql security definer set search_path=public as $$
declare r public.earnchat_referrals%rowtype;days date[];
begin select * into r from public.earnchat_referrals where referred_id=p_user for update;if not found then return;end if;select array_agg(activity_date order by activity_date) into days from public.earnchat_active_days where user_id=p_user;if coalesce(array_length(days,1),0)>=1 and r.first_active_date is null then update public.earnchat_referrals set first_active_date=days[1],status='active_day_1' where id=r.id;end if;if coalesce(array_length(days,1),0)>=2 and r.second_active_date is null then update public.earnchat_referrals set second_active_date=days[2],status='under_review',qualification_at=now() where id=r.id;end if;end;$$;

-- KYC and withdrawal
create or replace function public.submit_earnchat_kyc(p_reference text default null,p_metadata jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();kid uuid;begin if uid is null then raise exception 'Authentication required';end if;insert into public.earnchat_kyc_submissions(user_id,provider_reference,metadata) values(uid,p_reference,coalesce(p_metadata,'{}'::jsonb)) returning id into kid;update public.profiles set kyc_status='submitted',updated_at=now() where id=uid;return jsonb_build_object('ok',true,'submission_id',kid);end;$$;
create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;minimum bigint;maximum bigint;available bigint;curr text;wid uuid;age_days int;
begin
 if p_wallet not in('work','referral') then raise exception 'Invalid wallet';end if;select * into p from public.profiles where id=uid for update;if not found then raise exception 'Profile unavailable';end if;age_days:=current_date-p.account_created_at::date;if age_days<5 then raise exception 'Account must be at least 5 days old';end if;if p.kyc_status<>'approved' then raise exception 'KYC approval required';end if;if p.security_review_required or p.earning_suspended then raise exception 'Account is under review';end if;if p.country='KE' and p_method not in('mpesa','bank') then raise exception 'Choose M-Pesa or bank';end if;if p.country='NG' and p_method<>'bank' then raise exception 'Choose bank transfer';end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;if p_wallet='referral' then minimum:=public.earnchat_country_amount((select referral_withdraw_min_ngn from public.earnchat_business_settings where id=true),p.country);maximum:=9223372036854775807;available:=p.referral_available_balance;else minimum:=public.earnchat_country_amount(l.withdraw_min_ngn,p.country);maximum:=public.earnchat_country_amount(l.withdraw_max_ngn,p.country);available:=p.work_available_balance;end if;if p_amount<minimum or p_amount>maximum or p_amount>available then raise exception 'Withdrawal amount is outside the allowed range';end if;curr:=p.currency;
 insert into public.earnchat_withdrawals(user_id,wallet_type,amount,currency,country_code,payout_method,payout_snapshot) values(uid,p_wallet,p_amount,curr,p.country,p_method,p_payout) returning id into wid;if p_wallet='work' then update public.profiles set work_available_balance=work_available_balance-p_amount where id=uid;else update public.profiles set referral_available_balance=referral_available_balance-p_amount where id=uid;end if;insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description) values(uid,p_wallet,'hold','withdrawal',wid,p_amount,curr,p.country,'approved','Withdrawal request hold');return jsonb_build_object('ok',true,'withdrawal_id',wid,'status','submitted');
end;$$;

-- Presence
create or replace function public.upsert_earnchat_presence(p_session_id text,p_visitor_id text,p_page_id text,p_is_visible boolean,p_country text default null,p_device text default null,p_source text default null) returns void language plpgsql security definer set search_path=public as $$
begin insert into public.earnchat_site_presence(session_id,visitor_id,user_id,page_id,is_visible,country_code,device_category,source,last_seen) values(p_session_id,p_visitor_id,auth.uid(),coalesce(p_page_id,'landing'),coalesce(p_is_visible,true),p_country,p_device,p_source,now()) on conflict(session_id) do update set user_id=auth.uid(),page_id=excluded.page_id,is_visible=excluded.is_visible,country_code=coalesce(excluded.country_code,earnchat_site_presence.country_code),device_category=coalesce(excluded.device_category,earnchat_site_presence.device_category),source=coalesce(excluded.source,earnchat_site_presence.source),last_seen=now();end;$$;
create or replace function public.mark_earnchat_presence_inactive(p_session_id text) returns void language sql security definer set search_path=public as $$update public.earnchat_site_presence set is_visible=false,last_seen=now() where session_id=p_session_id$$;
create or replace function public.get_public_earnchat_stats() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('total_users',(select count(*) from public.profiles),'online_now',(select count(distinct coalesce(user_id::text,session_id)) from public.earnchat_site_presence where is_visible and last_seen>now()-make_interval(secs=>(select presence_online_seconds from public.earnchat_business_settings where id=true))))$$;

-- Admin operations
create or replace function public.admin_list_earnchat_tasks() returns setof public.earnchat_tasks language plpgsql stable security definer set search_path=public as $$begin if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;return query select * from public.earnchat_tasks order by created_at desc;end;$$;
create or replace function public.admin_upsert_earnchat_task(p_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();tid uuid:=coalesce(p_id,gen_random_uuid());lvl public.earnchat_level_settings%rowtype;reward bigint;
begin if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;select * into lvl from public.earnchat_level_settings where level_name=coalesce(p_payload->>'required_level','Starter');if not found then raise exception 'Invalid level';end if;reward:=(p_payload->>'base_reward_ngn')::bigint;if reward<lvl.task_min_ngn or reward>lvl.task_max_ngn then raise exception 'Reward outside level range';end if;
 insert into public.earnchat_tasks(id,title,description,external_url,provider_name,category,country_code,base_reward_ngn,required_level,required_seconds,daily_claim_limit,total_claim_limit,approval_type,proof_type,proof_required,instructions,starts_at,ends_at,status,created_by,updated_at) values(tid,trim(p_payload->>'title'),coalesce(p_payload->>'description',''),p_payload->>'external_url',nullif(p_payload->>'provider_name',''),coalesce(p_payload->>'category','Other'),coalesce(p_payload->>'country_code','ALL'),reward,coalesce(p_payload->>'required_level','Starter'),coalesce((p_payload->>'required_seconds')::int,0),coalesce((p_payload->>'daily_claim_limit')::int,1),(p_payload->>'total_claim_limit')::int,coalesce(p_payload->>'approval_type','pending'),coalesce(p_payload->>'proof_type','none'),coalesce((p_payload->>'proof_required')::boolean,false),coalesce(p_payload->>'instructions',''),(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,coalesce(p_payload->>'status','active'),uid,now()) on conflict(id) do update set title=excluded.title,description=excluded.description,external_url=excluded.external_url,provider_name=excluded.provider_name,category=excluded.category,country_code=excluded.country_code,base_reward_ngn=excluded.base_reward_ngn,required_level=excluded.required_level,required_seconds=excluded.required_seconds,daily_claim_limit=excluded.daily_claim_limit,total_claim_limit=excluded.total_claim_limit,approval_type=excluded.approval_type,proof_type=excluded.proof_type,proof_required=excluded.proof_required,instructions=excluded.instructions,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,updated_at=now();insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,case when p_id is null then 'task_create' else 'task_update' end,'task',tid,p_payload);return tid;end;$$;
create or replace function public.admin_review_task_claim(p_claim uuid,p_decision text,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;credited bigint:=0;
begin if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;if p_decision not in('approved','rejected') then raise exception 'Invalid decision';end if;select * into c from public.earnchat_task_claims where id=p_claim for update;if not found or c.status<>'pending' then raise exception 'Claim is not pending';end if;update public.profiles set work_pending_balance=greatest(0,work_pending_balance-c.reward_amount),task_rejection_count=task_rejection_count+case when p_decision='rejected' then 1 else 0 end where id=c.user_id;if p_decision='approved' then credited:=public.earnchat_credit(c.user_id,'work','task',c.id,c.reward_amount,c.country_code,'Admin-approved task');perform public.mark_earnchat_active_day(c.user_id);end if;update public.earnchat_task_claims set status=p_decision,review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=c.id;insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'task_claim_'||p_decision,'task_claim',c.id,jsonb_build_object('reason',p_reason,'credited',credited));return jsonb_build_object('ok',true,'status',p_decision,'credited',credited);end;$$;
create or replace function public.admin_review_earnchat_kyc(p_submission uuid,p_decision text,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();k public.earnchat_kyc_submissions%rowtype;
begin if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;if p_decision not in('approved','rejected') then raise exception 'Invalid decision';end if;select * into k from public.earnchat_kyc_submissions where id=p_submission for update;if not found then raise exception 'KYC unavailable';end if;update public.earnchat_kyc_submissions set status=p_decision,review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=k.id;update public.profiles set kyc_status=p_decision,updated_at=now() where id=k.user_id;perform public.evaluate_earnchat_level(k.user_id);insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'kyc_'||p_decision,'kyc',k.id,jsonb_build_object('reason',p_reason));return jsonb_build_object('ok',true);end;$$;
create or replace function public.admin_review_earnchat_withdrawal(p_withdrawal uuid,p_status text,p_reason text default null,p_reference text default null,p_publish boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();w public.earnchat_withdrawals%rowtype;p public.profiles%rowtype;
begin if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;if p_status not in('under_review','approved','processing','paid','rejected','cancelled') then raise exception 'Invalid status';end if;select * into w from public.earnchat_withdrawals where id=p_withdrawal for update;if not found then raise exception 'Withdrawal unavailable';end if;if w.status in('paid','rejected','cancelled') then raise exception 'Withdrawal is already closed';end if;if p_status in('rejected','cancelled') then if w.wallet_type='work' then update public.profiles set work_available_balance=work_available_balance+w.amount where id=w.user_id;else update public.profiles set referral_available_balance=referral_available_balance+w.amount where id=w.user_id;end if;insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at) values(w.user_id,w.wallet_type,'release','withdrawal',w.id,w.amount,w.currency,w.country_code,'approved','Withdrawal refunded',now()) on conflict do nothing;end if;if p_status='paid' then update public.profiles set total_withdrawn=total_withdrawn+w.amount where id=w.user_id;select * into p from public.profiles where id=w.user_id;if p_publish then insert into public.earnchat_payment_activity(withdrawal_id,masked_name,country_code,amount,currency,payout_method,masked_reference,paid_at) values(w.id,left(coalesce(p.full_name,'Member'),1)||'***',w.country_code,w.amount,w.currency,w.payout_method,case when p_reference is null then null else left(p_reference,2)||'•••'||right(p_reference,3) end,now()) on conflict(withdrawal_id) do nothing;end if;end if;update public.earnchat_withdrawals set status=p_status,review_reason=p_reason,transaction_reference=coalesce(p_reference,transaction_reference),reviewed_at=now(),paid_at=case when p_status='paid' then now() else paid_at end where id=w.id;insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'withdrawal_'||p_status,'withdrawal',w.id,jsonb_build_object('reason',p_reason,'reference',p_reference));return jsonb_build_object('ok',true,'status',p_status);end;$$;
create or replace function public.admin_get_earnchat_overview() returns jsonb language plpgsql stable security definer set search_path=public as $$begin if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;return jsonb_build_object('total_users',(select count(*) from public.profiles),'online_now',(select count(distinct coalesce(user_id::text,session_id)) from public.earnchat_site_presence where is_visible and last_seen>now()-interval '90 seconds'),'work_liability',(select coalesce(sum(work_available_balance+work_pending_balance),0) from public.profiles),'referral_liability',(select coalesce(sum(referral_available_balance+referral_pending_balance),0) from public.profiles),'pending_tasks',(select count(*) from public.earnchat_task_claims where status='pending'),'pending_withdrawals',(select count(*) from public.earnchat_withdrawals where status in('submitted','under_review')),'pending_kyc',(select count(*) from public.earnchat_kyc_submissions where status in('submitted','under_review')));end;$$;

-- RLS
alter table public.earnchat_active_days enable row level security;alter table public.earnchat_tasks enable row level security;alter table public.earnchat_task_claims enable row level security;alter table public.earnchat_chat_sessions enable row level security;alter table public.earnchat_referrals enable row level security;alter table public.earnchat_ledger enable row level security;alter table public.earnchat_withdrawals enable row level security;alter table public.earnchat_payment_activity enable row level security;alter table public.earnchat_member_feedback enable row level security;alter table public.earnchat_kyc_submissions enable row level security;alter table public.earnchat_site_presence enable row level security;alter table public.earnchat_admin_audit enable row level security;
drop policy if exists earnchat_tasks_read on public.earnchat_tasks;create policy earnchat_tasks_read on public.earnchat_tasks for select using(status='active' or public.earnchat_is_admin());
drop policy if exists earnchat_claims_own on public.earnchat_task_claims;create policy earnchat_claims_own on public.earnchat_task_claims for select using(auth.uid()=user_id or public.earnchat_is_admin());
drop policy if exists earnchat_chats_own on public.earnchat_chat_sessions;create policy earnchat_chats_own on public.earnchat_chat_sessions for select using(auth.uid()=user_id or public.earnchat_is_admin());
drop policy if exists earnchat_refs_own on public.earnchat_referrals;create policy earnchat_refs_own on public.earnchat_referrals for select using(auth.uid() in(referrer_id,referred_id) or public.earnchat_is_admin());
drop policy if exists earnchat_ledger_own on public.earnchat_ledger;create policy earnchat_ledger_own on public.earnchat_ledger for select using(auth.uid()=user_id or public.earnchat_is_admin());
drop policy if exists earnchat_withdrawals_own on public.earnchat_withdrawals;create policy earnchat_withdrawals_own on public.earnchat_withdrawals for select using(auth.uid()=user_id or public.earnchat_is_admin());
drop policy if exists earnchat_payments_public on public.earnchat_payment_activity;create policy earnchat_payments_public on public.earnchat_payment_activity for select using((is_visible and is_verified) or public.earnchat_is_admin());
drop policy if exists earnchat_feedback_public on public.earnchat_member_feedback;create policy earnchat_feedback_public on public.earnchat_member_feedback for select using((is_visible and verified_paid_member) or public.earnchat_is_admin());
drop policy if exists earnchat_kyc_own on public.earnchat_kyc_submissions;create policy earnchat_kyc_own on public.earnchat_kyc_submissions for select using(auth.uid()=user_id or public.earnchat_is_admin());
drop policy if exists earnchat_presence_admin on public.earnchat_site_presence;create policy earnchat_presence_admin on public.earnchat_site_presence for select using(public.earnchat_is_admin());
drop policy if exists earnchat_audit_admin on public.earnchat_admin_audit;create policy earnchat_audit_admin on public.earnchat_admin_audit for select using(public.earnchat_is_admin());

-- Grants
revoke all on function public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_earnchat_business_config() to anon,authenticated;
grant execute on function public.ensure_earnchat_profile(text,text) to authenticated;
grant execute on function public.get_my_earnchat_state() to authenticated;
grant execute on function public.list_earnchat_tasks() to authenticated;
grant execute on function public.start_earnchat_task(uuid) to authenticated;
grant execute on function public.submit_earnchat_task(uuid,jsonb) to authenticated;
grant execute on function public.complete_earnchat_chat(int,int,jsonb) to authenticated;
grant execute on function public.register_earnchat_referral(text) to authenticated;
grant execute on function public.submit_earnchat_kyc(text,jsonb) to authenticated;
grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated;
grant execute on function public.upsert_earnchat_presence(text,text,text,boolean,text,text,text) to anon,authenticated;
grant execute on function public.mark_earnchat_presence_inactive(text) to anon,authenticated;
grant execute on function public.get_public_earnchat_stats() to anon,authenticated;
grant execute on function public.earnchat_is_admin() to authenticated;
grant execute on function public.admin_list_earnchat_tasks() to authenticated;
grant execute on function public.admin_upsert_earnchat_task(uuid,jsonb) to authenticated;
grant execute on function public.admin_review_task_claim(uuid,text,text) to authenticated;
grant execute on function public.admin_review_earnchat_kyc(uuid,text,text) to authenticated;
grant execute on function public.admin_review_earnchat_withdrawal(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.admin_get_earnchat_overview() to authenticated;

-- Preserve existing old balance once when new balance is empty
update public.profiles set work_available_balance=coalesce(balance,0) where coalesce(work_available_balance,0)=0 and coalesce(balance,0)>0;
update public.profiles set currency=case when country='KE' then 'KES' else 'NGN' end,kyc_status=case when coalesce(kyc_done,false) then 'approved' when coalesce(kyc_pending,false) then 'submitted' else kyc_status end,updated_at=now();
commit;
