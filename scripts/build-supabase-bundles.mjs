import fs from'node:fs';

const applyFiles=[
 'supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql',
 'supabase/earnchat_level_chat_upgrade_20260731.sql',
 'supabase/earnchat_configuration_control_upgrade_20260801.sql',
 'supabase/earnchat_dynamic_chat_contract_20260801.sql',
 'supabase/earnchat_task_restart_contract_20260801.sql',
 'supabase/earnchat_dynamic_operations_contract_20260801.sql'
];
const verifyFiles=[
 'supabase/earnchat_configuration_control_verify_20260801.sql',
 'supabase/earnchat_production_verify.sql'
];

const banner=(title,files)=>`-- ${title}\n-- Generated from authoritative repository SQL files.\n-- Back up the Supabase database before running.\n-- Do not edit this bundle directly; edit the source migrations and regenerate.\n-- Included files, in order:\n${files.map((file,index)=>`-- ${index+1}. ${file}`).join('\n')}\n\n`;
const combine=(title,files)=>banner(title,files)+files.map((file,index)=>{
 const source=fs.readFileSync(file,'utf8').trim();
 return `-- ============================================================================\n-- BEGIN ${index+1}: ${file}\n-- ============================================================================\n${source}\n-- ============================================================================\n-- END ${index+1}: ${file}\n-- ============================================================================`;
}).join('\n\n')+'\n';

fs.writeFileSync('supabase/EARNCHAT_RUN_1_APPLY_ALL_20260801.sql',combine('Earn Chat production upgrade bundle — RUN FIRST',applyFiles));
fs.writeFileSync('supabase/EARNCHAT_RUN_2_VERIFY_ALL_20260801.sql',combine('Earn Chat production verification bundle — RUN SECOND',verifyFiles));
