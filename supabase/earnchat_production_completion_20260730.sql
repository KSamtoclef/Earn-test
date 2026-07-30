-- Run after earnchat_production_rebuild_20260730.sql
begin;

create or replace function public.mark_earnchat_active_day(p_user uuid default auth.uid()) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.earnchat_active_days(user_id,activity_date,qualifying_actions)
 values(p_user,current_date,1)
 on conflict(user_id,activity_date) do update set qualifying_actions=earnchat_active_days.qualifying_actions+1;
 update public.profiles set active_days_count=(select count(*) from public.earnchat_active_days where user_id=p_user),updated_at=now() where id=p_user;
 perform public.refresh_earnchat_referral_qualification(p_user);
 perform public.evaluate_earnchat_level(p_user);
end;$$;

create or replace function public.admin_review_earnchat_referral(p_referral uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();r public.earnchat_referrals%rowtype;reward bigint;credited bigint:=0;curr text;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_decision not in('qualified','disqualified') then raise exception 'Invalid decision';end if;
 select * into r from public.earnchat_referrals where id=p_referral for update;
 if not found or r.status not in('under_review','active_day_1') then raise exception 'Referral is not ready for review';end if;
 if p_decision='qualified' then
  if r.second_active_date is null then raise exception 'Two separate active days are required';end if;
  reward:=public.earnchat_country_amount((select referral_reward_ngn from public.earnchat_business_settings where id=true),coalesce(r.country_code,'NG'));
  curr:=case when coalesce(r.country_code,'NG')='KE' then 'KES' else 'NGN' end;
  credited:=public.earnchat_credit(r.referrer_id,'referral','referral',r.id,reward,coalesce(r.country_code,'NG'),'Qualified referral reward');
  update public.earnchat_referrals set status='qualified',reward_amount=credited,currency=curr,review_reason=p_reason,qualification_at=coalesce(qualification_at,now()) where id=r.id;
 else
  update public.earnchat_referrals set status='disqualified',review_reason=p_reason where id=r.id;
 end if;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details)
 values(uid,'referral_'||p_decision,'referral',r.id,jsonb_build_object('reason',p_reason,'credited',credited));
 return jsonb_build_object('ok',true,'status',p_decision,'credited',credited);
end;$$;

create or replace function public.admin_update_earnchat_business_settings(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 update public.earnchat_business_settings set
  kenya_multiplier=coalesce((p_payload->>'kenya_multiplier')::numeric,kenya_multiplier),
  daily_cap_ngn=coalesce((p_payload->>'daily_cap_ngn')::bigint,daily_cap_ngn),
  referral_reward_ngn=coalesce((p_payload->>'referral_reward_ngn')::bigint,referral_reward_ngn),
  referral_withdraw_min_ngn=coalesce((p_payload->>'referral_withdraw_min_ngn')::bigint,referral_withdraw_min_ngn),
  presence_online_seconds=coalesce((p_payload->>'presence_online_seconds')::int,presence_online_seconds),
  presence_heartbeat_seconds=coalesce((p_payload->>'presence_heartbeat_seconds')::int,presence_heartbeat_seconds),
  updated_at=now() where id=true;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,details) values(uid,'business_settings_update','configuration',p_payload);
 return public.get_earnchat_business_config();
end;$$;

create or replace function public.admin_update_earnchat_level(p_level text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_level not in('Starter','Active','Pro','Elite') then raise exception 'Invalid level';end if;
 update public.earnchat_level_settings set
  chat_limit=coalesce((p_payload->>'chat_limit')::int,chat_limit),
  chat_reward_ngn=coalesce((p_payload->>'chat_reward_ngn')::bigint,chat_reward_ngn),
  task_min_ngn=coalesce((p_payload->>'task_min_ngn')::bigint,task_min_ngn),
  task_max_ngn=coalesce((p_payload->>'task_max_ngn')::bigint,task_max_ngn),
  withdraw_min_ngn=coalesce((p_payload->>'withdraw_min_ngn')::bigint,withdraw_min_ngn),
  withdraw_max_ngn=coalesce((p_payload->>'withdraw_max_ngn')::bigint,withdraw_max_ngn),
  account_days=coalesce((p_payload->>'account_days')::int,account_days),
  active_days=coalesce((p_payload->>'active_days')::int,active_days),
  approved_chats=coalesce((p_payload->>'approved_chats')::int,approved_chats),
  approved_tasks=coalesce((p_payload->>'approved_tasks')::int,approved_tasks),
  updated_at=now() where level_name=p_level;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,details) values(uid,'level_settings_update','configuration',jsonb_build_object('level',p_level,'payload',p_payload));
 return (select to_jsonb(l) from public.earnchat_level_settings l where level_name=p_level);
end;$$;

create or replace function public.admin_update_earnchat_user_control(p_user uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_action='review_on' then update public.profiles set security_review_required=true,updated_at=now() where id=p_user;
 elsif p_action='review_off' then update public.profiles set security_review_required=false,updated_at=now() where id=p_user;
 elsif p_action='suspend' then update public.profiles set earning_suspended=true,updated_at=now() where id=p_user;
 elsif p_action='restore' then update public.profiles set earning_suspended=false,updated_at=now() where id=p_user;
 else raise exception 'Invalid action';end if;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'user_'||p_action,'user',p_user,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true,'action',p_action);
end;$$;

create or replace function public.admin_reverse_task_claim(p_claim uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;available bigint;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 select * into c from public.earnchat_task_claims where id=p_claim for update;
 if not found or c.status<>'approved' then raise exception 'Only approved claims can be reversed';end if;
 select work_available_balance into available from public.profiles where id=c.user_id for update;
 update public.profiles set work_available_balance=greatest(0,work_available_balance-c.reward_amount),security_review_required=case when available<c.reward_amount then true else security_review_required end,updated_at=now() where id=c.user_id;
 update public.earnchat_task_claims set status='reversed',review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=c.id;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(c.user_id,'work','reversal','task',c.id,c.reward_amount,c.currency,c.country_code,'approved',coalesce(p_reason,'Task claim reversed'),now()) on conflict do nothing;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'task_claim_reversed','task_claim',c.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true);
end;$$;

grant execute on function public.admin_review_earnchat_referral(uuid,text,text) to authenticated;
grant execute on function public.admin_update_earnchat_business_settings(jsonb) to authenticated;
grant execute on function public.admin_update_earnchat_level(text,jsonb) to authenticated;
grant execute on function public.admin_update_earnchat_user_control(uuid,text,text) to authenticated;
grant execute on function public.admin_reverse_task_claim(uuid,text) to authenticated;
commit;
