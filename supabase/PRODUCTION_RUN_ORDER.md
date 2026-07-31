# Earn Chat production SQL run order

Back up the Supabase database before running production SQL.

## Existing database used for the current live test

Run these idempotent upgrades in this order:

1. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
2. `earnchat_level_chat_upgrade_20260731.sql`
3. `earnchat_production_verify.sql` — read-only verification

Optional paused starter tasks:

4. `earnchat_starter_tasks_seed.sql`

Expected result from the final member upgrade:

```text
Earn Chat production-complete bonus, points, commissions, 45-second chat and Admin overview upgrade completed
```

The final database version must be:

```text
20260731-production-complete-r1
```

Verification requirements:

- every object row shows `exists = true`;
- every `problem_count` row shows `0`;
- at least one trusted administrator is listed;
- signup bonuses are present exactly once and use the correct country amount;
- Activity Points match the point-event ledger;
- no duplicate direct-referral commission exists;
- the guided-chat server minimum is 45 seconds;
- the Admin overview function contains exact country-separated liabilities and suspicious-account totals.

## Fresh or reset database

Run:

1. `earnchat_production_install.sql`
2. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
3. `earnchat_level_chat_upgrade_20260731.sql`
4. `earnchat_production_verify.sql`

The current installer creates the base production schema. The two current upgrades then apply the final KYC/recovery, bonus, points, commission, earned-level, chat-timing and exact Admin-overview contracts.

Do not run the removed certification migration or older multi-file production packages.

After SQL succeeds, confirm the trusted administrator:

```sql
select id,email,is_admin
from public.profiles
where is_admin=true;
```

Only a trusted account should be marked as an administrator.
