-- Earn Chat configurable KYC, recovery and bulk administrator workflows
-- Safe to rerun after earnchat_production_install.sql.
begin;

alter table public.earnchat_business_settings add column if not exists kyc_enabled boolean not null default true;
alter table public.earnchat_business_settings add column if not exists kyc_provider_ng text not null default 'Approved verification provider';
alter table public.earnchat_business_settings add column if not exists kyc_provider_ke text not null default 'Approved verification provider';
alter table public.earnchat_business_settings add column if not exists kyc_url_ng text;
alter table public.earnchat_business_settings add column if not exists kyc_url_ke text;
alter table public.earnchat_business_settings add column if not exists kyc_instructions_ng text not null default 'Open the approved verification page, complete the required steps, then return with your reference.';
alter table public.earnchat_business_settings add column if not exists kyc_instructions_ke text not null default 'Open the approved verification page, complete the required steps, then return with your reference.';
alter table public.earnchat_business_settings add column if not exists kyc_reference_required boolean not null default true;
alter table public.earnchat_business_settings add column if not exists kyc_review_hours integer not null default 48;

create or replace function public.get_earnchat_kyc_config()
returns jsonb
language sql
security definer
set search_path=public
as $$
 select jsonb_build_object(
  'enabled',coalesce(s.kyc_enabled,true),
  'reference_required',coalesce(s.kyc_reference_required,true),
  'review_hours',coalesce(s.kyc_review_hours,48),
  'NG',jsonb_build_object('provider',s.kyc_provider_ng,'url',s.kyc_url_ng,'instructions',s.kyc_instructions_ng),
  'KE',jsonb_build_object('provider',s.kyc_provider_ke,'url',s.kyc_url_ke,'instructions',s.kyc_instructions_ke)
 )
 from public.earnchat_business_settings s where s.id=true
$$;

grant execute on function public.get_earnchat_kyc_config() to anon,authenticated;

create or replace function public.admin_update_earnchat_kyc_config(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 uid uuid:=auth.uid();
 ng_url text:=nullif(trim(p_payload->>'url_ng'),'');
 ke_url text:=nullif(trim(p_payload->>'url_ke'),'');
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if ng_url is not null and ng_url !~* '^https://[^[:space:]]+$' then raise exception 'Nigeria KYC URL must use HTTPS'; end if;
 if ke_url is not null and ke_url !~* '^https://[^[:space:]]+$' then raise exception 'Kenya KYC URL must use HTTPS'; end if;
 update public.earnchat_business_settings set
  kyc_enabled=coalesce((p_payload->>'enabled')::boolean,kyc_enabled),
  kyc_provider_ng=coalesce(nullif(trim(p_payload->>'provider_ng'),''),kyc_provider_ng),
  kyc_provider_ke=coalesce(nullif(trim(p_payload->>'provider_ke'),''),kyc_provider_ke),
  kyc_url_ng=ng_url,
  kyc_url_ke=ke_url,
  kyc_instructions_ng=coalesce(nullif(trim(p_payload->>'instructions_ng'),''),kyc_instructions_ng),
  kyc_instructions_ke=coalesce(nullif(trim(p_payload->>'instructions_ke'),''),kyc_instructions_ke),
  kyc_reference_required=coalesce((p_payload->>'reference_required')::boolean,kyc_reference_required),
  kyc_review_hours=greatest(1,coalesce((p_payload->>'review_hours')::integer,kyc_review_hours)),
  updated_at=now()
 where id=true;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,details)
 values(uid,'kyc_configuration_updated','business_settings',coalesce(p_payload,'{}'::jsonb));
 return public.get_earnchat_kyc_config();
end$$;

grant execute on function public.admin_update_earnchat_kyc_config(jsonb) to authenticated;

create or replace function public.get_my_open_task_claim()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
 select coalesce((
  select jsonb_build_object(
   'claim_id',c.id,
   'task_id',c.task_id,
   'status',c.status,
   'started_at',c.started_at,
   'required_seconds',t.required_seconds,
   'reward',c.reward_amount,
   'currency',c.currency,
   'country_code',c.country_code,
   'proof_type',t.proof_type,
   'approval_type',t.approval_type,
   'url',t.external_url,
   'title',t.title,
   'provider_name',t.provider_name,
   'instructions',t.instructions
  )
  from public.earnchat_task_claims c
  join public.earnchat_tasks t on t.id=c.task_id
  where c.user_id=auth.uid() and c.status='started'
  order by c.started_at desc
  limit 1
 ),'null'::jsonb)
$$;

grant execute on function public.get_my_open_task_claim() to authenticated;

create or replace function public.get_my_open_chat_attempt()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare result jsonb;
begin
 update public.earnchat_chat_attempts
 set status='expired'
 where user_id=auth.uid() and status='started' and expires_at<=now();
 select jsonb_build_object(
  'attempt_id',a.id,
  'partner',a.partner_key,
  'started_at',a.started_at,
  'expires_at',a.expires_at,
  'required_replies',4,
  'minimum_seconds',120
 ) into result
 from public.earnchat_chat_attempts a
 where a.user_id=auth.uid() and a.status='started' and a.expires_at>now()
 order by a.started_at desc
 limit 1;
 return coalesce(result,'null'::jsonb);
end$$;

grant execute on function public.get_my_open_chat_attempt() to authenticated;

