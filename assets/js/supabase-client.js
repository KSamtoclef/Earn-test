import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';
if(!document.querySelector('link[data-earnchat-routes]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./assets/css/routes.css?v=20260730-production-1';link.dataset.earnchatRoutes='1';document.head.appendChild(link)}
if(!window.supabase)throw new Error('Supabase SDK failed to load');
export const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});
function loadFeature(src,key){if(document.querySelector(`script[data-feature="${key}"]`))return;const s=document.createElement('script');s.type='module';s.src=src;s.dataset.feature=key;document.head.appendChild(s)}
const loadOptional=()=>{loadFeature('./assets/js/features/analytics.js?v=20260730-production-1','analytics');loadFeature('./assets/js/features/feedback.js?v=20260730-production-1','feedback');loadFeature('./assets/js/features/qualification.js?v=20260730-production-1','qualification')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loadOptional,0),{once:true});else setTimeout(loadOptional,0);
