-- Run after earnchat_full_upgrade_20260730.sql.
-- Then mark the existing trusted administrator once:
-- update public.profiles set is_admin=true where email='YOUR_ADMIN_EMAIL';
begin;
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.earnchat_is_admin() returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select is_admin from public.profiles where id=auth.uid()),false)
$$;

create or replace function public.admin_create_earnchat_task(
 p_title text,p_description text,p_url text,p_provider text,p_country text,p_reward_ngn bigint,
 p_level text,p_required_seconds int,p_daily_limit int,p_total_limit int,p_approval text,
 p_proof_required boolean,p_instructions text,p_starts_at timestamptz,p_ends_at timestamptz,p_status text
) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();new_id uuid;l public.earnchat_level_settings%rowtype;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_title is null or length(trim(p_title))<3 then raise exception 'Task title is required';end if;
 if p_url is null or p_url!~'^https?://' then raise exception 'Valid task link required';end if;
 if p_country not in('ALL','NG','KE') then raise exception 'Invalid country';end if;
 if p_status not in('active','paused','ended') then raise exception 'Invalid status';end if;
 if p_approval not in('instant','pending','partner') then raise exception 'Invalid approval type';end if;
 select * into l from public.earnchat_level_settings where level_name=p_level;
 if not found then raise exception 'Invalid level';end if;
 if p_reward_ngn<l.task_min_ngn or p_reward_ngn>l.task_max_ngn then raise exception '% reward must be between % and % NGN',p_level,l.task_min_ngn,l.task_max_ngn;end if;
 insert into public.earnchat_tasks(title,description,external_url,provider_name,country_code,base_reward_ngn,required_level,required_seconds,daily_claim_limit,total_claim_limit,approval_type,proof_required,instructions,starts_at,ends_at,status,created_by)
 values(trim(p_title),coalesce(p_description,''),p_url,nullif(trim(coalesce(p_provider,'')),''),p_country,p_reward_ngn,p_level,greatest(0,coalesce(p_required_seconds,0)),greatest(1,coalesce(p_daily_limit,1)),p_total_limit,p_approval,coalesce(p_proof_required,false),coalesce(p_instructions,''),p_starts_at,p_ends_at,p_status,uid) returning id into new_id;
 return new_id;
end;$$;

create or replace function public.admin_update_earnchat_task_status(p_task uuid,p_status text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if p_status not in('active','paused','ended') then raise exception 'Invalid status';end if;
 update public.earnchat_tasks set status=p_status,updated_at=now() where id=p_task;
 return found;
end;$$;

create or replace function public.admin_delete_earnchat_task(p_task uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 if exists(select 1 from public.earnchat_task_claims where task_id=p_task) then
  update public.earnchat_tasks set status='ended',updated_at=now() where id=p_task;
 else delete from public.earnchat_tasks where id=p_task;
 end if;
 return found;
end;$$;

create or replace function public.admin_list_earnchat_tasks() returns setof public.earnchat_tasks
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required';end if;
 return query select * from public.earnchat_tasks order by created_at desc;
end;$$;

revoke all on function public.earnchat_is_admin() from public,anon;
grant execute on function public.earnchat_is_admin() to authenticated;
grant execute on function public.admin_create_earnchat_task(text,text,text,text,text,bigint,text,int,int,int,text,boolean,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_update_earnchat_task_status(uuid,text) to authenticated;
grant execute on function public.admin_delete_earnchat_task(uuid) to authenticated;
grant execute on function public.admin_list_earnchat_tasks() to authenticated;
commit;
