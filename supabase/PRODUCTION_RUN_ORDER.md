# Earn Chat production SQL run order

Back up the Supabase database before running production SQL.

## Existing database used for the current live test

Run these idempotent upgrades in this exact order:

1. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
2. `earnchat_level_chat_upgrade_20260731.sql`
3. `earnchat_configuration_control_upgrade_20260801.sql`
4. `earnchat_dynamic_chat_contract_20260801.sql`
5. `earnchat_dynamic_operations_contract_20260801.sql`
6. `earnchat_configuration_control_verify_20260801.sql` — read-only configuration and duplicate-credit checks
7. `earnchat_production_verify.sql` — read-only production verification

Optional paused starter tasks:

8. `earnchat_starter_tasks_seed.sql`

The 2026-08-01 upgrades are required for the Admin-driven configuration and accurate activity lifecycle. They add:

- configuration versioning;
- validated configuration sections;
- Admin-only mutation RPCs;
- configuration audit logging;
- dynamic guided-chat duration;
- dynamic reply count;
- dynamic minimum reply length;
- dynamic attempt expiry;
- dynamic guided-chat Activity Points;
- one server/client guided-chat contract;
- authoritative cancellation of incomplete task attempts;
- restart-required task behavior without duplicate open claims;
- server-enforced withdrawal availability and payout-method flags;
- configurable maximum open withdrawal requests;
- server-enforced KYC availability and reference requirements.

Do not expose the new Admin configuration controls before steps 3 through 5 have succeeded. The customer runtime uses safe fallbacks, but configurable rules become authoritative only after the database functions are installed.

The base production version remains:

```text
20260731-production-complete-r1
```

The configuration row must additionally show:

```text
configuration_version >= 1
```

Verification requirements:

- exactly one business-settings row exists;
- all configuration sections are JSON objects;
- every unknown feature flag count is `0`;
- every invalid level/order/amount count is `0`;
- every duplicate chat/task credit count is `0`;
- every duplicate open task-claim count is `0`;
- the public configuration contains no `updated_by` field;
- guided-chat start, resume and completion return the configured contract;
- incomplete task claims can be cancelled only by their owner or an authorized server action;
- restarting an incomplete task does not create duplicate credit;
- disabled withdrawal methods are rejected by the server;
- the configured maximum open withdrawal count is enforced;
- disabled KYC and missing required references are rejected by the server;
- only trusted Admin accounts can mutate configuration;
- configuration updates produce Admin audit entries;
- every object row in the original production verification shows `exists = true`;
- every original `problem_count` row shows `0`;
- signup bonuses remain present exactly once and use the correct country amount;
- Activity Points match the point-event ledger;
- no duplicate direct-referral commission exists;
- Admin overview contains country-separated liabilities and suspicious-account totals.

## Fresh or reset database

Run:

1. `earnchat_production_install.sql`
2. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
3. `earnchat_level_chat_upgrade_20260731.sql`
4. `earnchat_configuration_control_upgrade_20260801.sql`
5. `earnchat_dynamic_chat_contract_20260801.sql`
6. `earnchat_dynamic_operations_contract_20260801.sql`
7. `earnchat_configuration_control_verify_20260801.sql`
8. `earnchat_production_verify.sql`

The installer creates the base production schema. The later upgrades apply KYC/recovery, bonuses, points, direct commissions, earned levels, versioned Admin configuration, the dynamic guided-chat contract, authoritative task restart, and server-enforced withdrawal/KYC settings.

Do not run removed certification migrations or older multi-file production packages.

After SQL succeeds, confirm the trusted administrator:

```sql
select id,email,is_admin
from public.profiles
where is_admin=true;
```

Only trusted accounts should be marked as administrators.
