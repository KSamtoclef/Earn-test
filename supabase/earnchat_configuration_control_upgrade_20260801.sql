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
