import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';

const root=process.cwd(),fail=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]):[];
const required=['index.html','assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css','assets/css/member-motivation.css','assets/css/referral-priority.css','assets/css/level-chat-experience.css','assets/js/app-config.js','assets/js/supabase-client.js','assets/js/api.js','assets/js/router.js','assets/js/app.js','assets/js/admin/admin.js','assets/js/admin/core.js','assets/js/features/draft-recovery.js','assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/level-journey.js','assets/js/features/guided-chat-experience.js','supabase/earnchat_production_install.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/earnchat_level_chat_upgrade_20260731.sql','supabase/earnchat_production_verify.sql','supabase/PRODUCTION_RUN_ORDER.md'];
for(const file of required)if(!fs.existsSync(path.join(root,file)))fail.push(`Missing required file: ${file}`);
const js=walk(path.join(root,'assets/js')).filter(file=>/\.(?:js|mjs)$/.test(file));
for(const file of js){
 try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'})}
 catch(error){fail.push(`JavaScript syntax failed: ${path.relative(root,file)}\n${error.stderr?.toString()||error.message}`)}
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(file),match[1].split('?')[0]);
  if(!fs.existsSync(target))fail.push(`Missing import from ${path.relative(root,file)}: ${match[1]}`);
 }
}

const config=read('assets/js/app-config.js'),loader=read('assets/js/supabase-client.js'),api=read('assets/js/api.js'),journey=read('assets/js/features/level-journey.js'),chat=read('assets/js/features/guided-chat-experience.js'),motivation=read('assets/js/features/member-motivation.js'),levelCss=read('assets/css/level-chat-experience.css'),memberCss=read('assets/css/member-motivation.css'),core=read('assets/js/admin/core.js'),adminEntry=read('assets/js/admin/admin.js'),html=read('index.html');
if(!config.includes("'upgrade'"))fail.push('ROUTES does not contain upgrade.');
if(!loader.includes("RELEASE_VERSION='20260731-launch-lite-r3'"))fail.push('Current lightweight release identifier is missing.');
for(const token of ['loadedStyles=new Map','loadedFeatures=new Map','CUSTOMER_ROUTES','requestIdleCallback','levelFeature(false)'])if(!loader.includes(token))fail.push(`Route-driven loader missing: ${token}`);
for(const pathToken of ["loadFeature('./features/level-journey.js'","loadFeature('./features/guided-chat-experience.js'","loadFeature('./features/member-motivation.js'","loadFeature('./features/referral-priority.js'"])if(!loader.includes(pathToken))fail.push(`Correct module-relative feature path missing: ${pathToken}`);
if(loader.includes("loadFeature('./assets/js/features/"))fail.push('Page-relative dynamic import path remains in the module loader.');
if(loader.includes('interaction-design.js'))fail.push('Obsolete broad interaction module is still loaded.');
if(fs.existsSync(path.join(root,'assets/js/features/interaction-design.js')))fail.push('Obsolete broad interaction module still exists.');
if(loader.includes('await Promise.all(['))fail.push('Startup still blocks on all customer assets.');

for(const token of ['MEMBER_CACHE_MS=10000','memberPromise','earnchat:member-state','invalidateMemberState','ADMIN_CACHE_MS=12000','adminOverviewPromise','adminClaims:async(limit=50','adminUsers:async(limit=50','adminWithdrawals:async(limit=50'])if(!api.includes(token))fail.push(`Shared API/cache contract missing: ${token}`);
for(const token of ["section.id='view-upgrade'",'next-benefits','Do these next','upgrade-disclosure','Compare all levels','How Activity Points work','earn-activity-hub','Guided chats','Sponsored visits','Referrals','data-earn-action="chats"','primaryAction'])if(!journey.includes(token))fail.push(`Compact Upgrade/Earn journey missing: ${token}`);
for(const level of ['Starter','Active','Pro','Elite'])if(!journey.includes(`'${level}'`))fail.push(`Upgrade journey missing ${level}.`);
if((journey.match(/<details/g)||[]).length<3)fail.push('Upgrade details are not collapsed into three disclosure sections.');
if(journey.includes('pageshow')||journey.includes('visibilitychange'))fail.push('Upgrade still forces background/visibility refreshes.');
if(motivation.includes('member-welcome-card'))fail.push('Duplicate Home motivation renderer remains.');

