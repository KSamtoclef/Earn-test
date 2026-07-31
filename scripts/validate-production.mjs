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
 try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'})}catch(error){fail.push(`JavaScript syntax failed: ${path.relative(root,file)}\n${error.stderr?.toString()||error.message}`)}
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(file),match[1].split('?')[0]);
  if(!fs.existsSync(target))fail.push(`Missing import from ${path.relative(root,file)}: ${match[1]}`);
 }
}

const config=read('assets/js/app-config.js'),loader=read('assets/js/supabase-client.js'),journey=read('assets/js/features/level-journey.js'),chat=read('assets/js/features/guided-chat-experience.js'),motivation=read('assets/js/features/member-motivation.js'),levelCss=read('assets/css/level-chat-experience.css'),memberCss=read('assets/css/member-motivation.css'),referralCss=read('assets/css/referral-priority.css'),api=read('assets/js/api.js'),core=read('assets/js/admin/core.js'),html=read('index.html');

if(!config.includes("'upgrade'"))fail.push('ROUTES does not contain upgrade.');
if(!loader.includes("RELEASE_VERSION='20260731-lite-runtime-r1'"))fail.push('Lightweight runtime release is missing.');
for(const token of ['loadedStyles=new Map','loadedFeatures=new Set','routeName=','loadRouteFeatures','requestIdleCallback','timeout:4000'])if(!loader.includes(token))fail.push(`Lightweight loader missing: ${token}`);
for(const token of ['level-chat-experience.css','member-motivation.css','referral-priority.css','qualification.js','task-status.js','draft-recovery.js'])if(!loader.includes(token))fail.push(`Route feature loading missing: ${token}`);
if(loader.includes('await Promise.all(['))fail.push('Startup still blocks on all customer stylesheets.');
if(/loadFeature\('\.\/assets\/js\/features\/interaction-design\.js'/.test(loader))fail.push('Broad interaction-design module still loads at runtime.');
const eagerPrefix=loader.slice(0,loader.indexOf('function loadRouteFeatures'));
for(const feature of ['level-journey.js','guided-chat-experience.js','member-motivation.js','referral-priority.js','draft-recovery.js'])if(eagerPrefix.includes(feature))fail.push(`Feature is still eagerly loaded before route selection: ${feature}`);

for(const token of ["section.id='view-upgrade'",'id="upgrade-content"','data-route="home"','data-route="earn"','data-route="upgrade"','data-route="referrals"','data-route="profile"','statePromise','upgrade-retry','route-level-strip','withdraw'])if(!journey.includes(token))fail.push(`Upgrade journey missing: ${token}`);
for(const level of ['Starter','Active','Pro','Elite'])if(!journey.includes(`'${level}'`))fail.push(`Upgrade journey missing ${level}.`);
for(const token of ['Activity Points','Account days','Active days','Approved chats','Approved tasks','Submit KYC','Open guided chats','Open tasks','Open KYC'])if(!journey.includes(token))fail.push(`Upgrade criteria missing: ${token}`);
for(const token of ['Review upgrade progress','View upgrade journey','See how to increase commission'])if(!motivation.includes(token))fail.push(`Upgrade circulation missing: ${token}`);

for(const token of ['REQUIRED_SECONDS=45','/ 00:45','minimum_seconds:REQUIRED_SECONDS','stopImmediatePropagation','document.addEventListener(\'click\',interceptCompletion,true)','setInterval(enhance,1000)'])if(!chat.includes(token))fail.push(`Authoritative 45-second chat missing: ${token}`);
if(/setInterval\([^,]+,\s*(?:350|500)\)/.test(chat))fail.push('High-frequency chat scanner remains.');
for(const file of ['assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/guided-chat-experience.js','assets/js/features/level-journey.js'])if(read(file).includes('new MutationObserver'))fail.push(`Continuous observer remains in ${file}`);

for(const token of ['background:#eef4f8','box-shadow:none','backdrop-filter:none!important','overflow-x:hidden','safe-area-inset-bottom'])if(!levelCss.includes(token))fail.push(`Lightweight Upgrade CSS missing: ${token}`);
if(!memberCss.includes('box-shadow:none')||memberCss.includes('linear-gradient'))fail.push('Motivation CSS still uses expensive effects.');
if(!referralCss.includes('box-shadow:none')||referralCss.includes('linear-gradient'))fail.push('Referral CSS still uses expensive effects.');

const routeMatch=config.match(/ROUTES=\[([^\]]+)\]/),routes=new Set((routeMatch?.[1]||'').match(/'([^']+)'/g)?.map(value=>value.slice(1,-1))||[]),sources=[html,...js.map(file=>fs.readFileSync(file,'utf8'))].join('\n');
for(const match of sources.matchAll(/data-go=["']([^"']+)["']/g))if(!routes.has(match[1]))fail.push(`Invalid data-go route: ${match[1]}`);
for(const match of sources.matchAll(/data-route=["']([^"']+)["']/g))if(!routes.has(match[1]))fail.push(`Invalid data-route route: ${match[1]}`);
if(html.includes('<span id="public-online">')&&!motivation.includes('hidePublicPresence'))fail.push('Public online count is not suppressed.');

for(const token of ['PAGE_SIZE=50','admin-pagination','suspicious_accounts','work_liability_ngn','referral_liability_kes','activity_points','points_required','referral_commission_percent'])if(!core.includes(token))fail.push(`Admin core missing: ${token}`);
for(const token of ['activity_points','adminUsers:async(limit=200,offset=0)','adminClaims:async(limit=200,offset=0)','adminKyc:async(limit=200,offset=0)','adminWithdrawals:async(limit=200,offset=0)'])if(!api.includes(token))fail.push(`API contract missing: ${token}`);
if(!read('assets/js/admin/admin.js').includes("export{renderAdmin}from'./core.js'"))fail.push('Admin entry is not authoritative.');

const levelSql=read('supabase/earnchat_level_chat_upgrade_20260731.sql');
for(const token of ["version='20260731-production-complete-r1'",'signup_bonus_ngn=2000','referral_reward_ngn=500','earnchat_point_events','referral_commission_percent','minimum_seconds\',45'])if(!levelSql.includes(token))fail.push(`Final member SQL missing: ${token}`);
const verify=read('supabase/earnchat_production_verify.sql');
for(const token of ['duplicate_signup_bonuses','duplicate_point_events','activity_point_mismatches','duplicate_referral_commissions','chat_minimum_contract','admin_overview_contract','wallet_mismatches'])if(!verify.includes(token))fail.push(`Verification SQL missing: ${token}`);

for(const file of ['.github/workflows/final-authoritative-cleanup.yml','.github/workflows/finalize-production-source.yml','supabase/earnchat_production_certification_upgrade_20260731.sql'])if(fs.existsSync(path.join(root,file)))fail.push(`Obsolete file remains: ${file}`);

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat lightweight production validation passed.');
console.log(`Checked ${required.length} required files, ${js.length} runtime modules, route-driven loading, low-paint mobile CSS, Upgrade progression, 45-second chat, valid actions, Admin accuracy and database contracts.`);
