-- Earn Chat Admin/runtime configuration unification
-- Run after earnchat_final_task_runtime_20260802.sql. Idempotent.
begin;

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
  'referrals',coalesce(s.referral_config,'{}'::jsonb)||jsonb_build_object(
    'fixed_reward_ngn',s.referral_reward_ngn,
    'required_active_days',s.referral_required_active_days,
    'referrer_account_days',s.referrer_account_days,
    'direct_referral_only',true
  ),
  'withdrawals',coalesce(s.withdrawal_config,'{}'::jsonb)||jsonb_build_object(
    'referral_minimum_ngn',s.referral_withdraw_min_ngn
  ),
  'kyc',coalesce(s.kyc_config,'{}'::jsonb)||jsonb_build_object(
    'enabled',s.kyc_enabled,
    'provider_ng',s.kyc_provider_ng,
    'provider_ke',s.kyc_provider_ke,
    'provider_url_ng',coalesce(s.kyc_url_ng,''),
    'provider_url_ke',coalesce(s.kyc_url_ke,''),
    'instructions_ng',s.kyc_instructions_ng,
    'instructions_ke',s.kyc_instructions_ke,
    'reference_required',s.kyc_reference_required,
    'review_hours',s.kyc_review_hours
  ),
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
declare clean jsonb;before_value jsonb;after_value jsonb;new_version bigint;
begin
 perform public.earnchat_assert_admin();
 clean:=public.earnchat_validate_configuration_section(p_section,coalesce(p_payload,'{}'::jsonb));
 select case p_section
  when 'general' then coalesce(general_config,'{}'::jsonb)
  when 'landing' then coalesce(landing_config,'{}'::jsonb)
  when 'chat' then coalesce(chat_config,'{}'::jsonb)
  when 'tasks' then coalesce(task_config,'{}'::jsonb)
  when 'referrals' then coalesce(referral_config,'{}'::jsonb)
  when 'withdrawals' then coalesce(withdrawal_config,'{}'::jsonb)
  when 'kyc' then coalesce(kyc_config,'{}'::jsonb)
  when 'feature_flags' then coalesce(feature_flags,'{}'::jsonb)
  else null end into before_value
 from public.earnchat_business_settings where id=true;
 if before_value is null then raise exception 'Unsupported configuration section: %',p_section using errcode='22023'; end if;
 after_value:=before_value||clean;
 case p_section
  when 'general' then update public.earnchat_business_settings set general_config=after_value,configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid() where id=true returning configuration_version into new_version;
  when 'landing' then update public.earnchat_business_settings set landing_config=after_value,configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid() where id=true returning configuration_version into new_version;
  when 'chat' then update public.earnchat_business_settings set chat_config=after_value,configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid() where id=true returning configuration_version into new_version;
  when 'tasks' then update public.earnchat_business_settings set task_config=after_value,configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid() where id=true returning configuration_version into new_version;
  when 'referrals' then
   after_value:=jsonb_set(after_value,'{direct_referral_only}','true'::jsonb,true);
   update public.earnchat_business_settings set referral_config=after_value,
    referral_reward_ngn=coalesce((after_value->>'fixed_reward_ngn')::bigint,referral_reward_ngn),
    referral_required_active_days=coalesce((after_value->>'required_active_days')::int,referral_required_active_days),
    referrer_account_days=coalesce((after_value->>'referrer_account_days')::int,referrer_account_days),
    configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid()
   where id=true returning configuration_version into new_version;
  when 'withdrawals' then
   update public.earnchat_business_settings set withdrawal_config=after_value,
    referral_withdraw_min_ngn=coalesce((after_value->>'referral_minimum_ngn')::bigint,referral_withdraw_min_ngn),
    configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid()
   where id=true returning configuration_version into new_version;
  when 'kyc' then
   update public.earnchat_business_settings set kyc_config=after_value,
    kyc_enabled=coalesce((after_value->>'enabled')::boolean,kyc_enabled),
    kyc_provider_ng=coalesce(nullif(trim(after_value->>'provider_ng'),''),kyc_provider_ng),
    kyc_provider_ke=coalesce(nullif(trim(after_value->>'provider_ke'),''),kyc_provider_ke),
    kyc_url_ng=nullif(trim(after_value->>'provider_url_ng'),''),
    kyc_url_ke=nullif(trim(after_value->>'provider_url_ke'),''),
    kyc_instructions_ng=coalesce(nullif(trim(after_value->>'instructions_ng'),''),kyc_instructions_ng),
    kyc_instructions_ke=coalesce(nullif(trim(after_value->>'instructions_ke'),''),kyc_instructions_ke),
    kyc_reference_required=coalesce((after_value->>'reference_required')::boolean,kyc_reference_required),
    kyc_review_hours=coalesce((after_value->>'review_hours')::int,kyc_review_hours),
    configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid()
   where id=true returning configuration_version into new_version;
  when 'feature_flags' then update public.earnchat_business_settings set feature_flags=after_value,configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid() where id=true returning configuration_version into new_version;
 end case;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details)
 values(auth.uid(),'configuration_updated','business_configuration',null,jsonb_build_object('section',p_section,'before',before_value,'after',after_value,'configuration_version',new_version));
 return public.get_earnchat_business_config();
