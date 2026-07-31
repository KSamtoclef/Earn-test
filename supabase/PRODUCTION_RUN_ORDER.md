# Earn Chat production SQL run order

Back up the Supabase database before running production SQL.

## Existing database already installed

Run the current upgrades in this order, then verification:

1. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
2. `earnchat_level_chat_upgrade_20260731.sql`
3. `earnchat_starter_tasks_seed.sql` — optional paused starter tasks
4. `earnchat_production_verify.sql` — read-only verification

The KYC/recovery upgrade is safe to rerun and includes:

- country-specific KYC configuration and HTTPS validation;
- bulk KYC, task-claim and user-control actions;
- task and guided-chat recovery;
- one open task/chat attempt per user;
- server-side payout validation and hardened function search paths.

The member-motivation upgrade is also safe to rerun and includes:

- real one-time ₦2,000 / KSh1,200 welcome bonuses for new and existing profiles;
- auditable Activity Points with duplicate protection;
- Starter, Active, Pro and Elite point thresholds;
- Active earned through 4 account days, 4 active days, 8 approved chats, 6 approved tasks, 50 points and submitted KYC;
- direct qualified-referral reward of ₦500 / KSh300;
- direct-referral commissions of 1%, 3%, 5% and 7% by the inviter's current level;
- no chain or second-level commission;
- 45-second, four-reply guided conversations.

Expected member-motivation result:

```text
Earn Chat welcome bonus, points, direct referral commissions and 45-second chat upgrade completed
```

## Fresh or reset database

Some older databases contain `earnchat_credit(uuid,text,text,uuid,bigint,text,text)` with a `void` return type. PostgreSQL cannot replace that function with the production `bigint` return type.

Before the installer, execute once in a separate SQL Editor tab:

```sql
drop function if exists public.earnchat_credit(uuid,text,text,uuid,bigint,text,text) cascade;
```

Then run:

1. `earnchat_production_install.sql`
2. `earnchat_kyc_bulk_admin_upgrade_20260730.sql`
3. `earnchat_level_chat_upgrade_20260731.sql`
4. `earnchat_starter_tasks_seed.sql` — optional
5. `earnchat_production_verify.sql`

After SQL succeeds, confirm the trusted administrator remains active:

```sql
select id,email,is_admin
from public.profiles
where is_admin=true;
```

Confirm bonuses and points are not duplicated:

```sql
select user_id,count(*)
from public.earnchat_ledger
where source_type='signup_bonus' and entry_type='credit'
group by user_id
having count(*)>1;

select user_id,source_type,source_key,count(*)
from public.earnchat_point_events
group by user_id,source_type,source_key
having count(*)>1;
```

Both checks should return no rows.

Verification expectations:

- every required object row shows `exists = true`;
- every `problem_count` row shows `0`;
- no duplicate open chat or task claim exists;
- no invalid KYC URL exists;
- wallet and ledger checks match;
- at least one trusted administrator is listed.
