-- Earn Chat dynamic withdrawal and KYC contracts
-- Run after earnchat_configuration_control_upgrade_20260801.sql.
-- Idempotent. Back up the database before applying production migrations.
begin;

create or replace function public.request_earnchat_withdrawal(p_wallet text,p_amount bigint,p_method text,p_payout jsonb)
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
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into settings from public.earnchat_business_settings where id=true;
 cfg:=coalesce(settings.withdrawal_config,'{}'::jsonb);
 enabled:=coalesce((cfg->>'enabled')::boolean,true);
 bank_enabled:=coalesce((cfg->>'bank_transfer_enabled')::boolean,true);
 mpesa_enabled:=coalesce((cfg->>'mpesa_enabled')::boolean,true);
 max_open:=greatest(1,least(10,coalesce((cfg->>'maximum_open_requests')::int,1)));
 if not enabled then raise exception '%',coalesce(nullif(cfg->>'maintenance_message',''),'Withdrawals are temporarily unavailable'); end if;

 select * into p from public.profiles where id=uid for update;
 if not found then raise exception 'Profile unavailable'; end if;
 if current_date-p.account_created_at::date<5 or p.kyc_status<>'approved' or p.security_review_required or p.earning_suspended then
  raise exception 'Withdrawal eligibility requirements are not complete';
 end if;
 if p_method='bank' and not bank_enabled then raise exception 'Bank transfer is temporarily unavailable'; end if;
 if p_method='mpesa' and not mpesa_enabled then raise exception 'M-Pesa is temporarily unavailable'; end if;
 if p.country='KE' and p_method not in('mpesa','bank') then raise exception 'Choose an available Kenyan payout method'; end if;
 if p.country='NG' and p_method<>'bank' then raise exception 'Choose bank transfer'; end if;

 select count(*) into open_count from public.earnchat_withdrawals
 where user_id=uid and status in('submitted','under_review','approved','processing');
 if open_count>=max_open then raise exception 'You already have the maximum number of open withdrawal requests'; end if;

 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 if p_wallet='referral' then
  mn:=public.earnchat_country_amount(coalesce((cfg->>'referral_minimum_ngn')::bigint,settings.referral_withdraw_min_ngn,40000),p.country);
  mx:=9223372036854775807;
  available:=p.referral_available_balance;
 elsif p_wallet='work' then
  mn:=public.earnchat_country_amount(l.withdraw_min_ngn,p.country);
  mx:=public.earnchat_country_amount(l.withdraw_max_ngn,p.country);
  available:=p.work_available_balance;
 else
  raise exception 'Invalid wallet';
 end if;
 if p_amount<mn or p_amount>mx or p_amount>available then raise exception 'Withdrawal amount is outside the allowed range'; end if;
 if coalesce(jsonb_typeof(p_payout),'null')<>'object' then raise exception 'Payout details are invalid'; end if;
 if nullif(trim(coalesce(p_payout->>'account_name','')),'') is null then raise exception 'Account name is required'; end if;
 if nullif(trim(coalesce(p_payout->>'account_number','')),'') is null then raise exception 'Account number is required'; end if;

 insert into public.earnchat_withdrawals(user_id,wallet_type,amount,currency,country_code,payout_method,payout_snapshot)
 values(uid,p_wallet,p_amount,p.currency,p.country,p_method,p_payout) returning id into wid;
 if p_wallet='work' then
  update public.profiles set work_available_balance=work_available_balance-p_amount,updated_at=now() where id=uid;
 else
  update public.profiles set referral_available_balance=referral_available_balance-p_amount,updated_at=now() where id=uid;
 end if;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description)
 values(uid,p_wallet,'hold','withdrawal',wid,p_amount,p.currency,p.country,'approved','Withdrawal request hold');
 return jsonb_build_object('ok',true,'withdrawal_id',wid,'status','submitted','review_hours',coalesce((cfg->>'review_hours')::int,48));
end$$;

create or replace function public.submit_earnchat_kyc(p_reference text default null,p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 settings public.earnchat_business_settings%rowtype;
 cfg jsonb;
 enabled boolean;
 reference_required boolean;
 kid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into settings from public.earnchat_business_settings where id=true;
 cfg:=coalesce(settings.kyc_config,'{}'::jsonb);
 enabled:=coalesce((cfg->>'enabled')::boolean,true);
 reference_required:=coalesce((cfg->>'reference_required')::boolean,true);
 if not enabled then raise exception '%',coalesce(nullif(cfg->>'maintenance_message',''),'Identity verification is temporarily unavailable'); end if;
 if reference_required and nullif(trim(coalesce(p_reference,'')),'') is null then raise exception 'Verification reference is required'; end if;
 if exists(select 1 from public.earnchat_kyc_submissions where user_id=uid and status in('submitted','under_review')) then
  raise exception 'A verification submission is already under review';
 end if;
 insert into public.earnchat_kyc_submissions(user_id,provider_reference,metadata)
 values(uid,nullif(trim(p_reference),''),coalesce(p_metadata,'{}'::jsonb)) returning id into kid;
 update public.profiles set kyc_status='submitted',updated_at=now() where id=uid;
 return jsonb_build_object('ok',true,'submission_id',kid,'status','submitted','review_hours',coalesce((cfg->>'review_hours')::int,48));
end$$;

grant execute on function public.request_earnchat_withdrawal(text,bigint,text,jsonb) to authenticated;
grant execute on function public.submit_earnchat_kyc(text,jsonb) to authenticated;

commit;
