(function(){
  'use strict';

  window.EARNCHAT_BUILD='2026-07-30-performance-1';

  function loadRuntimeScript(src, dataKey){
    if(document.querySelector('script[' + dataKey + ']')) return Promise.resolve();
    return new Promise(function(resolve){
      var script=document.createElement('script');
      script.src=src;
      script.async=true;
      script.setAttribute(dataKey,'1');
      script.onload=resolve;
      script.onerror=function(){console.error('Earn Chat runtime failed to load:',src);resolve();};
      document.head.appendChild(script);
    });
  }

  function openPage(pageId){
    ensureAppExperience();
    if(typeof window.pg==='function'){
      window.pg(pageId);
      return;
    }
    document.querySelectorAll('.page').forEach(function(page){page.classList.remove('on');});
    var target=document.getElementById(pageId);
    if(target){target.classList.add('on');window.scrollTo(0,0);}
  }

  function stabilisePublicUi(){
    var style=document.getElementById('earnchat-public-stability');
    if(!style){
      style=document.createElement('style');
      style.id='earnchat-public-stability';
      style.textContent='#land-signup-btn,#land-signup-btn2,#land-login-btn{position:relative!important;z-index:20!important;pointer-events:auto!important;touch-action:manipulation!important}#pg-landing{pointer-events:auto!important}';
      document.head.appendChild(style);
    }

    var hero=document.querySelector('#pg-landing .hero p');
    if(hero) hero.innerHTML='Complete guided conversations and daily activities.<br>Earn <strong style="color:#12aa82;">₦2,500</strong> per completed guided chat, within your five-day daily limit.';
    var stat=document.querySelector('#pg-landing .big-stats .bs-card:first-child .bs-val');
    if(stat) stat.textContent='₦2,500';
    var label=document.querySelector('#pg-landing .big-stats .bs-card:first-child .bs-lbl');
    if(label) label.textContent='Per Guided Chat';

    document.querySelectorAll('#land-signup-btn,#land-signup-btn2').forEach(function(button){
      if(button.dataset.ecPublicBound) return;
      button.dataset.ecPublicBound='1';
      button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openPage('pg-register');},true);
    });
    var login=document.getElementById('land-login-btn');
    if(login&&!login.dataset.ecPublicBound){
      login.dataset.ecPublicBound='1';
      login.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();openPage('pg-login');},true);
    }
  }

  var appExperiencePromise=null;
  function ensureAppExperience(){
    if(appExperiencePromise) return appExperiencePromise;
    appExperiencePromise=Promise.all([
      loadRuntimeScript('./assets/js/core-flow-upgrade.js?v=20260730-3','data-earn-chat-core-flow'),
      loadRuntimeScript('./assets/js/professional-five-day-upgrade.js?v=20260730-4','data-earn-chat-professional-five-day'),
      loadRuntimeScript('./assets/js/sponsored-visits-upgrade.js?v=20260730-3','data-earn-chat-sponsored-visits'),
      loadRuntimeScript('./assets/js/share-message-upgrade.js?v=20260730-1','data-earn-chat-share-upgrade')
    ]);
    return appExperiencePromise;
  }
  window.ensureEarnChatAppExperience=ensureAppExperience;

  // Only the lightweight landing design is required on first paint.
  loadRuntimeScript('./assets/js/mobile-landing-fix.js?v=20260730-5','data-earn-chat-mobile-landing-fix');
  if(location.hash==='#admin'||location.hash==='#admin-panel'){
    loadRuntimeScript('./assets/js/admin-live-upgrade.js?v=20260729-1','data-earn-chat-admin-live');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',stabilisePublicUi,{once:true});
  else stabilisePublicUi();

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
      if(!session || !session.user) return;

      await ensureAppExperience();
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
    ensureAppExperience();
    window.S.supaId = session.user.id;
    window.S.email = session.user.email || window.S.email || '';
    try{ window.saveState(); }catch(error){}
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreEarnChatSession, {once:true});
  else restoreEarnChatSession();
})();