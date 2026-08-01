# Earn Chat final production check

Commit: 576e725640b0d9475e8582770533f8598dfd3709
Validation exit: 0
Build exit: 1

## Validation output
```text

> validate
> node scripts/validate-production.mjs && node scripts/validate-deployment.mjs

Earn Chat structural production validation passed.
Checked 33 required files and 18 JavaScript modules across configuration, customer runtime, Admin, chat, task restart, withdrawals, KYC, security, routing and copy-only deployment.
Earn Chat deployment configuration validation passed.
```

## Build output
```text

> build
> npm run validate && node scripts/build-static.mjs


> validate
> node scripts/validate-production.mjs && node scripts/validate-deployment.mjs

Earn Chat structural production validation passed.
Checked 33 required files and 18 JavaScript modules across configuration, customer runtime, Admin, chat, task restart, withdrawals, KYC, security, routing and copy-only deployment.
Earn Chat deployment configuration validation passed.
file:///home/runner/work/Earn-test/Earn-test/scripts/build-static.mjs:25
  if(!sourceApp.includes(token))throw new Error(`Application source is missing required contract: ${token}`);
                                      ^

Error: Application source is missing required contract: CHAT_SECONDS=45
    at file:///home/runner/work/Earn-test/Earn-test/scripts/build-static.mjs:25:39
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)

Node.js v22.23.1
```
