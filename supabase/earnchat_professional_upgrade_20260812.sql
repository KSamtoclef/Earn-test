-- Earn Chat professional upgrade — withdrawal eligibility, referral counting and guided-session cleanup
-- Additive/idempotent. Existing production data and reward qualification logic are preserved.
-- Direct referrals count toward withdrawal eligibility immediately after a genuine signup.
-- Referral reward qualification remains a separate activity-based process.

begin;

-- 1) Extend authoritative withdrawal configuration validation.
create or replace function public.earnchat_validate_configuration_section(section_name text,payload jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
 result jsonb:=coalesce(payload,'{}'::jsonb);
 seconds int;
 replies int;
 reply_length int;
 countries jsonb;
 referral_mode text;
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
  seconds:=coalesce((result->>'minimum_seconds')::int,45);
  replies:=coalesce((result->>'required_replies')::int,4);
  reply_length:=coalesce((result->>'minimum_reply_length')::int,12);
  if seconds<>0 and (seconds<30 or seconds>900) then raise exception 'Chat minimum seconds must be 0 or between 30 and 900' using errcode='22023'; end if;
  if replies<1 or replies>10 then raise exception 'Chat required replies must be between 1 and 10' using errcode='22023'; end if;
  if reply_length<1 or reply_length>500 then raise exception 'Chat minimum reply length must be between 1 and 500' using errcode='22023'; end if;
  if result ? 'prompt_sets' and jsonb_typeof(result->'prompt_sets')<>'array' then raise exception 'Chat prompt sets must be an array' using errcode='22023'; end if;
  if result ? 'partners' and jsonb_typeof(result->'partners')<>'array' then raise exception 'Guided session profiles must be an array' using errcode='22023'; end if;
 when 'tasks' then
  perform public.earnchat_validate_known_keys(result,array['enabled','visits_enabled','default_attempt_expiry_minutes','incomplete_attempt_policy','restart_required_message','pending_review_message','approved_message','rejected_message','show_status_filters','featured_task_limit'],'tasks');
  if result ? 'incomplete_attempt_policy' and result->>'incomplete_attempt_policy' not in('restart','resume') then raise exception 'Task incomplete policy must be restart or resume' using errcode='22023'; end if;
 when 'referrals' then
  perform public.earnchat_validate_known_keys(result,array['enabled','fixed_reward_ngn','required_active_days','referrer_account_days','direct_referral_only','sharing_copy','qualification_explanation','automatic_review_enabled','fraud_review_threshold'],'referrals');
  if result ? 'direct_referral_only' and coalesce((result->>'direct_referral_only')::boolean,true)=false then raise exception 'Earn Chat supports direct referrals only' using errcode='22023'; end if;
 when 'withdrawals' then
  perform public.earnchat_validate_known_keys(result,array[
   'enabled','maintenance_message','maximum_open_requests','referral_minimum_ngn','review_hours',
   'bank_transfer_enabled','mpesa_enabled','instructions_ng','instructions_ke',
   'required_account_days','required_referrals','referral_count_mode','kyc_required'
  ],'withdrawals');
  if result ? 'required_account_days' and ((result->>'required_account_days')::int<0 or (result->>'required_account_days')::int>365) then
   raise exception 'Required account days must be between 0 and 365' using errcode='22023';
  end if;
  if result ? 'required_referrals' and ((result->>'required_referrals')::int<0 or (result->>'required_referrals')::int>1000000) then
   raise exception 'Required referrals must be zero or greater' using errcode='22023';
  end if;
  referral_mode:=coalesce(result->>'referral_count_mode','registered');
  if referral_mode not in('registered','qualified') then
   raise exception 'Referral count mode must be registered or qualified' using errcode='22023';
  end if;
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

-- 2) Seed the new eligibility settings without overwriting existing admin choices.
update public.earnchat_business_settings
set withdrawal_config = jsonb_build_object(
      'required_account_days',5,
      'required_referrals',5,
      'referral_count_mode','registered',
      'kyc_required',true
    ) || coalesce(withdrawal_config,'{}'::jsonb),
    configuration_version=coalesce(configuration_version,1)+1,
    version='20260812-professional-upgrade-r1',
    updated_at=now()
