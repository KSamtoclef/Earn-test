(function(){
  'use strict';

  function loadRuntimeScript(src, dataKey){
    if(document.querySelector('script[' + dataKey + ']')) return;
    var script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.setAttribute(dataKey,'1');
    script.onerror=function(){console.error('Earn Chat runtime failed to load:',src);};
    document.head.appendChild(script);
  }

  // Critical public layout loads before any Supabase check.
  // The landing page remains usable even when the backend is disabled or unavailable.
  loadRuntimeScript('./assets/js/mobile-landing-fix.js?v=20260730-2','data-earn-chat-mobile-landing-fix');

  if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_KEY){
    console.warn('Earn Chat Supabase is not connected. Public pages remain available.');
    return;
  }

  window.BACKEND_ENABLED = true;
  window._supa = window._supa || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'earn-chat-auth-v1'
    }
  });

  function loadBackendUpgrades(){
    loadRuntimeScript('./assets/js/admin-live-upgrade.js?v=20260729-1','data-earn-chat-admin-live');
    loadRuntimeScript('./assets/js/share-message-upgrade.js?v=20260729-1','data-earn-chat-share-upgrade');
    loadRuntimeScript('./assets/js/core-flow-upgrade.js?v=20260729-1','data-earn-chat-core-flow');
    loadRuntimeScript('./assets/js/professional-five-day-upgrade.js?v=20260730-2','data-earn-chat-professional-five-day');
    loadRuntimeScript('./assets/js/sponsored-visits-upgrade.js?v=20260730-1','data-earn-chat-sponsored-visits');
  }

  function showAuthStatus(message,isError){
    var box=document.getElementById('earnchat-auth-runtime-status');
    if(!box){
      box=document.createElement('div');
      box.id='earnchat-auth-runtime-status';
      box.style.cssText='position:fixed;left:12px;right:12px;top:12px;z-index:100001;padding:12px 14px;border-radius:13px;font:600 12px/1.45 Inter,sans-serif;display:none';
      document.body.appendChild(box);
    }
    box.textContent=message||'';
    box.style.display=message?'block':'none';
    box.style.background=isError?'#fff0f2':'#eef7ff';
    box.style.color=isError?'#a52d3d':'#24598f';
    box.style.border='1px solid '+(isError?'#efb9c1':'#bfdcff');
    if(message)setTimeout(function(){box.style.display='none';},5000);
  }

  async function restoreEarnChatSession(){
    try{
      var result = await window._supa.auth.getSession();
      if(result.error) throw result.error;
      var session = result && result.data ? result.data.session : null;
      if(!session || !session.user){
        var active=document.querySelector('.page.on');
        if(!active && typeof window.pg==='function') window.pg('pg-landing');
        return;
      }

      window.S.supaId = session.user.id;
      window.S.email = session.user.email || window.S.email || '';
      var metadata = session.user.user_metadata || {};
      if(!window.S.name) window.S.name = String(metadata.full_name || window.S.email.split('@')[0] || 'Friend').split(' ')[0];

      var profile = await window.sbGetProfile(window.S.supaId);
      if(!profile){
        var repaired = await window.sbEnsureProfile(window.S.supaId, window.S.email, metadata.full_name || window.S.name);
        if(repaired && repaired.error) throw repaired.error;
        if(repaired) profile = repaired.data;
      }

      if(profile) window.applySecureProfile(profile);
      window.saveState();
      window.updateUI();
      window.dispatchEvent(new CustomEvent('earnchat:state-updated'));

      var active = document.querySelector('.page.on');
      if(active && ['pg-landing','pg-login','pg-register'].includes(active.id)) window.pg('pg-dash');
    }catch(error){
      console.error('Earn Chat session restore failed:', error);
      showAuthStatus('Secure login could not finish: '+String(error&&error.message||'unknown error'),true);
    }
  }

  window._supa.auth.onAuthStateChange(function(event, session){
    if(!session || !session.user) return;
    window.S.supaId = session.user.id;
    window.S.email = session.user.email || window.S.email || '';
    try{ window.saveState(); }catch(error){}
  });

  loadBackendUpgrades();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreEarnChatSession, {once:true});
  else restoreEarnChatSession();
})();