(function(){
  'use strict';

  var profileChannel = null;
  var lastFullSyncAt = null;
  var fullSyncTimer = null;

  function adminOpen(){
    return !!window.adminLoggedIn && document.getElementById('pg-admin') && document.getElementById('pg-admin').classList.contains('on');
  }

  function refreshAdmin(reason){
    if(!adminOpen() || typeof window.renderAdminPanel !== 'function') return;
    clearTimeout(fullSyncTimer);
    fullSyncTimer = setTimeout(async function(){
      try{
        await window.renderAdminPanel();
        lastFullSyncAt = new Date();
        var el = document.getElementById('adm-live-updated');
        if(el && !el.textContent.includes('Full sync')){
          el.textContent += ' · Full sync ' + lastFullSyncAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
        }
      }catch(error){
        console.warn('Admin refresh failed (' + (reason || 'unknown') + '):', error);
      }
    }, 250);
  }

  var originalStart = window.startAdminRealtime;
  window.startAdminRealtime = function(){
    if(typeof originalStart === 'function') originalStart();
    if(!window._supa) return;

    if(profileChannel){
      try{ window._supa.removeChannel(profileChannel); }catch(error){}
    }

    profileChannel = window._supa.channel('earn-chat-admin-profile-live-' + Date.now())
      .on('postgres_changes', {event:'*',schema:'public',table:'profiles'}, function(){ refreshAdmin('profiles'); })
      .on('postgres_changes', {event:'*',schema:'public',table:'kyc_submissions'}, function(){ refreshAdmin('kyc'); })
      .subscribe(function(status){
        if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
          if(typeof window.updateRealtimeStatus === 'function') window.updateRealtimeStatus('Partial realtime unavailable — polling remains active', false);
        }
      });

    refreshAdmin('realtime-start');
  };

  var originalStop = window.stopAdminRealtime;
  window.stopAdminRealtime = function(){
    if(profileChannel && window._supa){
      try{ window._supa.removeChannel(profileChannel); }catch(error){}
    }
    profileChannel = null;
    clearTimeout(fullSyncTimer);
    if(typeof originalStop === 'function') originalStop();
  };

  window.addEventListener('focus', function(){ refreshAdmin('focus'); });
  window.addEventListener('online', function(){ refreshAdmin('online'); });
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden) refreshAdmin('visible');
  });
})();
