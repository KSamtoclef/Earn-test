import fs from'node:fs';

function update(path,transform){const before=fs.readFileSync(path,'utf8'),after=transform(before);if(after===before)throw new Error(`No change made to ${path}`);fs.writeFileSync(path,after)}

update('assets/js/app.js',source=>{
 let next=source;
 const started="sessionStorage.setItem('earnchat-task-recovery',JSON.stringify({claimId:c.claim_id}));";
 if(!next.includes(started))throw new Error('Task start recovery marker not found');
 next=next.replace(started,`${started}window.dispatchEvent(new CustomEvent('earnchat:task-started',{detail:{claimId:c.claim_id,taskId:task.id}}));`);
 const submitted="sessionStorage.removeItem('earnchat-task-recovery');await refreshState();";
 if(!next.includes(submitted))throw new Error('Task submit recovery marker not found');
 next=next.replace(submitted,"sessionStorage.removeItem('earnchat-task-recovery');window.dispatchEvent(new CustomEvent('earnchat:task-submitted',{detail:{claimId:r.claim_id||null,status:r.status||'submitted'}}));await refreshState();");
 return next;
});

update('assets/js/features/level-journey.js',source=>{
 const old="window.addEventListener('hashchange',()=>schedule(20));";
 if(!source.includes(old))throw new Error('Upgrade hash listener not found');
 return source.replace(old,"window.addEventListener('earnchat:route-view',event=>{if(['home','earn','tasks','visits','upgrade','referrals','withdraw','profile'].includes(event.detail?.route))schedule(0)});");
});

update('scripts/validate-production.mjs',source=>{
 let next=source;
 next=next.replace("'assets/js/features/referral-priority.js','assets/js/features/level-journey.js','supabase/earnchat_production_install.sql'","'assets/js/features/referral-priority.js','assets/js/features/level-journey.js','assets/js/features/qualification.js','assets/js/features/task-status.js','supabase/earnchat_production_install.sql'");
 next=next.replace("const html=read('index.html'),config=read('assets/js/app-config.js'),loader=read('assets/js/supabase-client.js'),api=read('assets/js/api.js'),app=read('assets/js/app.js'),router=read('assets/js/router.js'),journey=read('assets/js/features/level-journey.js'),drafts=read('assets/js/features/draft-recovery.js'),analytics=read('assets/js/features/analytics.js'),build=read('scripts/build-static.mjs'),core=read('assets/js/admin/core.js'),adminEntry=read('assets/js/admin/admin.js'),release='20260801-source-consolidated-r1';","const html=read('index.html'),config=read('assets/js/app-config.js'),loader=read('assets/js/supabase-client.js'),api=read('assets/js/api.js'),app=read('assets/js/app.js'),router=read('assets/js/router.js'),journey=read('assets/js/features/level-journey.js'),qualification=read('assets/js/features/qualification.js'),taskStatus=read('assets/js/features/task-status.js'),drafts=read('assets/js/features/draft-recovery.js'),analytics=read('assets/js/features/analytics.js'),build=read('scripts/build-static.mjs'),core=read('assets/js/admin/core.js'),adminEntry=read('assets/js/admin/admin.js'),release='20260801-source-consolidated-r1';");
 next=next.replace("for(const token of [`RELEASE='${release}'`,'CHAT_SECONDS=45','CHAT_RECOVERY_MS','CHAT_PROMPT_SETS',' / 00:45','data-chat-next','earnchat:chat-completion-requested'])","for(const token of [`RELEASE='${release}'`,'CHAT_SECONDS=45','CHAT_RECOVERY_MS','CHAT_PROMPT_SETS',' / 00:45','data-chat-next','earnchat:chat-completion-requested','earnchat:task-started','earnchat:task-submitted'])");
 const marker="if((journey.match(/<details/g)||[]).length<3)fail.push('Upgrade detail sections are not collapsed.');";
 if(!next.includes(marker))throw new Error('Journey validation marker not found');
 next=next.replace(marker,`${marker}\nif(journey.includes("addEventListener('hashchange'"))fail.push('Upgrade module still owns a hashchange listener.');\nfor(const [name,source] of [['qualification',qualification],['task status',taskStatus]]){if(source.includes('pageshow')||source.includes('visibilitychange'))fail.push(\`\${name} module still performs lifecycle rescans.\`);if(!source.includes('earnchat:route-view'))fail.push(\`\${name} module is not route-event driven.\`);}`);
 const secretMarker="for(const secret of ['service_role','SUPABASE_SERVICE_ROLE','DATABASE_URL=','postgresql://'])if(allSource.includes(secret))fail.push(`Potential secret or privileged credential found: ${secret}`);";
 if(!next.includes(secretMarker))throw new Error('Secret validation marker not found');
 next=next.replace(secretMarker,`${secretMarker}\nfor(const staleDomain of ['earn-testsite.vercel.app','earn-test-99lc.vercel.app','www.chat-earn.xyz','chat-earn.xyz'])if(allSource.includes(staleDomain))fail.push(\`Stale or test domain remains: \${staleDomain}\`);`);
 return next;
});

console.log('Final runtime source cleanup applied.');
// Self-cleaning migration trigger.
