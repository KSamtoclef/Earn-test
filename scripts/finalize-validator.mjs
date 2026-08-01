import fs from'node:fs';
const path='scripts/validate-production.mjs';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing validator target: ${label}`);source=source.replace(from,to)};
replace(
"'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_configuration_control_verify_20260801.sql','supabase/earnchat_production_verify.sql'",
"'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_dynamic_chat_contract_20260801.sql','supabase/earnchat_task_restart_contract_20260801.sql','supabase/earnchat_configuration_control_verify_20260801.sql','supabase/earnchat_production_verify.sql'",
'required SQL contracts'
);
replace(
"migration=read('supabase/earnchat_configuration_control_upgrade_20260801.sql'),verify=read('supabase/earnchat_configuration_control_verify_20260801.sql');",
"migration=read('supabase/earnchat_configuration_control_upgrade_20260801.sql'),dynamicChat=read('supabase/earnchat_dynamic_chat_contract_20260801.sql'),taskRestart=read('supabase/earnchat_task_restart_contract_20260801.sql'),verify=read('supabase/earnchat_configuration_control_verify_20260801.sql');",
'SQL source reads'
);
replace(
"'earnchat:config-updated','api.refreshBusiness','getPublicOrigin(app.config)'",
"'earnchat:config-updated','getPublicOrigin(app.config)','landingConfig()','taskConfig()','referralConfig()','withdrawalConfig()','kycConfig()'",
'customer configuration tokens'
);
const insertion="\nfor(const token of ['cancelTask','cancel_earnchat_task_claim'])if(!api.includes(token))fail.push(`Task restart API contract missing: ${token}`);\nfor(const token of ['earnchat_chat_contract','required_replies','minimum_reply_length','attempt_expiry_minutes','earnchat_reconcile_points','complete_earnchat_chat'])if(!dynamicChat.includes(token))fail.push(`Dynamic chat SQL contract missing: ${token}`);\nfor(const token of ['cancel_earnchat_task_claim','status=\'expired\'','Restarted by member','grant execute'])if(!taskRestart.includes(token))fail.push(`Task restart SQL contract missing: ${token}`);\nfor(const token of ['registration_enabled','social_proof_enabled','restart_required_message','pending_review_message','maintenance_message'])if(!app.includes(token))fail.push(`Final customer configuration coverage missing: ${token}`);\n";
const marker="for(const token of ['configuration_version','general_config jsonb'";
if(!source.includes(marker))throw new Error('Missing SQL validation insertion marker');
source=source.replace(marker,insertion+marker);
fs.writeFileSync(path,source);

