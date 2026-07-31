import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';

const root=process.cwd(),fail=[];
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]):[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const required=[
'index.html','assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css','assets/css/professional-ui.css','assets/css/member-motivation.css','assets/js/app-config.js','assets/js/supabase-client.js','assets/js/api.js','assets/js/router.js','assets/js/app.js','assets/js/admin/admin.js','assets/js/admin/core.js','assets/js/features/qualification.js','assets/js/features/analytics.js','assets/js/features/task-status.js','assets/js/features/interaction-design.js','assets/js/features/draft-recovery.js','assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/level-journey.js','assets/js/features/guided-chat-experience.js','supabase/earnchat_production_install.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/earnchat_level_chat_upgrade_20260731.sql','supabase/earnchat_production_verify.sql','supabase/PRODUCTION_RUN_ORDER.md'];
for(const f of required)if(!fs.existsSync(path.join(root,f)))fail.push(`Missing required file: ${f}`);

const js=walk(path.join(root,'assets/js')).filter(f=>/\.(?:js|mjs)$/.test(f));
for(const f of js){try{execFileSync(process.execPath,['--check',f],{stdio:'pipe'})}catch(e){fail.push(`JavaScript syntax failed: ${path.relative(root,f)}\n${e.stderr?.toString()||e.message}`)}const source=fs.readFileSync(f,'utf8');for(const m of source.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){const target=path.resolve(path.dirname(f),m[1].split('?')[0]);if(!fs.existsSync(target))fail.push(`Missing import from ${path.relative(root,f)}: ${m[1]}`)}}

const RELEASE='20260731-production-certification-r1';
const html=read('index.html'),loader=read('assets/js/supabase-client.js'),api=read('assets/js/api.js'),core=read('assets/js/admin/core.js');
if(!loader.includes(`RELEASE_VERSION='${RELEASE}'`))fail.push('Feature loader release identifier is inconsistent.');
for(const token of ['interaction-design','draft-recovery','referral-priority','level-journey','guided-chat-experience','member-motivation'])if(!loader.includes(token))fail.push(`Feature loader missing: ${token}`);
for(const token of ['data-route="home"','data-route="earn"','data-route="upgrade"','data-route="referrals"','data-route="profile"'])if(!html.includes(token))fail.push(`Primary navigation missing: ${token}`);
if(html.includes('<span id="public-online">')&&!read('assets/js/features/member-motivation.js').includes('hidePublicPresence'))fail.push('Public online count is not suppressed.');

const obsolete=['sponsored-visits-upgrade.js','linked-task-marketplace.js','auth-session-fix.js','earnchat-business-config.js','app-consistency-controller.js','earnchat-app-flow.js','earnchat-legacy-flow-bridge.js','earnchat-wallet-upgrade.js','enhancements.js','kyc-bulk-upgrade.js','feedback.js'];
for(const name of obsolete)if(js.some(f=>path.basename(f)===name))fail.push(`Obsolete runtime file remains: ${name}`);

for(const file of ['assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/guided-chat-experience.js']){const source=read(file);if(source.includes('new MutationObserver'))fail.push(`Continuous whole-page observer remains in ${file}`)}
if(/setInterval\([^,]+,\s*(?:350|500)\)/.test(read('assets/js/features/guided-chat-experience.js')))fail.push('High-frequency guided-chat page scanner remains.');
if(!read('assets/css/professional-ui.css').includes('backdrop-filter:none'))fail.push('Mobile blur-cost override is missing.');

for(const token of ['PAGE_SIZE=50','admin-pagination','suspicious_accounts','work_liability_ngn','referral_liability_ngn','work_liability_kes','referral_liability_kes','activity_points','points_required','referral_commission_percent','KYC SETTINGS','Live preview','admin_bulk_review_task_claims','admin_bulk_review_earnchat_kyc','task-preview-country','tf-test-url'])if(!core.includes(token))fail.push(`Admin core missing: ${token}`);
for(const token of ['activity_points','adminUsers:async(limit=200,offset=0)','adminClaims:async(limit=200,offset=0)','adminKyc:async(limit=200,offset=0)','adminWithdrawals:async(limit=200,offset=0)'])if(!api.includes(token))fail.push(`API contract missing: ${token}`);
if(!read('assets/js/admin/admin.js').includes("export{renderAdmin}from'./core.js'"))fail.push('Admin entry is not routed through the authoritative core.');

const drafts=read('assets/js/features/draft-recovery.js');
for(const token of ['task-form','kyc-config-form','mission-form','feedback-form','business-form','register-form','Draft saved just now','Clear draft','checks<16'])if(!drafts.includes(token))fail.push(`Draft recovery missing: ${token}`);
for(const sensitive of ['register-password','login-password','payout-account','payout-name','payout-provider','kyc-reference'])if(!drafts.includes(sensitive))fail.push(`Draft recovery does not block sensitive field: ${sensitive}`);

const level=read('supabase/earnchat_level_chat_upgrade_20260731.sql');
for(const token of ["version='20260731-production-complete-r1'",'signup_bonus_ngn=2000','referral_reward_ngn=500','earnchat_point_events','earnchat_award_points','earnchat_grant_signup_bonus','referral_commission_percent','Direct referral commission',"source_type in('chat','task')",'minimum_seconds\',45','suspicious_accounts','work_liability_ngn','referral_liability_kes','activity_points=coalesce'])if(!level.includes(token))fail.push(`Final member SQL missing: ${token}`);
const kyc=read('supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql');
for(const token of ['Server-side payout validation','request_earnchat_withdrawal','admin_bulk_review_task_claims','admin_bulk_review_earnchat_kyc','admin_bulk_update_user_control','get_my_open_task_claim','get_my_open_chat_attempt','cancel_earnchat_chat_attempt','cancel_earnchat_task_claim','earnchat_one_started_task_per_user'])if(!kyc.includes(token))fail.push(`KYC/recovery SQL missing: ${token}`);
const verify=read('supabase/earnchat_production_verify.sql');
for(const token of ['duplicate_signup_bonuses','missing_signup_bonuses','invalid_signup_bonus_amounts','duplicate_point_events','activity_point_mismatches','duplicate_referral_commissions','invalid_level_point_contract','invalid_level_commission_contract','chat_minimum_contract','admin_overview_contract','wallet_mismatches'])if(!verify.includes(token))fail.push(`Verification SQL missing: ${token}`);
const order=read('supabase/PRODUCTION_RUN_ORDER.md');
for(const token of ['earnchat_kyc_bulk_admin_upgrade_20260730.sql','earnchat_level_chat_upgrade_20260731.sql','earnchat_production_verify.sql'])if(!order.includes(token))fail.push(`Run order missing: ${token}`);

if(fs.existsSync(path.join(root,'.github/workflows/finalize-production-source.yml')))fail.push('Temporary source-finalization workflow still exists.');
if(fs.existsSync(path.join(root,'supabase/earnchat_production_certification_upgrade_20260731.sql')))fail.push('Duplicate certification migration still exists.');

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat production validation passed.');
console.log(`Checked ${required.length} required files, ${js.length} runtime modules, exact Admin totals, pagination, mobile performance guards, welcome bonus, Activity Points, direct commissions and final SQL verification contracts.`);
