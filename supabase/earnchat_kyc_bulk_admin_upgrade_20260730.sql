-- Earn Chat configurable KYC and bulk administrator workflows
-- Run once after earnchat_production_install.sql.
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
declare uid uuid:=auth.uid();
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 update public.earnchat_business_settings set
  kyc_enabled=coalesce((p_payload->>'enabled')::boolean,kyc_enabled),
  kyc_provider_ng=coalesce(nullif(trim(p_payload->>'provider_ng'),''),kyc_provider_ng),
  kyc_provider_ke=coalesce(nullif(trim(p_payload->>'provider_ke'),''),kyc_provider_ke),
  kyc_url_ng=nullif(trim(p_payload->>'url_ng'),''),
  kyc_url_ke=nullif(trim(p_payload->>'url_ke'),''),
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

create or replace function public.admin_bulk_review_earnchat_kyc(p_submissions uuid[],p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare item uuid; succeeded int:=0; failed int:=0;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid KYC decision'; end if;
 foreach item in array coalesce(p_submissions,array[]::uuid[]) loop
  begin
   perform public.admin_review_earnchat_kyc(item,p_decision,p_reason);
   succeeded:=succeeded+1;
  exception when others then failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('ok',true,'succeeded',succeeded,'failed',failed);
end$$;

grant execute on function public.admin_bulk_review_earnchat_kyc(uuid[],text,text) to authenticated;

create or replace function public.admin_bulk_review_task_claims(p_claims uuid[],p_decision text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare item uuid; succeeded int:=0; failed int:=0;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid task decision'; end if;
 foreach item in array coalesce(p_claims,array[]::uuid[]) loop
  begin
   perform public.admin_review_task_claim(item,p_decision,p_reason);
   succeeded:=succeeded+1;
  exception when others then failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('ok',true,'succeeded',succeeded,'failed',failed);
end$$;

grant execute on function public.admin_bulk_review_task_claims(uuid[],text,text) to authenticated;

create or replace function public.admin_bulk_update_user_control(p_users uuid[],p_action text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare item uuid; succeeded int:=0; failed int:=0;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_action not in('review_on','review_off','suspend','restore') then raise exception 'Invalid user-control action'; end if;
 foreach item in array coalesce(p_users,array[]::uuid[]) loop
  begin
   perform public.admin_update_earnchat_user_control(item,p_action,p_reason);
   succeeded:=succeeded+1;
  exception when others then failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('ok',true,'succeeded',succeeded,'failed',failed);
end$$;

grant execute on function public.admin_bulk_update_user_control(uuid[],text,text) to authenticated;

commit;
select 'Earn Chat KYC and bulk admin upgrade completed' as status;