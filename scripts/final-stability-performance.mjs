import fs from'node:fs';

function edit(path,fn){const before=fs.readFileSync(path,'utf8');const after=fn(before);if(after===before)throw new Error(`No changes made to ${path}`);fs.writeFileSync(path,after)}
function mustReplace(source,from,to,label){if(!source.includes(from))throw new Error(`Missing ${label}`);return source.replace(from,to)}

edit('assets/js/api.js',source=>{
 source=mustReplace(source,
  "const unwrap=result=>{if(result.error)throw result.error;return result.data};\nconst rpc=(name,args={})=>sb.rpc(name,args).then(unwrap);",
  "const unwrap=result=>{if(result.error)throw result.error;return result.data};\nconst withTimeout=(promise,ms=15000,label='Request')=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out. Check your connection and retry.`)),ms))]);\nconst rpc=(name,args={})=>withTimeout(sb.rpc(name,args).then(unwrap),15000,'Supabase request');",
  'RPC timeout');
 source=mustReplace(source,
  "let adminOverviewCache=null,adminOverviewAt=0,adminOverviewPromise=null;",
  "let adminOverviewCache=null,adminOverviewAt=0,adminOverviewPromise=null;\nlet adminStatusCache=null,adminStatusAt=0,adminStatusOwner=null,adminStatusPromise=null;",
  'admin status cache state');
 source=mustReplace(source,
  "export function invalidateAdminOverview(){adminOverviewCache=null;adminOverviewAt=0;adminOverviewPromise=null}",
  "export function invalidateAdminOverview(){adminOverviewCache=null;adminOverviewAt=0;adminOverviewPromise=null}\nfunction invalidateAdminStatus(){adminStatusCache=null;adminStatusAt=0;adminStatusOwner=null;adminStatusPromise=null}",
  'admin status invalidator');
 const marker="async function adminOverview(force=false){";
 const insert=`async function adminStatus(force=false){\n  const owner=await sessionUserId();\n  if(!owner){invalidateAdminStatus();return false}\n  if(adminStatusOwner&&adminStatusOwner!==owner)invalidateAdminStatus();\n  if(!force&&adminStatusCache!==null&&adminStatusOwner===owner&&Date.now()-adminStatusAt<300000)return adminStatusCache;\n  if(adminStatusPromise&&adminStatusOwner===owner)return adminStatusPromise;\n  adminStatusOwner=owner;\n  const request=rpc('earnchat_is_admin').then(value=>{adminStatusCache=!!value;adminStatusAt=Date.now();return adminStatusCache});\n  adminStatusPromise=request;\n  try{return await request}finally{if(adminStatusPromise===request)adminStatusPromise=null}\n}\n`;
 if(!source.includes(marker))throw new Error('Missing adminOverview marker');
 source=source.replace(marker,insert+marker);
 source=mustReplace(source,
  "logout:async()=>{try{return unwrap(await sb.auth.signOut())}finally{invalidateMemberState();invalidateAdminOverview()}},",
  "logout:async()=>{try{return unwrap(await sb.auth.signOut())}finally{invalidateMemberState();invalidateAdminOverview();invalidateAdminStatus()}},",
  'logout cache cleanup');
 source=mustReplace(source,
  "business:businessConfig,\n refreshBusiness:()=>businessConfig(true),",
  "business:businessConfig,\n peekBusiness:()=>configCache,\n refreshBusiness:()=>businessConfig(true),",
  'configuration peek');
 source=mustReplace(source,"isAdmin:async()=>rpc('earnchat_is_admin'),","isAdmin:adminStatus,",'cached admin authorization');
 return source;
});

edit('assets/js/admin/configuration.js',source=>{
 source=mustReplace(source,
  " target.innerHTML='<article class=\"card\"><b>Loading authoritative configuration…</b></article>';\n try{\n  const config=normalizeBusinessConfig(await api.business());",
  " const cached=api.peekBusiness?.();\n if(!cached)target.innerHTML='<article class=\"card\"><b>Loading authoritative configuration…</b></article>';\n try{\n  const config=normalizeBusinessConfig(cached||await api.business());",
  'instant cached configuration paint');
 return source;
});

