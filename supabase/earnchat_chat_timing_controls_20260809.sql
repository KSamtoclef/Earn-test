-- Earn Chat flexible guided-chat timing contract
-- Run after earnchat_admin_runtime_unification_20260802.sql.
-- Idempotent. Allows 0-900 seconds. A value of 0 disables the waiting requirement.
begin;

create or replace function public.earnchat_chat_contract()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
 select jsonb_build_object(
  'enabled',coalesce((s.chat_config->>'enabled')::boolean,true),
  'minimum_seconds',greatest(0,least(900,coalesce((s.chat_config->>'minimum_seconds')::int,45))),
  'required_replies',greatest(1,least(10,coalesce((s.chat_config->>'required_replies')::int,4))),
  'minimum_reply_length',greatest(1,least(500,coalesce((s.chat_config->>'minimum_reply_length')::int,12))),
  'attempt_expiry_minutes',greatest(5,least(1440,coalesce((s.chat_config->>'attempt_expiry_minutes')::int,30))),
  'activity_points',greatest(0,least(1000,coalesce((s.chat_config->>'activity_points')::int,2)))
 )
 from public.earnchat_business_settings s where s.id=true;
$$;

create or replace function public.admin_update_earnchat_configuration(p_section text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 clean jsonb;
 validation_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
 before_value jsonb;
 after_value jsonb;
 new_version bigint;
 requested_seconds integer;
begin
 perform public.earnchat_assert_admin();

 if p_section='chat' and validation_payload ? 'minimum_seconds' then
  requested_seconds:=(validation_payload->>'minimum_seconds')::integer;
  if requested_seconds<0 or requested_seconds>900 then
   raise exception 'Chat minimum seconds must be between 0 and 900' using errcode='22023';
  end if;
  clean:=public.earnchat_validate_configuration_section(
   p_section,
   jsonb_set(validation_payload,'{minimum_seconds}',to_jsonb(greatest(30,requested_seconds)),true)
  );
  clean:=jsonb_set(clean,'{minimum_seconds}',to_jsonb(requested_seconds),true);
 else
  clean:=public.earnchat_validate_configuration_section(p_section,validation_payload);
 end if;

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
exception when invalid_text_representation then
 raise exception 'Configuration field has an invalid number or boolean value' using errcode='22023';
end;
$$;

grant execute on function public.admin_update_earnchat_configuration(text,jsonb) to authenticated;
grant execute on function public.start_earnchat_chat(text) to authenticated;
grant execute on function public.get_my_open_chat_attempt() to authenticated;
grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;

update public.earnchat_business_settings
set version='20260809-flexible-chat-timing-r1',configuration_version=configuration_version+1,updated_at=now()
where id=true;

commit;
