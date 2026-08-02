-- Earn Chat final task-expiry and dynamic point contract
-- Run after earnchat_final_completion_20260802.sql.
begin;

alter table public.earnchat_task_claims
 add column if not exists expires_at timestamptz;

update public.earnchat_task_claims c
set expires_at=coalesce(c.expires_at,c.started_at+make_interval(mins=>greatest(1,least(1440,coalesce((select (coalesce(s.task_config,'{}'::jsonb)->>'default_attempt_expiry_minutes')::int from public.earnchat_business_settings s where s.id=true),30)))))
where c.status='started' and c.expires_at is null;

create index if not exists earnchat_task_claims_open_expiry_idx
 on public.earnchat_task_claims(user_id,expires_at)
 where status='started';

create or replace function public.earnchat_award_points(p_user uuid,p_source_type text,p_source_key text,p_points integer,p_description text default null)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare inserted uuid;effective_points integer:=coalesce(p_points,0);cfg jsonb;
begin
 if p_source_type='chat' then
  select coalesce(chat_config,'{}'::jsonb) into cfg from public.earnchat_business_settings where id=true;
  effective_points:=greatest(0,least(1000,coalesce((cfg->>'activity_points')::integer,effective_points,2)));
 end if;
 if p_user is null or nullif(trim(p_source_type),'') is null or nullif(trim(p_source_key),'') is null or effective_points<=0 then return 0; end if;
 insert into public.earnchat_point_events(user_id,source_type,source_key,points,description)
 values(p_user,trim(p_source_type),trim(p_source_key),effective_points,p_description)
 on conflict(user_id,source_type,source_key) do nothing returning id into inserted;
 if inserted is null then return 0; end if;
 update public.profiles set activity_points=activity_points+effective_points,updated_at=now() where id=p_user;
 return effective_points;
exception when invalid_text_representation then
 raise exception 'Configured Activity Points value is invalid' using errcode='22023';
end$$;

create or replace function public.start_earnchat_task(p_task uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare category text;result jsonb;minutes integer;claim_id uuid;expiry timestamptz;
begin
 select t.category into category from public.earnchat_tasks t where t.id=p_task;
 perform public.earnchat_assert_runtime_available(case when category='Visit' then 'sponsored_visits' else 'tasks' end);
 result:=public.start_earnchat_task_core_20260802(p_task);
 claim_id:=nullif(result->>'claim_id','')::uuid;
 select greatest(1,least(1440,coalesce((coalesce(task_config,'{}'::jsonb)->>'default_attempt_expiry_minutes')::integer,30)))
 into minutes from public.earnchat_business_settings where id=true;
 expiry:=now()+make_interval(mins=>minutes);
 update public.earnchat_task_claims set expires_at=expiry where id=claim_id and user_id=auth.uid();
 return result||jsonb_build_object('expires_at',expiry,'attempt_expiry_minutes',minutes);
end$$;

create or replace function public.submit_earnchat_task(p_claim uuid,p_proof jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare category text;expiry timestamptz;
begin
 select t.category,c.expires_at into category,expiry
 from public.earnchat_task_claims c join public.earnchat_tasks t on t.id=c.task_id
 where c.id=p_claim and c.user_id=auth.uid() for update of c;
 if expiry is not null and expiry<=now() then
  update public.earnchat_task_claims set status='expired',review_reason='Attempt expired before submission',reviewed_at=now() where id=p_claim and status='started';
  raise exception 'This task attempt expired. Restart the task to begin again.' using errcode='55000';
 end if;
 perform public.earnchat_assert_runtime_available(case when category='Visit' then 'sponsored_visits' else 'tasks' end);
 return public.submit_earnchat_task_core_20260802(p_claim,p_proof);
end$$;

create or replace function public.get_my_open_task_claim()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();result jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 update public.earnchat_task_claims set status='expired',review_reason='Attempt expired',reviewed_at=now()
 where user_id=uid and status='started' and expires_at is not null and expires_at<=now();
 select jsonb_build_object(
  'claim_id',c.id,'task_id',t.id,'title',t.title,'category',t.category,
  'instructions',t.instructions,'required_seconds',t.required_seconds,
  'proof_type',t.proof_type,'proof_required',t.proof_required,
  'approval_type',t.approval_type,'url',t.external_url,
  'reward',c.reward_amount,'currency',c.currency,'country_code',c.country_code,
  'started_at',c.started_at,'expires_at',c.expires_at
 ) into result
 from public.earnchat_task_claims c join public.earnchat_tasks t on t.id=c.task_id
 where c.user_id=uid and c.status='started'
 order by c.started_at desc limit 1;
 return result;
end$$;

grant execute on function public.start_earnchat_task(uuid) to authenticated;
grant execute on function public.submit_earnchat_task(uuid,jsonb) to authenticated;
grant execute on function public.get_my_open_task_claim() to authenticated;

update public.earnchat_business_settings set version='20260802-final-completion-r2',updated_at=now() where id=true;
commit;
