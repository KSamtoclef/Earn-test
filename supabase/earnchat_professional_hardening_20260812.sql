-- Earn Chat professional hardening — exact withdrawal readiness and edge-case protection
-- Run once after earnchat_professional_upgrade_20260812.sql.
-- Additive/idempotent: preserves user, ledger, KYC, task, referral and withdrawal records.

begin;

-- Keep the product default at ₦20,000 without overwriting non-legacy custom values.
update public.earnchat_business_settings
set referral_withdraw_min_ngn=20000,
    withdrawal_config=case
      when coalesce((withdrawal_config->>'referral_minimum_ngn')::bigint,40000)=40000
        then jsonb_set(coalesce(withdrawal_config,'{}'::jsonb),'{referral_minimum_ngn}','20000'::jsonb,true)
      else withdrawal_config
    end,
    configuration_version=coalesce(configuration_version,1)+1,
    version='20260812-professional-hardening-r1',
    updated_at=now()
where id=true
  and coalesce(referral_withdraw_min_ngn,40000)=40000
  and coalesce(version,'') in('20260812-professional-upgrade-r1','20260812-professional-hardening-r1');

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
 maximum_balance bigint;
 open_requests int;
 max_open int;
 enabled boolean;
 feature_enabled boolean;
 maintenance boolean;
 bank_enabled boolean;
 mpesa_enabled boolean;
 payout_method_available boolean;
 open_request_capacity boolean;
 runtime_available boolean;
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
 max_open:=greatest(1,least(10,coalesce((cfg->>'maximum_open_requests')::int,1)));
 enabled:=coalesce((cfg->>'enabled')::boolean,true);
 bank_enabled:=coalesce((cfg->>'bank_transfer_enabled')::boolean,true);
 mpesa_enabled:=coalesce((cfg->>'mpesa_enabled')::boolean,true);
 feature_enabled:=coalesce((coalesce(s.feature_flags,'{}'::jsonb)->>'withdrawals')::boolean,true);
 maintenance:=coalesce((coalesce(s.general_config,'{}'::jsonb)->>'maintenance_mode')::boolean,false);
 runtime_available:=enabled and feature_enabled and not maintenance;

 -- A configured "day" means a complete 24-hour period, not a calendar-date rollover.
 current_days:=greatest(0,floor(extract(epoch from (now()-coalesce(p.account_created_at,now())))/86400)::int);

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
  maximum_balance:=public.earnchat_country_amount(coalesce(l.withdraw_max_ngn,9223372036854775807),p.country);
  available_balance:=coalesce(p.work_available_balance,0);
 else
  minimum_balance:=public.earnchat_country_amount(coalesce((cfg->>'referral_minimum_ngn')::bigint,s.referral_withdraw_min_ngn,20000),p.country);
  maximum_balance:=9223372036854775807;
  available_balance:=coalesce(p.referral_available_balance,0);
 end if;

 select count(*)::int into open_requests
 from public.earnchat_withdrawals
 where user_id=uid and status in('submitted','under_review','approved','processing');

 open_request_capacity:=open_requests<max_open;
 payout_method_available:=case
   when p.country='KE' then bank_enabled or mpesa_enabled
   else bank_enabled
 end;
 ok_days:=current_days>=required_days;
 ok_referrals:=current_referrals>=required_referrals;
 ok_kyc:=(not kyc_required) or coalesce(p.kyc_status,'not_submitted')='approved';
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
  'maximum_balance',maximum_balance,
  'balance_complete',ok_balance,
  'security_clear',ok_security,
  'withdrawals_enabled',runtime_available,
  'payout_method_available',payout_method_available,
  'open_requests',open_requests,
  'maximum_open_requests',max_open,
  'open_request_capacity',open_request_capacity,
  'ready',runtime_available and payout_method_available and open_request_capacity and ok_days and ok_referrals and ok_kyc and ok_balance and ok_security
 );
end;
$$;

revoke all on function public.get_my_earnchat_withdrawal_readiness(text) from public,anon;
grant execute on function public.get_my_earnchat_withdrawal_readiness(text) to authenticated,service_role;

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

 current_days:=greatest(0,floor(extract(epoch from (now()-coalesce(p.account_created_at,now())))/86400)::int);
 if current_days<required_days then raise exception 'Account age requirement is not complete'; end if;

 if referral_mode='qualified' then
  select count(*)::int into current_referrals from public.earnchat_referrals where referrer_id=uid and status='qualified';
 else
  select count(*)::int into current_referrals from public.earnchat_referrals where referrer_id=uid and coalesce(status,'signed_up')<>'disqualified';
 end if;
 if current_referrals<required_referrals then raise exception 'Referral requirement is not complete'; end if;
 if kyc_required and coalesce(p.kyc_status,'not_submitted')<>'approved' then raise exception 'Identity verification must be approved before withdrawal'; end if;

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
  mn:=public.earnchat_country_amount(coalesce((cfg->>'referral_minimum_ngn')::bigint,settings.referral_withdraw_min_ngn,20000),p.country);
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

-- Keep the authenticated public contract stable.
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
