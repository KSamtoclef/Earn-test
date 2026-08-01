-- Earn Chat configuration scalar synchronization
-- Run after earnchat_configuration_control_upgrade_20260801.sql.
-- Keeps legacy server functions aligned with the Admin JSON control center.
begin;

create or replace function public.earnchat_sync_configuration_scalars()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
 if new.referral_config is distinct from old.referral_config then
  new.referral_reward_ngn:=greatest(0,coalesce((new.referral_config->>'fixed_reward_ngn')::bigint,new.referral_reward_ngn,500));
  new.referral_required_active_days:=greatest(0,coalesce((new.referral_config->>'required_active_days')::int,new.referral_required_active_days,2));
  new.referrer_account_days:=greatest(0,coalesce((new.referral_config->>'referrer_account_days')::int,new.referrer_account_days,5));
 end if;
 if new.withdrawal_config is distinct from old.withdrawal_config then
  new.referral_withdraw_min_ngn:=greatest(0,coalesce((new.withdrawal_config->>'referral_minimum_ngn')::bigint,new.referral_withdraw_min_ngn,40000));
 end if;
 return new;
exception when invalid_text_representation then
 raise exception 'Configuration contains an invalid scalar value' using errcode='22023';
end;
$$;

drop trigger if exists earnchat_sync_configuration_scalars_trigger on public.earnchat_business_settings;
create trigger earnchat_sync_configuration_scalars_trigger
before update of referral_config,withdrawal_config on public.earnchat_business_settings
for each row execute function public.earnchat_sync_configuration_scalars();

update public.earnchat_business_settings
set
 referral_reward_ngn=greatest(0,coalesce((referral_config->>'fixed_reward_ngn')::bigint,referral_reward_ngn,500)),
 referral_required_active_days=greatest(0,coalesce((referral_config->>'required_active_days')::int,referral_required_active_days,2)),
 referrer_account_days=greatest(0,coalesce((referral_config->>'referrer_account_days')::int,referrer_account_days,5)),
 referral_withdraw_min_ngn=greatest(0,coalesce((withdrawal_config->>'referral_minimum_ngn')::bigint,referral_withdraw_min_ngn,40000)),
 updated_at=now()
where id=true;

commit;
