(function(){
  'use strict';

  var STYLE_ID='earn-chat-core-flow-style';
  var CARD_ID='earn-chat-primary-card';

  function addStyles(){
    if(document.getElementById(STYLE_ID)) return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=[
      '#'+CARD_ID+'{background:linear-gradient(135deg,rgba(0,200,150,.18),rgba(0,200,150,.05));border:1.5px solid var(--g);border-radius:16px;padding:15px;margin:0 0 12px;box-shadow:0 10px 28px rgba(0,0,0,.18)}',
      '.ec-primary-chat-head{display:flex;gap:11px;align-items:flex-start;margin-bottom:12px}',
      '.ec-primary-chat-icon{width:44px;height:44px;border-radius:13px;background:var(--g);color:#000;display:flex;align-items:center;justify-content:center;font-size:23px;flex-shrink:0}',
      '.ec-primary-chat-copy{flex:1;min-width:0}',
      '.ec-primary-chat-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--g);font-weight:800;margin-bottom:3px}',
      '.ec-primary-chat-title{font-family:"Space Grotesk",sans-serif;font-size:17px;font-weight:800;color:var(--tx)}',
      '.ec-primary-chat-sub{font-size:11px;color:var(--mu);line-height:1.5;margin-top:3px}',
      '.ec-primary-chat-btn{width:100%;border:0;border-radius:11px;padding:12px 14px;background:var(--g);color:#000;font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:800;cursor:pointer}',
      '.ec-supporting-note{font-size:11px;color:var(--mu);line-height:1.5;margin:-2px 0 10px;padding:9px 11px;background:rgba(255,255,255,.025);border:1px solid var(--br);border-radius:10px}'
    ].join('');
    document.head.appendChild(style);
  }

  function findSectionByText(root,text){
    return Array.prototype.find.call(root.querySelectorAll('.sect'),function(el){
      return String(el.textContent||'').toLowerCase().indexOf(text.toLowerCase())>-1;
    })||null;
  }

  function primaryAction(){
    if(!window.S) return {label:'Start an Earn Chat session',action:function(){ if(typeof window.scrollToPartners==='function') window.scrollToPartners(); }};
    if(S.activeChatSessionId && Number(S.chatMsgCount||0)>=3 && Number(S.swDone||0)<Number(S.swTarget||5)){
      return {label:'Continue chat sharing',action:function(){ if(typeof window.pg==='function') window.pg('pg-share'); }};
    }
    if(S.activeChatSessionId && Number(S.chatMsgCount||0)<3){
      return {label:'Continue current chat',action:function(){ if(typeof window.pg==='function') window.pg('pg-chat'); }};
    }
    return {label:'Start an Earn Chat session',action:function(){ if(typeof window.scrollToPartners==='function') window.scrollToPartners(); }};
  }

  function updatePrimaryCard(){
    var card=document.getElementById(CARD_ID);
    if(!card) return;
    var action=primaryAction();
    var button=card.querySelector('.ec-primary-chat-btn');
    if(button){
      button.textContent=action.label+' →';
      button.onclick=action.action;
    }
    var sub=card.querySelector('.ec-primary-chat-sub');
    if(sub){
      sub.textContent='Chat is the main earning activity. Complete approved replies, then finish the recorded share stage for that session.';
    }
  }

  function installDashboardUpgrade(){
    var dash=document.getElementById('pg-dash');
    var partners=document.getElementById('partners-list');
    if(!dash||!partners) return;

    var chatHeading=findSectionByText(dash,'Chat Partners');
    if(chatHeading) chatHeading.textContent='💬 Main Earning Activity — Earn Chat';

    if(!document.getElementById(CARD_ID)){
      var card=document.createElement('div');
      card.id=CARD_ID;
      card.innerHTML='<div class="ec-primary-chat-head"><div class="ec-primary-chat-icon">💬</div><div class="ec-primary-chat-copy"><div class="ec-primary-chat-label">Core earning activity</div><div class="ec-primary-chat-title">Chat first, then complete supporting tasks</div><div class="ec-primary-chat-sub"></div></div></div><button type="button" class="ec-primary-chat-btn">Start an Earn Chat session →</button>';
      if(chatHeading) chatHeading.parentNode.insertBefore(card,chatHeading);
      else partners.parentNode.insertBefore(card,partners);
    }

    var taskHeading=findSectionByText(dash,"Today's Tasks");
    if(taskHeading){
      taskHeading.textContent="⚡ Today's Supporting Tasks";
      if(!taskHeading.nextElementSibling || !taskHeading.nextElementSibling.classList.contains('ec-supporting-note')){
        var note=document.createElement('div');
        note.className='ec-supporting-note';
        note.textContent='Supporting tasks remain important for daily progress. Only genuinely configured activities should be rotated in; completed activities must not be renamed and shown again as fake new tasks.';
        taskHeading.parentNode.insertBefore(note,taskHeading.nextSibling);
      }
    }

    updatePrimaryCard();
  }

  function updateWithdrawalPages(){
    var processing=document.getElementById('pg-proc');
    if(processing){
      var heading=processing.querySelector('h2');
      var paragraph=processing.querySelector('p');
      if(heading) heading.textContent='Withdrawal request submitted';
      if(paragraph) paragraph.textContent='Awaiting admin review';
    }

    var success=document.getElementById('pg-success');
    if(success){
      var successHeading=success.querySelector('h2');
      var successParagraph=success.querySelector('p');
      if(successHeading) successHeading.textContent='Withdrawal request submitted';
      if(successParagraph) successParagraph.textContent='Awaiting admin review. Approved requests follow the platform payout schedule, and the admin records the payment reference when money is sent.';
    }
  }

  function install(){
    addStyles();
    installDashboardUpgrade();
    updateWithdrawalPages();
  }

  var originalUpdateUI=window.updateUI;
  if(typeof originalUpdateUI==='function'){
    window.updateUI=function(){
      var result=originalUpdateUI.apply(this,arguments);
      install();
      return result;
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  var observer=new MutationObserver(function(){
    updatePrimaryCard();
    updateWithdrawalPages();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();