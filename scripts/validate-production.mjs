import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';

const root=process.cwd(),fail=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]):[];
const required=[
 'index.html','package.json','scripts/build-static.mjs','assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css','assets/css/member-motivation.css','assets/css/referral-priority.css','assets/css/level-chat-experience.css','assets/js/app-config.js','assets/js/supabase-client.js','assets/js/api.js','assets/js/router.js','assets/js/app.js','assets/js/admin/admin.js','assets/js/admin/core.js','assets/js/features/draft-recovery.js','assets/js/features/analytics.js','assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/level-journey.js','supabase/earnchat_production_install.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/earnchat_level_chat_upgrade_20260731.sql','supabase/earnchat_production_verify.sql','supabase/PRODUCTION_RUN_ORDER.md'
];
for(const file of required)if(!exists(file))fail.push(`Missing required file: ${file}`);

const js=walk(path.join(root,'assets/js')).filter(file=>/\.js$/.test(file));
for(const file of js){
 try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'})}
 catch(error){fail.push(`JavaScript syntax failed: ${path.relative(root,file)}\n${error.stderr?.toString()||error.message}`)}
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(file),match[1].split('?')[0]);
  if(!fs.existsSync(target))fail.push(`Missing import from ${path.relative(root,file)}: ${match[1]}`);
 }
}

const html=read('index.html'),config=read('assets/js/app-config.js'),loader=read('assets/js/supabase-client.js'),api=read('assets/js/api.js'),app=read('assets/js/app.js'),router=read('assets/js/router.js'),journey=read('assets/js/features/level-journey.js'),drafts=read('assets/js/features/draft-recovery.js'),analytics=read('assets/js/features/analytics.js'),build=read('scripts/build-static.mjs'),core=read('assets/js/admin/core.js'),adminEntry=read('assets/js/admin/admin.js'),release='20260801-source-consolidated-r1';

for(const token of [`RELEASE='${release}'`,'CHAT_SECONDS=45','CHAT_RECOVERY_MS','CHAT_PROMPT_SETS',' / 00:45','data-chat-next','earnchat:chat-completion-requested'])if(!app.includes(token))fail.push(`Authoritative app source missing: ${token}`);
for(const stale of ['About 2 minutes','minimum two minutes','two-minute session','120-elapsed',' / 02:00','<120)return','#public-stats','#public-total','#public-online'])if(app.includes(stale))fail.push(`Obsolete app behavior remains: ${stale}`);
if(exists('assets/js/features/guided-chat-experience.js'))fail.push('Duplicate guided chat controller still exists.');
if(loader.includes('guided-chat-experience.js'))fail.push('Duplicate guided chat controller is still loaded.');

if(!loader.includes(`RELEASE_VERSION='${release}'`))fail.push('Loader release identifier is not aligned.');
for(const token of ['stylePromises=new Map','modulePromises=new Map','CUSTOMER_ROUTES','requestIdleCallback','levelFeature(false)'])if(!loader.includes(token))fail.push(`Route loader contract missing: ${token}`);
if(loader.includes("loadFeature('./assets/js/features/"))fail.push('Page-relative dynamic import remains.');
if(loader.includes('interaction-design.js'))fail.push('Obsolete broad interaction module remains loaded.');
if(exists('assets/js/features/interaction-design.js'))fail.push('Obsolete broad interaction module still exists.');

