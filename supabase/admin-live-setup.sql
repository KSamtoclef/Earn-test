-- Earn Chat admin live setup
-- Safe, additive, and idempotent. Run once in Supabase SQL Editor.

begin;

-- Required indexes for the admin dashboard and live-presence queries.
create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);
create index if not exists site_presence_last_seen_idx
  on public.site_presence (last_seen desc);
create index if not exists withdrawal_requests_requested_at_idx
  on public.withdrawal_requests (requested_at desc);
create index if not exists kyc_submissions_created_at_idx
  on public.kyc_submissions (created_at desc);

-- Admin read policies. They reuse the existing is_current_user_admin() function
-- and do not replace or weaken user-facing RLS policies.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='earn_chat_admin_read_profiles') then
    create policy earn_chat_admin_read_profiles on public.profiles
      for select to authenticated
      using (public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='analytics_events' and policyname='earn_chat_admin_read_analytics') then
    create policy earn_chat_admin_read_analytics on public.analytics_events
      for select to authenticated
      using (public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='site_presence' and policyname='earn_chat_admin_read_presence') then
    create policy earn_chat_admin_read_presence on public.site_presence
      for select to authenticated
      using (public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='withdrawal_requests' and policyname='earn_chat_admin_read_withdrawals') then
    create policy earn_chat_admin_read_withdrawals on public.withdrawal_requests
      for select to authenticated
      using (public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='kyc_submissions' and policyname='earn_chat_admin_read_kyc') then
    create policy earn_chat_admin_read_kyc on public.kyc_submissions
      for select to authenticated
      using (public.is_current_user_admin());
  end if;
end $$;

-- Make the existing admin helper functions executable by authenticated users.
grant execute on function public.is_current_user_admin() to authenticated;

-- Add live tables to the Supabase Realtime publication only when missing.
do $$
declare
  t text;
begin
  foreach t in array array['site_presence','analytics_events','withdrawal_requests','kyc_submissions','profiles']
  loop
    if not exists (
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

-- Verification output.
select
  p.tablename,
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
