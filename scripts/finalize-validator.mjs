import fs from'node:fs';

const path='scripts/validate-production.mjs';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing validator target: ${label}`);source=source.replace(from,to)};

replace(
"'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_configuration_control_verify_20260801.sql','supabase/earnchat_production_verify.sql'",
"'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_dynamic_chat_contract_20260801.sql','supabase/earnchat_task_restart_contract_20260801.sql','supabase/earnchat_dynamic_operations_contract_20260801.sql','supabase/earnchat_configuration_control_verify_20260801.sql','supabase/earnchat_production_verify.sql'",
'required dynamic SQL files'
);
replace(
"migration=read('supabase/earnchat_configuration_control_upgrade_20260801.sql'),verify=read('supabase/earnchat_configuration_control_verify_20260801.sql');",
"migration=read('supabase/earnchat_configuration_control_upgrade_20260801.sql'),chatContract=read('supabase/earnchat_dynamic_chat_contract_20260801.sql'),taskRestart=read('supabase/earnchat_task_restart_contract_20260801.sql'),operationsContract=read('supabase/earnchat_dynamic_operations_contract_20260801.sql'),verify=read('supabase/earnchat_configuration_control_verify_20260801.sql');",
'dynamic SQL sources'
);
replace(
"for(const token of ['restart-required','pending-review','approved','rejected','earnchat:task-started','earnchat:task-submitted','earnchat:route-view'])if(!taskStatus.includes(token))fail.push(`Task lifecycle contract missing: ${token}`);",
"for(const token of ['restart-required','pending-review','approved','rejected','earnchat:task-started','earnchat:task-submitted','earnchat:route-view'])if(!taskStatus.includes(token))fail.push(`Task lifecycle contract missing: ${token}`);\nfor(const token of ['cancelTask','cancel_earnchat_task_claim','Activity not completed','Restart task','taskConfig().restart_required_message','featureFlags().tasks','featureFlags().sponsored_visits'])if(!(api+app).includes(token))fail.push(`Final task restart/configuration contract missing: ${token}`);\nfor(const stale of ['Continue task</button>','resume-task'])if(app.includes(stale))fail.push(`Obsolete task resume behavior remains: ${stale}`);",
'final task runtime checks'
);
replace(
"for(const token of ['duplicate_level_rank','invalid_level_amounts','invalid_level_order','unknown_feature_flags','invalid_chat_contract','duplicate_open_task_claims','duplicate_task_credits','duplicate_chat_credits','normalized_public_configuration'])if(!verify.includes(token))fail.push(`Configuration verification missing: ${token}`);",
"for(const token of ['duplicate_level_rank','invalid_level_amounts','invalid_level_order','unknown_feature_flags','invalid_chat_contract','duplicate_open_task_claims','duplicate_task_credits','duplicate_chat_credits','normalized_public_configuration'])if(!verify.includes(token))fail.push(`Configuration verification missing: ${token}`);\nfor(const token of ['earnchat_chat_contract','required_replies','minimum_reply_length','minimum_seconds','attempt_expiry_minutes','activity_points','earnchat_reconcile_points'])if(!chatContract.includes(token))fail.push(`Dynamic chat SQL contract missing: ${token}`);\nfor(const token of ['cancel_earnchat_task_claim','status=\'expired\'','Restarted by member','grant execute'])if(!taskRestart.includes(token))fail.push(`Task restart SQL contract missing: ${token}`);\nfor(const token of ['withdrawal_config','maximum_open_requests','bank_transfer_enabled','mpesa_enabled','kyc_config','reference_required','request_earnchat_withdrawal','submit_earnchat_kyc'])if(!operationsContract.includes(token))fail.push(`Dynamic operations SQL contract missing: ${token}`);\nif(operationsContract.includes('create or replace function public.cancel_earnchat_task_claim'))fail.push('Task cancellation is duplicated in the operations migration.');",
'dynamic SQL validation'
);
replace(
"'scripts/install-customer-configuration.mjs'];",
"'scripts/install-customer-configuration.mjs','.github/workflows/finalize-runtime-configuration.yml','scripts/finalize-customer-config.mjs','scripts/finalize-api-config.mjs','scripts/finalize-validator.mjs','.github/workflows/finalize-validator.yml'];",
'final temporary files'
);

fs.writeFileSync(path,source);
