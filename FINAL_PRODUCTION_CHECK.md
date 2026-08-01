# Earn Chat final production check

Commit: 77b7d233d6c79f9eb46739521e135bd56e94cbf8
Validation exit: 1
Build exit: 1

## Validation output
```text

> validate
> node scripts/validate-production.mjs && node scripts/validate-deployment.mjs

Production validation failed with 5 issue(s):
- Admin configuration control missing: featureForm
- Admin configuration control missing: levelForm
- Task lifecycle contract missing: restart-required
- Task lifecycle contract missing: pending-review
- Production SQL run order missing: earnchat_task_restart_contract_20260801.sql
```

## Build output
```text

> build
> npm run validate && node scripts/build-static.mjs


> validate
> node scripts/validate-production.mjs && node scripts/validate-deployment.mjs

Production validation failed with 5 issue(s):
- Admin configuration control missing: featureForm
- Admin configuration control missing: levelForm
- Task lifecycle contract missing: restart-required
- Task lifecycle contract missing: pending-review
- Production SQL run order missing: earnchat_task_restart_contract_20260801.sql
```