where id=true;

-- Preserve live/custom level settings. Only replace the known legacy defaults.
update public.earnchat_level_settings
set withdraw_min_ngn=20000,updated_at=now()
where (level_name='Starter' and withdraw_min_ngn=40000)
   or (level_name='Active' and withdraw_min_ngn=40000)
   or (level_name='Pro' and withdraw_min_ngn=50000)
   or (level_name='Elite' and withdraw_min_ngn=60000);

-- Replace only the original placeholder foreign-person set. Any admin-customized set is preserved.
update public.earnchat_business_settings
set chat_config=jsonb_set(
      coalesce(chat_config,'{}'::jsonb),
      '{partners}',
      '[
        {"name":"Daily Check-in","short":"D","place":"Guided Session","topic":"Goals and progress"},
        {"name":"Planning Session","short":"P","place":"Guided Session","topic":"Daily planning and focus"},
        {"name":"Learning Session","short":"L","place":"Guided Session","topic":"Skills and personal development"}
      ]'::jsonb,
      true
    ),
    updated_at=now()
where id=true
  and jsonb_typeof(coalesce(chat_config,'{}'::jsonb)->'partners')='array'
  and jsonb_array_length(coalesce(chat_config,'{}'::jsonb)->'partners')=3
  and not exists(
    select 1
    from jsonb_array_elements(coalesce(chat_config,'{}'::jsonb)->'partners') item
    where coalesce(item->>'name','') not in('Noah T.','Amina R.','Grace M.')
  );

-- 3) Server-authoritative withdrawal readiness.
create or replace function public.get_my_earnchat_withdrawal_readiness(p_wallet text default 'work')
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 s public.earnchat_business_settings%rowtype;
 cfg jsonb;
 required_days int;
 required_referrals int;
 referral_mode text;
 kyc_required boolean;
 current_days int;
 current_referrals int;
 minimum_balance bigint;
 available_balance bigint;
 max_balance bigint;
 open_requests int;
 ok_days boolean;
 ok_referrals boolean;
 ok_kyc boolean;
 ok_balance boolean;
 ok_security boolean;
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_wallet not in('work','referral') then raise exception 'Invalid wallet' using errcode='22023'; end if;

 select * into p from public.profiles where id=uid;
 if not found then raise exception 'Profile unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 select * into s from public.earnchat_business_settings where id=true;
 cfg:=coalesce(s.withdrawal_config,'{}'::jsonb);

 required_days:=greatest(0,least(365,coalesce((cfg->>'required_account_days')::int,5)));
 required_referrals:=greatest(0,coalesce((cfg->>'required_referrals')::int,5));
 referral_mode:=case when cfg->>'referral_count_mode'='qualified' then 'qualified' else 'registered' end;
 kyc_required:=coalesce((cfg->>'kyc_required')::boolean,true);
 current_days:=greatest(0,current_date-coalesce(p.account_created_at::date,current_date));

 if referral_mode='qualified' then
  select count(*)::int into current_referrals
  from public.earnchat_referrals
  where referrer_id=uid and status='qualified';
 else
  select count(*)::int into current_referrals
  from public.earnchat_referrals
  where referrer_id=uid and coalesce(status,'signed_up')<>'disqualified';
 end if;

 if p_wallet='work' then
  minimum_balance:=public.earnchat_country_amount(coalesce(l.withdraw_min_ngn,20000),p.country);
  max_balance:=public.earnchat_country_amount(coalesce(l.withdraw_max_ngn,9223372036854775807),p.country);
  available_balance:=coalesce(p.work_available_balance,0);
 else
  minimum_balance:=public.earnchat_country_amount(coalesce((cfg->>'referral_minimum_ngn')::bigint,s.referral_withdraw_min_ngn,40000),p.country);
  max_balance:=9223372036854775807;
  available_balance:=coalesce(p.referral_available_balance,0);
 end if;

 select count(*)::int into open_requests
 from public.earnchat_withdrawals
 where user_id=uid and status in('submitted','under_review','approved','processing');

 ok_days:=current_days>=required_days;
 ok_referrals:=current_referrals>=required_referrals;
 ok_kyc:=(not kyc_required) or p.kyc_status='approved';
 ok_balance:=available_balance>=minimum_balance;
 ok_security:=not coalesce(p.security_review_required,false) and not coalesce(p.earning_suspended,false);

 return jsonb_build_object(
  'wallet',p_wallet,
  'country_code',coalesce(p.country,'NG'),
  'currency',coalesce(p.currency,case when p.country='KE' then 'KES' else 'NGN' end),
  'current_days',current_days,
  'required_days',required_days,
  'days_complete',ok_days,
  'current_referrals',current_referrals,
  'required_referrals',required_referrals,
  'referral_count_mode',referral_mode,
  'referrals_complete',ok_referrals,
  'kyc_required',kyc_required,
  'kyc_status',coalesce(p.kyc_status,'not_submitted'),
  'kyc_complete',ok_kyc,
  'available_balance',available_balance,
  'minimum_balance',minimum_balance,
  'maximum_balance',max_balance,
  'balance_complete',ok_balance,
  'security_clear',ok_security,
  'open_requests',open_requests,
  'ready',ok_days and ok_referrals and ok_kyc and ok_balance and ok_security
 );
