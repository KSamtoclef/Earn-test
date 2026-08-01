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
