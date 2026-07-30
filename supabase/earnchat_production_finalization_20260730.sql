-- Run after earnchat_production_integrity_20260730.sql
begin;

-- Internal helpers must never be callable directly by browser roles.
revoke all on function public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.mark_earnchat_active_day(uuid) from public,anon,authenticated;
revoke all on function public.refresh_earnchat_referral_qualification(uuid) from public,anon,authenticated;
revoke all on function public.evaluate_earnchat_level(uuid) from public,anon,authenticated;

-- Task reversal must reverse both the wallet and the approved-task counter.
create or replace function public.admin_reverse_task_claim(p_claim uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;available bigint;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 select * into c from public.earnchat_task_claims where id=p_claim for update;
 if not found or c.status<>'approved' then raise exception 'Only approved claims can be reversed';end if;
 select work_available_balance into available from public.profiles where id=c.user_id for update;
 update public.profiles set
  work_available_balance=greatest(0,work_available_balance-c.reward_amount),
  approved_tasks_count=greatest(0,approved_tasks_count-1),
  task_rejection_count=task_rejection_count+1,
  security_review_required=case when available<c.reward_amount then true else security_review_required end,
  updated_at=now()
 where id=c.user_id;
 update public.earnchat_task_claims set status='reversed',review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=c.id;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(c.user_id,'work','reversal','task',c.id,c.reward_amount,c.currency,c.country_code,'approved',coalesce(p_reason,'Task claim reversed'),now())
 on conflict do nothing;
 perform public.evaluate_earnchat_level(c.user_id);
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details)
 values(uid,'task_claim_reversed','task_claim',c.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true);
end;$$;

-- Useful indexes for production queues and histories.
create index if not exists earnchat_claim_status_idx on public.earnchat_task_claims(status,submitted_at desc);
create index if not exists earnchat_withdrawal_status_idx on public.earnchat_withdrawals(status,created_at desc);
create index if not exists earnchat_referral_status_idx on public.earnchat_referrals(status,signup_at desc);
create index if not exists earnchat_kyc_status_idx on public.earnchat_kyc_submissions(status,created_at desc);
create index if not exists earnchat_chat_user_completed_idx on public.earnchat_chat_sessions(user_id,completed_at desc);
create index if not exists earnchat_ledger_user_created_idx on public.earnchat_ledger(user_id,created_at desc);

update public.earnchat_business_settings set version='2026-07-30-production-final',updated_at=now() where id=true;

grant execute on function public.admin_reverse_task_claim(uuid,text) to authenticated;
commit;
