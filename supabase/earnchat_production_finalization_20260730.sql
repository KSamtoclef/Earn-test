-- Run after earnchat_production_integrity_20260730.sql
begin;

-- Internal helpers must never be callable directly by browser roles.
revoke all on function public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.mark_earnchat_active_day(uuid) from public,anon,authenticated;
revoke all on function public.refresh_earnchat_referral_qualification(uuid) from public,anon,authenticated;
revoke all on function public.evaluate_earnchat_level(uuid) from public,anon,authenticated;
revoke all on function public.complete_earnchat_chat(integer,integer,jsonb) from public,anon,authenticated;

-- A server-created attempt proves when a rewarded guided chat actually began.
create table if not exists public.earnchat_chat_attempts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 partner_key text,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '30 minutes'),
 completed_at timestamptz,
 status text not null default 'started' check(status in('started','completed','expired','cancelled'))
);
create unique index if not exists earnchat_one_started_chat_attempt on public.earnchat_chat_attempts(user_id) where status='started';
create index if not exists earnchat_chat_attempt_user_idx on public.earnchat_chat_attempts(user_id,started_at desc);
alter table public.earnchat_chat_attempts enable row level security;
drop policy if exists earnchat_chat_attempts_own on public.earnchat_chat_attempts;
create policy earnchat_chat_attempts_own on public.earnchat_chat_attempts for select using(auth.uid()=user_id or public.earnchat_is_admin());

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;attempt_id uuid;reward bigint;
begin
 if uid is null then raise exception 'Authentication required';end if;
 select * into p from public.profiles where id=uid;
 if not found then raise exception 'Profile unavailable';end if;
 if p.earning_suspended or p.security_review_required then raise exception 'Earning is unavailable while account review is active';end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached';end if;
 update public.earnchat_chat_attempts set status='expired' where user_id=uid and status='started' and expires_at<=now();
 if exists(select 1 from public.earnchat_chat_attempts where user_id=uid and status='started') then raise exception 'Finish or wait for the current guided chat attempt to expire';end if;
 insert into public.earnchat_chat_attempts(user_id,partner_key) values(uid,nullif(trim(p_partner),'')) returning id into attempt_id;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);
 return jsonb_build_object('attempt_id',attempt_id,'started_at',now(),'required_replies',4,'required_seconds',120,'reward',reward,'currency',p.currency,'remaining',l.chat_limit-cnt);
end;$$;

create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();a public.earnchat_chat_attempts%rowtype;p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;valid_count int;distinct_count int;reward bigint;credited bigint;curr text;sid uuid;duration_seconds int;hashes jsonb;
begin
 if uid is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(p_replies)<>'array' or jsonb_array_length(p_replies)<>4 then raise exception 'Exactly four replies are required';end if;
 select count(*),count(distinct lower(regexp_replace(trim(value #>> '{}'),'\s+',' ','g'))),jsonb_agg(encode(digest(lower(regexp_replace(trim(value #>> '{}'),'\s+',' ','g')),'sha256'),'hex'))
 into valid_count,distinct_count,hashes
 from jsonb_array_elements(p_replies)
 where jsonb_typeof(value)='string' and length(trim(value #>> '{}'))>=12;
 if valid_count<>4 or distinct_count<>4 then raise exception 'Use four different meaningful replies';end if;
 select * into a from public.earnchat_chat_attempts where id=p_attempt and user_id=uid for update;
 if not found or a.status<>'started' then raise exception 'Guided chat attempt is unavailable';end if;
 if a.expires_at<=now() then update public.earnchat_chat_attempts set status='expired' where id=a.id;raise exception 'Guided chat attempt expired';end if;
 duration_seconds:=floor(extract(epoch from(now()-a.started_at)))::int;
 if duration_seconds<120 then raise exception 'Remain in the guided chat for at least two minutes';end if;
 select * into p from public.profiles where id=uid;
 if p.earning_suspended or p.security_review_required then raise exception 'Earning is unavailable while account review is active';end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached';end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);curr:=p.currency;
 insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags)
 values(uid,l.level_name,4,duration_seconds,'approved',reward,curr,p.country,coalesce(p_quality,'{}'::jsonb)||jsonb_build_object('attempt_id',a.id,'reply_hashes',hashes)) returning id into sid;
 credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided chat');
 update public.earnchat_chat_attempts set status='completed',completed_at=now() where id=a.id;
 perform public.mark_earnchat_active_day(uid);
 return jsonb_build_object('ok',true,'session_id',sid,'amount',credited,'currency',curr,'remaining',l.chat_limit-cnt-1,'duration_seconds',duration_seconds);
end;$$;

-- Task reversal must reverse both the wallet and the approved-task counter.
create or replace function public.admin_reverse_task_claim(p_claim uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;available bigint;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 select * into c from public.earnchat_task_claims where id=p_claim for update;
 if not found or c.status<>'approved' then raise exception 'Only approved claims can be reversed';end if;
 select work_available_balance into available from public.profiles where id=c.user_id for update;
 update public.profiles set work_available_balance=greatest(0,work_available_balance-c.reward_amount),approved_tasks_count=greatest(0,approved_tasks_count-1),task_rejection_count=task_rejection_count+1,security_review_required=case when available<c.reward_amount then true else security_review_required end,updated_at=now() where id=c.user_id;
 update public.earnchat_task_claims set status='reversed',review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=c.id;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(c.user_id,'work','reversal','task',c.id,c.reward_amount,c.currency,c.country_code,'approved',coalesce(p_reason,'Task claim reversed'),now()) on conflict do nothing;
 perform public.evaluate_earnchat_level(c.user_id);
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'task_claim_reversed','task_claim',c.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true);
end;$$;

create index if not exists earnchat_claim_status_idx on public.earnchat_task_claims(status,submitted_at desc);
create index if not exists earnchat_withdrawal_status_idx on public.earnchat_withdrawals(status,created_at desc);
create index if not exists earnchat_referral_status_idx on public.earnchat_referrals(status,signup_at desc);
create index if not exists earnchat_kyc_status_idx on public.earnchat_kyc_submissions(status,created_at desc);
create index if not exists earnchat_chat_user_completed_idx on public.earnchat_chat_sessions(user_id,completed_at desc);
create index if not exists earnchat_ledger_user_created_idx on public.earnchat_ledger(user_id,created_at desc);

update public.earnchat_business_settings set version='2026-07-30-production-final',updated_at=now() where id=true;

grant execute on function public.start_earnchat_chat(text) to authenticated;
grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.admin_reverse_task_claim(uuid,text) to authenticated;
commit;
