import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';

export const RELEASE_VERSION='20260731-lite-runtime-r2';
const loadedStyles=new Map(),loadedFeatures=new Set();

function loadStyle(href,key){
 if(loadedStyles.has(key))return loadedStyles.get(key);
 const existing=document.querySelector(`link[data-style="${key}"]`);
 if(existing){
  const ready=existing.sheet?Promise.resolve():new Promise(resolve=>{
   const done=()=>resolve();
   existing.addEventListener('load',done,{once:true});
   existing.addEventListener('error',done,{once:true});
   setTimeout(done,2500);
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
  setTimeout(done,2500);
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

function showStartupError(message){
 const loader=document.querySelector('#startup-loader');
 if(!loader)return;
 loader.classList.remove('hidden');
 loader.innerHTML=`<div class="loader-mark">EC</div><strong>Earn Chat could not connect</strong><small style="max-width:280px;text-align:center;line-height:1.45">${message}</small><button type="button" style="width:auto;min-width:150px" onclick="location.reload()">Retry</button>`;
}

function loadSdkFrom(src,timeoutMs=6500){
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  let settled=false;
  const finish=(error=null)=>{
   if(settled)return;
   settled=true;
   clearTimeout(timer);
   script.onload=null;
   script.onerror=null;
   error?reject(error):resolve(window.supabase);
  };
  const timer=setTimeout(()=>finish(new Error('SDK request timed out')),timeoutMs);
  script.src=src;
  script.async=true;
  script.dataset.earnchatSupabase='1';
  script.onload=()=>window.supabase?finish():finish(new Error('SDK loaded without a client'));
  script.onerror=()=>finish(new Error('SDK request failed'));
  document.head.appendChild(script);
 });
}

async function ensureSdk(){
 if(window.supabase)return window.supabase;
 document.querySelectorAll('script[src*="@supabase/supabase-js"]').forEach(script=>{
  if(!window.supabase)script.remove();
 });
 const sources=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@supabase/supabase-js@2'
 ];
 let lastError=null;
 for(const source of sources){
  try{
   const sdk=await loadSdkFrom(source);
   if(sdk)return sdk;
  }catch(error){lastError=error}
 }
 throw lastError||new Error('Supabase SDK failed to initialize');
}

let sdk;
try{
 sdk=await ensureSdk();
}catch(error){
 showStartupError('Your connection could not load the secure account service. Check your data connection, then tap Retry.');
 throw error;
}

export const sb=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});

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
