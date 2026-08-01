import fs from'node:fs';

function patch(path,changes){
 let source=fs.readFileSync(path,'utf8');
 for(const [from,to,label] of changes){
  if(!source.includes(from))throw new Error(`Missing ${label} in ${path}`);
  source=source.replace(from,to);
 }
 fs.writeFileSync(path,source);
}

patch('assets/js/api.js',[
 ["const MEMBER_CACHE_MS=10000,CONFIG_CACHE_MS=60000,ADMIN_CACHE_MS=12000;\nlet memberCache=null,memberAt=0,memberPromise=null,memberOwner=null;\nlet configCache=null,configAt=0,configPromise=null;",
  "const MEMBER_CACHE_MS=10000,CONFIG_CACHE_MS=300000,ADMIN_CACHE_MS=12000,CONFIG_STORAGE_KEY='earnchat-business-config:v1';\nlet memberCache=null,memberAt=0,memberPromise=null,memberOwner=null;\nlet configCache=null,configAt=0,configPromise=null;\ntry{const saved=JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY)||'null');if(saved?.data){configCache=saved.data;configAt=Number(saved.savedAt||0)}}catch{}",
  'persistent configuration cache'],
 ["export function invalidateBusinessConfig(section='all'){\n  configCache=null;configAt=0;configPromise=null;\n  window.dispatchEvent(new CustomEvent('earnchat:config-invalidated',{detail:{section}}));\n}",
  "export function invalidateBusinessConfig(section='all',notify=true){\n  configCache=null;configAt=0;configPromise=null;\n  if(notify)window.dispatchEvent(new CustomEvent('earnchat:config-invalidated',{detail:{section}}));\n}\nfunction storeBusinessConfig(data){\n  configCache=data;configAt=Date.now();\n  try{localStorage.setItem(CONFIG_STORAGE_KEY,JSON.stringify({savedAt:configAt,data}))}catch{}\n  return data;\n}",
  'silent invalidation and storage'],
 ["  const request=rpc('get_earnchat_business_config').then(data=>{\n    configCache=data;configAt=Date.now();\n    window.dispatchEvent(new CustomEvent('earnchat:config-updated',{detail:{version:data?.version||data?.settings?.version||null,section:'all',config:data,updated_at:data?.updated_at||data?.settings?.updated_at||null}}));\n    return data;\n  });",
  "  const request=rpc('get_earnchat_business_config').then(storeBusinessConfig);",
  'non-broadcasting configuration read'],
 ["  if(options.config)invalidateBusinessConfig(options.section||'all');\n  if(options.member)invalidateMemberState();\n  if(options.event)window.dispatchEvent(new CustomEvent(options.event,{detail:{data,section:options.section||null}}));\n  return data;",
  "  let result=data;\n  if(options.config){\n    invalidateBusinessConfig(options.section||'all',false);\n    result=await businessConfig(true);\n    window.dispatchEvent(new CustomEvent('earnchat:config-updated',{detail:{version:result?.configuration_version||result?.version||null,section:options.section||'all',config:result,updated_at:result?.updated_at||result?.settings?.updated_at||null}}));\n  }\n  if(options.member)invalidateMemberState();\n  if(options.event)window.dispatchEvent(new CustomEvent(options.event,{detail:{data:result,section:options.section||null}}));\n  return result;",
  'authoritative post-mutation refresh']
]);

patch('assets/js/admin/configuration.js',[
 ["const config=normalizeBusinessConfig(await api.business(true));","const config=normalizeBusinessConfig(await api.business());",'cached configuration read'],
 [";window.dispatchEvent(new CustomEvent('earnchat:config-updated',{detail:{section:sectionName,config:response,version:response?.configuration_version||response?.version||null,updated_at:response?.updated_at||null}}))","",'duplicate configuration event']
]);

patch('assets/js/app.js',[
 ["async function boot(){const ref=new URLSearchParams(location.search).get('ref');if(ref)sessionStorage.setItem('earnchat-ref',ref);if(!localStorage.getItem('earnchat-country')){app.suggestedCountry=inferCountry();app.country=app.suggestedCountry}else app.suggestedCountry=app.country;bind();configureRouter({isAuthenticated:loggedIn,routeHandler:onRoute});try{app.config=normalizeBusinessConfig(await api.business())}catch{app.config=normalizeBusinessConfig(app.config||{})}try{const result=await api.session();app.session=result.session||null;app.user=app.session?.user||null;if(app.session){await api.ensureProfile(null,null);await applyPendingReferral();await refreshState()}}catch{}finally{renderSignupCountry();$('#startup-loader').classList.add('hidden');resolveRoute();if(!loggedIn())showCountrySuggestion();startPresence()}",
  "async function boot(){const ref=new URLSearchParams(location.search).get('ref');if(ref)sessionStorage.setItem('earnchat-ref',ref);if(!localStorage.getItem('earnchat-country')){app.suggestedCountry=inferCountry();app.country=app.suggestedCountry}else app.suggestedCountry=app.country;bind();configureRouter({isAuthenticated:loggedIn,routeHandler:onRoute});try{const saved=JSON.parse(localStorage.getItem('earnchat-business-config:v1')||'null');app.config=normalizeBusinessConfig(saved?.data||{})}catch{app.config=normalizeBusinessConfig({})}renderLanding();renderSignupCountry();const configRefresh=api.business().then(data=>{app.config=normalizeBusinessConfig(data);renderSignupCountry();const route=document.body.dataset.route||'landing';if(route!=='admin')return onRoute(route)}).catch(()=>{});try{const result=await api.session();app.session=result.session||null;app.user=app.session?.user||null;if(app.session){await api.ensureProfile(null,null);await applyPendingReferral();await refreshState()}}catch{}finally{$('#startup-loader').classList.add('hidden');resolveRoute();if(!loggedIn())showCountrySuggestion();startPresence();void configRefresh}",
  'fast cached startup'],
 ["window.addEventListener('earnchat:config-updated',event=>{if(event.detail?.config)app.config=normalizeBusinessConfig(event.detail.config);const route=document.body.dataset.route||'landing';Promise.resolve(onRoute(route)).catch(error=>console.error('Configuration refresh failed:',error))});",
  "window.addEventListener('earnchat:config-updated',event=>{if(event.detail?.config)app.config=normalizeBusinessConfig(event.detail.config);const route=document.body.dataset.route||'landing';if(route==='admin')return;Promise.resolve(onRoute(route)).catch(error=>console.error('Configuration refresh failed:',error))});",
  'admin-safe configuration update'],
 ["window.addEventListener('earnchat:config-invalidated',async()=>{try{app.config=normalizeBusinessConfig(await api.refreshBusiness())}catch{return}const route=document.body.dataset.route||'landing';Promise.resolve(onRoute(route)).catch(error=>console.error('Configuration refresh failed:',error))});",
  "window.addEventListener('earnchat:config-invalidated',async()=>{try{app.config=normalizeBusinessConfig(await api.refreshBusiness())}catch{return}const route=document.body.dataset.route||'landing';if(route==='admin')return;Promise.resolve(onRoute(route)).catch(error=>console.error('Configuration refresh failed:',error))});",
  'admin-safe invalidation refresh']
]);

// Triggered after the workflow was installed.
