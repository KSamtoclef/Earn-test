-- Earn Chat production verification bundle — RUN SECOND
-- Generated from authoritative repository SQL files.
-- Back up the Supabase database before running.
-- Do not edit this bundle directly; edit the source migrations and regenerate.
-- Included files, in order:
-- 1. supabase/earnchat_configuration_control_verify_20260801.sql
-- 2. supabase/earnchat_production_verify.sql

-- ============================================================================
-- BEGIN 1: supabase/earnchat_configuration_control_verify_20260801.sql
-- ============================================================================
-- Earn Chat configuration control verification
-- Read-only checks. Run after earnchat_configuration_control_upgrade_20260801.sql.

select
  version,
  configuration_version,
  updated_at,
  updated_by,
  jsonb_typeof(general_config) as general_type,
  jsonb_typeof(landing_config) as landing_type,
  jsonb_typeof(chat_config) as chat_type,
  jsonb_typeof(task_config) as task_type,
  jsonb_typeof(referral_config) as referral_type,
  jsonb_typeof(withdrawal_config) as withdrawal_type,
  jsonb_typeof(kyc_config) as kyc_type,
  jsonb_typeof(feature_flags) as feature_flags_type
from public.earnchat_business_settings
where id=true;

select 'configuration_rows' as check_name,count(*) as issue_count
from public.earnchat_business_settings
having count(*)<>1;

select 'invalid_configuration_json' as check_name,count(*) as issue_count
from public.earnchat_business_settings
where id=true and (
 jsonb_typeof(general_config)<>'object' or jsonb_typeof(landing_config)<>'object' or
 jsonb_typeof(chat_config)<>'object' or jsonb_typeof(task_config)<>'object' or
 jsonb_typeof(referral_config)<>'object' or jsonb_typeof(withdrawal_config)<>'object' or
 jsonb_typeof(kyc_config)<>'object' or jsonb_typeof(feature_flags)<>'object'
);

select 'duplicate_level_rank' as check_name,count(*) as issue_count
from(
 select rank from public.earnchat_level_settings group by rank having count(*)>1
)q;

select 'invalid_level_amounts' as check_name,count(*) as issue_count
from public.earnchat_level_settings
where coalesce(chat_reward_ngn,0)<0 or coalesce(task_min_ngn,0)<0 or coalesce(task_max_ngn,0)<0
 or coalesce(withdraw_min_ngn,0)<0 or coalesce(withdraw_max_ngn,0)<0
 or coalesce(task_max_ngn,0)<coalesce(task_min_ngn,0)
 or coalesce(withdraw_max_ngn,0)<coalesce(withdraw_min_ngn,0);

select 'invalid_level_order' as check_name,count(*) as issue_count
from(
 select level_name,rank,points_required,lag(points_required) over(order by rank) previous_points
 from public.earnchat_level_settings
)q where previous_points is not null and coalesce(points_required,0)<coalesce(previous_points,0);

select 'unknown_feature_flags' as check_name,count(*) as issue_count
from public.earnchat_business_settings s,
lateral jsonb_object_keys(coalesce(s.feature_flags,'{}'::jsonb)) key
where s.id=true and key not in('guided_chat','tasks','sponsored_visits','referrals','withdrawals','qualifications','social_proof','member_feedback','kyc','upgrade','admin_analytics','public_registration');

select 'unsafe_public_origin' as check_name,count(*) as issue_count
from public.earnchat_business_settings
where id=true and general_config ? 'production_origin'
 and coalesce(general_config->>'production_origin','')<>''
 and general_config->>'production_origin' !~* '^https://[^[:space:]]+$';

select 'invalid_chat_contract' as check_name,count(*) as issue_count
from public.earnchat_business_settings
where id=true and (
 coalesce((chat_config->>'minimum_seconds')::int,45) not between 30 and 900 or
 coalesce((chat_config->>'required_replies')::int,4) not between 1 and 10 or
 coalesce((chat_config->>'minimum_reply_length')::int,12) not between 1 and 500
);

select 'duplicate_open_task_claims' as check_name,count(*) as issue_count
from(
 select user_id,task_id,count(*)
 from public.earnchat_task_claims
 where status in('started','pending')
 group by user_id,task_id having count(*)>1
)q;

select 'duplicate_task_credits' as check_name,count(*) as issue_count
from(
 select user_id,source_id,count(*)
 from public.earnchat_ledger
 where source_type='task' and entry_type in('credit','reward') and source_id is not null
 group by user_id,source_id having count(*)>1
)q;

