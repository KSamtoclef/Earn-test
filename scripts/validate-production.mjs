import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';

const root=process.cwd(),fail=[];
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]):[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const required=['index.html','assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css','assets/css/professional-ui.css','assets/css/member-motivation.css','assets/css/level-chat-experience.css','assets/js/app-config.js','assets/js/supabase-client.js','assets/js/api.js','assets/js/router.js','assets/js/app.js','assets/js/admin/admin.js','assets/js/admin/core.js','assets/js/features/interaction-design.js','assets/js/features/draft-recovery.js','assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/level-journey.js','assets/js/features/guided-chat-experience.js','supabase/earnchat_production_install.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/earnchat_level_chat_upgrade_20260731.sql','supabase/earnchat_production_verify.sql','supabase/PRODUCTION_RUN_ORDER.md'];
for(const file of required)if(!fs.existsSync(path.join(root,file)))fail.push(`Missing required file: ${file}`);

const js=walk(path.join(root,'assets/js')).filter(file=>/\.(?:js|mjs)$/.test(file));
for(const file of js){try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'})}catch(error){fail.push(`JavaScript syntax failed: ${path.relative(root,file)}\n${error.stderr?.toString()||error.message}`)}const source=fs.readFileSync(file,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){const target=path.resolve(path.dirname(file),match[1].split('?')[0]);if(!fs.existsSync(target))fail.push(`Missing import from ${path.relative(root,file)}: ${match[1]}`)}}

const config=read('assets/js/app-config.js'),loader=read('assets/js/supabase-client.js'),journey=read('assets/js/features/level-journey.js'),chat=read('assets/js/features/guided-chat-experience.js'),interaction=read('assets/js/features/interaction-design.js'),motivation=read('assets/js/features/member-motivation.js'),levelCss=read('assets/css/level-chat-experience.css'),api=read('assets/js/api.js'),core=read('assets/js/admin/core.js'),html=read('index.html');
if(!config.includes("'upgrade'"))fail.push('ROUTES does not contain upgrade.');
if(!loader.includes("RELEASE_VERSION='20260731-final-runtime-r1'"))fail.push('Final cache-busted runtime release is missing.');
for(const token of ['level-journey','guided-chat-experience','member-motivation','interaction-design'])if(!loader.includes(token))fail.push(`Feature loader missing: ${token}`);
if(loader.indexOf('level-journey')>loader.indexOf('member-motivation'))fail.push('Upgrade journey does not load before decorative customer modules.');

for(const token of ["section.id='view-upgrade'",'id="upgrade-content"','data-route="home"','data-route="earn"','data-route="upgrade"','data-route="referrals"','data-route="profile"'])if(!journey.includes(token))fail.push(`Upgrade shell/navigation missing: ${token}`);
const navMarkup=journey.match(/nav\.innerHTML='([^']+)'/)?.[1]||'';
for(const token of ['data-route="home"','data-route="earn"','data-route="upgrade"','data-route="referrals"','data-route="profile"'])if(!navMarkup.includes(token))fail.push(`Primary navigation missing: ${token}`);
for(const token of ['data-route="tasks"','data-route="withdraw"'])if(navMarkup.includes(token))fail.push(`Permanent navigation still contains ${token}`);
for(const level of ['Starter','Active','Pro','Elite'])if(!journey.includes(`'${level}'`))fail.push(`Upgrade journey missing ${level}.`);
for(const token of ['Activity Points','Account days','Active days','Approved chats','Approved tasks','Submit KYC','activity-points-guide','data-requirement-action','How to earn points','Open guided chats','Open tasks','Open KYC','makeLevelControls','level-pill-button',"button.dataset.go='upgrade'",'locked-level-action'])if(!journey.includes(token))fail.push(`Upgrade behavior missing: ${token}`);
for(const token of ['statePromise','if(statePromise)return statePromise','upgrade-retry','Level progress could not load','document.body.dataset.route=\'upgrade\'','withdraw'])if(!journey.includes(token))fail.push(`Reliable Upgrade loading missing: ${token}`);
for(const token of ['Review upgrade progress','View upgrade journey','See how to increase commission','data-go="upgrade"'])if(!motivation.includes(token))fail.push(`Customer motivation missing Upgrade circulation: ${token}`);
if(interaction.includes("activate('profile')")&&interaction.includes('Open earned level progress'))fail.push('Legacy Profile-based Upgrade hack remains.');
for(const token of ['#view-upgrade','upgrade-hero','upgrade-level-card','upgrade-requirement','route-level-strip','background:#fff!important','backdrop-filter:none!important','safe-area-inset-bottom'])if(!levelCss.includes(token))fail.push(`Upgrade/mobile CSS missing: ${token}`);
if(html.includes('<span id="public-online">')&&!motivation.includes('hidePublicPresence'))fail.push('Public online count is not suppressed.');

for(const token of ['REQUIRED_SECONDS=45','/ 00:45','minimum 45 seconds','minimum_seconds:REQUIRED_SECONDS','interceptCompletion','stopImmediatePropagation','document.addEventListener(\'click\',interceptCompletion,true)','setInterval(enhance,1000)'])if(!chat.includes(token))fail.push(`Authoritative 45-second chat missing: ${token}`);
if(/setInterval\([^,]+,\s*(?:350|500)\)/.test(chat))fail.push('High-frequency whole-page chat scanner remains.');

const routeMatch=config.match(/ROUTES=\[([^\]]+)\]/),routes=new Set((routeMatch?.[1]||'').match(/'([^']+)'/g)?.map(x=>x.slice(1,-1))||[]),sources=[html,...js.map(file=>fs.readFileSync(file,'utf8'))].join('\n');
for(const match of sources.matchAll(/data-go=["']([^"']+)["']/g))if(!routes.has(match[1]))fail.push(`Invalid data-go route: ${match[1]}`);
for(const match of sources.matchAll(/data-route=["']([^"']+)["']/g))if(!routes.has(match[1]))fail.push(`Invalid data-route route: ${match[1]}`);
for(const file of ['assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/guided-chat-experience.js','assets/js/features/level-journey.js'])if(read(file).includes('new MutationObserver'))fail.push(`Continuous observer remains in ${file}`);