edit('assets/js/admin/core.js',source=>{
 source=mustReplace(source,"let usersCache=[],renderToken=0;","let usersCache=[],renderToken=0,lastRenderedTab=null;",'admin render state');
 source=mustReplace(source,
  "function setTab(next){tab=TABS.includes(next)?next:'overview';sessionStorage.setItem('earnchat-admin-tab',tab);renderAdmin()}",
  "function setTab(next){const resolved=TABS.includes(next)?next:'overview';if(resolved===tab&&lastRenderedTab===tab)return;tab=resolved;sessionStorage.setItem('earnchat-admin-tab',tab);renderAdmin()}",
  'same-tab guard');
 const pattern=/export async function renderAdmin\(\)\{[^\n]*\n?/;
 const match=source.match(pattern);
 if(!match)throw new Error('Missing renderAdmin function');
 const replacement="export async function renderAdmin(){const token=++renderToken,current=tab;renderNavigation();if(lastRenderedTab!==current||!host()?.children.length)loading();try{const needsUsers=new Set(['live','users','claims','chats','referrals','qualifications','withdrawals','kyc','analytics','audit']).has(current);const [allowed]=await Promise.all([api.isAdmin(),needsUsers?loadUsers():Promise.resolve(null)]);if(!allowed)throw new Error('Administrator permission required');if(token!==renderToken)return;const renderers={overview,live,users,tasks,claims,chats,referrals,qualifications,withdrawals,kyc,payments,configuration:renderConfiguration,analytics,audit};await renderers[current]();if(token!==renderToken)return;lastRenderedTab=current;document.dispatchEvent(new CustomEvent('earnchat:form-rendered',{detail:{root:host()}}))}catch(error){if(token===renderToken)fail(error)}}\n";
 source=source.replace(pattern,replacement);
 return source;
});

edit('assets/js/app.js',source=>{
 source=mustReplace(source,
  "const app={session:null,user:null,state:null,profile:null,config:null,country:countryFromStorage(),suggestedCountry:null,taskClaim:null,chat:null,chatTimer:null,presenceTimer:null,explicitLogout:false,authVerifyTimer:null,adminModule:null};",
  "const app={session:null,user:null,state:null,profile:null,config:null,country:countryFromStorage(),suggestedCountry:null,taskClaim:null,chat:null,chatTimer:null,presenceTimer:null,explicitLogout:false,authVerifyTimer:null,sessionVerifyPromise:null,lastSessionVerifiedAt:0,adminModule:null};",
  'session verification state');
 const old=`function startPresence(){clearInterval(app.presenceTimer);app.presenceTimer=setInterval(()=>{if(!document.hidden)sendPresence()},60000);document.addEventListener('visibilitychange',()=>{if(document.hidden)api.presenceInactive(presenceSession).catch(()=>{});else{verifySession();sendPresence()}});window.addEventListener('focus',verifySession);window.addEventListener('pageshow',verifySession);window.addEventListener('pagehide',()=>api.presenceInactive(presenceSession).catch(()=>{})}\nasync function verifySession(){if(app.explicitLogout)return false;try{const result=await api.session(),session=result.session||null;if(session?.user){app.session=session;app.user=session.user;await api.ensureProfile(null,null);await applyPendingReferral();await refreshState();return true}app.session=null;app.user=null;app.state=null;app.profile=null;resolveRoute();return false}catch{return loggedIn()}}`;
 const next=`function startPresence(){clearInterval(app.presenceTimer);app.presenceTimer=setInterval(()=>{if(!document.hidden)sendPresence()},60000);document.addEventListener('visibilitychange',()=>{if(document.hidden)api.presenceInactive(presenceSession).catch(()=>{});else{void verifySession();sendPresence()}});window.addEventListener('focus',()=>void verifySession());window.addEventListener('pageshow',()=>void verifySession());window.addEventListener('pagehide',()=>api.presenceInactive(presenceSession).catch(()=>{})}\nasync function verifySession(force=false){if(app.explicitLogout)return false;if(!force&&Date.now()-app.lastSessionVerifiedAt<30000)return loggedIn();if(app.sessionVerifyPromise)return app.sessionVerifyPromise;const previousId=app.user?.id||null;const request=(async()=>{try{const result=await api.session(),session=result.session||null,nextId=session?.user?.id||null;app.lastSessionVerifiedAt=Date.now();if(nextId){app.session=session;app.user=session.user;if(!app.state||nextId!==previousId){await api.ensureProfile(null,null);await applyPendingReferral();await refreshState();resolveRoute()}return true}if(previousId||loggedIn()){app.session=null;app.user=null;app.state=null;app.profile=null;resolveRoute()}return false}catch{return loggedIn()}})();app.sessionVerifyPromise=request;try{return await request}finally{if(app.sessionVerifyPromise===request)app.sessionVerifyPromise=null}}`;
 source=mustReplace(source,old,next,'throttled session verification');
 source=mustReplace(source,
  "sb.auth.onAuthStateChange((event,session)=>{clearTimeout(app.authVerifyTimer);if(event==='SIGNED_OUT'){if(app.explicitLogout)return;app.authVerifyTimer=setTimeout(verifySession,500);return}if(session?.user){app.session=session;app.user=session.user;app.authVerifyTimer=setTimeout(async()=>{try{await refreshState();resolveRoute()}catch{}},0)}})",
  "sb.auth.onAuthStateChange((event,session)=>{clearTimeout(app.authVerifyTimer);if(event==='SIGNED_OUT'){if(app.explicitLogout)return;app.authVerifyTimer=setTimeout(()=>verifySession(true),500);return}if(session?.user){const changed=app.user?.id!==session.user.id;app.session=session;app.user=session.user;if(changed||!app.state)app.authVerifyTimer=setTimeout(async()=>{try{await refreshState();resolveRoute()}catch{}},0)}})",
  'non-rerendering auth refresh');
 return source;
});

edit('assets/css/app.css',source=>source+`\n/* Final Admin stability and mobile readability */\n.admin-config-section{background:#fff;border:1px solid var(--line);border-radius:20px;margin:12px 0;overflow:hidden}\n.admin-config-section>summary{display:flex;align-items:flex-start;gap:12px;padding:17px 18px;cursor:pointer;list-style:none}\n.admin-config-section>summary::-webkit-details-marker{display:none}\n.admin-config-section>summary:before{content:'›';font-size:24px;font-weight:900;line-height:1;transform:rotate(0deg);transition:transform .15s ease}\n.admin-config-section[open]>summary:before{transform:rotate(90deg)}\n.admin-config-section>summary span{display:grid;gap:4px;min-width:0}\n.admin-config-section>summary b{display:block;font-size:18px;line-height:1.25}\n.admin-config-section>summary small{display:block;color:var(--muted);font-size:13px;line-height:1.4}\n.admin-config-form,.level-config-list{padding:0 18px 18px}\n@media(max-width:600px){.admin-config-section>summary{padding:15px}.admin-config-form,.level-config-list{padding:0 15px 15px}}\n`);