select 'duplicate_chat_credits' as check_name,count(*) as issue_count
from(
 select user_id,source_id,count(*)
 from public.earnchat_ledger
 where source_type='chat' and entry_type in('credit','reward') and source_id is not null
 group by user_id,source_id having count(*)>1
)q;

select 'recent_configuration_audit' as check_name,count(*) as record_count
from public.earnchat_admin_audit
where action in('configuration_updated','business_settings_updated')
 and created_at>now()-interval '30 days';

select public.get_earnchat_business_config() as normalized_public_configuration;
-- ============================================================================
-- END 1: supabase/earnchat_configuration_control_verify_20260801.sql
-- ============================================================================

-- ============================================================================
-- BEGIN 2: supabase/earnchat_production_verify.sql
-- ============================================================================
-- Earn Chat final consolidated read-only verification
-- Run after the production installer and all current upgrades.

with required_tables(name) as (values
 ('profiles'),('earnchat_business_settings'),('earnchat_level_settings'),('earnchat_active_days'),('earnchat_tasks'),('earnchat_task_claims'),('earnchat_chat_sessions'),('earnchat_chat_attempts'),('earnchat_referrals'),('earnchat_ledger'),('earnchat_withdrawals'),('earnchat_payment_activity'),('earnchat_member_feedback'),('earnchat_kyc_submissions'),('earnchat_site_presence'),('earnchat_admin_audit'),('earnchat_qualification_missions'),('earnchat_qualification_submissions'),('earnchat_analytics_events'),('earnchat_point_events')
),required_functions(signature) as (values
 ('ensure_earnchat_profile(text,text)'),('get_my_earnchat_state()'),('get_earnchat_business_config()'),('list_earnchat_tasks()'),('start_earnchat_task(uuid)'),('submit_earnchat_task(uuid,jsonb)'),('get_my_open_task_claim()'),('cancel_earnchat_task_claim(uuid)'),('start_earnchat_chat(text)'),('complete_earnchat_chat(uuid,jsonb,jsonb)'),('get_my_open_chat_attempt()'),('cancel_earnchat_chat_attempt(uuid)'),('register_earnchat_referral(text)'),('submit_earnchat_kyc(text,jsonb)'),('get_earnchat_kyc_config()'),('request_earnchat_withdrawal(text,bigint,text,jsonb)'),('upsert_earnchat_presence(text,text,text,boolean,text,text,text)'),('mark_earnchat_presence_inactive(text)'),('get_public_earnchat_stats()'),('record_earnchat_event(text,text,text,jsonb)'),('start_earnchat_qualification(uuid)'),('submit_earnchat_qualification(uuid,jsonb)'),('earnchat_is_admin()'),('admin_list_earnchat_tasks()'),('admin_upsert_earnchat_task(uuid,jsonb)'),('admin_delete_earnchat_task(uuid)'),('admin_review_task_claim(uuid,text,text)'),('admin_reverse_task_claim(uuid,text)'),('admin_bulk_review_task_claims(uuid[],text,text)'),('admin_review_earnchat_referral(uuid,text,text)'),('admin_review_earnchat_kyc(uuid,text,text)'),('admin_bulk_review_earnchat_kyc(uuid[],text,text)'),('admin_update_earnchat_kyc_config(jsonb)'),('admin_review_earnchat_withdrawal(uuid,text,text,text,boolean)'),('admin_update_earnchat_user_control(uuid,text,text)'),('admin_bulk_update_user_control(uuid[],text,text)'),('admin_update_earnchat_business_settings(jsonb)'),('admin_update_earnchat_level(text,jsonb)'),('admin_get_earnchat_overview()'),('admin_upsert_earnchat_qualification(uuid,jsonb)'),('admin_review_earnchat_qualification(uuid,text,text)'),('admin_reverse_earnchat_chat(uuid,text)'),('admin_upsert_earnchat_feedback(uuid,text,text,boolean,boolean)'),('admin_set_payment_visibility(uuid,boolean)'),('earnchat_award_points(uuid,text,text,integer,text)'),('earnchat_grant_signup_bonus(uuid)')
)
select 'table' object_type,name object_name,to_regclass('public.'||name) is not null as exists from required_tables
union all
select 'function',signature,to_regprocedure('public.'||signature) is not null from required_functions
order by object_type,object_name;

