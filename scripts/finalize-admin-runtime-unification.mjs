import fs from'node:fs';
import'./straighten-admin-runtime.mjs';

let production=fs.readFileSync('scripts/validate-production.mjs','utf8');
let deployment=fs.readFileSync('scripts/validate-deployment.mjs','utf8');
let final=fs.readFileSync('scripts/validate-final-completion.mjs','utf8');
let taskStatus=fs.readFileSync('assets/js/features/task-status.js','utf8');
let index=fs.readFileSync('index.html','utf8');

production=production.replace(
 "for(const token of ['sourceApp','outputApp','Built application differs','Static deployment bundle copied'])requireToken(build,token,'Copy-only build contract missing');",
 "for(const token of ['Built file differs from source','without behavior rewrites'])requireToken(build,token,'Copy-only build contract missing');"
);
deployment=deployment.replace(
 "if(!build.includes('sourceApp!==outputApp'))fail.push('The static build must verify source/output equality.');",
 "if(!build.includes('Built file differs from source'))fail.push('The static build must verify source/output equality.');"
);

const decorateNeedle="function decorate(card,key,row){card.dataset.taskStatus=key;";
const decorateReplacement="function decorate(card,key,row){card.dataset.taskStatus=key;card.classList.toggle('task-incomplete',key==='incomplete');card.classList.toggle('task-pending',key==='pending');card.classList.toggle('task-approved',key==='approved');card.classList.toggle('task-rejected',key==='rejected');";
if(!taskStatus.includes(decorateNeedle))throw new Error('Unified task lifecycle decorator was not found.');
taskStatus=taskStatus.replace(decorateNeedle,decorateReplacement);

const neutralMoney=[
 ['<strong id="preview-balance">₦2,000</strong>','<strong id="preview-balance">—</strong>'],
 ['<b id="landing-chat">₦250</b>','<b id="landing-chat">—</b>'],
 ['<b id="landing-chat-detail">₦250 per approved Starter chat</b>','<b id="landing-chat-detail">Reward shown after country selection</b>'],
 ['<div class="amount" id="home-work">₦0</div>','<div class="amount" id="home-work">—</div>'],
 ['<div id="home-work-pending">Pending ₦0</div>','<div id="home-work-pending">Pending —</div>'],
 ['<b id="home-referral">₦0</b>','<b id="home-referral">—</b>'],
 ['<span id="home-referral-pending">Pending ₦0</span>','<span id="home-referral-pending">Pending —</span>'],
 ['<div class="amount" id="ref-balance">₦0</div>','<div class="amount" id="ref-balance">—</div>'],
 ['<small id="ref-remaining">₦40,000 remaining</small>','<small id="ref-remaining">Loading eligibility…</small>'],
 ['<h2 id="withdraw-available">₦0</h2>','<h2 id="withdraw-available">—</h2>'],
 ['<p id="withdraw-limits">Minimum ₦40,000</p>','<p id="withdraw-limits">Loading withdrawal limits…</p>']
];
for(const [from,to] of neutralMoney){if(index.includes(from))index=index.replace(from,to)}

final=final.replaceAll('final-completion.js?v=20260802-final-r2','final-completion.js?v=20260802-unified-r1');
final=final.replace(
 "'supabase/earnchat_final_completion_20260802.sql','supabase/earnchat_final_task_runtime_20260802.sql','supabase/PRODUCTION_RUN_ORDER.md'",
 "'supabase/earnchat_final_completion_20260802.sql','supabase/earnchat_final_task_runtime_20260802.sql','supabase/earnchat_admin_runtime_unification_20260802.sql','supabase/PRODUCTION_RUN_ORDER.md'"
);
final=final.replace(
 "const runOrder=read('supabase/PRODUCTION_RUN_ORDER.md');",
 "const unifiedSql=read('supabase/earnchat_admin_runtime_unification_20260802.sql');\n const runOrder=read('supabase/PRODUCTION_RUN_ORDER.md');"
);
final=final.replace(
 "for(const token of['expires_at','default_attempt_expiry_minutes','get_my_open_task_claim','activity_points','20260802-final-completion-r2'])requireToken(taskSql,token,'Final task runtime contract missing');",
 "for(const token of['expires_at','default_attempt_expiry_minutes','get_my_open_task_claim','activity_points','20260802-final-completion-r2'])requireToken(taskSql,token,'Final task runtime contract missing');\n for(const token of['admin_update_earnchat_configuration','admin_update_earnchat_business_settings','admin_update_earnchat_kyc_config','fixed_reward_ngn','referral_minimum_ngn','provider_url_ng','configuration_version'])requireToken(unifiedSql,token,'Admin/runtime unification contract missing');"
);
final=final.replace(
 "for(const token of['earnchat_final_completion_20260802.sql','earnchat_final_task_runtime_20260802.sql'])requireToken(runOrder,token,'Final SQL run order missing');",
 "for(const token of['earnchat_final_completion_20260802.sql','earnchat_final_task_runtime_20260802.sql','earnchat_admin_runtime_unification_20260802.sql'])requireToken(runOrder,token,'Final SQL run order missing');"
);

fs.writeFileSync('scripts/validate-production.mjs',production);
fs.writeFileSync('scripts/validate-deployment.mjs',deployment);
fs.writeFileSync('scripts/validate-final-completion.mjs',final);
fs.writeFileSync('assets/js/features/task-status.js',taskStatus);
fs.writeFileSync('index.html',index);
console.log('Unified source/deployment validation contract installed.');
// workflow trigger 5