exception when invalid_text_representation then raise exception 'Configuration field has an invalid number or boolean value' using errcode='22023';
end;
$$;

create or replace function public.admin_update_earnchat_business_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare allowed text[]:=array['signup_bonus_ngn','nigeria_multiplier','kenya_multiplier','daily_cap_ngn','referral_reward_ngn','referral_withdraw_min_ngn','referral_required_active_days','referrer_account_days','presence_online_seconds','presence_heartbeat_seconds'];key text;old_row jsonb;new_version bigint;reward bigint;withdraw_min bigint;active_days int;account_days int;
begin
 perform public.earnchat_assert_admin();
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Business settings payload must be an object' using errcode='22023'; end if;
 for key in select jsonb_object_keys(p_payload) loop if not key=any(allowed) then raise exception 'Unknown business setting: %',key using errcode='22023'; end if;end loop;
 select to_jsonb(s) into old_row from public.earnchat_business_settings s where id=true;
 reward:=case when p_payload?'referral_reward_ngn' then greatest(0,(p_payload->>'referral_reward_ngn')::bigint) else null end;
 withdraw_min:=case when p_payload?'referral_withdraw_min_ngn' then greatest(0,(p_payload->>'referral_withdraw_min_ngn')::bigint) else null end;
 active_days:=case when p_payload?'referral_required_active_days' then greatest(0,(p_payload->>'referral_required_active_days')::int) else null end;
 account_days:=case when p_payload?'referrer_account_days' then greatest(0,(p_payload->>'referrer_account_days')::int) else null end;
 update public.earnchat_business_settings set
  signup_bonus_ngn=case when p_payload?'signup_bonus_ngn' then greatest(0,(p_payload->>'signup_bonus_ngn')::bigint) else signup_bonus_ngn end,
  nigeria_multiplier=case when p_payload?'nigeria_multiplier' then greatest(.01,(p_payload->>'nigeria_multiplier')::numeric) else nigeria_multiplier end,
  kenya_multiplier=case when p_payload?'kenya_multiplier' then greatest(.01,(p_payload->>'kenya_multiplier')::numeric) else kenya_multiplier end,
  daily_cap_ngn=case when p_payload?'daily_cap_ngn' then greatest(0,(p_payload->>'daily_cap_ngn')::bigint) else daily_cap_ngn end,
  referral_reward_ngn=coalesce(reward,referral_reward_ngn),
  referral_withdraw_min_ngn=coalesce(withdraw_min,referral_withdraw_min_ngn),
  referral_required_active_days=coalesce(active_days,referral_required_active_days),
  referrer_account_days=coalesce(account_days,referrer_account_days),
  presence_online_seconds=case when p_payload?'presence_online_seconds' then greatest(30,(p_payload->>'presence_online_seconds')::int) else presence_online_seconds end,
  presence_heartbeat_seconds=case when p_payload?'presence_heartbeat_seconds' then greatest(15,(p_payload->>'presence_heartbeat_seconds')::int) else presence_heartbeat_seconds end,
  referral_config=coalesce(referral_config,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object('fixed_reward_ngn',reward,'required_active_days',active_days,'referrer_account_days',account_days,'direct_referral_only',true)),
  withdrawal_config=coalesce(withdrawal_config,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object('referral_minimum_ngn',withdraw_min)),
  configuration_version=configuration_version+1,updated_at=now(),updated_by=auth.uid()
 where id=true returning configuration_version into new_version;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(auth.uid(),'business_settings_updated','business_configuration',null,jsonb_build_object('before',old_row,'payload',p_payload,'configuration_version',new_version));
 return public.get_earnchat_business_config();