select 'configuration' check_name,version,signup_bonus_ngn,nigeria_multiplier,kenya_multiplier,daily_cap_ngn,referral_reward_ngn,referral_withdraw_min_ngn,kyc_enabled,kyc_reference_required,kyc_review_hours from public.earnchat_business_settings where id=true;
select 'levels' check_name,level_name,rank,chat_limit,chat_reward_ngn,task_min_ngn,task_max_ngn,withdraw_min_ngn,withdraw_max_ngn,account_days,active_days,approved_chats,approved_tasks,points_required,referral_commission_percent from public.earnchat_level_settings order by rank;
select 'admins' check_name,id,email,is_admin from public.profiles where is_admin=true;

select 'missing_referral_codes' check_name,count(*) problem_count from public.profiles where referral_code is null or trim(referral_code)='';
select 'invalid_country_currency' check_name,count(*) problem_count from public.profiles where(country='NG' and currency<>'NGN')or(country='KE' and currency<>'KES')or country not in('NG','KE');
select 'invalid_kyc_urls' check_name,count(*) problem_count from public.earnchat_business_settings where id=true and((kyc_url_ng is not null and kyc_url_ng!~*'^https://[^[:space:]]+$')or(kyc_url_ke is not null and kyc_url_ke!~*'^https://[^[:space:]]+$'));
select 'invalid_withdrawal_payouts' check_name,count(*) problem_count from public.earnchat_withdrawals w where
 (w.country_code='NG' and(w.payout_method<>'bank' or coalesce(w.payout_snapshot->>'account_number','')!~'^\d{10}$' or nullif(trim(w.payout_snapshot->>'provider'),'') is null or nullif(trim(w.payout_snapshot->>'account_name'),'') is null))
 or(w.country_code='KE' and w.payout_method='mpesa' and(coalesce(w.payout_snapshot->>'account_number','')!~'^254[17]\d{8}$' or nullif(trim(w.payout_snapshot->>'account_name'),'') is null))
 or(w.country_code='KE' and w.payout_method='bank' and(nullif(trim(w.payout_snapshot->>'provider'),'') is null or nullif(trim(w.payout_snapshot->>'account_number'),'') is null or nullif(trim(w.payout_snapshot->>'account_name'),'') is null))
 or w.country_code not in('NG','KE');

select 'duplicate_open_withdrawals' check_name,count(*) problem_count from(select user_id,wallet_type from public.earnchat_withdrawals where status in('submitted','under_review','approved','processing') group by user_id,wallet_type having count(*)>1)x;
select 'duplicate_open_task_claims' check_name,count(*) problem_count from(select user_id from public.earnchat_task_claims where status='started' group by user_id having count(*)>1)x;
select 'expired_started_task_claims' check_name,count(*) problem_count from public.earnchat_task_claims where status='started' and expires_at is not null and expires_at<=now();
select 'duplicate_started_chat_attempts' check_name,count(*) problem_count from(select user_id from public.earnchat_chat_attempts where status='started' and expires_at>now() group by user_id having count(*)>1)x;
select 'expired_started_chat_attempts' check_name,count(*) problem_count from public.earnchat_chat_attempts where status='started' and expires_at<=now();
select 'duplicate_task_credits' check_name,count(*) problem_count from(select user_id,source_id from public.earnchat_ledger where source_type='task' and entry_type='credit' group by user_id,source_id having count(*)>1)x;
select 'duplicate_chat_credits' check_name,count(*) problem_count from(select user_id,source_id from public.earnchat_ledger where source_type='chat' and entry_type='credit' group by user_id,source_id having count(*)>1)x;
select 'duplicate_referral_credits' check_name,count(*) problem_count from(select user_id,source_id from public.earnchat_ledger where source_type='referral' and entry_type='credit' group by user_id,source_id having count(*)>1)x;

