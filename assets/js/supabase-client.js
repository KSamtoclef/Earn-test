import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';
if(!document.querySelector('link[data-earnchat-routes]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./assets/css/routes.css?v=20260730-production-1';link.dataset.earnchatRoutes='1';document.head.appendChild(link)}
if(!window.supabase)throw new Error('Supabase SDK failed to load');
export const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});
