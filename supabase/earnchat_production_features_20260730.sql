-- Run after earnchat_production_completion_20260730.sql
begin;

alter table public.profiles enable row level security;
drop policy if exists earnchat_profiles_own_or_admin on public.profiles;
create policy earnchat_profiles_own_or_admin on public.profiles for select using(auth.uid()=id or public.earnchat_is_admin());

create table if not exists public.earnchat_qualification_missions(
 id uuid primary key default gen_random_uuid(),
 mission_key text not null unique,
 level_name text not null references public.earnchat_level_settings(level_name),
 title text not null,
 description text not null default '',
 external_url text check(external_url is null or external_url~'^https?://'),
 required_seconds int not null default 0,
 instructions text not null default '',
 status text not null default 'active' check(status in('active','paused','ended')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.earnchat_qualification_submissions(
 id uuid primary key default gen_random_uuid(),
 mission_id uuid not null references public.earnchat_qualification_missions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(),
 submitted_at timestamptz,
 proof jsonb not null default '{}'::jsonb,
 status text not null default 'started' check(status in('started','under_review','approved','rejected')),
 review_reason text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 unique(mission_id,user_id)
);
create table if not exists public.earnchat_analytics_events(
 id bigint generated always as identity primary key,
 event_name text not null,
 user_id uuid references auth.users(id) on delete set null,
 session_id text,
 page_id text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists earnchat_analytics_created_idx on public.earnchat_analytics_events(created_at desc);
create index if not exists earnchat_analytics_event_idx on public.earnchat_analytics_events(event_name,created_at desc);

alter table public.earnchat_qualification_missions enable row level security;
alter table public.earnchat_qualification_submissions enable row level security;
alter table public.earnchat_analytics_events enable row level security;
drop policy if exists earnchat_missions_read on public.earnchat_qualification_missions;
create policy earnchat_missions_read on public.earnchat_qualification_missions for select using(status='active' or public.earnchat_is_admin());
drop policy if exists earnchat_submissions_own on public.earnchat_qualification_submissions;
create policy earnchat_submissions_own on public.earnchat_qualification_submissions for select using(auth.uid()=user_id or public.earnchat_is_admin());
drop policy if exists earnchat_analytics_admin on public.earnchat_analytics_events;
create policy earnchat_analytics_admin on public.earnchat_analytics_events for select using(public.earnchat_is_admin());

create or replace function public.record_earnchat_event(p_event text,p_session text,p_page text,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if nullif(trim(p_event),'') is null then return;end if;
 insert into public.earnchat_analytics_events(event_name,user_id,session_id,page_id,metadata)
 values(trim(p_event),auth.uid(),nullif(p_session,''),nullif(p_page,''),coalesce(p_metadata,'{}'::jsonb));
end;$$;

create or replace function public.start_earnchat_qualification(p_mission uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();m public.earnchat_qualification_missions%rowtype;sid uuid;
begin
 if uid is null then raise exception 'Authentication required';end if;
 select * into m from public.earnchat_qualification_missions where id=p_mission and status='active';
 if not found then raise exception 'Qualification mission unavailable';end if;
 insert into public.earnchat_qualification_submissions(mission_id,user_id)
 values(m.id,uid) on conflict(mission_id,user_id) do update set started_at=now(),status='started',proof='{}'::jsonb,review_reason=null,reviewed_by=null,reviewed_at=null
 returning id into sid;
 return jsonb_build_object('submission_id',sid,'url',m.external_url,'required_seconds',m.required_seconds,'instructions',m.instructions);
end;$$;

create or replace function public.submit_earnchat_qualification(p_submission uuid,p_proof jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();s public.earnchat_qualification_submissions%rowtype;m public.earnchat_qualification_missions%rowtype;
begin
 select * into s from public.earnchat_qualification_submissions where id=p_submission and user_id=uid for update;
 if not found or s.status<>'started' then raise exception 'Invalid qualification submission';end if;
 select * into m from public.earnchat_qualification_missions where id=s.mission_id;
 if extract(epoch from(now()-s.started_at))<m.required_seconds then raise exception 'Required mission time not completed';end if;
 update public.earnchat_qualification_submissions set submitted_at=now(),proof=coalesce(p_proof,'{}'::jsonb),status='under_review' where id=s.id;
 return jsonb_build_object('ok',true,'status','under_review');
end;$$;

create or replace function public.admin_upsert_earnchat_qualification(p_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();mid uuid:=coalesce(p_id,gen_random_uuid());
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 insert into public.earnchat_qualification_missions(id,mission_key,level_name,title,description,external_url,required_seconds,instructions,status,created_by,updated_at)
 values(mid,p_payload->>'mission_key',p_payload->>'level_name',p_payload->>'title',coalesce(p_payload->>'description',''),nullif(p_payload->>'external_url',''),coalesce((p_payload->>'required_seconds')::int,0),coalesce(p_payload->>'instructions',''),coalesce(p_payload->>'status','active'),uid,now())
 on conflict(id) do update set mission_key=excluded.mission_key,level_name=excluded.level_name,title=excluded.title,description=excluded.description,external_url=excluded.external_url,required_seconds=excluded.required_seconds,instructions=excluded.instructions,status=excluded.status,updated_at=now();
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'qualification_upsert','qualification',mid,p_payload);
 return mid;
end;$$;

create or replace function public.admin_review_earnchat_qualification(p_submission uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();s public.earnchat_qualification_submissions%rowtype;m public.earnchat_qualification_missions%rowtype;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid decision';end if;
 select * into s from public.earnchat_qualification_submissions where id=p_submission for update;
 if not found or s.status<>'under_review' then raise exception 'Submission is not under review';end if;
 select * into m from public.earnchat_qualification_missions where id=s.mission_id;
 update public.earnchat_qualification_submissions set status=p_decision,review_reason=p_reason,reviewed_by=uid,reviewed_at=now() where id=s.id;
 if p_decision='approved' then
  if m.level_name='Pro' then update public.profiles set pro_mission_status='approved',updated_at=now() where id=s.user_id;
  elsif m.level_name='Elite' then update public.profiles set elite_mission_status='approved',updated_at=now() where id=s.user_id;
  end if;
  perform public.evaluate_earnchat_level(s.user_id);
 end if;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'qualification_'||p_decision,'qualification_submission',s.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true,'status',p_decision);
end;$$;

create or replace function public.admin_reverse_earnchat_chat(p_session uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();c public.earnchat_chat_sessions%rowtype;available bigint;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 select * into c from public.earnchat_chat_sessions where id=p_session for update;
 if not found or c.status<>'approved' then raise exception 'Only approved chat sessions can be reversed';end if;
 select work_available_balance into available from public.profiles where id=c.user_id for update;
 update public.profiles set work_available_balance=greatest(0,work_available_balance-c.reward_amount),approved_chats_count=greatest(0,approved_chats_count-1),chat_rejection_count=chat_rejection_count+1,security_review_required=case when available<c.reward_amount then true else security_review_required end,updated_at=now() where id=c.user_id;
 update public.earnchat_chat_sessions set status='reversed',rejection_reason=p_reason where id=c.id;
 insert into public.earnchat_ledger(user_id,wallet_type,entry_type,source_type,source_id,amount,currency,country_code,status,description,approved_at)
 values(c.user_id,'work','reversal','chat',c.id,c.reward_amount,c.currency,c.country_code,'approved',coalesce(p_reason,'Chat session reversed'),now()) on conflict do nothing;
 perform public.evaluate_earnchat_level(c.user_id);
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'chat_reversed','chat_session',c.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true);
end;$$;

create or replace function public.admin_upsert_earnchat_feedback(p_id uuid,p_quote text,p_country text,p_verified boolean,p_visible boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();fid uuid:=coalesce(p_id,gen_random_uuid());
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_country not in('NG','KE') then raise exception 'Invalid country';end if;
 insert into public.earnchat_member_feedback(id,quote,country_code,verified_paid_member,is_visible)
 values(fid,trim(p_quote),p_country,p_verified,p_visible)
 on conflict(id) do update set quote=excluded.quote,country_code=excluded.country_code,verified_paid_member=excluded.verified_paid_member,is_visible=excluded.is_visible;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'feedback_upsert','feedback',fid,jsonb_build_object('visible',p_visible,'verified',p_verified));
 return fid;
end;$$;

create or replace function public.admin_set_payment_visibility(p_payment uuid,p_visible boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 update public.earnchat_payment_activity set is_visible=p_visible where id=p_payment;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,target_id,details) values(uid,'payment_visibility','payment',p_payment,jsonb_build_object('visible',p_visible));
 return found;
end;$$;

grant execute on function public.record_earnchat_event(text,text,text,jsonb) to anon,authenticated;
grant execute on function public.start_earnchat_qualification(uuid) to authenticated;
grant execute on function public.submit_earnchat_qualification(uuid,jsonb) to authenticated;
grant execute on function public.admin_upsert_earnchat_qualification(uuid,jsonb) to authenticated;
grant execute on function public.admin_review_earnchat_qualification(uuid,text,text) to authenticated;
grant execute on function public.admin_reverse_earnchat_chat(uuid,text) to authenticated;
grant execute on function public.admin_upsert_earnchat_feedback(uuid,text,text,boolean,boolean) to authenticated;
grant execute on function public.admin_set_payment_visibility(uuid,boolean) to authenticated;
commit;
