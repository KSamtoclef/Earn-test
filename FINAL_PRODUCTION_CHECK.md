# Earn Chat final production check

Commit: 2ebb14362e1d7a1f942d5cccec292847c344398c
Validation exit: 1
Build exit: 1

## Validation output
```text

> validate
> node scripts/validate-production.mjs && node scripts/validate-deployment.mjs

node:fs:440
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^

Error: ENOENT: no such file or directory, open '/home/runner/work/Earn-test/Earn-test/supabase/earnchat_task_restart_contract_20260801.sql'
    at Object.readFileSync (node:fs:440:20)
    at read (file:///home/runner/work/Earn-test/Earn-test/scripts/validate-production.mjs:9:21)
    at file:///home/runner/work/Earn-test/Earn-test/scripts/validate-production.mjs:55:22
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/home/runner/work/Earn-test/Earn-test/supabase/earnchat_task_restart_contract_20260801.sql'
}

Node.js v22.23.1
```

## Build output
```text

> build
> npm run validate && node scripts/build-static.mjs


> validate
> node scripts/validate-production.mjs && node scripts/validate-deployment.mjs

node:fs:440
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^

Error: ENOENT: no such file or directory, open '/home/runner/work/Earn-test/Earn-test/supabase/earnchat_task_restart_contract_20260801.sql'
    at Object.readFileSync (node:fs:440:20)
    at read (file:///home/runner/work/Earn-test/Earn-test/scripts/validate-production.mjs:9:21)
    at file:///home/runner/work/Earn-test/Earn-test/scripts/validate-production.mjs:55:22
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/home/runner/work/Earn-test/Earn-test/supabase/earnchat_task_restart_contract_20260801.sql'
}

Node.js v22.23.1
```