end;
$$;

revoke all on function public.get_my_earnchat_withdrawal_readiness(text) from public,anon;
grant execute on function public.get_my_earnchat_withdrawal_readiness(text) to authenticated,service_role;

-- 4) Versioned withdrawal core. It preserves existing payout, balance, open-request and ledger protections.
create or replace function public.request_earnchat_withdrawal_core_20260812(
 p_wallet text,
 p_amount bigint,
 p_method text,
 p_payout jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 settings public.earnchat_business_settings%rowtype;
 cfg jsonb;
 mn bigint;
 mx bigint;
 available bigint;
 wid uuid;
 max_open int;
 open_count int;
 enabled boolean;
 bank_enabled boolean;
 mpesa_enabled boolean;
 required_days int;
 required_referrals int;
 referral_mode text;
 current_days int;
 current_referrals int;
 kyc_required boolean;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_wallet not in('work','referral') then raise exception 'Invalid wallet'; end if;

 select * into settings from public.earnchat_business_settings where id=true;
 cfg:=coalesce(settings.withdrawal_config,'{}'::jsonb);
 enabled:=coalesce((cfg->>'enabled')::boolean,true);
 bank_enabled:=coalesce((cfg->>'bank_transfer_enabled')::boolean,true);
 mpesa_enabled:=coalesce((cfg->>'mpesa_enabled')::boolean,true);
 max_open:=greatest(1,least(10,coalesce((cfg->>'maximum_open_requests')::int,1)));
 required_days:=greatest(0,least(365,coalesce((cfg->>'required_account_days')::int,5)));
 required_referrals:=greatest(0,coalesce((cfg->>'required_referrals')::int,5));
 referral_mode:=case when cfg->>'referral_count_mode'='qualified' then 'qualified' else 'registered' end;
 kyc_required:=coalesce((cfg->>'kyc_required')::boolean,true);
 if not enabled then raise exception '%',coalesce(nullif(cfg->>'maintenance_message',''),'Withdrawals are temporarily unavailable'); end if;

 select * into p from public.profiles where id=uid for update;
 if not found then raise exception 'Profile unavailable'; end if;
 if coalesce(p.security_review_required,false) or coalesce(p.earning_suspended,false) then raise exception 'Withdrawal eligibility requirements are not complete'; end if;

 current_days:=greatest(0,current_date-coalesce(p.account_created_at::date,current_date));
 if current_days<required_days then raise exception 'Account age requirement is not complete'; end if;

 if referral_mode='qualified' then
  select count(*)::int into current_referrals from public.earnchat_referrals where referrer_id=uid and status='qualified';
 else
  select count(*)::int into current_referrals from public.earnchat_referrals where referrer_id=uid and coalesce(status,'signed_up')<>'disqualified';
 end if;
 if current_referrals<required_referrals then raise exception 'Referral requirement is not complete'; end if;
 if kyc_required and p.kyc_status<>'approved' then raise exception 'Identity verification must be approved before withdrawal'; end if;

 if p_method='bank' and not bank_enabled then raise exception 'Bank transfer is temporarily unavailable'; end if;
 if p_method='mpesa' and not mpesa_enabled then raise exception 'M-Pesa is temporarily unavailable'; end if;
 if p.country='KE' and p_method not in('mpesa','bank') then raise exception 'Choose an available Kenyan payout method'; end if;
 if p.country='NG' and p_method<>'bank' then raise exception 'Choose bank transfer'; end if;

 select count(*) into open_count
 from public.earnchat_withdrawals
 where user_id=uid and status in('submitted','under_review','approved','processing');
 if open_count>=max_open then raise exception 'You already have the maximum number of open withdrawal requests'; end if;

 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 if p_wallet='referral' then
  mn:=public.earnchat_country_amount(coalesce((cfg->>'referral_minimum_ngn')::bigint,settings.referral_withdraw_min_ngn,40000),p.country);
  mx:=9223372036854775807;
  available:=coalesce(p.referral_available_balance,0);
 else
  mn:=public.earnchat_country_amount(coalesce(l.withdraw_min_ngn,20000),p.country);
  mx:=public.earnchat_country_amount(coalesce(l.withdraw_max_ngn,9223372036854775807),p.country);
  available:=coalesce(p.work_available_balance,0);
 end if;

 if p_amount is null or p_amount<=0 then raise exception 'Enter a valid withdrawal amount'; end if;
 if p_amount<mn or p_amount>mx or p_amount>available then raise exception 'Withdrawal amount is outside the allowed range'; end if;
 if coalesce(jsonb_typeof(p_payout),'null')<>'object' then raise exception 'Payout details are invalid'; end if;
 if nullif(trim(coalesce(p_payout->>'account_name','')),'') is null then raise exception 'Account name is required'; end if;
 if nullif(trim(coalesce(p_payout->>'account_number','')),'') is null then raise exception 'Account number is required'; end if;
 if p_method='bank' and nullif(trim(coalesce(p_payout->>'provider','')),'') is null then raise exception 'Bank name is required'; end if;

 insert into public.earnchat_withdrawals(user_id,wallet_type,amount,currency,country_code,payout_method,payout_snapshot)
 values(uid,p_wallet,p_amount,p.currency,p.country,p_method,p_payout)
 returning id into wid;

 if p_wallet='work' then
  update public.profiles set work_available_balance=work_available_balance-p_amount,updated_at=now() where id=uid;
 else
  update public.profiles set referral_available_balance=referral_available_balance-p_amount,updated_at=now() where id=uid;
 end if;

 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description)
 values(uid,p_wallet,'hold','withdrawal',wid,p_amount,p.currency,p.country,'approved','Withdrawal request hold');

 return jsonb_build_object(
  'ok',true,
  'withdrawal_id',wid,
  'status','submitted',
  'review_hours',coalesce((cfg->>'review_hours')::int,48),
  'required_account_days',required_days,
  'required_referrals',required_referrals,
  'referral_count_mode',referral_mode
 );
end;
$$;

revoke all on function public.request_earnchat_withdrawal_core_20260812(text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.request_earnchat_withdrawal_core_20260812(text,bigint,text,jsonb) to service_role;

-- Keep the public customer contract stable while routing to the new protected core.
create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 perform public.earnchat_assert_runtime_available('withdrawals');
 return public.request_earnchat_withdrawal_core_20260812(p_wallet,p_amount,p_method,p_payout);
end;
$$;

revoke all on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) from public,anon;
grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated,service_role;

commit;
