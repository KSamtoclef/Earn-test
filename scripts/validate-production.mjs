import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd(),fail=[];
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]):[];
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const RELEASE='20260731-production-certification-r1';
const requiredFiles=[
 'index.html','assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css','assets/js/app-config.js','assets/js/supabase-client.js',
 'assets/js/api.js','assets/js/router.js','assets/js/app.js','assets/js/admin/admin.js','assets/js/admin/core.js',
 'assets/js/features/qualification.js','assets/js/features/feedback.js','assets/js/features/analytics.js','assets/js/features/task-status.js',
 'supabase/earnchat_production_install.sql','supabase/earnchat_production_verify.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/PRODUCTION_RUN_ORDER.md'
];
for(const file of requiredFiles)if(!fs.existsSync(path.join(root,file)))fail.push(`Missing required file: ${file}`);

const runtimeFiles=walk(path.join(root,'assets','js')).filter(x=>/\.(?:js|mjs)$/.test(x));
for(const absolute of runtimeFiles){
 const file=relative(absolute),text=fs.readFileSync(absolute,'utf8');
 try{execFileSync(process.execPath,['--check',absolute],{stdio:'pipe'})}catch(error){fail.push(`JavaScript syntax failed: ${file}\n${error.stderr?.toString()||error.message}`)}
 const imports=[...text.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)];
 for(const match of imports){const resolved=path.resolve(path.dirname(absolute),match[1].split('?')[0]);if(!fs.existsSync(resolved))fail.push(`Missing import from ${file}: ${match[1]}`)}
}

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const selectors=runtimeFiles.flatMap(absolute=>{const text=fs.readFileSync(absolute,'utf8');return[...text.matchAll(/(?:querySelector|querySelectorAll|\$|q)\(\s*['"]#([A-Za-z0-9_-]+)['"]/g)].map(m=>[relative(absolute),m[1]])});
const dynamicIds=new Set(['kyc-provider-modal','kyc-provider-close','kyc-provider-content','kyc-provider-message','task-proof-field','task-proof-value','example-label','admin-mobile-section','admin-pagination','task-preview']);
for(const[file,id]of selectors)if(!html.includes(`id="${id}"`)&&!dynamicIds.has(id))fail.push(`${file} references missing HTML id: ${id}`);
const ids=[...html.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map(m=>m[1]);
for(const id of new Set(ids))if(ids.filter(x=>x===id).length>1)fail.push(`Duplicate HTML id: ${id}`);

const forbidden=['daily-share','pg-share','pg-claim','earn_per_share','share_reward','₦3,750','₦70,000','demoSignupFallback','earnchat-demo-users','request_withdrawal','withdrawal_requests','sponsored-visits-upgrade','linked-task-marketplace','auth-session-fix','Reply & Earn up to','window.EARNCHAT_BUSINESS','window.S||','value="screenshot"','prompt(\'Enter your KYC/provider reference'];
for(const absolute of [path.join(root,'index.html'),...runtimeFiles]){const file=relative(absolute),text=fs.readFileSync(absolute,'utf8');for(const term of forbidden)if(text.includes(term))fail.push(`Forbidden legacy or unsupported term in ${file}: ${term}`)}

const forbiddenRuntimeNames=['sponsored-visits-upgrade.js','linked-task-marketplace.js','auth-session-fix.js','earnchat-business-config.js','app-consistency-controller.js','earnchat-app-flow.js','earnchat-legacy-flow-bridge.js','earnchat-wallet-upgrade.js','enhancements.js','kyc-bulk-upgrade.js'];
for(const name of forbiddenRuntimeNames)if(runtimeFiles.some(f=>path.basename(f)===name))fail.push(`Obsolete runtime file still exists: ${name}`);

const loader=fs.readFileSync(path.join(root,'assets/js/supabase-client.js'),'utf8');
for(const token of ['./assets/js/features/task-status.js','./assets/js/features/qualification.js'])if(!loader.includes(token))fail.push(`Feature module is not loaded: ${token}`);
if(!loader.includes(`RELEASE_VERSION='${RELEASE}'`))fail.push('Certification release identifier missing from feature loader.');
if(/kyc-bulk-upgrade|admin\/enhancements/.test(loader))fail.push('Obsolete KYC or Admin override module is still loaded.');

const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
for(const token of ['openKycFlow','restoreOpenTask','restoreOpenChatBanner','openTaskClaim','openChatAttempt','cancelChatAttempt','EXAMPLE DASHBOARD'])if(!app.includes(token))fail.push(`Customer core missing: ${token}`);
if(app.includes('async function submitKyc(){const reference=prompt'))fail.push('Prompt-based KYC remains in customer core.');
if(!app.includes(`const RELEASE='${RELEASE}'`))fail.push('Customer controller release identifier is inconsistent.');

const entry=fs.readFileSync(path.join(root,'assets/js/admin/admin.js'),'utf8');
if(!entry.includes("export{renderAdmin}from'./core.js'"))fail.push('Admin entry is not routed through the authoritative core.');
const admin=fs.readFileSync(path.join(root,'assets/js/admin/core.js'),'utf8');
for(const token of ['KYC SETTINGS','Live preview','admin_bulk_review_task_claims','admin_bulk_review_earnchat_kyc','Nigeria work liability','Kenya work liability','task-preview-country','tf-test-url'])if(!admin.includes(token))fail.push(`Admin core missing: ${token}`);
if(admin.includes('value="screenshot"'))fail.push('Admin core still exposes unsupported screenshot proof.');
if(/Work liability['"].*₦|Referral liability['"].*₦/.test(admin))fail.push('Admin core still exposes mixed-currency liability totals.');

for(const match of html.matchAll(/[?&]v=([^"']+)/g))if(match[1]!==RELEASE)fail.push(`index.html uses mixed asset version: ${match[1]}`);

const install=fs.readFileSync(path.join(root,'supabase','earnchat_production_install.sql'),'utf8');
const verify=fs.readFileSync(path.join(root,'supabase','earnchat_production_verify.sql'),'utf8');
const upgrade=fs.readFileSync(path.join(root,'supabase','earnchat_kyc_bulk_admin_upgrade_20260730.sql'),'utf8');
const requiredInstallTokens=['alter table public.profiles add column if not exists referral_code','insert into public.earnchat_level_settings(level_name,rank','earnchat_chat_attempts','start_earnchat_chat','complete_earnchat_chat(p_attempt uuid','start_earnchat_task','submit_earnchat_task','request_earnchat_withdrawal','admin_review_task_claim','admin_review_earnchat_withdrawal','admin_review_earnchat_referral','earnchat_qualification_missions','earnchat_analytics_events','revoke all on function public.mark_earnchat_active_day'];
const requiredVerifyTokens=['required_tables','required_functions','duplicate_started_chat_attempts','duplicate_open_task_claims','pending_task_balance_mismatch','pending_referral_balance_mismatch','wallet_mismatches','invalid_kyc_urls','invalid_withdrawal_payouts'];
const requiredUpgradeTokens=['get_earnchat_kyc_config','admin_update_earnchat_kyc_config','admin_bulk_review_earnchat_kyc','admin_bulk_review_task_claims','admin_bulk_update_user_control','get_my_open_task_claim','get_my_open_chat_attempt','cancel_earnchat_chat_attempt','cancel_earnchat_task_claim','earnchat_one_started_task_per_user','failures','2026-07-31-production-certification-r1'];
for(const token of requiredInstallTokens)if(!install.includes(token))fail.push(`Installer missing: ${token}`);
for(const token of requiredVerifyTokens)if(!verify.includes(token))fail.push(`Verification SQL missing: ${token}`);
for(const token of requiredUpgradeTokens)if(!upgrade.includes(token))fail.push(`Consolidated upgrade SQL missing: ${token}`);

if(fs.existsSync(path.join(root,'supabase','earnchat_production_certification_upgrade_20260731.sql')))fail.push('Duplicate certification migration still exists; use the consolidated KYC/recovery upgrade only.');

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat production validation passed.');
console.log(`Checked ${requiredFiles.length} required files, ${runtimeFiles.length} runtime modules, core customer/Admin ownership, selectors, release versions, legacy removal and the consolidated recovery SQL contract.`);
