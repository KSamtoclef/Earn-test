-- Earn Chat earned-level motivation and compact guided-chat timing upgrade
-- Safe to rerun after the production installer and consolidated KYC/recovery upgrade.
begin;

-- Starter members earn Active through sustained genuine activity, never payment.
update public.earnchat_level_settings
set account_days=4,
    active_days=4,
    approved_chats=8,
    approved_tasks=6,
    kyc_requirement='submitted',
    max_rejection_rate=50,
    updated_at=now()
where level_name='Active';

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;aid uuid;started timestamptz;expires timestamptz;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 update public.earnchat_chat_attempts set status='expired' where user_id=uid and status='started' and expires_at<=now();
 if exists(select 1 from public.earnchat_chat_attempts where user_id=uid and status='started' and expires_at>now()) then raise exception 'Finish your current guided chat first'; end if;
 insert into public.earnchat_chat_attempts(user_id,partner_key) values(uid,p_partner) returning id,started_at,expires_at into aid,started,expires;
 return jsonb_build_object('attempt_id',aid,'partner',p_partner,'started_at',started,'expires_at',expires,'required_replies',4,'minimum_seconds',45,'daily_limit',l.chat_limit,'remaining',l.chat_limit-cnt);
end$$;

grant execute on function public.start_earnchat_chat(text) to authenticated;

create or replace function public.get_my_open_chat_attempt()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.earnchat_chat_attempts%rowtype;
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,'required_replies',4,'minimum_seconds',45);
end$$;

grant execute on function public.get_my_open_chat_attempt() to authenticated;

create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();a public.earnchat_chat_attempts%rowtype;p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;reward bigint;sid uuid;credited bigint;distinct_count int;short_count int;
begin
 select * into a from public.earnchat_chat_attempts where id=p_attempt and user_id=uid for update;
 if not found or a.status<>'started' or a.expires_at<now() then raise exception 'Chat attempt unavailable'; end if;
 if jsonb_typeof(p_replies)<>'array' or jsonb_array_length(p_replies)<>4 then raise exception 'Four replies are required'; end if;
 select count(distinct lower(trim(value))),count(*) filter(where length(trim(value))<12) into distinct_count,short_count from jsonb_array_elements_text(p_replies);
 if distinct_count<4 or short_count>0 then raise exception 'Use four different meaningful replies'; end if;
 if extract(epoch from(now()-a.started_at))<45 then raise exception 'Complete the 45-second guided conversation'; end if;
 select * into p from public.profiles where id=uid;
 if p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);
 insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags)
 values(uid,p.level_name,4,floor(extract(epoch from(now()-a.started_at)))::int,'approved',reward,p.currency,p.country,jsonb_build_object('reply_hashes',(select jsonb_agg(md5(lower(trim(value)))) from jsonb_array_elements_text(p_replies)),'client',coalesce(p_quality,'{}'::jsonb))) returning id into sid;
 credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided chat');
 update public.earnchat_chat_attempts set status='completed',completed_at=now() where id=a.id;
 perform public.mark_earnchat_active_day(uid);
 return jsonb_build_object('ok',true,'session_id',sid,'amount',credited,'currency',p.currency,'remaining',l.chat_limit-cnt-1,'minimum_seconds',45);
end$$;

grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;

update public.earnchat_business_settings
set version='20260731-level-chat-r1',updated_at=now()
where id=true;

commit;
select 'Earn Chat level motivation and 45-second guided chat upgrade completed' as result;
