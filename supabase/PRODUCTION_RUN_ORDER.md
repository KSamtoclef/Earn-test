# Earn Chat production SQL run order

Back up the Supabase database before running this package.

Run each file once in the SQL Editor, in this exact order:

1. `earnchat_production_rebuild_20260730.sql`
2. `earnchat_production_completion_20260730.sql`
3. `earnchat_production_features_20260730.sql`
4. `earnchat_production_integrity_20260730.sql`
5. `earnchat_production_finalization_20260730.sql`
6. `earnchat_production_release_patch_20260730.sql`
7. `earnchat_production_verify_20260730.sql` — read-only verification

The earlier `earnchat_full_upgrade_20260730.sql` and `earnchat_admin_tasks_20260730.sql` migrations do not replace this production package. The production files add or replace the canonical tables and RPC functions used by the rebuilt frontend.

After files 1–6 succeed, confirm the trusted administrator is still active:

```sql
select id,email,is_admin from public.profiles where is_admin=true;
```

If no administrator is returned, mark only the trusted account:

```sql
update public.profiles set is_admin=true where lower(email)=lower('YOUR_ADMIN_EMAIL');
```

Run file 7 and inspect every result set. Empty anomaly result sets are expected. The object-existence result must show `exists = true` for every required table and function. The configuration version must be `2026-07-30-production-release`.
