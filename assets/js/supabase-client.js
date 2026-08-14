import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';

export const RELEASE_VERSION='20260812-professional-r3';

// The public homepage must never remain behind the startup screen while the
// account service is initializing. Protected routes still use the normal auth
// and Supabase readiness flow.
function releasePublicStartupLoader(){
  const route=location.hash.replace(/^#\/?/,'').split('?')[0]||'landing';
  if(!['landing','register','login'].includes(route))return;
  const release=()=>document.getElementById('startup-loader')?.classList.add('hidden');
  setTimeout(release,300);
}
releasePublicStartupLoader();

const stylePromises=new Map(),modulePromises=new Map();

function loadStyle(href,key){if(stylePromises.has(key))return stylePromises.get(key);const promise=new Promise(resolve=>{const existing=document.querySelector(`link[data-style="${key}"]`);if(existing){if(existing.sheet)return resolve(existing);const done=()=>resolve(existing);existing.addEventListener('load',done,{once:true});existing.addEventListener('error',done,{once:true});setTimeout(done,1200);return}const link=document.createElement('link');const done=()=>resolve(link);link.rel='stylesheet';link.href=`${href}?v=${RELEASE_VERSION}`;link.dataset.style=key;link.addEventListener('load',done,{once:true});link.addEventListener('error',()=>{console.warn(`Earn Chat stylesheet failed: ${key}`);done()},{once:true});document.head.appendChild(link);setTimeout(done,1200)});stylePromises.set(key,promise);return promise}
function loadFeature(src,key,stylePromise=null,{critical=false}={}){if(modulePromises.has(key))return modulePromises.get(key);const promise=(stylePromise||Promise.resolve()).then(()=>import(`${src}?v=${RELEASE_VERSION}`)).catch(error=>{modulePromises.delete(key);if(critical)throw error;console.warn(`Earn Chat optional feature failed: ${key}`,error);return null});modulePromises.set(key,promise);return promise}
loadStyle('./assets/css/routes.css','routes').catch(()=>{});
const connectionError=()=>new Error('The secure account service is still connecting. Check your data connection and try again.');
function emptyQuery(){const result={data:[],error:null};const chain=new Proxy({},{get(_target,key){if(key==='then')return resolve=>Promise.resolve(result).then(resolve);if(key==='catch')return()=>Promise.resolve(result);if(key==='finally')return callback=>Promise.resolve(result).finally(callback);return()=>chain}});return chain}
function offlineClient(){return{auth:{getSession:async()=>({data:{session:null},error:null}),signUp:async()=>({data:null,error:connectionError()}),signInWithPassword:async()=>({data:null,error:connectionError()}),signOut:async()=>({data:null,error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async()=>({data:null,error:connectionError()}),from:()=>({select:()=>emptyQuery()})}}
export let sb=offlineClient();
function loadSdkFrom(src,timeoutMs=4200){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(script=>script.src===src||script.src.startsWith(src)),script=existing||document.createElement('script');let settled=false;const finish=(error=null)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(window.supabase)},timer=setTimeout(()=>finish(new Error('SDK request timed out')),timeoutMs);if(window.supabase)return finish();script.addEventListener('load',()=>window.supabase?finish():finish(new Error('SDK loaded without a client')),{once:true});script.addEventListener('error',()=>finish(new Error('SDK request failed')),{once:true});if(!existing){script.src=src;script.async=true;script.dataset.earnchatSupabase='1';document.head.appendChild(script)}})}
async function ensureSdk(){if(window.supabase)return window.supabase;let lastError=null;for(const source of['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2']){try{const sdk=await loadSdkFrom(source);if(sdk)return sdk}catch(error){lastError=error}}throw lastError||new Error('Supabase SDK failed to initialize')}
ensureSdk().then(sdk=>{sb=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});document.documentElement.dataset.accountService='ready';window.dispatchEvent(new CustomEvent('earnchat:supabase-ready'));setTimeout(()=>window.dispatchEvent(new Event('pageshow')),0)}).catch(error=>{console.error('Earn Chat account service unavailable:',error);document.documentElement.dataset.accountService='offline'});
const idle=(callback,timeout=1800)=>window.requestIdleCallback?requestIdleCallback(callback,{timeout}):setTimeout(callback,350);
const routeName=()=>location.hash.replace(/^#\/?/,'').split('?')[0]||'landing';
const CUSTOMER_ROUTES=new Set(['home','earn','chat','upgrade','visits','referrals','withdraw','profile']);
function levelFeature(immediate=false){const style=loadStyle('./assets/css/level-chat-experience.css','level-chat-experience');const run=()=>loadFeature('./features/level-journey.js','level-journey',style,{critical:true});immediate?run():idle(run,900)}
function loadRouteFeatures(){const route=routeName();if(route==='upgrade')levelFeature(true);else if(CUSTOMER_ROUTES.has(route))levelFeature(false);if(['landing','register','home','referrals'].includes(route)){const style=loadStyle('./assets/css/member-motivation.css','member-motivation');loadFeature('./features/member-motivation.js','member-motivation',style)}if(['home','referrals'].includes(route)){const style=loadStyle('./assets/css/referral-priority.css','referral-priority');idle(()=>loadFeature('./features/referral-priority.js','referral-priority',style),1200)}if(route==='profile')loadFeature('./features/qualification.js','qualification');if(route==='visits')loadFeature('./features/task-status.js','task-status');if(['register','visits','profile','admin'].includes(route))idle(()=>loadFeature('./features/draft-recovery.js','draft-recovery'),1200)}
window.addEventListener('hashchange',loadRouteFeatures,{passive:true});
loadRouteFeatures();
loadFeature('./features/ui-redesign.js','ui-redesign');
idle(()=>loadFeature('./features/analytics.js','analytics'),4500);
