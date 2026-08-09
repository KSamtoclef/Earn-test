begin;

-- Tasks are no longer a customer product. Preserve all historical rows because
-- visit rewards and past claims share these tables, but end every non-Visit item.
update public.earnchat_tasks
set status='ended',updated_at=now()
where category<>'Visit' and status<>'ended';

-- Remove task-based upgrade requirements while retaining sponsored-visit history.
update public.earnchat_level_settings
set approved_tasks=0,updated_at=now()
where approved_tasks<>0;

-- Keep the legacy flag disabled for older clients. Sponsored Visits remains enabled.
update public.earnchat_business_settings
set feature_flags=coalesce(feature_flags,'{}'::jsonb)
  || jsonb_build_object('tasks',false,'sponsored_visits',true),
    configuration_version=configuration_version+1,
    updated_at=now()
where id=true;

create or replace function public.earnchat_enforce_sponsored_visit_only()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if new.category is distinct from 'Visit' then
    raise exception 'Standalone Tasks have been removed. Only Sponsored Visits can be created.';
  end if;
  return new;
end
$$;

drop trigger if exists earnchat_sponsored_visit_only on public.earnchat_tasks;
create trigger earnchat_sponsored_visit_only
before insert or update of category on public.earnchat_tasks
for each row execute function public.earnchat_enforce_sponsored_visit_only();

commit;

-- Verification: both values must be 0.
select 'active_non_visit_tasks' as check_name,count(*) as issue_count
from public.earnchat_tasks where category<>'Visit' and status<>'ended'
union all
select 'nonzero_task_level_requirements',count(*)
from public.earnchat_level_settings where approved_tasks<>0;
