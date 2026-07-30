-- Earn Chat production verification. Read-only. Run after all production migrations.
with required_tables(name) as (values
 ('profiles'),('earnchat_business_settings'),('earnchat_level_settings'),('earnchat_active_days'),
 ('earnchat_tasks'),('earnchat_task_claims'),('earnchat_chat_attempts'),('earnchat_chat_sessions'),('earnchat_referrals'),
 ('earnchat_ledger'),('earnchat_withdrawals'),('earnchat_payment_activity'),('earnchat_member_feedback'),
 ('earnchat_kyc_submissions'),('earnchat_site_presence'),('earnchat_admin_audit'),
 ('earnchat_qualification_missions'),('earnchat_qualification_submissions'),('earnchat_analytics_events')
), required_functions(name,signature) as (values
 ('ensure_earnchat_profile','ensure_earnchat_profile(text,text)'),('get_my_earnchat_state','get_my_earnchat_state()'),
 ('get_earnchat_business_config','get_earnchat_business_config()'),('list_earnchat_tasks','list_earnchat_tasks()'),
 ('start_earnchat_task','start_earnchat_task(uuid)'),('submit_earnchat_task','submit_earnchat_task(uuid,jsonb)'),
 ('start_earnchat_chat','start_earnchat_chat(text)'),('complete_earnchat_chat','complete_earnchat_chat(uuid,jsonb,jsonb)'),
 ('register_earnchat_referral','register_earnchat_referral(text)'),('submit_earnchat_kyc','submit_earnchat_kyc(text,jsonb)'),
 ('request_earnchat_withdrawal','request_earnchat_withdrawal(text,bigint,text,jsonb)'),
 ('upsert_earnchat_presence','upsert_earnchat_presence(text,text,text,boolean,text,text,text)'),
 ('mark_earnchat_presence_inactive','mark_earnchat_presence_inactive(text)'),('get_public_earnchat_stats','get_public_earnchat_stats()'),
 ('record_earnchat_event','record_earnchat_event(text,text,text,jsonb)'),
 ('start_earnchat_qualification','start_earnchat_qualification(uuid)'),('submit_earnchat_qualification','submit_earnchat_qualification(uuid,jsonb)'),
 ('earnchat_is_admin','earnchat_is_admin()'),('admin_upsert_earnchat_task','admin_upsert_earnchat_task(uuid,jsonb)'),
 ('admin_delete_earnchat_task','admin_delete_earnchat_task(uuid)'),('admin_review_task_claim','admin_review_task_claim(uuid,text,text)'),
 ('admin_reverse_task_claim','admin_reverse_task_claim(uuid,text)'),('admin_reverse_earnchat_chat','admin_reverse_earnchat_chat(uuid,text)'),
 ('admin_review_earnchat_referral','admin_review_earnchat_referral(uuid,text,text)'),
 ('admin_review_earnchat_kyc','admin_review_earnchat_kyc(uuid,text,text)'),
 ('admin_review_earnchat_withdrawal','admin_review_earnchat_withdrawal(uuid,text,text,text,boolean)'),
 ('admin_upsert_earnchat_qualification','admin_upsert_earnchat_qualification(uuid,jsonb)'),
 ('admin_review_earnchat_qualification','admin_review_earnchat_qualification(uuid,text,text)'),
 ('admin_upsert_earnchat_feedback','admin_upsert_earnchat_feedback(uuid,text,text,boolean,boolean)'),
 ('admin_set_payment_visibility','admin_set_payment_visibility(uuid,boolean)'),
 ('admin_update_earnchat_business_settings','admin_update_earnchat_business_settings(jsonb)'),
 ('admin_update_earnchat_level','admin_update_earnchat_level(text,jsonb)'),
 ('admin_update_earnchat_user_control','admin_update_earnchat_user_control(uuid,text,text)'),
 ('admin_get_earnchat_overview','admin_get_earnchat_overview()')
)
select 'table' object_type,name,to_regclass('public.'||name) is not null exists from required_tables
union all select 'function',name,to_regprocedure('public.'||signature) is not null from required_functions order by object_type,name;

select 'business_settings' check_name,to_jsonb(s) result from public.earnchat_business_settings s where id=true;
select 'level_settings' check_name,jsonb_agg(to_jsonb(l) order by rank) result from public.earnchat_level_settings l;
select 'admin_accounts' check_name,coalesce(jsonb_agg(jsonb_build_object('email',email,'is_admin',is_admin)),'[]'::jsonb) result from public.profiles where is_admin;
select 'rls' check_name,tablename,rowsecurity from pg_tables where schemaname='public' and (tablename='profiles' or tablename like 'earnchat_%') order by tablename;