select 'duplicate_signup_bonuses' check_name,count(*) problem_count from(select user_id from public.earnchat_ledger where source_type='signup_bonus' and entry_type='credit' and status='approved' group by user_id having count(*)>1)x;
select 'missing_signup_bonuses' check_name,count(*) problem_count from public.profiles p where not exists(select 1 from public.earnchat_ledger l where l.user_id=p.id and l.source_type='signup_bonus' and l.entry_type='credit' and l.status='approved');
select 'invalid_signup_bonus_amounts' check_name,count(*) problem_count from public.earnchat_ledger l join public.profiles p on p.id=l.user_id cross join public.earnchat_business_settings s where s.id=true and l.source_type='signup_bonus' and l.entry_type='credit' and l.status='approved' and l.amount<>round(s.signup_bonus_ngn*case when p.country='KE' then s.kenya_multiplier else s.nigeria_multiplier end)::bigint;
select 'duplicate_point_events' check_name,count(*) problem_count from(select user_id,source_type,source_key from public.earnchat_point_events group by user_id,source_type,source_key having count(*)>1)x;
select 'activity_point_mismatches' check_name,count(*) problem_count from public.profiles p where p.activity_points<>coalesce((select sum(e.points) from public.earnchat_point_events e where e.user_id=p.id),0);
select 'invalid_point_values' check_name,count(*) problem_count from public.earnchat_point_events where points<=0;
select 'duplicate_referral_commissions' check_name,count(*) problem_count from(select user_id,source_id from public.earnchat_ledger where source_type='referral_commission' and entry_type='credit' group by user_id,source_id having count(*)>1)x;
select 'invalid_referral_commissions' check_name,count(*) problem_count from public.earnchat_ledger where source_type='referral_commission' and(entry_type<>'credit' or wallet_type<>'referral' or amount<=0 or status<>'approved');
select 'invalid_level_points_or_commission' check_name,count(*) problem_count from public.earnchat_level_settings where points_required<0 or referral_commission_percent not between 1 and 7;
select 'invalid_level_point_contract' check_name,count(*) problem_count from public.earnchat_level_settings where(level_name='Starter' and points_required<>0)or(level_name='Active' and points_required<>50)or(level_name='Pro' and points_required<>150)or(level_name='Elite' and points_required<>300);
select 'invalid_level_commission_contract' check_name,count(*) problem_count from public.earnchat_level_settings where(level_name='Starter' and referral_commission_percent<>1)or(level_name='Active' and referral_commission_percent<>3)or(level_name='Pro' and referral_commission_percent<>5)or(level_name='Elite' and referral_commission_percent<>7);
select 'invalid_member_motivation_settings' check_name,count(*) problem_count from public.earnchat_business_settings where id=true and(signup_bonus_ngn<>2000 or referral_reward_ngn<>500 or version<>'20260731-production-complete-r1');
select 'chat_minimum_contract' check_name,case when coalesce(pg_get_functiondef(to_regprocedure('public.complete_earnchat_chat(uuid,jsonb,jsonb)')),'') like '%<45%' and coalesce(pg_get_functiondef(to_regprocedure('public.start_earnchat_chat(text)')),'') like '%minimum_seconds'',45%' then 0 else 1 end problem_count;
select 'admin_overview_contract' check_name,case when coalesce(pg_get_functiondef(to_regprocedure('public.admin_get_earnchat_overview()')),'') like '%suspicious_accounts%' and coalesce(pg_get_functiondef(to_regprocedure('public.admin_get_earnchat_overview()')),'') like '%work_liability_ngn%' and coalesce(pg_get_functiondef(to_regprocedure('public.admin_get_earnchat_overview()')),'') like '%referral_liability_kes%' then 0 else 1 end problem_count;

select 'pending_task_balance_mismatch' check_name,count(*) problem_count from public.profiles p where p.work_pending_balance<>coalesce((select sum(c.reward_amount) from public.earnchat_task_claims c where c.user_id=p.id and c.status='pending'),0);
select 'pending_referral_balance_mismatch' check_name,count(*) problem_count from public.profiles p where p.referral_pending_balance<>coalesce((select sum(r.reward_amount) from public.earnchat_referrals r where r.referrer_id=p.id and r.status='under_review'),0);
select 'rls_disabled' check_name,count(*) problem_count from pg_tables where schemaname='public' and tablename like 'earnchat_%' and not rowsecurity;

with ledger_balance as(
 select user_id,wallet_type,coalesce(sum(case when entry_type in('credit','release') and status='approved' then amount when entry_type in('hold','debit','reversal') and status='approved' then -amount else 0 end),0) calculated from public.earnchat_ledger group by user_id,wallet_type
)
select 'wallet_mismatches' check_name,count(*) problem_count from ledger_balance l join public.profiles p on p.id=l.user_id where l.calculated<>case when l.wallet_type='work' then p.work_available_balance else p.referral_available_balance end;

select 'Earn Chat verification finished. Every object row must show exists=true and every problem_count must be 0.' as result;
-- ============================================================================
-- END 2: supabase/earnchat_production_verify.sql
-- ============================================================================
