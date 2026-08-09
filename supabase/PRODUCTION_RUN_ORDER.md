# Earn Chat production SQL run order

Back up the Supabase database before running production SQL.

## Existing database used for the current live site

Run these idempotent upgrades in this exact order:

1. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
2. `earnchat_level_chat_upgrade_20260731.sql`
3. `earnchat_configuration_control_upgrade_20260801.sql`
4. `earnchat_dynamic_chat_contract_20260801.sql`
5. `earnchat_task_restart_contract_20260801.sql`
6. `earnchat_dynamic_operations_contract_20260801.sql`
7. `earnchat_final_completion_20260802.sql`
8. `earnchat_final_task_runtime_20260802.sql`
9. `earnchat_admin_runtime_unification_20260802.sql`
10. `earnchat_chat_timing_controls_20260809.sql`
11. `earnchat_configuration_control_verify_20260801.sql` — read-only configuration and duplicate-credit checks
12. `earnchat_production_verify.sql` — read-only production verification

Optional paused starter tasks:

11. `earnchat_starter_tasks_seed.sql`

The final 2026-08-02 completion migrations add:

- authoritative NGN/KES profile consistency;
- correct cross-country referral commission conversion;
- configurable referral active-day qualification;
- configurable referrer account-age qualification;
- server enforcement for maintenance mode and feature flags;
- guarded customer RPCs that cannot bypass disabled features;
- configurable task-attempt expiry;
- authoritative expiry and restart handling;
- dynamic guided-chat Activity Points;
- country-safe withdrawal and earning calculations.

The customer runtime additionally applies:

- country-neutral first paint, preventing a Kenyan user from seeing temporary Naira figures;
- configured Nigeria and Kenya multipliers on every displayed base reward;
- configured presence timing;
- configured featured-task limits;
- dynamic referral progress counts;
- configured platform identity, support, Terms and Privacy links;
- customer navigation controlled by feature flags;
- a full maintenance screen for protected customer routes.

Do not expose the Admin configuration controls until steps 3 through 8 have succeeded. The browser has safe fallbacks, but monetary, qualification, maintenance and security rules become authoritative only after the database functions are installed.

The final configuration row should show:

```text
version = 20260802-final-completion-r2
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
- incomplete task claims expire using the configured timeout;
- restarting an incomplete task does not create duplicate credit;
- disabled customer features are rejected by the server;
- maintenance mode blocks protected earning operations;
- disabled withdrawal methods are rejected by the server;
- the configured maximum open withdrawal count is enforced;
- disabled KYC and missing required references are rejected by the server;
- only trusted Admin accounts can mutate configuration;
- configuration updates produce Admin audit entries;
- every object row in the original production verification shows `exists = true`;
- every original `problem_count` row shows `0`;
- signup bonuses remain present exactly once and use the correct country amount;
- Kenyan profiles use `KE` and `KES`; Nigerian profiles use `NG` and `NGN`;
- cross-country referral commissions are converted through the configured country multipliers;
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
6. `earnchat_task_restart_contract_20260801.sql`
7. `earnchat_dynamic_operations_contract_20260801.sql`
8. `earnchat_final_completion_20260802.sql`
9. `earnchat_final_task_runtime_20260802.sql`
10. `earnchat_configuration_control_verify_20260801.sql`
11. `earnchat_production_verify.sql`

Do not run removed certification migrations or older multi-file production packages.

After SQL succeeds, confirm the trusted administrator:

```sql
select id,email,is_admin
from public.profiles
where is_admin=true;
```

Only trusted accounts should be marked as administrators.
