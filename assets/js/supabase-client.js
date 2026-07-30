import{SUPABASE_URL,SUPABASE_ANON_KEY}from'./app-config.js';
if(!window.supabase)throw new Error('Supabase SDK failed to load');
export const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'earn-chat-production-auth'}});
