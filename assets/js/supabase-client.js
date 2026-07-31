import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';

export const RELEASE_VERSION='20260731-production-certification-r1';
if(!document.querySelector('link[data-earnchat-routes]')){const link=document.createElement('link');link.rel='stylesheet';link.href=`./assets/css/routes.css?v=${RELEASE_VERSION}`;link.dataset.earnchatRoutes='1';document.head.appendChild(link)}

async function ensureSdk(){if(window.supabase)return window.supabase;await new Promise((resolve,reject)=>{let script=[...document.scripts].find(s=>s.src.includes('@supabase/supabase-js'))||document.querySelector('script[data-earnchat-supabase]');if(script){if(window.supabase){resolve();return}script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(new Error('Supabase SDK failed to load')),{once:true});return}script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.async=true;script.dataset.earnchatSupabase='1';script.onload=resolve;script.onerror=()=>reject(new Error('Supabase SDK failed to load'));document.head.appendChild(script)});if(!window.supabase)throw new Error('Supabase SDK failed to initialize');return window.supabase}
const sdk=await ensureSdk();
export const sb=sdk.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});

function loadFeature(src,key){if(document.querySelector(`script[data-feature="${key}"]`))return;const s=document.createElement('script');s.type='module';s.src=`${src}?v=${RELEASE_VERSION}`;s.dataset.feature=key;s.onerror=()=>console.error(`Earn Chat feature failed to load: ${key}`);document.head.appendChild(s)}
const idle=callback=>window.requestIdleCallback?requestIdleCallback(callback,{timeout:1500}):setTimeout(callback,500);
idle(()=>loadFeature('./assets/js/features/analytics.js','analytics'));
function loadRouteFeatures(){const hash=location.hash;if(hash.includes('profile'))loadFeature('./assets/js/features/qualification.js','qualification');if(hash.includes('tasks')||hash.includes('visits'))loadFeature('./assets/js/features/task-status.js','task-status')}
window.addEventListener('hashchange',loadRouteFeatures);loadRouteFeatures();