exception when invalid_text_representation then raise exception 'Business setting has an invalid numeric value' using errcode='22023';
end;
$$;

create or replace function public.admin_update_earnchat_kyc_config(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();ng text:=nullif(trim(p_payload->>'url_ng'),'');ke text:=nullif(trim(p_payload->>'url_ke'),'');merged jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if ng is not null and ng !~* '^https://[^[:space:]]+$' then raise exception 'Nigeria KYC URL must use HTTPS';end if;
 if ke is not null and ke !~* '^https://[^[:space:]]+$' then raise exception 'Kenya KYC URL must use HTTPS';end if;
 merged:=coalesce((select kyc_config from public.earnchat_business_settings where id=true),'{}'::jsonb)||jsonb_build_object(
  'enabled',coalesce((p_payload->>'enabled')::boolean,true),
  'provider_ng',coalesce(nullif(trim(p_payload->>'provider_ng'),''),''),
  'provider_ke',coalesce(nullif(trim(p_payload->>'provider_ke'),''),''),
  'provider_url_ng',coalesce(ng,''),'provider_url_ke',coalesce(ke,''),
  'instructions_ng',coalesce(p_payload->>'instructions_ng',''),'instructions_ke',coalesce(p_payload->>'instructions_ke',''),
  'reference_required',coalesce((p_payload->>'reference_required')::boolean,true),
  'review_hours',greatest(1,coalesce((p_payload->>'review_hours')::integer,48))
 );
 update public.earnchat_business_settings set
  kyc_enabled=coalesce((p_payload->>'enabled')::boolean,kyc_enabled),
  kyc_provider_ng=coalesce(nullif(trim(p_payload->>'provider_ng'),''),kyc_provider_ng),
  kyc_provider_ke=coalesce(nullif(trim(p_payload->>'provider_ke'),''),kyc_provider_ke),
  kyc_url_ng=ng,kyc_url_ke=ke,
  kyc_instructions_ng=coalesce(nullif(trim(p_payload->>'instructions_ng'),''),kyc_instructions_ng),
  kyc_instructions_ke=coalesce(nullif(trim(p_payload->>'instructions_ke'),''),kyc_instructions_ke),
  kyc_reference_required=coalesce((p_payload->>'reference_required')::boolean,kyc_reference_required),
  kyc_review_hours=greatest(1,coalesce((p_payload->>'review_hours')::integer,kyc_review_hours)),
  kyc_config=merged,configuration_version=configuration_version+1,updated_at=now(),updated_by=uid
 where id=true;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,details) values(uid,'kyc_configuration_updated','business_settings',coalesce(p_payload,'{}'::jsonb));
 return public.get_earnchat_kyc_config();
end$$;

grant execute on function public.get_earnchat_business_config() to anon,authenticated;
grant execute on function public.admin_update_earnchat_configuration(text,jsonb) to authenticated;
grant execute on function public.admin_update_earnchat_business_settings(jsonb) to authenticated;
grant execute on function public.admin_update_earnchat_kyc_config(jsonb) to authenticated;

update public.earnchat_business_settings set
 referral_config=coalesce(referral_config,'{}'::jsonb)||jsonb_build_object('fixed_reward_ngn',referral_reward_ngn,'required_active_days',referral_required_active_days,'referrer_account_days',referrer_account_days,'direct_referral_only',true),
 withdrawal_config=coalesce(withdrawal_config,'{}'::jsonb)||jsonb_build_object('referral_minimum_ngn',referral_withdraw_min_ngn),
 kyc_config=coalesce(kyc_config,'{}'::jsonb)||jsonb_build_object('enabled',kyc_enabled,'provider_ng',kyc_provider_ng,'provider_ke',kyc_provider_ke,'provider_url_ng',coalesce(kyc_url_ng,''),'provider_url_ke',coalesce(kyc_url_ke,''),'instructions_ng',kyc_instructions_ng,'instructions_ke',kyc_instructions_ke,'reference_required',kyc_reference_required,'review_hours',kyc_review_hours),
 version='20260802-admin-runtime-unified-r1',configuration_version=configuration_version+1,updated_at=now()
where id=true;

commit;