select 'internal_helper_privilege_leak' check_name,p.proname,r.rolname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
where n.nspname='public' and p.proname in('earnchat_credit','mark_earnchat_active_day','refresh_earnchat_referral_qualification','evaluate_earnchat_level')
 and r.rolname in('anon','authenticated') and has_function_privilege(r.rolname,p.oid,'EXECUTE');
select 'obsolete_chat_rpc_executable' check_name,r.rolname
from pg_roles r where r.rolname in('anon','authenticated')
 and to_regprocedure('public.complete_earnchat_chat(integer,integer,jsonb)') is not null
 and has_function_privilege(r.rolname,'public.complete_earnchat_chat(integer,integer,jsonb)','EXECUTE');

select 'duplicate_open_withdrawals' check_name,user_id,wallet_type,count(*) from public.earnchat_withdrawals where status in('submitted','under_review','approved','processing') group by user_id,wallet_type having count(*)>1;
select 'duplicate_started_chat_attempts' check_name,user_id,count(*) from public.earnchat_chat_attempts where status='started' group by user_id having count(*)>1;
select 'expired_started_chat_attempts' check_name,id,user_id,expires_at from public.earnchat_chat_attempts where status='started' and expires_at<=now();
select 'duplicate_task_credits' check_name,user_id,source_id,count(*) from public.earnchat_ledger where source_type='task' and entry_type='credit' group by user_id,source_id having count(*)>1;
select 'duplicate_chat_credits' check_name,user_id,source_id,count(*) from public.earnchat_ledger where source_type='chat' and entry_type='credit' group by user_id,source_id having count(*)>1;
select 'duplicate_referral_credits' check_name,user_id,source_id,count(*) from public.earnchat_ledger where source_type='referral' and entry_type='credit' group by user_id,source_id having count(*)>1;

with ledger_balances as (
 select user_id,wallet_type,coalesce(sum(case when entry_type in('credit','release') and status='approved' then amount when entry_type in('debit','hold','reversal') and status='approved' then -amount else 0 end),0) calculated
 from public.earnchat_ledger group by user_id,wallet_type)
select 'wallet_mismatch' check_name,p.id,p.email,l.wallet_type,l.calculated,case when l.wallet_type='work' then p.work_available_balance else p.referral_available_balance end profile_balance
from ledger_balances l join public.profiles p on p.id=l.user_id
where l.calculated<>case when l.wallet_type='work' then p.work_available_balance else p.referral_available_balance end;

select 'pending_task_balance_mismatch' check_name,p.id,p.email,p.work_pending_balance,coalesce((select sum(c.reward_amount) from public.earnchat_task_claims c where c.user_id=p.id and c.status='pending'),0) calculated_pending
from public.profiles p where p.work_pending_balance<>coalesce((select sum(c.reward_amount) from public.earnchat_task_claims c where c.user_id=p.id and c.status='pending'),0);
select 'pending_referral_balance_mismatch' check_name,p.id,p.email,p.referral_pending_balance,coalesce((select sum(r.reward_amount) from public.earnchat_referrals r where r.referrer_id=p.id and r.status='under_review'),0) calculated_pending
from public.profiles p where p.referral_pending_balance<>coalesce((select sum(r.reward_amount) from public.earnchat_referrals r where r.referrer_id=p.id and r.status='under_review'),0);
select 'invalid_country_currency' check_name,id,email,country,currency from public.profiles where (country='NG' and currency<>'NGN') or (country='KE' and currency<>'KES');
select 'missing_referral_code' check_name,id,email from public.profiles where referral_code is null or referral_code='';
select 'approved_chat_without_attempt' check_name,c.id,c.user_id from public.earnchat_chat_sessions c where c.status='approved' and not (c.quality_flags ? 'attempt_id');
select 'invalid_chat_credit' check_name,c.id,c.user_id,c.reward_amount,l.amount ledger_amount from public.earnchat_chat_sessions c left join public.earnchat_ledger l on l.source_type='chat' and l.source_id=c.id and l.entry_type='credit' where c.status='approved' and coalesce(l.amount,-1)<>c.reward_amount;
select 'invalid_task_credit' check_name,c.id,c.user_id,c.reward_amount,l.amount ledger_amount from public.earnchat_task_claims c left join public.earnchat_ledger l on l.source_type='task' and l.source_id=c.id and l.entry_type='credit' where c.status='approved' and coalesce(l.amount,-1)<>c.reward_amount;

select 'configuration_summary' check_name,jsonb_build_object('version',(select version from public.earnchat_business_settings where id=true),'nigeria_multiplier',(select nigeria_multiplier from public.earnchat_business_settings where id=true),'kenya_multiplier',(select kenya_multiplier from public.earnchat_business_settings where id=true),'daily_cap_ngn',(select daily_cap_ngn from public.earnchat_business_settings where id=true),'levels',(select jsonb_object_agg(level_name,to_jsonb(l)-'level_name') from public.earnchat_level_settings l)) result;
