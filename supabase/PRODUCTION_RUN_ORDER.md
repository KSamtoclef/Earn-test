# Earn Chat production SQL run order

Back up the Supabase database before running production SQL.

## Existing database already installed

Your current database has already run the consolidated installer and an earlier KYC upgrade. Run the latest consolidated upgrade once, then verification:

1. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
2. `earnchat_production_verify.sql` — read-only verification

The consolidated upgrade is safe to rerun and now includes:

- country-specific KYC provider names, URLs and instructions;
- HTTPS validation for KYC URLs;
- bulk KYC, task-claim and user-control actions with detailed failures;
- open task recovery after refresh;
- one active task claim per user;
- task expiry and cancellation;
- open guided-chat recovery using server timestamps;
- guided-chat cancellation;
- final database version `2026-07-31-production-certification-r1`.

Expected upgrade result:

```text
Earn Chat KYC, recovery and bulk administrator upgrade completed
```

## Fresh or reset database

Some older databases contain `earnchat_credit(uuid,text,text,uuid,bigint,text,text)` with a `void` return type. PostgreSQL cannot replace that function with the production `bigint` return type.

Before the installer, execute once in a separate SQL Editor tab:

```sql
drop function if exists public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) cascade;
```

Then run in this order:

1. `earnchat_production_install.sql`
2. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
3. `earnchat_production_verify.sql`

Do not run the removed certification migration or the older multi-file production package.

After SQL succeeds, confirm the trusted administrator remains active:

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

Verification expectations:

- every required object row shows `exists = true`;
- every `problem_count` row shows `0`;
- no duplicate open chat or task claim exists;
- no invalid KYC URL exists;
- wallet and ledger checks match;
- at least one trusted administrator is listed.
