import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';

export const RELEASE_VERSION='20260731-final-runtime-r2';

function loadStyle(href,key){
 const existing=document.querySelector(`link[data-style="${key}"]`);
 if(existing)return existing.sheet?Promise.resolve():new Promise(resolve=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',resolve,{once:true})});
 return new Promise(resolve=>{
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`${href}?v=${RELEASE_VERSION}`;
  link.dataset.style=key;
  link.addEventListener('load',resolve,{once:true});
  link.addEventListener('error',()=>{console.error(`Earn Chat stylesheet failed to load: ${key}`);resolve()},{once:true});
  document.head.appendChild(link);
 });
}

// Every customer feature waits for its design system. Functional HTML must never render as raw, overlapping text.
await Promise.all([
 loadStyle('./assets/css/routes.css','routes'),
 loadStyle('./assets/css/professional-ui.css','professional-ui'),
 loadStyle('./assets/css/member-motivation.css','member-motivation'),
 loadStyle('./assets/css/referral-priority.css','referral-priority'),
 loadStyle('./assets/css/level-chat-experience.css','level-chat-experience')
]);

aasync function ensureSdk(){if(window.supabase)return window.supabase;await new Promise((resolve,reject)=>{let script=[...document.scripts].find(s=>s.src.includes('@supabase/supabase-js'))||document.querySelector('script[data-earnchat-supabase]');if(script){if(window.supabase){resolve();return}script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(new Error('Supabase SDK failed to load')),{once:true});return}script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.async=true;script.dataset.earnchatSupabase='1';script.onload=resolve;script.onerror=()=>reject(new Error('Supabase SDK failed to initialize'));document.head.appendChild(script)});if(!window.supabase)throw new Error('Supabase SDK failed to initialize');return window.supabase}
const sdk=await ensureSdk();
export const sb=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});

function loadFeature(src,key){if(document.querySelector(`script[data-feature="${key}"]`))return;const s=document.createElement('script');s.type='module';s.src=`${src}?v=${RELEASE_VERSION}`;s.dataset.feature=key;s.onerror=()=>console.error(`Earn Chat feature failed to load: ${key}`);document.head.appendChild(s)}
const idle=callback=>window.requestIdleCallback?requestIdleCallback(callback,{timeout:1500}):setTimeout(callback,500);
loadFeature('./assets/js/features/level-journey.js','level-journey');
loadFeature('./assets/js/features/guided-chat-experience.js','guided-chat-experience');
loadFeature('./assets/js/features/member-motivation.js','member-motivation');
loadFeature('./assets/js/features/referral-priority.js','referral-priority');
loadFeature('./assets/js/features/interaction-design.js','interaction-design');
loadFeature('./assets/js/features/draft-recovery.js','draft-recovery');
idle(()=>loadFeature('./assets/js/features/analytics.js','analytics'));
function loadRouteFeatures(){const hash=location.hash;if(hash.includes('profile'))loadFeature('./assets/js/features/qualification.js','qualification');if(hash.includes('tasks')||hash.includes('visits'))loadFeature('./assets/js/features/task-status.js','task-status')}
window.addEventListener('hashchange',loadRouteFeatures);loadRouteFeatures();
