-- Earn Chat admin live setup
-- Safe, additive, idempotent, and compatible with slightly different existing schemas.
-- Run the whole file once in Supabase SQL Editor.

begin;

-- Create useful indexes only when both the table and the expected column exist.
do $$
begin
  if to_regclass('public.analytics_events') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='analytics_events' and column_name='created_at') then
    execute 'create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc)';
  end if;

  if to_regclass('public.site_presence') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='site_presence' and column_name='last_seen') then
    execute 'create index if not exists site_presence_last_seen_idx on public.site_presence (last_seen desc)';
  end if;

  if to_regclass('public.withdrawal_requests') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='withdrawal_requests' and column_name='requested_at') then
    execute 'create index if not exists withdrawal_requests_requested_at_idx on public.withdrawal_requests (requested_at desc)';
  end if;

  if to_regclass('public.kyc_submissions') is not null then
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='created_at') then
      execute 'create index if not exists kyc_submissions_created_at_idx on public.kyc_submissions (created_at desc)';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='submitted_at') then
      execute 'create index if not exists kyc_submissions_submitted_at_idx on public.kyc_submissions (submitted_at desc)';
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='updated_at') then
      execute 'create index if not exists kyc_submissions_updated_at_idx on public.kyc_submissions (updated_at desc)';
    end if;
  end if;
end $$;

-- Admin read policies. Existing user-facing policies are preserved.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('profiles','earn_chat_admin_read_profiles'),
      ('analytics_events','earn_chat_admin_read_analytics'),
      ('site_presence','earn_chat_admin_read_presence'),
      ('withdrawal_requests','earn_chat_admin_read_withdrawals'),
      ('kyc_submissions','earn_chat_admin_read_kyc')
    ) as v(table_name, policy_name)
  loop
    if to_regclass(format('public.%I', item.table_name)) is not null then
      execute format('alter table public.%I enable row level security', item.table_name);
      if not exists (
        select 1 from pg_policies
        where schemaname='public'
          and tablename=item.table_name
          and policyname=item.policy_name
      ) then
        execute format(
          'create policy %I on public.%I for select to authenticated using (public.is_current_user_admin())',
          item.policy_name,
          item.table_name
        );
      end if;
    end if;
  end loop;
end $$;

-- Allow authenticated users to call the existing admin-check function.
do $$
begin
  if to_regprocedure('public.is_current_user_admin()') is not null then
    grant execute on function public.is_current_user_admin() to authenticated;
  else
    raise exception 'Required function public.is_current_user_admin() was not found. Run the main Earn Chat secure SQL first.';
  end if;
end $$;

-- Add existing tables to Supabase Realtime only when they are not already published.
do $$
declare
  t text;
begin
  foreach t in array array['site_presence','analytics_events','withdrawal_requests','kyc_submissions','profiles']
  loop
    if to_regclass(format('public.%I', t)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname='supabase_realtime'
           and schemaname='public'
           and tablename=t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;

-- Verification output. Five rows should appear.
select
  p.tablename,
  (to_regclass(format('public.%I', p.tablename)) is not null) as table_exists,
  exists (
    select 1 from pg_publication_tables r
    where r.pubname='supabase_realtime'
      and r.schemaname='public'
      and r.tablename=p.tablename
  ) as realtime_enabled,
  count(pol.policyname) filter (where pol.policyname like 'earn_chat_admin_read_%') as admin_read_policies
from (values
  ('profiles'),
  ('analytics_events'),
  ('site_presence'),
  ('withdrawal_requests'),
  ('kyc_submissions')
) as p(tablename)
left join pg_policies pol
  on pol.schemaname='public' and pol.tablename=p.tablename
group by p.tablename
order by p.tablename;
