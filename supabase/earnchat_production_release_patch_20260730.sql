-- Run after earnchat_production_finalization_20260730.sql and before verification.
begin;

-- Preserve existing balances in the canonical ledger without crediting them twice.
do $$
begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='balance') then
  execute $sql$
   update public.profiles p set work_available_balance=greatest(p.work_available_balance,coalesce(p.balance,0)),updated_at=now()
   where coalesce(p.balance,0)>p.work_available_balance
     and not exists(select 1 from public.earnchat_ledger l where l.user_id=p.id and l.wallet_type='work')
  $sql$;
 end if;
end$$;

insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
select p.id,'work','credit','opening_balance',p.id,p.work_available_balance,p.currency,p.country,'approved','Opening work balance preserved during production migration',now()
from public.profiles p
where p.work_available_balance>0 and not exists(select 1 from public.earnchat_ledger l where l.user_id=p.id and l.wallet_type='work')
on conflict do nothing;

insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
select p.id,'referral','credit','opening_balance',p.id,p.referral_available_balance,p.currency,p.country,'approved','Opening referral balance preserved during production migration',now()
from public.profiles p
where p.referral_available_balance>0 and not exists(select 1 from public.earnchat_ledger l where l.user_id=p.id and l.wallet_type='referral')
on conflict do nothing;

-- Users only list tasks available in their country. Higher-level tasks remain visible and locked in the frontend.
create or replace function public.list_earnchat_tasks()
returns setof public.earnchat_tasks language sql stable security definer set search_path=public as $$
 select t.* from public.earnchat_tasks t join public.profiles p on p.id=auth.uid()
 where t.status='active' and (t.starts_at is null or t.starts_at<=now()) and (t.ends_at is null or t.ends_at>=now())
   and t.country_code in('ALL',p.country)
 order by t.created_at desc
$$;

-- Referral currency belongs to the referrer wallet, not the referred account.
create or replace function public.register_earnchat_referral(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();referrer public.profiles%rowtype;
begin
 if uid is null or nullif(trim(p_code),'') is null then raise exception 'Invalid referral';end if;
 select * into referrer from public.profiles where referral_code=upper(trim(p_code));
 if not found or referrer.id=uid then raise exception 'Invalid referral';end if;
 insert into public.earnchat_referrals(referrer_id,referred_id,referral_code,country_code,currency)
 values(referrer.id,uid,upper(trim(p_code)),referrer.country,referrer.currency)
 on conflict(referred_id) do nothing;
 return jsonb_build_object('ok',true);
end;$$;

update public.earnchat_referrals r set country_code=p.country,currency=p.currency
from public.profiles p where p.id=r.referrer_id and r.status in('signed_up','active_day_1');

-- Overview amounts remain separated by currency so KES is never labelled as NGN.
create or replace function public.admin_get_earnchat_overview()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 return jsonb_build_object(
  'total_users',(select count(*) from public.profiles),
  'online_now',(select count(distinct coalesce(user_id::text,session_id)) from public.earnchat_site_presence where is_visible and last_seen>now()-interval '90 seconds'),
  'pending_tasks',(select count(*) from public.earnchat_task_claims where status='pending'),
  'pending_withdrawals',(select count(*) from public.earnchat_withdrawals where status in('submitted','under_review')),
  'pending_kyc',(select count(*) from public.earnchat_kyc_submissions where status in('submitted','under_review')),
  'pending_referrals',(select count(*) from public.earnchat_referrals where status='under_review'),
  'work_liability',(select coalesce(sum(work_available_balance+work_pending_balance),0) from public.profiles where country='NG'),
  'referral_liability',(select coalesce(sum(referral_available_balance+referral_pending_balance),0) from public.profiles where country='NG'),
  'work_liability_kes',(select coalesce(sum(work_available_balance+work_pending_balance),0) from public.profiles where country='KE'),
  'referral_liability_kes',(select coalesce(sum(referral_available_balance+referral_pending_balance),0) from public.profiles where country='KE')
 );
end;$$;

grant execute on function public.list_earnchat_tasks() to authenticated;
grant execute on function public.register_earnchat_referral(text) to authenticated;
grant execute on function public.admin_get_earnchat_overview() to authenticated;
update public.earnchat_business_settings set version='2026-07-30-production-release',updated_at=now() where id=true;
commit;
