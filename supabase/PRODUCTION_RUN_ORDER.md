# Earn Chat production SQL run order

Back up the Supabase database before running the production installer.

## One-time compatibility preflight

Some databases that ran the older economy migration already contain `earnchat_credit(uuid,text,text,uuid,bigint,text,text)` with a `void` return type. PostgreSQL cannot replace that function with the new `bigint` return type.

Before running the installer, execute this statement once in a separate SQL Editor tab:

```sql
drop function if exists public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) cascade;
```

`CASCADE` removes only old functions that depend on that obsolete helper. The consolidated installer recreates the production versions inside one transaction.

Then run only these two files in the Supabase SQL Editor:

1. `earnchat_production_install.sql`
2. `earnchat_production_verify.sql` — read-only verification

Do not rerun the older multi-file production package. The consolidated installer is designed to recover safely from the partial migration state and fixes the previously reported missing `referral_code`, missing `updated_at`, level-value mismatch, missing `earnchat_chat_attempts`, and legacy function return-type errors.

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
