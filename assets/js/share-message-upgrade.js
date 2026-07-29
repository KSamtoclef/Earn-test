(function(){
  'use strict';

  var originalOpen = window.open;

  function referralCode(){
    var source = String((window.S && (S.supaId || S.email)) || 'earnchat-user');
    var hash = 2166136261;
    for(var i=0;i<source.length;i++){
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'EC' + (hash >>> 0).toString(16).toUpperCase().slice(0,8).padStart(8,'0');
  }

  function shareAmount(){
    var amount = Number((window.S && (S.chatEarned || S.pendingUnlock || S.balance)) || 0);
    if(typeof window.fmt === 'function') return window.fmt(amount);
    return '₦' + Math.floor(amount).toLocaleString('en-NG');
  }

  function joinUrl(){
    var base = (window.CONFIG && CONFIG.site_url && !String(CONFIG.site_url).includes('YOUR'))
      ? String(CONFIG.site_url)
      : window.location.origin + '/';
    try{
      var url = new URL(base, window.location.href);
      url.searchParams.set('ref', referralCode());
      return url.toString();
    }catch(error){
      return window.location.origin + '/?ref=' + encodeURIComponent(referralCode());
    }
  }

  function message(){
    var country = (typeof window.activeCountry === 'function') ? window.activeCountry() : {name:'Nigeria'};
    var payoutLine = country && country.code === 'KE'
      ? '✅ Request withdrawals through supported Kenyan payment methods'
      : '✅ Request withdrawals through supported Nigerian banks and wallets';

    return [
      '💬 I just completed ' + shareAmount() + ' in rewarded chat activities on Earn Chat!',
      '',
      'Earn Chat gives users access to guided chat and daily earning activities.',
      '✅ Free to join',
      '✅ Rewards recorded from approved activities',
      payoutLine,
      '',
      'Join here 👇',
      joinUrl(),
      '',
      'My Earn Chat progress is currently active 🔥'
    ].join('\n');
  }

  window.open = function(url, target, features){
    try{
      var text = String(url || '');
      if(text.indexOf('https://wa.me/?text=') === 0 && document.getElementById('pg-share')?.classList.contains('on')){
        url = 'https://wa.me/?text=' + encodeURIComponent(message());
        if(typeof window.trackEvent === 'function'){
          window.trackEvent('share_message_prepared', {
            referral_code: referralCode(),
            amount: Number((window.S && (S.chatEarned || S.pendingUnlock || S.balance)) || 0),
            country: (typeof window.activeCountryCode === 'function') ? window.activeCountryCode() : 'NG'
          });
        }
      }
    }catch(error){
      console.warn('Earn Chat share message upgrade failed:', error);
    }
    return originalOpen.call(window, url, target, features);
  };

  window.buildEarnChatShareMessage = message;
  window.getEarnChatReferralCode = referralCode;
})();