for(const token of ['PAGE_SIZE=50','admin-pagination','suspicious_accounts','work_liability_ngn','referral_liability_ngn','work_liability_kes','referral_liability_kes','activity_points','points_required','referral_commission_percent'])if(!core.includes(token))fail.push(`Admin core missing: ${token}`);
for(const token of ['activity_points','adminUsers:async(limit=200,offset=0)','adminClaims:async(limit=200,offset=0)','adminKyc:async(limit=200,offset=0)','adminWithdrawals:async(limit=200,offset=0)'])if(!api.includes(token))fail.push(`API contract missing: ${token}`);
if(!read('assets/js/admin/admin.js').includes("export{renderAdmin}from'./core.js'"))fail.push('Admin entry is not authoritative.');

const drafts=read('assets/js/features/draft-recovery.js');
for(const token of ['task-form','kyc-config-form','mission-form','feedback-form','business-form','register-form','Draft saved just now','Clear draft','checks<16'])if(!drafts.includes(token))fail.push(`Draft recovery missing: ${token}`);
for(const sensitive of ['register-password','login-password','payout-account','payout-name','payout-provider','kyc-reference'])if(!drafts.includes(sensitive))fail.push(`Draft recovery does not block sensitive field: ${sensitive}`);

const levelSql=read('supabase/earnchat_level_chat_upgrade_20260731.sql');
for(const token of ["version='20260731-production-complete-r1'",'signup_bonus_ngn=2000','referral_reward_ngn=500','earnchat_point_events','earnchat_grant_signup_bonus','referral_commission_percent','Direct referral commission','minimum_seconds\',45','suspicious_accounts','work_liability_ngn','referral_liability_kes'])if(!levelSql.includes(token))fail.push(`Final member SQL missing: ${token}`);
const verify=read('supabase/earnchat_production_verify.sql');
for(const token of ['duplicate_signup_bonuses','missing_signup_bonuses','invalid_signup_bonus_amounts','duplicate_point_events','activity_point_mismatches','duplicate_referral_commissions','invalid_level_point_contract','invalid_level_commission_contract','chat_minimum_contract','admin_overview_contract','wallet_mismatches'])if(!verify.includes(token))fail.push(`Verification SQL missing: ${token}`);
if(fs.existsSync(path.join(root,'.github/workflows/final-authoritative-cleanup.yml')))fail.push('Non-running cleanup workflow remains.');
if(fs.existsSync(path.join(root,'.github/workflows/finalize-production-source.yml')))fail.push('Temporary finalizer workflow remains.');
if(fs.existsSync(path.join(root,'supabase/earnchat_production_certification_upgrade_20260731.sql')))fail.push('Duplicate certification migration remains.');

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat production validation passed.');
console.log(`Checked ${required.length} required files, ${js.length} runtime modules, reliable Upgrade loading, route-level motivation, authoritative 45-second chat interception, valid routes, solid mobile surfaces, Admin accuracy and final database contracts.`);
