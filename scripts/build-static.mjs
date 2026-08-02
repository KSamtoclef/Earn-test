import fs from'node:fs';
import path from'node:path';

const root=process.cwd();
const output=path.join(root,'public');
const requiredInputs=['index.html','assets'];

fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});

for(const target of requiredInputs){
  const source=path.join(root,target);
  if(!fs.existsSync(source))throw new Error(`Missing build input: ${target}`);
  fs.cpSync(source,path.join(output,target),{recursive:true});
}
for(const optional of['favicon.ico','robots.txt','manifest.webmanifest']){
  const source=path.join(root,optional);
  if(fs.existsSync(source))fs.copyFileSync(source,path.join(output,optional));
}

const sourceApp=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
const outputAppPath=path.join(output,'assets/js/app.js');
const outputApiPath=path.join(output,'assets/js/api.js');
const outputIndexPath=path.join(output,'index.html');
const outputApp=fs.readFileSync(outputAppPath,'utf8');
const sourceConfig=fs.readFileSync(path.join(root,'assets/js/config-runtime.js'),'utf8');
const outputConfig=fs.readFileSync(path.join(output,'assets/js/config-runtime.js'),'utf8');
if(sourceApp!==outputApp)throw new Error('Built application differs from the committed source.');
if(sourceConfig!==outputConfig)throw new Error('Built configuration runtime differs from the committed source.');
for(const token of['chatMinimumSeconds','chatRequiredReplies','chatMinimumReplyLength','chatRecoveryMs','chatPromptSets','data-chat-next']){
  if(!sourceApp.includes(token))throw new Error(`Application source is missing required dynamic contract: ${token}`);
}
for(const token of['minimum_seconds:45','required_replies:4','minimum_reply_length:12','recovery_expiry_minutes:360']){
  if(!sourceConfig.includes(token))throw new Error(`Safe configuration fallback is missing: ${token}`);
}
for(const token of['About 2 minutes','minimum two minutes','two-minute session','120-elapsed',' / 02:00','#public-stats','#public-total','#public-online','const CHAT_SECONDS=45','CHAT_RECOVERY_MS=']){
  if(sourceApp.includes(token))throw new Error(`Application source contains obsolete behavior: ${token}`);
}

function replaceRequired(source,search,replacement,label){
  if(!source.includes(search))throw new Error(`Static completion contract missing: ${label}`);
  return source.replace(search,replacement);
}

let builtApp=outputApp;
builtApp=replaceRequired(
  builtApp,
  "const amountFromBase=base=>Math.round(Number(base||0)*(country()==='KE'?Number(app.config?.settings?.kenya_multiplier||.6):1));",
  "const amountFromBase=base=>{const settings=app.config?.settings||{};const multiplier=country()==='KE'?Number(settings.kenya_multiplier||.6):Number(settings.nigeria_multiplier||1);return Math.round(Number(base||0)*multiplier)};",
  'country multipliers'
);
builtApp=replaceRequired(
  builtApp,
  "app.presenceTimer=setInterval(()=>{if(!document.hidden)sendPresence()},60000);",
  "app.presenceTimer=setInterval(()=>{if(!document.hidden)sendPresence()},Math.max(15000,Number(app.config?.settings?.presence_heartbeat_seconds||60)*1000));",
  'configurable presence heartbeat'
);
builtApp=replaceRequired(
  builtApp,
  "const rows=(await api.tasks()).filter(r=>category?r.category===category:r.category!=='Visit'),currentRank=Number(levels()[level()]?.rank||0);",
  "let rows=(await api.tasks()).filter(r=>category?r.category===category:r.category!=='Visit');const featuredLimit=Math.max(0,Number(cfg.featured_task_limit||0));if(featuredLimit)rows=rows.slice(0,featuredLimit);const currentRank=Number(levels()[level()]?.rank||0);",
  'featured task limit'
);
builtApp=replaceRequired(
  builtApp,
  "const done=[r.first_active_date,r.second_active_date].filter(Boolean).length;",
  "const done=Number(r.qualifying_active_days_count??[r.first_active_date,r.second_active_date].filter(Boolean).length);",
  'dynamic referral progress'
);
fs.writeFileSync(outputAppPath,builtApp);

let builtApi=fs.readFileSync(outputApiPath,'utf8');
builtApi=replaceRequired(
  builtApi,
  "adminPresence:async()=>unwrap(await select('earnchat_site_presence').gt('last_seen',new Date(Date.now()-90000).toISOString()).order('last_seen',{ascending:false}).limit(100)),",
  "adminPresence:async()=>{const seconds=Math.max(30,Number(configCache?.settings?.presence_online_seconds||90));return unwrap(await select('earnchat_site_presence').gt('last_seen',new Date(Date.now()-seconds*1000).toISOString()).order('last_seen',{ascending:false}).limit(100))},",
  'configurable online-presence window'
);
fs.writeFileSync(outputApiPath,builtApi);

let builtIndex=fs.readFileSync(outputIndexPath,'utf8');
const appScript=/<script type="module" src="\.\/assets\/js\/app\.js[^\"]*"><\/script>/;
if(!appScript.test(builtIndex))throw new Error('Application module tag is missing from index.html.');
builtIndex=builtIndex.replace(appScript,match=>`<script type="module" src="./assets/js/final-completion.js?v=20260802-final-r2"></script>\n${match}`);
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
for(const [from,to] of neutralMoney)builtIndex=replaceRequired(builtIndex,from,to,'neutral first-paint money');
fs.writeFileSync(outputIndexPath,builtIndex);

if(!fs.existsSync(path.join(output,'index.html')))throw new Error('Static build did not produce public/index.html');
if(!fs.existsSync(path.join(output,'assets/js/app.js')))throw new Error('Static build did not produce public/assets/js/app.js');
if(!fs.existsSync(path.join(output,'assets/js/config-runtime.js')))throw new Error('Static build did not produce public/assets/js/config-runtime.js');
if(!fs.existsSync(path.join(output,'assets/js/final-completion.js')))throw new Error('Static build did not produce the completion runtime.');
console.log('Static deployment bundle copied and completed from validated authoritative source.');
