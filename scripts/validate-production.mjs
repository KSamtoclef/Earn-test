import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';

const root=process.cwd(),fail=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]):[];
const required=[
 'index.html','package.json','vercel.json','scripts/build-static.mjs','scripts/validate-deployment.mjs',
 'assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css','assets/css/member-motivation.css','assets/css/referral-priority.css','assets/css/level-chat-experience.css',
 'assets/js/app-config.js','assets/js/config-runtime.js','assets/js/supabase-client.js','assets/js/api.js','assets/js/router.js','assets/js/app.js',
 'assets/js/admin/admin.js','assets/js/admin/core.js','assets/js/admin/configuration.js',
 'assets/js/features/draft-recovery.js','assets/js/features/analytics.js','assets/js/features/member-motivation.js','assets/js/features/referral-priority.js','assets/js/features/level-journey.js','assets/js/features/qualification.js','assets/js/features/task-status.js',
 'supabase/earnchat_production_install.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/earnchat_level_chat_upgrade_20260731.sql','supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_configuration_control_verify_20260801.sql','supabase/earnchat_production_verify.sql','supabase/PRODUCTION_RUN_ORDER.md'
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

const html=read('index.html'),configSource=read('assets/js/config-runtime.js'),loader=read('assets/js/supabase-client.js'),api=read('assets/js/api.js'),app=read('assets/js/app.js'),router=read('assets/js/router.js'),adminCore=read('assets/js/admin/core.js'),adminConfig=read('assets/js/admin/configuration.js'),drafts=read('assets/js/features/draft-recovery.js'),analytics=read('assets/js/features/analytics.js'),taskStatus=read('assets/js/features/task-status.js'),build=read('scripts/build-static.mjs'),migration=read('supabase/earnchat_configuration_control_upgrade_20260801.sql'),verify=read('supabase/earnchat_configuration_control_verify_20260801.sql');

for(const token of ['CONFIG_DEFAULTS','normalizeBusinessConfig','getGeneralConfig','getLandingConfig','getChatConfig','getTaskConfig','getReferralConfig','getWithdrawalConfig','getKycConfig','getFeatureFlags','getPublicOrigin'])if(!configSource.includes(token))fail.push(`Configuration helper missing: ${token}`);
for(const token of ['minimum_seconds:45','required_replies:4','minimum_reply_length:12','direct_referral_only:true','production_origin:\'https://earn-chat.com\''])if(!configSource.includes(token))fail.push(`Safe configuration fallback missing: ${token}`);

for(const token of ['invalidateBusinessConfig','earnchat:config-invalidated','earnchat:config-updated','refreshBusiness','adminUpdateConfiguration','earnchat:admin-config-saved'])if(!api.includes(token))fail.push(`Configuration cache/API contract missing: ${token}`);
if((api.match(/createClient\(/g)||[]).length)fail.push('Supabase client must not be created in api.js.');
if((loader.match(/createClient\(/g)||[]).length!==1)fail.push('Exactly one Supabase browser client must be created.');

for(const token of ["from'./config-runtime.js'",'chatMinimumSeconds','chatRequiredReplies','chatMinimumReplyLength','chatPartners','chatRecoveryMs','normalizeBusinessConfig(data.config','earnchat:config-updated','api.refreshBusiness','getPublicOrigin(app.config)'])if(!app.includes(token))fail.push(`Customer configuration integration missing: ${token}`);
for(const stale of ['const CHAT_SECONDS=45','const PARTNERS=[','CHAT_RECOVERY_MS=','PARTNERS.map(','PARTNERS.find(','minimum two minutes',' / 02:00'])if(app.includes(stale))fail.push(`Obsolete customer hardcoding remains: ${stale}`);
if(exists('assets/js/features/guided-chat-experience.js'))fail.push('Duplicate guided-chat controller still exists.');
if(loader.includes('guided-chat-experience.js'))fail.push('Duplicate guided-chat controller is still loaded.');

for(const token of ["renderConfiguration}from'./configuration.js'",'configuration:renderConfiguration','PAGE_SIZE=50','renderToken'])if(!adminCore.includes(token))fail.push(`Admin ownership contract missing: ${token}`);
if(adminCore.includes('async function configuration(){'))fail.push('Legacy Admin configuration renderer remains.');
for(const token of ['data-config-section="general"','data-config-section="chat"','data-config-section="tasks"','data-config-section="referrals"','data-config-section="withdrawals"','data-config-section="kyc"','data-config-section="feature_flags"','adminUpdateConfiguration','adminUpdateLevel','earnchat:form-rendered','earnchat:form-save-succeeded','configuration_version'])if(!adminConfig.includes(token))fail.push(`Admin configuration control missing: ${token}`);

for(const token of ['earnchat:form-rendered','earnchat:form-save-succeeded','earnchat:form-save-failed','earnchat-draft:v2','BLOCKED_IDS','BLOCKED_TYPES'])if(!drafts.includes(token))fail.push(`Draft recovery contract missing: ${token}`);
for(const stale of ['scheduleScan','checks<16',"addEventListener('pageshow'"])if(drafts.includes(stale))fail.push(`Obsolete draft scanner remains: ${stale}`);
for(const token of ['earnchat:chat-completion-requested','earnchat:withdrawal-requested','earnchat:task-opened','earnchat:referral-shared'])if(!analytics.includes(token))fail.push(`Semantic analytics event missing: ${token}`);
if(analytics.includes('#chat-complete')||analytics.includes('#withdraw-form'))fail.push('Analytics still binds core business controls by DOM ID.');

for(const token of ['restart-required','pending-review','approved','rejected','earnchat:task-started','earnchat:task-submitted','earnchat:route-view'])if(!taskStatus.includes(token))fail.push(`Task lifecycle contract missing: ${token}`);

for(const token of ['configuration_version','general_config jsonb','landing_config jsonb','chat_config jsonb','task_config jsonb','referral_config jsonb','withdrawal_config jsonb','kyc_config jsonb','feature_flags jsonb','earnchat_assert_admin','earnchat_validate_known_keys','earnchat_validate_configuration_section','admin_update_earnchat_configuration','get_earnchat_business_config','earnchat_admin_audit'])if(!migration.includes(token))fail.push(`Configuration SQL contract missing: ${token}`);
for(const token of ['duplicate_level_rank','invalid_level_amounts','invalid_level_order','unknown_feature_flags','invalid_chat_contract','duplicate_open_task_claims','duplicate_task_credits','duplicate_chat_credits','normalized_public_configuration'])if(!verify.includes(token))fail.push(`Configuration verification missing: ${token}`);

const routeConfig=read('assets/js/app-config.js'),routeMatch=routeConfig.match(/ROUTES=\[([^\]]+)\]/),routes=new Set((routeMatch?.[1]||'').match(/'([^']+)'/g)?.map(value=>value.slice(1,-1))||[]),allRuntime=[html,...js.map(file=>fs.readFileSync(file,'utf8'))].join('\n');
const literal=value=>value&&!/[${}`]/.test(value);
for(const match of allRuntime.matchAll(/data-go=["']([^"']+)["']/g))if(literal(match[1])&&!routes.has(match[1]))fail.push(`Invalid data-go route: ${match[1]}`);
for(const match of allRuntime.matchAll(/data-route=["']([^"']+)["']/g))if(literal(match[1])&&!routes.has(match[1]))fail.push(`Invalid data-route route: ${match[1]}`);
if((router.match(/addEventListener\(['"]hashchange/g)||[]).length>1)fail.push('Router registers duplicate hashchange listeners.');

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]),duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
if(duplicates.length)fail.push(`Duplicate HTML IDs: ${duplicates.join(', ')}`);
for(const stale of ['About 2 minutes','00:00 / 02:00','id="public-online"','earn-test-99lc.vercel.app','www.chat-earn.xyz','chat-earn.xyz'])if(allRuntime.includes(stale))fail.push(`Stale production content remains: ${stale}`);

if(build.includes('app.replace')||build.includes('fs.writeFileSync(appPath'))fail.push('Build script rewrites application behavior.');
for(const token of ['sourceApp','outputApp','Built application differs','Static deployment bundle copied'])if(!build.includes(token))fail.push(`Copy-only build contract missing: ${token}`);

const secretFiles=walk(root).filter(file=>/\.(?:js|mjs|html|json|yml|yaml)$/.test(file)&&!file.includes(`${path.sep}public${path.sep}`)&&path.basename(file)!=='validate-production.mjs');
const secretPatterns=[/SUPABASE_SERVICE_ROLE\s*=/i,/DATABASE_URL\s*=/i,/postgres(?:ql)?:\/\/[^\s'"`]+/i,/service_role\s*[:=]\s*['"][^'"]+/i];
for(const file of secretFiles){const source=fs.readFileSync(file,'utf8');for(const pattern of secretPatterns)if(pattern.test(source))fail.push(`Potential privileged credential found in ${path.relative(root,file)}`)}

const obsolete=['.github/workflows/consolidate-source.yml','.github/workflows/align-release.yml','.github/workflows/upgrade-config-cache.yml','.github/workflows/install-admin-configuration.yml','.github/workflows/install-customer-configuration.yml','scripts/consolidate-source.mjs','scripts/align-release.mjs','scripts/upgrade-config-cache.mjs','scripts/install-admin-configuration.mjs','scripts/install-customer-configuration.mjs'];
for(const file of obsolete)if(exists(file))fail.push(`Temporary migration file remains: ${file}`);

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat Admin-driven configuration validation passed.');
console.log(`Checked ${required.length} required files, ${js.length} runtime modules, normalized configuration, cache propagation, customer chat rules, Admin controls, task lifecycle, copy-only build, routes, credentials and database contracts.`);
