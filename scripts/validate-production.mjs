import fs from'node:fs';
import path from'node:path';
import{execFileSync}from'node:child_process';

const root=process.cwd();
const failures=[];
const rel=file=>path.relative(root,file).replaceAll('\\','/');
const file=name=>path.join(root,name);
const exists=name=>fs.existsSync(file(name));
const read=name=>fs.readFileSync(file(name),'utf8');
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]):[];
const requireFile=name=>{if(!exists(name))failures.push(`Missing required file: ${name}`)};
const requireToken=(source,token,label)=>{if(!source.includes(token))failures.push(`${label}: ${token}`)};
const forbidToken=(source,token,label)=>{if(source.includes(token))failures.push(`${label}: ${token}`)};

const required=[
 'index.html','package.json','vercel.json',
 'scripts/build-static.mjs','scripts/validate-deployment.mjs','scripts/validate-production.mjs',
 'assets/css/app.css','assets/css/routes.css','assets/css/experience-theme.css',
 'assets/js/app-config.js','assets/js/config-runtime.js','assets/js/supabase-client.js','assets/js/api.js','assets/js/router.js','assets/js/app.js',
 'assets/js/admin/admin.js','assets/js/admin/core.js','assets/js/admin/configuration.js',
 'assets/js/features/draft-recovery.js','assets/js/features/analytics.js','assets/js/features/task-status.js','assets/js/features/level-journey.js','assets/js/features/qualification.js',
 'supabase/earnchat_production_install.sql','supabase/earnchat_kyc_bulk_admin_upgrade_20260730.sql','supabase/earnchat_level_chat_upgrade_20260731.sql',
 'supabase/earnchat_configuration_control_upgrade_20260801.sql','supabase/earnchat_dynamic_chat_contract_20260801.sql','supabase/earnchat_task_restart_contract_20260801.sql',
 'supabase/earnchat_configuration_control_verify_20260801.sql','supabase/earnchat_production_verify.sql','supabase/PRODUCTION_RUN_ORDER.md'
];
required.forEach(requireFile);