create or replace function public.start_earnchat_task(p_task uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid();t public.earnchat_tasks%rowtype;p public.profiles%rowtype;ur int;tr int;dc int;tc int;reward bigint;cid uuid;started timestamptz;
begin
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 if exists(select 1 from public.earnchat_task_claims where user_id=uid and status='started') then raise exception 'Finish your current task first'; end if;
 select * into t from public.earnchat_tasks where id=p_task and status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now());
 if not found or t.country_code not in('ALL',p.country) then raise exception 'Task unavailable'; end if;
 select rank into ur from public.earnchat_level_settings where level_name=p.level_name;
 select rank into tr from public.earnchat_level_settings where level_name=t.required_level;
 if ur<tr then raise exception 'Required level: %',t.required_level; end if;
 select count(*) into dc from public.earnchat_task_claims where task_id=t.id and user_id=uid and started_at::date=current_date and status<>'rejected';
 if dc>=t.daily_claim_limit then raise exception 'Daily claim limit reached'; end if;
 if t.total_claim_limit is not null then
  select count(*) into tc from public.earnchat_task_claims where task_id=t.id and status in('started','pending','approved');
  if tc>=t.total_claim_limit then raise exception 'Task capacity reached'; end if;
 end if;
 reward:=public.earnchat_country_amount(t.base_reward_ngn,p.country);
 insert into public.earnchat_task_claims(task_id,user_id,reward_amount,currency,country_code)
 values(t.id,uid,reward,p.currency,p.country) returning id,started_at into cid,started;
 return jsonb_build_object('claim_id',cid,'task_id',t.id,'started_at',started,'url',t.external_url,'title',t.title,'provider_name',t.provider_name,'required_seconds',t.required_seconds,'reward',reward,'currency',p.currency,'approval_type',t.approval_type,'proof_type',t.proof_type,'instructions',t.instructions);
end$$;

grant execute on function public.start_earnchat_task(uuid) to authenticated;

create or replace function public.start_earnchat_chat(p_partner text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid();p public.profiles%rowtype;l public.earnchat_level_settings%rowtype;cnt int;aid uuid;started timestamptz;expires timestamptz;
begin
 select * into p from public.profiles where id=uid;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 select * into l from public.earnchat_level_settings where level_name=p.level_name;
 select count(*) into cnt from public.earnchat_chat_sessions where user_id=uid and session_date=current_date and status='approved';
 if cnt>=l.chat_limit then raise exception 'Daily chat limit reached'; end if;
 update public.earnchat_chat_attempts set status='expired' where user_id=uid and status='started' and expires_at<now();
 if exists(select 1 from public.earnchat_chat_attempts where user_id=uid and status='started' and expires_at>now()) then raise exception 'Finish your current guided chat first'; end if;
 insert into public.earnchat_chat_attempts(user_id,partner_key) values(uid,p_partner) returning id,started_at,expires_at into aid,started,expires;
 return jsonb_build_object('attempt_id',aid,'partner',p_partner,'started_at',started,'expires_at',expires,'required_replies',4,'minimum_seconds',120,'daily_limit',l.chat_limit,'remaining',l.chat_limit-cnt);
end$$;

grant execute on function public.start_earnchat_chat(text) to authenticated;

create or replace function public.admin_bulk_review_earnchat_kyc(p_submissions uuid[],p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare item uuid;succeeded int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid KYC decision'; end if;
 foreach item in array coalesce(p_submissions,array[]::uuid[]) loop
  begin
   perform public.admin_review_earnchat_kyc(item,p_decision,p_reason);
   succeeded:=succeeded+1;
  exception when others then failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'error',sqlerrm));
  end;
 end loop;
 return jsonb_build_object('ok',jsonb_array_length(failures)=0,'succeeded',succeeded,'failed',jsonb_array_length(failures),'failures',failures);
end$$;

grant execute on function public.admin_bulk_review_earnchat_kyc(uuid[],text,text) to authenticated;

create or replace function public.admin_bulk_review_task_claims(p_claims uuid[],p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare item uuid;succeeded int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid task decision'; end if;
 foreach item in array coalesce(p_claims,array[]::uuid[]) loop
  begin
   perform public.admin_review_task_claim(item,p_decision,p_reason);
   succeeded:=succeeded+1;
  exception when others then failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'error',sqlerrm));
  end;
 end loop;
 return jsonb_build_object('ok',jsonb_array_length(failures)=0,'succeeded',succeeded,'failed',jsonb_array_length(failures),'failures',failures);
end$$;

grant execute on function public.admin_bulk_review_task_claims(uuid[],text,text) to authenticated;

create or replace function public.admin_bulk_update_user_control(p_users uuid[],p_action text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare item uuid;succeeded int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_action not in('review_on','review_off','suspend','restore') then raise exception 'Invalid user-control action'; end if;
 foreach item in array coalesce(p_users,array[]::uuid[]) loop
  begin
   perform public.admin_update_earnchat_user_control(item,p_action,p_reason);
   succeeded:=succeeded+1;
  exception when others then failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'error',sqlerrm));
  end;
 end loop;
 return jsonb_build_object('ok',jsonb_array_length(failures)=0,'succeeded',succeeded,'failed',jsonb_array_length(failures),'failures',failures);
end$$;

grant execute on function public.admin_bulk_update_user_control(uuid[],text,text) to authenticated;

commit;
select 'Earn Chat certification KYC, recovery and bulk upgrade completed' as status;