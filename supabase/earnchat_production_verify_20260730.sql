-- Earn Chat production verification. Read-only.
with required_tables(name) as (values
 ('profiles'),('earnchat_business_settings'),('earnchat_level_settings'),('earnchat_active_days'),
 ('earnchat_tasks'),('earnchat_task_claims'),('earnchat_chat_sessions'),('earnchat_referrals'),
 ('earnchat_ledger'),('earnchat_withdrawals'),('earnchat_payment_activity'),('earnchat_member_feedback'),
 ('earnchat_kyc_submissions'),('earnchat_site_presence'),('earnchat_admin_audit')
), table_status as (
 select r.name, to_regclass('public.'||r.name) is not null as exists from required_tables r
), required_functions(name,signature) as (values
 ('ensure_earnchat_profile','ensure_earnchat_profile(text,text)'),
 ('get_my_earnchat_state','get_my_earnchat_state()'),
 ('list_earnchat_tasks','list_earnchat_tasks()'),
 ('start_earnchat_task','start_earnchat_task(uuid)'),
 ('submit_earnchat_task','submit_earnchat_task(uuid,jsonb)'),
 ('complete_earnchat_chat','complete_earnchat_chat(integer,integer,jsonb)'),
 ('register_earnchat_referral','register_earnchat_referral(text)'),
 ('request_earnchat_withdrawal','request_earnchat_withdrawal(text,bigint,text,jsonb)'),
 ('earnchat_is_admin','earnchat_is_admin()'),
 ('admin_upsert_earnchat_task','admin_upsert_earnchat_task(uuid,jsonb)'),
 ('admin_review_task_claim','admin_review_task_claim(uuid,text,text)'),
 ('admin_review_earnchat_kyc','admin_review_earnchat_kyc(uuid,text,text)'),
 ('admin_review_earnchat_withdrawal','admin_review_earnchat_withdrawal(uuid,text,text,text,boolean)'),
 ('admin_get_earnchat_overview','admin_get_earnchat_overview()')
), function_status as (
 select name,to_regprocedure('public.'||signature) is not null as exists from required_functions
)
select 'table' as object_type,name,exists from table_status
union all
select 'function',name,exists from function_status
order by object_type,name;

select 'business_settings' as check_name,to_jsonb(s) as result from public.earnchat_business_settings s where id=true;
select 'level_settings' as check_name,jsonb_agg(to_jsonb(l) order by rank) as result from public.earnchat_level_settings l;
select 'admin_accounts' as check_name,jsonb_agg(jsonb_build_object('email',email,'is_admin',is_admin)) as result from public.profiles where is_admin;

select 'rls' as check_name,tablename,rowsecurity from pg_tables where schemaname='public' and tablename like 'earnchat_%' order by tablename;

select 'duplicate_open_withdrawals' as check_name,user_id,wallet_type,count(*)
from public.earnchat_withdrawals
where status in('submitted','under_review','approved','processing')
group by user_id,wallet_type having count(*)>1;

select 'duplicate_task_credits' as check_name,user_id,source_id,count(*)
from public.earnchat_ledger where source_type='task' and entry_type='credit'
group by user_id,source_id having count(*)>1;

select 'duplicate_chat_credits' as check_name,user_id,source_id,count(*)
from public.earnchat_ledger where source_type='chat' and entry_type='credit'
group by user_id,source_id having count(*)>1;

select 'duplicate_referral_credits' as check_name,user_id,source_id,count(*)
from public.earnchat_ledger where source_type='referral' and entry_type='credit'
group by user_id,source_id having count(*)>1;

with ledger_balances as (
 select user_id,wallet_type,
  coalesce(sum(case when entry_type in('credit','release') and status='approved' then amount when entry_type in('debit','hold','reversal') and status='approved' then -amount else 0 end),0) as calculated
 from public.earnchat_ledger group by user_id,wallet_type
)
select 'wallet_mismatch' as check_name,p.id,p.email,l.wallet_type,l.calculated,
 case when l.wallet_type='work' then p.work_available_balance else p.referral_available_balance end as profile_balance
from ledger_balances l join public.profiles p on p.id=l.user_id
where l.calculated<>case when l.wallet_type='work' then p.work_available_balance else p.referral_available_balance end;

select 'pending_task_balance_mismatch' as check_name,p.id,p.email,p.work_pending_balance,
 coalesce((select sum(c.reward_amount) from public.earnchat_task_claims c where c.user_id=p.id and c.status='pending'),0) as calculated_pending
from public.profiles p
where p.work_pending_balance<>coalesce((select sum(c.reward_amount) from public.earnchat_task_claims c where c.user_id=p.id and c.status='pending'),0);

select 'invalid_country_currency' as check_name,id,email,country,currency from public.profiles
where (country='NG' and currency<>'NGN') or (country='KE' and currency<>'KES');

select 'configuration_summary' as check_name,
 jsonb_build_object(
  'nigeria_multiplier',(select nigeria_multiplier from public.earnchat_business_settings where id=true),
  'kenya_multiplier',(select kenya_multiplier from public.earnchat_business_settings where id=true),
  'daily_cap_ngn',(select daily_cap_ngn from public.earnchat_business_settings where id=true),
  'starter',(select to_jsonb(l) from public.earnchat_level_settings l where level_name='Starter'),
  'active',(select to_jsonb(l) from public.earnchat_level_settings l where level_name='Active'),
  'pro',(select to_jsonb(l) from public.earnchat_level_settings l where level_name='Pro'),
  'elite',(select to_jsonb(l) from public.earnchat_level_settings l where level_name='Elite')
 ) as result;