for(const token of ['memberOwner','sessionUserId','MEMBER_CACHE_MS=10000','memberPromise','invalidateMemberState','ADMIN_CACHE_MS=12000','adminOverviewPromise','adminClaims:async(limit=50','adminUsers:async(limit=50','adminWithdrawals:async(limit=50'])if(!api.includes(token))fail.push(`API/cache contract missing: ${token}`);
if((api.match(/createClient\(/g)||[]).length>0)fail.push('Supabase client must only be created in supabase-client.js.');
if((loader.match(/createClient\(/g)||[]).length!==1)fail.push('Exactly one Supabase client must be created.');

for(const token of ['earnchat:form-rendered','earnchat:form-save-succeeded','earnchat:form-save-failed','earnchat-draft:v2','BLOCKED_IDS','BLOCKED_TYPES'])if(!drafts.includes(token))fail.push(`Draft recovery contract missing: ${token}`);
for(const stale of ['scheduleScan','pageshow',"setTimeout(scan",'checks<16'])if(drafts.includes(stale))fail.push(`Obsolete draft scanner remains: ${stale}`);
for(const token of ['earnchat:chat-completion-requested','earnchat:withdrawal-requested','earnchat:task-opened','earnchat:referral-shared'])if(!analytics.includes(token))fail.push(`Semantic analytics event missing: ${token}`);
if(analytics.includes('#chat-complete')||analytics.includes('#withdraw-form'))fail.push('Analytics still binds business controls by DOM ID.');

for(const token of ["section.id='view-upgrade'",'next-benefits','upgrade-disclosure','Compare all levels','How Activity Points work','earn-activity-hub','Guided chats','Sponsored visits','Referrals','primaryAction'])if(!journey.includes(token))fail.push(`Upgrade/Earn journey missing: ${token}`);
for(const level of ['Starter','Active','Pro','Elite'])if(!journey.includes(`'${level}'`))fail.push(`Upgrade journey missing ${level}.`);
if((journey.match(/<details/g)||[]).length<3)fail.push('Upgrade detail sections are not collapsed.');

if(!config.includes("'upgrade'"))fail.push('ROUTES does not contain upgrade.');
const routeMatch=config.match(/ROUTES=\[([^\]]+)\]/),routes=new Set((routeMatch?.[1]||'').match(/'([^']+)'/g)?.map(value=>value.slice(1,-1))||[]),sources=[html,...js.map(file=>fs.readFileSync(file,'utf8'))].join('\n');
const literal=value=>value&&!/[${}`]/.test(value);
for(const match of sources.matchAll(/data-go=["']([^"']+)["']/g))if(literal(match[1])&&!routes.has(match[1]))fail.push(`Invalid data-go route: ${match[1]}`);
for(const match of sources.matchAll(/data-route=["']([^"']+)["']/g))if(literal(match[1])&&!routes.has(match[1]))fail.push(`Invalid data-route route: ${match[1]}`);
if((router.match(/addEventListener\(['"]hashchange/g)||[]).length>1)fail.push('Router registers duplicate hashchange listeners.');

for(const token of [release,'About 45 seconds','00:00 / 00:45','data-route="upgrade"','data-route="referrals"'])if(!html.includes(token))fail.push(`First-paint contract missing: ${token}`);
for(const stale of ['About 2 minutes','00:00 / 02:00','timer reaches two minutes','id="public-online"'])if(html.includes(stale))fail.push(`Stale first-paint content remains: ${stale}`);
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]),duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
if(duplicates.length)fail.push(`Duplicate HTML IDs: ${duplicates.join(', ')}`);

if(build.includes('app.replace')||build.includes('Chat build transform')||build.includes('fs.writeFileSync(appPath'))fail.push('Build script still rewrites application behavior.');
for(const token of ["copyTargets",'sourceApp!==outputApp','Static deployment bundle copied'])if(!build.includes(token)&&token!=='copyTargets')fail.push(`Copy-only build contract missing: ${token}`);
for(const token of ['sourceApp','outputApp','Built application differs'])if(!build.includes(token))fail.push(`Source/output equality check missing: ${token}`);

for(const token of ['PAGE_SIZE=50','admin-pagination','suspicious_accounts','work_liability_ngn','referral_liability_kes','activity_points','points_required','referral_commission_percent'])if(!core.includes(token))fail.push(`Admin core missing: ${token}`);
const hasAdminImport=/import\s*\{\s*renderAdmin\s*\}\s*from\s*['"]\.\/core\.js['"]/.test(adminEntry),hasAdminExport=/export\s*\{\s*renderAdmin\s*\}/.test(adminEntry);
if(!hasAdminImport||!hasAdminExport)fail.push('Admin entry is not authoritative.');

const allSource=walk(root).filter(file=>/\.(?:js|mjs|html|json|yml|yaml)$/.test(file)&&!file.includes(`${path.sep}public${path.sep}`)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
for(const secret of ['service_role','SUPABASE_SERVICE_ROLE','DATABASE_URL=','postgresql://'])if(allSource.includes(secret))fail.push(`Potential secret or privileged credential found: ${secret}`);
for(const obsolete of ['.github/workflows/final-authoritative-cleanup.yml','.github/workflows/finalize-production-source.yml','.github/workflows/consolidate-source.yml','.github/workflows/align-release.yml','scripts/consolidate-source.mjs','scripts/align-release.mjs'])if(exists(obsolete))fail.push(`Temporary or obsolete file remains: ${obsolete}`);

const levelSql=read('supabase/earnchat_level_chat_upgrade_20260731.sql');
for(const token of ["version='20260731-production-complete-r1'",'signup_bonus_ngn=2000','referral_reward_ngn=500','earnchat_point_events','referral_commission_percent','minimum_seconds\',45'])if(!levelSql.includes(token))fail.push(`Member SQL contract missing: ${token}`);
const verify=read('supabase/earnchat_production_verify.sql');
for(const token of ['duplicate_signup_bonuses','duplicate_point_events','activity_point_mismatches','duplicate_referral_commissions','chat_minimum_contract','admin_overview_contract','wallet_mismatches'])if(!verify.includes(token))fail.push(`Verification SQL missing: ${token}`);

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat consolidated-source validation passed.');
console.log(`Checked ${required.length} required files, ${js.length} runtime modules, single chat ownership, user-scoped state cache, event-driven drafts, semantic analytics, copy-only build, routes, Admin and database contracts.`);