for(const token of ['REQUIRED_SECONDS=45','/ 00:45','minimum_seconds:REQUIRED_SECONDS','stopImmediatePropagation','completionPanel','Choose your next activity','data-go="tasks"','data-go="visits"','data-go="referrals"','data-go="home"','chat-complete-live','ensureCompletionButton','timerObserver.observe(timer'])if(!chat.includes(token))fail.push(`Final clickable 45-second chat flow missing: ${token}`);
if(/setInterval\([^,]+,\s*(?:350|500)\)/.test(chat))fail.push('High-frequency chat scanner remains.');
for(const file of ['assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/level-journey.js'])if(read(file).includes('new MutationObserver'))fail.push(`Continuous observer remains in ${file}`);
if(chat.includes('new MutationObserver')&&!chat.includes('timerObserver.observe(timer'))fail.push('Chat observer is not scoped to the timer element.');

for(const token of ['content-visibility:auto','upgrade-disclosure','benefit-chips','earn-option-grid','chat-next-grid','backdrop-filter:none!important','safe-area-inset-bottom','prefers-reduced-motion'])if(!levelCss.includes(token))fail.push(`Lightweight UI CSS missing: ${token}`);
if(memberCss.includes('member-welcome-card')||memberCss.includes('linear-gradient')||!memberCss.includes('box-shadow:none'))fail.push('Motivation CSS still contains duplicate or expensive Home styling.');

for(const token of ['20260731-launch-lite-r2','About 45 seconds','00:00 / 00:45','data-route="upgrade"','data-route="referrals"'])if(!html.includes(token))fail.push(`Correct first-paint contract missing: ${token}`);
for(const stale of ['About 2 minutes','00:00 / 02:00','timer reaches two minutes'])if(html.includes(stale))fail.push(`Stale first-paint wording remains: ${stale}`);

const routeMatch=config.match(/ROUTES=\[([^\]]+)\]/),routes=new Set((routeMatch?.[1]||'').match(/'([^']+)'/g)?.map(value=>value.slice(1,-1))||[]),sources=[html,...js.map(file=>fs.readFileSync(file,'utf8'))].join('\n');
const isStaticRoute=value=>value&&!value.includes('$')&&!value.includes('{')&&!value.includes('}')&&!value.includes('`');
for(const match of sources.matchAll(/data-go=["']([^"']+)["']/g))if(isStaticRoute(match[1])&&!routes.has(match[1]))fail.push(`Invalid data-go route: ${match[1]}`);
for(const match of sources.matchAll(/data-route=["']([^"']+)["']/g))if(isStaticRoute(match[1])&&!routes.has(match[1]))fail.push(`Invalid data-route route: ${match[1]}`);
if(html.includes('id="public-online"'))fail.push('Public online counter remains in first-paint HTML.');

for(const token of ['PAGE_SIZE=50','admin-pagination','suspicious_accounts','work_liability_ngn','referral_liability_kes','activity_points','points_required','referral_commission_percent'])if(!core.includes(token))fail.push(`Admin core missing: ${token}`);
const hasAdminImport=/import\s*\{\s*renderAdmin\s*\}\s*from\s*['"]\.\/core\.js['"]/.test(adminEntry);
const hasAdminExport=/export\s*\{\s*renderAdmin\s*\}/.test(adminEntry);
if(!hasAdminImport||!hasAdminExport)fail.push('Admin entry is not authoritative.');

const levelSql=read('supabase/earnchat_level_chat_upgrade_20260731.sql');
for(const token of ["version='20260731-production-complete-r1'",'signup_bonus_ngn=2000','referral_reward_ngn=500','earnchat_point_events','referral_commission_percent','minimum_seconds\',45'])if(!levelSql.includes(token))fail.push(`Final member SQL missing: ${token}`);
const verify=read('supabase/earnchat_production_verify.sql');
for(const token of ['duplicate_signup_bonuses','duplicate_point_events','activity_point_mismatches','duplicate_referral_commissions','chat_minimum_contract','admin_overview_contract','wallet_mismatches'])if(!verify.includes(token))fail.push(`Verification SQL missing: ${token}`);
for(const file of ['.github/workflows/final-authoritative-cleanup.yml','.github/workflows/finalize-production-source.yml','supabase/earnchat_production_certification_upgrade_20260731.sql'])if(fs.existsSync(path.join(root,file)))fail.push(`Obsolete file remains: ${file}`);

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat final launch validation passed.');
console.log(`Checked ${required.length} required files, ${js.length} runtime modules, shared state, corrected dynamic imports, compact Upgrade, multi-option Earn, clickable 45-second chat completion, Admin pagination and database contracts.`);
