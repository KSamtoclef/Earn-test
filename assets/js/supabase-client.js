import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';

export const RELEASE_VERSION='20260731-lite-runtime-r3';
const loadedStyles=new Map(),loadedFeatures=new Set();

function loadStyle(href,key){
 if(loadedStyles.has(key))return loadedStyles.get(key);
 const existing=document.querySelector(`link[data-style="${key}"]`);
 if(existing){
  const ready=existing.sheet?Promise.resolve():new Promise(resolve=>{
   const done=()=>resolve();
   existing.addEventListener('load',done,{once:true});
   existing.addEventListener('error',done,{once:true});
   setTimeout(done,1800);
  });
  loadedStyles.set(key,ready);
  return ready;
 }
 const ready=new Promise(resolve=>{
  const link=document.createElement('link');
  const done=()=>resolve();
  link.rel='stylesheet';
  link.href=`${href}?v=${RELEASE_VERSION}`;
  link.dataset.style=key;
  link.addEventListener('load',done,{once:true});
  link.addEventListener('error',()=>{console.error(`Earn Chat stylesheet failed to load: ${key}`);done()},{once:true});
  document.head.appendChild(link);
  setTimeout(done,1800);
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

loadStyle('./assets/css/routes.css','routes').catch(()=>{});

const connectionError=()=>new Error('The secure account service is still connecting. Check your data connection and try again.');
function emptyQuery(){
 const result={data:[],error:null};
 const chain=new Proxy({}, {
  get(_target,key){
   if(key==='then')return(resolve)=>Promise.resolve(result).then(resolve);
   if(key==='catch')return()=>Promise.resolve(result);
   if(key==='finally')return callback=>Promise.resolve(result).finally(callback);
   return()=>chain;
  }
 });
 return chain;
}
function offlineClient(){
 return{
  auth:{
   getSession:async()=>({data:{session:null},error:null}),
   signUp:async()=>({data:null,error:connectionError()}),
   signInWithPassword:async()=>({data:null,error:connectionError()}),
   signOut:async()=>({data:null,error:null}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  },
  rpc:async()=>({data:null,error:connectionError()}),
  from:()=>({select:()=>emptyQuery()})
 };
}

export let sb=offlineClient();

function loadSdkFrom(src,timeoutMs=4500){
 return new Promise((resolve,reject)=>{
  const existing=[...document.scripts].find(script=>script.src===src||script.src.startsWith(src));
  const script=existing||document.createElement('script');
  let settled=false;
  const finish=(error=null)=>{
   if(settled)return;
   settled=true;
   clearTimeout(timer);
   error?reject(error):resolve(window.supabase);
  };
  const timer=setTimeout(()=>finish(new Error('SDK request timed out')),timeoutMs);
  if(window.supabase)return finish();
  script.addEventListener('load',()=>window.supabase?finish():finish(new Error('SDK loaded without a client')),{once:true});
  script.addEventListener('error',()=>finish(new Error('SDK request failed')),{once:true});
  if(!existing){
   script.src=src;
   script.async=true;
   script.dataset.earnchatSupabase='1';
   document.head.appendChild(script);
  }
 });
}

async function ensureSdk(){
 if(window.supabase)return window.supabase;
 const sources=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
 let lastError=null;
 for(const source of sources){
  try{const sdk=await loadSdkFrom(source);if(sdk)return sdk}catch(error){lastError=error}
 }
 throw lastError||new Error('Supabase SDK failed to initialize');
}

ensureSdk().then(sdk=>{
 sb=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});
 document.documentElement.dataset.accountService='ready';
 window.dispatchEvent(new CustomEvent('earnchat:supabase-ready'));
 setTimeout(()=>window.dispatchEvent(new Event('pageshow')),0);
}).catch(error=>{
 console.error('Earn Chat account service unavailable:',error);
 document.documentElement.dataset.accountService='offline';
});

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
