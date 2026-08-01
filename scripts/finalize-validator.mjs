import fs from'node:fs';

const path='scripts/validate-production.mjs';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing validator target: ${label}`);source=source.replace(from,to)};

replace(
"'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_dynamic_chat_contract_20260801.sql','supabase/earnchat_dynamic_operations_contract_20260801.sql',",
"'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_dynamic_chat_contract_20260801.sql','supabase/earnchat_task_restart_contract_20260801.sql','supabase/earnchat_dynamic_operations_contract_20260801.sql',",
'required task restart SQL'
);
replace(
"const operationsSql=read('supabase/earnchat_dynamic_operations_contract_20260801.sql');",
"const taskRestartSql=read('supabase/earnchat_task_restart_contract_20260801.sql');\nconst operationsSql=read('supabase/earnchat_dynamic_operations_contract_20260801.sql');",
'task restart SQL read'
);
replace(
"for(const token of ['restart-required','pending-review','approved','rejected','earnchat:task-started','earnchat:task-submitted','earnchat:route-view'])requireToken(taskStatus,token,'Task lifecycle contract missing');",
"for(const token of ['restart-required','pending-review','approved','rejected','earnchat:task-started','earnchat:task-submitted','earnchat:route-view'])requireToken(taskStatus,token,'Task lifecycle contract missing');\nfor(const token of ['cancelTask','cancel_earnchat_task_claim'])requireToken(api,token,'Task restart API contract missing');\nfor(const token of ['Activity not completed','Restart task','taskConfig().restart_required_message','featureFlags().tasks','featureFlags().sponsored_visits'])requireToken(app,token,'Task restart/customer configuration missing');\nfor(const token of ['Continue task</button>','resume-task'])forbidToken(app,token,'Obsolete task resume behavior remains');",
'task runtime ownership checks'
);
replace(
"for(const token of ['cancel_earnchat_task_claim',\"status='cancelled'\",'Restarted by member','request_earnchat_withdrawal','maximum_open_requests','bank_transfer_enabled','mpesa_enabled','submit_earnchat_kyc','reference_required','grant execute'])requireToken(operationsSql,token,'Dynamic operations SQL contract missing');",
"for(const token of ['cancel_earnchat_task_claim',\"status='expired'\",'Restarted by member','grant execute'])requireToken(taskRestartSql,token,'Task restart SQL contract missing');\nfor(const token of ['request_earnchat_withdrawal','withdrawal_config','maximum_open_requests','bank_transfer_enabled','mpesa_enabled','submit_earnchat_kyc','kyc_config','reference_required','grant execute'])requireToken(operationsSql,token,'Dynamic operations SQL contract missing');\nforbidToken(operationsSql,'create or replace function public.cancel_earnchat_task_claim','Task cancellation is duplicated in operations SQL');",
'split dynamic SQL ownership'
);
replace(
"for(const token of ['earnchat_configuration_control_upgrade_20260801.sql','earnchat_dynamic_chat_contract_20260801.sql','earnchat_dynamic_operations_contract_20260801.sql','earnchat_configuration_control_verify_20260801.sql'])requireToken(runOrder,token,'Production SQL run order missing');",
"for(const token of ['earnchat_configuration_control_upgrade_20260801.sql','earnchat_dynamic_chat_contract_20260801.sql','earnchat_task_restart_contract_20260801.sql','earnchat_dynamic_operations_contract_20260801.sql','earnchat_configuration_control_verify_20260801.sql'])requireToken(runOrder,token,'Production SQL run order missing');",
'run order validation'
);
replace(
"if(failures.length){console.error(`Production validation failed with ${failures.length} issue(s):\\n- ${failures.join('\\n- ')}`);process.exit(1)}",
"const temporary=['.github/workflows/finalize-runtime-configuration.yml','scripts/finalize-customer-config.mjs','scripts/finalize-api-config.mjs'];\nfor(const name of temporary)if(exists(name))failures.push(`Temporary migration file remains: ${name}`);\n\nif(failures.length){console.error(`Production validation failed with ${failures.length} issue(s):\\n- ${failures.join('\\n- ')}`);process.exit(1)}",
'temporary migration rejection'
);

fs.writeFileSync(path,source);
