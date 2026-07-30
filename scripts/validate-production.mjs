import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const fail=[];
const requiredFiles=[
 'index.html','assets/css/app.css','assets/css/routes.css','assets/js/app-config.js','assets/js/supabase-client.js',
 'assets/js/api.js','assets/js/router.js','assets/js/app.js','assets/js/admin/admin.js',
 'assets/js/features/qualification.js','assets/js/features/feedback.js','assets/js/features/analytics.js',
 'supabase/earnchat_production_rebuild_20260730.sql','supabase/earnchat_production_completion_20260730.sql',
 'supabase/earnchat_production_features_20260730.sql','supabase/earnchat_production_integrity_20260730.sql',
 'supabase/earnchat_production_finalization_20260730.sql','supabase/earnchat_production_verify_20260730.sql'
];
for(const file of requiredFiles)if(!fs.existsSync(path.join(root,file)))fail.push(`Missing required file: ${file}`);

const jsFiles=requiredFiles.filter(x=>x.endsWith('.js'));
for(const file of jsFiles){
 try{execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});}catch(error){fail.push(`JavaScript syntax failed: ${file}\n${error.stderr?.toString()||error.message}`)}
 const text=fs.readFileSync(path.join(root,file),'utf8');
 for(const match of text.matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/g)){
  const resolved=path.resolve(path.dirname(path.join(root,file)),match[1].split('?')[0]);
  if(!fs.existsSync(resolved))fail.push(`Missing import from ${file}: ${match[1]}`);
 }
}

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
const referencedIds=new Set([...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'/g)].map(m=>m[1]));
const dynamicIds=new Set(['qualification-card','member-feedback','member-feedback-list']);
for(const id of referencedIds)if(!dynamicIds.has(id)&&!html.includes(`id="${id}"`))fail.push(`app.js references missing HTML id: ${id}`);

const forbidden=[
 'daily-share','pg-share','pg-claim','earn_per_share','share_reward','₦3,750','₦70,000',
 'demoSignupFallback','earnchat-demo-users','request_withdrawal','withdrawal_requests',
 'sponsored-visits-upgrade','linked-task-marketplace','auth-session-fix','Reply & Earn up to'
];
const activeFiles=['index.html',...jsFiles];
for(const file of activeFiles){const text=fs.readFileSync(path.join(root,file),'utf8');for(const term of forbidden)if(text.includes(term))fail.push(`Forbidden legacy term in ${file}: ${term}`)}

const sqlOrder=[
 'earnchat_production_rebuild_20260730.sql','earnchat_production_completion_20260730.sql',
 'earnchat_production_features_20260730.sql','earnchat_production_integrity_20260730.sql',
 'earnchat_production_finalization_20260730.sql','earnchat_production_verify_20260730.sql'
];
const requiredSqlTokens=[
 'ensure_earnchat_profile','get_my_earnchat_state','complete_earnchat_chat','start_earnchat_task',
 'submit_earnchat_task','request_earnchat_withdrawal','admin_review_task_claim',
 'admin_review_earnchat_withdrawal','admin_review_earnchat_referral','earnchat_qualification_missions',
 'earnchat_analytics_events','revoke all on function public.mark_earnchat_active_day'
];
const combined=sqlOrder.map(f=>fs.readFileSync(path.join(root,'supabase',f),'utf8')).join('\n');
for(const token of requiredSqlTokens)if(!combined.includes(token))fail.push(`Production SQL contract missing: ${token}`);

if(fail.length){console.error(`Production validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat production validation passed.');
console.log(`Checked ${requiredFiles.length} required files, ${jsFiles.length} JavaScript modules, HTML selectors, forbidden legacy terms and the six-file SQL package.`);
