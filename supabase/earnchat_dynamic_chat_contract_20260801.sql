-- Earn Chat dynamic guided-chat contract
-- Run after earnchat_configuration_control_upgrade_20260801.sql.
-- Idempotent. Back up the database before applying production migrations.
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
  'minimum_seconds',greatest(30,least(900,coalesce((s.chat_config->>'minimum_seconds')::int,45))),
  'required_replies',greatest(1,least(10,coalesce((s.chat_config->>'required_replies')::int,4))),
  'minimum_reply_length',greatest(1,least(500,coalesce((s.chat_config->>'minimum_reply_length')::int,12))),
  'attempt_expiry_minutes',greatest(5,least(1440,coalesce((s.chat_config->>'attempt_expiry_minutes')::int,30))),
  'activity_points',greatest(0,least(1000,coalesce((s.chat_config->>'activity_points')::int,2)))
 )
 from public.earnchat_business_settings s where s.id=true;
$$;

create or replace function public.earnchat_reconcile_points(
 p_user uuid,
 p_source_type text,
 p_source_key text,
 p_points integer,
 p_description text default null
)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare current_points integer:=0;difference integer:=0;event_id uuid;
begin
 if p_user is null or nullif(trim(p_source_type),'') is null or nullif(trim(p_source_key),'') is null then return 0; end if;
 p_points:=greatest(0,coalesce(p_points,0));
 select id,points into event_id,current_points
 from public.earnchat_point_events
 where user_id=p_user and source_type=trim(p_source_type) and source_key=trim(p_source_key)
 for update;
 if event_id is null then
  if p_points=0 then return 0; end if;
  insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
  values(p_user,trim(p_source_type),trim(p_source_key),p_points,p_description)
  returning id into event_id;
  difference:=p_points;
 else
  difference:=p_points-current_points;
  update public.earnchat_point_events
  set points=p_points,description=coalesce(p_description,description)
  where id=event_id;
 end if;
 if difference<>0 then
  update public.profiles set activity_points=greatest(0,activity_points+difference),updated_at=now() where id=p_user;
 end if;
 return p_points;
end$$;

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 cnt int;
 aid uuid;
 started timestamptz;
 expires timestamptz;
 contract jsonb:=public.earnchat_chat_contract();
 expiry_minutes int;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if coalesce((contract->>'enabled')::boolean,true)=false then raise exception 'Guided Chat is temporarily unavailable'; end if;
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 update public.earnchat_chat_attempts set status='expired' where user_id=uid and status='started' and expires_at<=now();
 if exists(select 1 from public.earnchat_chat_attempts where user_id=uid and status='started' and expires_at>now()) then raise exception 'Finish your current guided chat first'; end if;
 expiry_minutes:=coalesce((contract->>'attempt_expiry_minutes')::int,30);
 insert into public.earnchat_chat_attempts(user_id,partner_key,expires_at)
 values(uid,nullif(trim(p_partner),''),now()+make_interval(mins=>expiry_minutes))
 returning id,started_at,expires_at into aid,started,expires;
 return jsonb_build_object(
  'attempt_id',aid,'partner',p_partner,'started_at',started,'expires_at',expires,
  'required_replies',(contract->>'required_replies')::int,
  'minimum_seconds',(contract->>'minimum_seconds')::int,
  'minimum_reply_length',(contract->>'minimum_reply_length')::int,
  'daily_limit',l.chat_limit,'remaining',l.chat_limit-cnt
 );
end$$;

create or replace function public.get_my_open_chat_attempt()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.earnchat_chat_attempts%rowtype;contract jsonb:=public.earnchat_chat_contract();
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object(
  'attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,
  'required_replies',(contract->>'required_replies')::int,
  'minimum_seconds',(contract->>'minimum_seconds')::int,
  'minimum_reply_length',(contract->>'minimum_reply_length')::int
 );
end$$;

create or replace function public.complete_earnchat_chat(p_attempt uuid,p_replies jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 uid uuid:=auth.uid();
 a public.earnchat_chat_attempts%rowtype;
 p public.profiles%rowtype;
 l public.earnchat_level_settings%rowtype;
 cnt int;
 reward bigint;
 sid uuid;
 credited bigint;
 distinct_count int;
 short_count int;
 contract jsonb:=public.earnchat_chat_contract();
 required_replies int;
 minimum_seconds int;
 minimum_reply_length int;
 configured_points int;
 duration_seconds int;
begin
 required_replies:=(contract->>'required_replies')::int;
 minimum_seconds:=(contract->>'minimum_seconds')::int;
 minimum_reply_length:=(contract->>'minimum_reply_length')::int;
 configured_points:=(contract->>'activity_points')::int;
 if coalesce((contract->>'enabled')::boolean,true)=false then raise exception 'Guided Chat is temporarily unavailable'; end if;
 select * into a from public.earnchat_chat_attempts where id=p_attempt and user_id=uid for update;
 if not found or a.status<>'started' or a.expires_at<now() then raise exception 'Chat attempt unavailable'; end if;
 if jsonb_typeof(p_replies)<>'array' or jsonb_array_length(p_replies)<>required_replies then
  raise exception '% replies are required',required_replies;
 end if;
 select count(distinct lower(trim(value))),count(*) filter(where length(trim(value))<minimum_reply_length)
 into distinct_count,short_count from jsonb_array_elements_text(p_replies);
 if distinct_count<required_replies or short_count>0 then
  raise exception 'Use % different replies of at least % characters',required_replies,minimum_reply_length;
 end if;
 duration_seconds:=floor(extract(epoch from(now()-a.started_at)))::int;
 if duration_seconds<minimum_seconds then raise exception 'Complete the % second guided conversation',minimum_seconds; end if;
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 if not found then raise exception 'Unknown account level'; end if;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 reward:=public.earnchat_country_amount(l.chat_reward_ngn,p.country);
 insert into public.earnchat_chat_sessions(user_id,level_name,message_count,duration_seconds,status,reward_amount,currency,country_code,quality_flags)
 values(uid,p.level_name,required_replies,duration_seconds,'approved',reward,p.currency,p.country,jsonb_build_object(
  'reply_hashes',(select jsonb_agg(md5(lower(trim(value)))) from jsonb_array_elements_text(p_replies)),
  'client',coalesce(p_quality,'{}'::jsonb),
  'contract',contract
 )) returning id into sid;
 credited:=public.earnchat_credit(uid,'work','chat',sid,reward,p.country,'Approved guided chat');
 perform public.earnchat_reconcile_points(uid,'chat',sid::text,configured_points,'Approved guided conversation');
 update public.earnchat_chat_attempts set status='completed',completed_at=now() where id=a.id;
 perform public.mark_earnchat_active_day(uid);
 return jsonb_build_object(
  'ok',true,'session_id',sid,'amount',credited,'currency',p.currency,
  'remaining',l.chat_limit-cnt-1,'minimum_seconds',minimum_seconds,
  'required_replies',required_replies,'minimum_reply_length',minimum_reply_length,
  'activity_points',configured_points
 );
end$$;

revoke all on function public.earnchat_chat_contract() from public;
revoke all on function public.earnchat_reconcile_points(uuid,text,text,integer,text) from public;
grant execute on function public.start_earnchat_chat(text) to authenticated;
grant execute on function public.get_my_open_chat_attempt() to authenticated;
grant execute on function public.complete_earnchat_chat(uuid,jsonb,jsonb) to authenticated;

commit;
