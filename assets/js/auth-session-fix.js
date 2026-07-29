(function(){
  'use strict';

  if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_KEY) return;

  window.BACKEND_ENABLED = true;
  window._supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'earn-chat-auth-v1'
    }
  });

  function loadRuntimeScript(src, dataKey){
    if(document.querySelector('script[' + dataKey + ']')) return;
    var script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.setAttribute(dataKey,'1');
    document.head.appendChild(script);
  }

  function loadRuntimeUpgrades(){
    loadRuntimeScript('./assets/js/admin-live-upgrade.js?v=20260729-1','data-earn-chat-admin-live');
    loadRuntimeScript('./assets/js/share-message-upgrade.js?v=20260729-1','data-earn-chat-share-upgrade');
  }

  async function restoreEarnChatSession(){
    try{
      var result = await window._supa.auth.getSession();
      var session = result && result.data ? result.data.session : null;
      if(!session || !session.user) return;

      window.S.supaId = session.user.id;
      window.S.email = session.user.email || window.S.email || '';

      var metadata = session.user.user_metadata || {};
      if(!window.S.name){
        window.S.name = String(metadata.full_name || window.S.email.split('@')[0] || 'Friend').split(' ')[0];
      }

      var profile = await window.sbGetProfile(window.S.supaId);
      if(!profile){
        var repaired = await window.sbEnsureProfile(window.S.supaId, window.S.email, metadata.full_name || window.S.name);
        if(repaired && !repaired.error) profile = repaired.data;
      }

      if(profile) window.applySecureProfile(profile);
      window.saveState();
      window.updateUI();

      var active = document.querySelector('.page.on');
      if(active && ['pg-landing','pg-login','pg-register'].includes(active.id)) window.pg('pg-dash');
    }catch(error){
      console.warn('Earn Chat session restore failed:', error);
    }
  }

  window._supa.auth.onAuthStateChange(function(event, session){
    if(!session || !session.user) return;
    window.S.supaId = session.user.id;
    window.S.email = session.user.email || window.S.email || '';
    try{ window.saveState(); }catch(error){}
  });

  loadRuntimeUpgrades();

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', restoreEarnChatSession, {once:true});
  }else{
    restoreEarnChatSession();
  }
})();