const jsFiles=walk(file('assets/js')).filter(name=>name.endsWith('.js'));
for(const jsFile of jsFiles){
 try{execFileSync(process.execPath,['--check',jsFile],{stdio:'pipe'})}
 catch(error){failures.push(`JavaScript syntax failed: ${rel(jsFile)}\n${error.stderr?.toString()||error.message}`)}
 const source=fs.readFileSync(jsFile,'utf8');
 for(const match of source.matchAll(/(?:from\s*|import\s*\()['"](\.\.?\/[^'"]+)['"]/g)){
  const target=path.resolve(path.dirname(jsFile),match[1].split('?')[0]);
  if(!fs.existsSync(target))failures.push(`Missing import from ${rel(jsFile)}: ${match[1]}`);
 }
}

const html=read('index.html');
const appConfig=read('assets/js/app-config.js');
const runtimeConfig=read('assets/js/config-runtime.js');
const loader=read('assets/js/supabase-client.js');
const api=read('assets/js/api.js');
const router=read('assets/js/router.js');
const app=read('assets/js/app.js');
const adminCore=read('assets/js/admin/core.js');
const adminConfig=read('assets/js/admin/configuration.js');
const drafts=read('assets/js/features/draft-recovery.js');
const analytics=read('assets/js/features/analytics.js');
const taskStatus=read('assets/js/features/task-status.js');
const build=read('scripts/build-static.mjs');
const configSql=read('supabase/earnchat_configuration_control_upgrade_20260801.sql');
const chatSql=read('supabase/earnchat_dynamic_chat_contract_20260801.sql');
const taskRestartSql=read('supabase/earnchat_task_restart_contract_20260801.sql');
const verifySql=read('supabase/earnchat_configuration_control_verify_20260801.sql');
const runOrder=read('supabase/PRODUCTION_RUN_ORDER.md');

for(const token of ['CONFIG_DEFAULTS','normalizeBusinessConfig','getGeneralConfig','getLandingConfig','getChatConfig','getTaskConfig','getReferralConfig','getWithdrawalConfig','getKycConfig','getFeatureFlags','getPublicOrigin'])requireToken(runtimeConfig,token,'Configuration helper missing');
for(const token of ['minimum_seconds:45','required_replies:4','minimum_reply_length:12',"production_origin:'https://earn-chat.com'",'direct_referral_only:true'])requireToken(runtimeConfig,token,'Safe fallback missing');

if((loader.match(/createClient\(/g)||[]).length!==1)failures.push('Exactly one Supabase browser client must be created.');
if((api.match(/createClient\(/g)||[]).length!==0)failures.push('api.js must not create another Supabase client.');
for(const token of ['modulePromises=new Map','loadFeature(','RELEASE_VERSION'])requireToken(loader,token,'Feature-loader contract missing');

for(const token of ['invalidateBusinessConfig','refreshBusiness','earnchat:config-invalidated','earnchat:config-updated','adminUpdateConfiguration','earnchat:admin-config-saved','cancelTask'])requireToken(api,token,'API/cache contract missing');
for(const token of ["from'./config-runtime.js'",'chatMinimumSeconds','chatRequiredReplies','chatMinimumReplyLength','chatRecoveryMs','chatPartners','landingConfig()','taskConfig()','referralConfig()','withdrawalConfig()','kycConfig()','featureFlags()','getPublicOrigin(app.config)','api.cancelTask','earnchat:config-updated'])requireToken(app,token,'Customer configuration integration missing');
for(const token of ['const CHAT_SECONDS=45','const PARTNERS=[','CHAT_RECOVERY_MS=',' / 02:00','minimum two minutes'])forbidToken(app,token,'Obsolete customer rule remains');
if(exists('assets/js/features/guided-chat-experience.js'))failures.push('Duplicate guided-chat controller exists.');

for(const token of ['configureRouter','hashchange','routeHandler'])requireToken(router,token,'Router contract missing');
if((router.match(/addEventListener\(['"]hashchange/g)||[]).length>1)failures.push('Router contains duplicate hashchange listeners.');

for(const token of ["renderConfiguration}from'./configuration.js'",'configuration:renderConfiguration','PAGE_SIZE=50','renderToken'])requireToken(adminCore,token,'Admin ownership contract missing');
forbidToken(adminCore,'async function configuration(){','Legacy Admin Configuration renderer remains');
for(const token of ['admin-config-section','admin-config-form','generalForm','landingForm','chatForm','tasksForm','referralForm','withdrawalForm','kycForm','featureForm','levelForm','adminUpdateConfiguration','adminUpdateLevel','configuration_version','earnchat:form-rendered','earnchat:form-save-succeeded'])requireToken(adminConfig,token,'Admin configuration control missing');

for(const token of ['earnchat:form-rendered','earnchat:form-save-succeeded','earnchat:form-save-failed','earnchat-draft:v2','BLOCKED_IDS','BLOCKED_TYPES'])requireToken(drafts,token,'Draft recovery contract missing');
for(const token of ['scheduleScan','checks<16',"addEventListener('pageshow'"])forbidToken(drafts,token,'Obsolete draft scanner remains');
for(const token of ['earnchat:chat-completion-requested','earnchat:withdrawal-requested','earnchat:task-opened','earnchat:referral-shared'])requireToken(analytics,token,'Semantic analytics event missing');
for(const token of ['#chat-complete','#withdraw-form'])forbidToken(analytics,token,'Analytics binds a core control directly');
for(const token of ['restart-required','pending-review','approved','rejected','earnchat:task-started','earnchat:task-submitted','earnchat:route-view'])requireToken(taskStatus,token,'Task lifecycle contract missing');

for(const token of ['configuration_version','general_config jsonb','landing_config jsonb','chat_config jsonb','task_config jsonb','referral_config jsonb','withdrawal_config jsonb','kyc_config jsonb','feature_flags jsonb','earnchat_validate_configuration_section','admin_update_earnchat_configuration','get_earnchat_business_config','earnchat_admin_audit'])requireToken(configSql,token,'Configuration SQL contract missing');
for(const token of ['earnchat_chat_contract','minimum_seconds','required_replies','minimum_reply_length','attempt_expiry_minutes','earnchat_reconcile_points','start_earnchat_chat','get_my_open_chat_attempt','complete_earnchat_chat'])requireToken(chatSql,token,'Dynamic chat SQL contract missing');
for(const token of ['cancel_earnchat_task_claim',"status='expired'",'Restarted by member','grant execute'])requireToken(taskRestartSql,token,'Task restart SQL contract missing');
for(const token of ['duplicate_level_rank','invalid_level_amounts','invalid_level_order','unknown_feature_flags','invalid_chat_contract','duplicate_open_task_claims','duplicate_task_credits','duplicate_chat_credits','normalized_public_configuration'])requireToken(verifySql,token,'Configuration verification missing');
for(const token of ['earnchat_configuration_control_upgrade_20260801.sql','earnchat_dynamic_chat_contract_20260801.sql','earnchat_task_restart_contract_20260801.sql','earnchat_configuration_control_verify_20260801.sql'])requireToken(runOrder,token,'Production SQL run order missing');

const routeMatch=appConfig.match(/ROUTES=\[([^\]]+)\]/);
const routes=new Set((routeMatch?.[1]||'').match(/'([^']+)'/g)?.map(value=>value.slice(1,-1))||[]);
const runtime=[html,...jsFiles.map(name=>fs.readFileSync(name,'utf8'))].join('\n');
const literal=value=>value&&!/[${}`]/.test(value);
for(const match of runtime.matchAll(/data-go=["']([^"']+)["']/g))if(literal(match[1])&&!routes.has(match[1]))failures.push(`Invalid data-go route: ${match[1]}`);
for(const match of runtime.matchAll(/data-route=["']([^"']+)["']/g))if(literal(match[1])&&!routes.has(match[1]))failures.push(`Invalid data-route route: ${match[1]}`);
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
if(duplicateIds.length)failures.push(`Duplicate HTML IDs: ${duplicateIds.join(', ')}`);
for(const token of ['About 2 minutes','00:00 / 02:00','id="public-online"','earn-test-99lc.vercel.app','chat-earn.xyz'])forbidToken(runtime,token,'Stale production content remains');

for(const token of ['app.replace','fs.writeFileSync(appPath'])forbidToken(build,token,'Build script rewrites application behavior');
for(const token of ['sourceApp','outputApp','Built application differs','Static deployment bundle copied'])requireToken(build,token,'Copy-only build contract missing');

const secretFiles=walk(root).filter(name=>/\.(?:js|mjs|html|json|yml|yaml)$/.test(name)&&!name.includes(`${path.sep}public${path.sep}`)&&path.basename(name)!=='validate-production.mjs');
const secretPatterns=[/SUPABASE_SERVICE_ROLE\s*=/i,/DATABASE_URL\s*=/i,/postgres(?:ql)?:\/\/[^\s'"`]+/i,/service_role\s*[:=]\s*['"][^'"]+/i];
for(const secretFile of secretFiles){const source=fs.readFileSync(secretFile,'utf8');for(const pattern of secretPatterns)if(pattern.test(source))failures.push(`Potential privileged credential found in ${rel(secretFile)}`)}

if(failures.length){console.error(`Production validation failed with ${failures.length} issue(s):\n- ${failures.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat structural production validation passed.');
console.log(`Checked ${required.length} required files and ${jsFiles.length} JavaScript modules across configuration, customer runtime, Admin, task/chat contracts, security, routing and copy-only deployment.`);
