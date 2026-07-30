# Earn Chat production SQL run order

Back up the Supabase database before running the production installer.

Run only these two files in the Supabase SQL Editor:

1. `earnchat_production_install.sql`
2. `earnchat_production_verify.sql` — read-only verification

Do not rerun the older multi-file production package. The consolidated installer is designed to recover safely from the partial migration state and fixes the previously reported missing `referral_code`, missing `updated_at`, level-value mismatch, and missing `earnchat_chat_attempts` errors.

After the installer succeeds, confirm the trusted administrator remains active:

```sql
select id,email,is_admin
from public.profiles
where is_admin=true;
```

If no administrator is returned, mark only the trusted account:

```sql
update public.profiles
set is_admin=true
where lower(email)=lower('YOUR_ADMIN_EMAIL');
```

Then run `earnchat_production_verify.sql`.

Expected verification results:

- every required object row shows `exists = true`;
- every `problem_count` row shows `0`;
- configuration version is `2026-07-30-production-install`;
- at least one trusted administrator is listed.
