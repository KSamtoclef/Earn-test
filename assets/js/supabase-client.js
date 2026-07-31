import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';

export const RELEASE_VERSION='20260731-lite-runtime-r1';
const loadedStyles=new Map(),loadedFeatures=new Set();

function loadStyle(href,key){
 if(loadedStyles.has(key))return loadedStyles.get(key);
 const existing=document.querySelector(`link[data-style="${key}"]`);
 if(existing){const ready=existing.sheet?Promise.resolve():new Promise(resolve=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})});loadedStyles.set(key,ready);return ready}
 const ready=new Promise(resolve=>{
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`${href}?v=${RELEASE_VERSION}`;
  link.dataset.style=key;
  link.onload=resolve;
  link.onerror=()=>{console.error(`Earn Chat stylesheet failed to load: ${key}`);resolve()};
  document.head.appendChild(link);
 });
 loadedStyles.set(key,ready);
 return ready;
}

function loadFeature(src,key,style=null){
 if(loadedFeatures.has(key)||document.querySelector(`script[data-feature="${key}"]`))return;
 loadedFeatures.add(key);
 const start=()=>{
  const script=document.createElement('script');
  script.type='module';
  script.src=`${src}?v=${RELEASE_VERSION}`;
  script.dataset.feature=key;
  script.onerror=()=>console.error(`Earn Chat feature failed to load: ${key}`);
  document.head.appendChild(script);
 };
 style?style.then(start):start();
}

const routesStyle=loadStyle('./assets/css/routes.css','routes');

async function ensureSdk(){
 if(window.supabase)return window.supabase;
 await new Promise((resolve,reject)=>{
  let script=[...document.scripts].find(item=>item.src.includes('@supabase/supabase-js'))||document.querySelector('script[data-earnchat-supabase]');
  if(script){
   if(window.supabase)return resolve();
   script.addEventListener('load',resolve,{once:true});
   script.addEventListener('error',()=>reject(new Error('Supabase SDK failed to load')),{once:true});
   return;
  }
  script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.async=true;
  script.dataset.earnchatSupabase='1';
  script.onload=resolve;
  script.onerror=()=>reject(new Error('Supabase SDK failed to initialize'));
  document.head.appendChild(script);
 });
 if(!window.supabase)throw new Error('Supabase SDK failed to initialize');
 return window.supabase;
}

const sdk=await ensureSdk();
export const sb=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});
routesStyle.catch(()=>{});

const idle=callback=>window.requestIdleCallback?requestIdleCallback(callback,{timeout:4000}):setTimeout(callback,1800);
const routeName=()=>location.hash.replace(/^#\/?/,'').split('?')[0]||'landing';

function loadRouteFeatures(){
 const route=routeName();
 const authenticated=!['landing','register','login'].includes(route);

 if(authenticated){
  const levelStyle=loadStyle('./assets/css/level-chat-experience.css','level-chat-experience');
  loadFeature('./assets/js/features/level-journey.js','level-journey',levelStyle);
 }

 if(['home','earn','chat'].includes(route))loadFeature('./assets/js/features/guided-chat-experience.js','guided-chat-experience');

 if(['landing','register','home','referrals'].includes(route)){
  const motivationStyle=loadStyle('./assets/css/member-motivation.css','member-motivation');
  loadFeature('./assets/js/features/member-motivation.js','member-motivation',motivationStyle);
 }

 if(['home','referrals'].includes(route)){
  const referralStyle=loadStyle('./assets/css/referral-priority.css','referral-priority');
  loadFeature('./assets/js/features/referral-priority.js','referral-priority',referralStyle);
 }

 if(route==='profile')loadFeature('./assets/js/features/qualification.js','qualification');
 if(route==='tasks'||route==='visits')loadFeature('./assets/js/features/task-status.js','task-status');
 if(['register','tasks','visits','profile','admin'].includes(route))loadFeature('./assets/js/features/draft-recovery.js','draft-recovery');
}

window.addEventListener('hashchange',loadRouteFeatures,{passive:true});
loadRouteFeatures();
idle(()=>loadFeature('./assets/js/features/analytics.js','analytics'));
