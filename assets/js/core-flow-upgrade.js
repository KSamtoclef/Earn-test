(function(){
  'use strict';
  var STYLE_ID='earn-chat-core-flow-style';
  var CARD_ID='earn-chat-primary-card';

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=[
      '#'+CARD_ID+'{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:15px;margin:0 0 12px;box-shadow:0 10px 28px rgba(31,53,91,.08)}',
      '.ec-primary-chat-head{display:flex;gap:11px;align-items:flex-start;margin-bottom:12px}',
      '.ec-primary-chat-icon{width:44px;height:44px;border-radius:13px;background:#13b98d;color:#fff;display:flex;align-items:center;justify-content:center;font-size:23px;flex-shrink:0}',
      '.ec-primary-chat-copy{flex:1;min-width:0}',
      '.ec-primary-chat-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#129b77;font-weight:800;margin-bottom:3px}',
      '.ec-primary-chat-title{font-size:17px;font-weight:800;color:#172033}',
      '.ec-primary-chat-sub{font-size:11px;color:#6d788a;line-height:1.5;margin-top:3px}',
      '.ec-primary-chat-btn{width:100%;border:0;border-radius:13px;padding:13px 14px;background:#2478f3;color:#fff;font-size:14px;font-weight:800;cursor:pointer}',
      '.ec-supporting-note{font-size:11px;color:#6d788a;line-height:1.5;margin:-2px 0 10px;padding:10px 12px;background:#eef5ff;border:1px solid #cfe0f8;border-radius:12px}'
    ].join('');
    document.head.appendChild(style);
  }

  function findSectionByText(root,text){
    return Array.prototype.find.call(root.querySelectorAll('.sect'),function(element){
      return String(element.textContent||'').toLowerCase().indexOf(text.toLowerCase())>-1;
    })||null;
  }

  function primaryAction(){
    if(!window.S)return{label:'Start an Earn Chat session',action:function(){window.scrollToPartners?.();}};
    if(S.activeChatSessionId&&Number(S.chatMsgCount||0)>=3&&Number(S.swDone||0)<Number(S.swTarget||5))return{label:'Continue chat sharing',action:function(){window.pg?.('pg-share');}};
    if(S.activeChatSessionId&&Number(S.chatMsgCount||0)<3)return{label:'Continue current chat',action:function(){window.pg?.('pg-chat');}};
    return{label:'Start an Earn Chat session',action:function(){window.scrollToPartners?.();}};
  }

  function updatePrimaryCard(){
    var card=document.getElementById(CARD_ID);
    if(!card)return;
    var action=primaryAction(),button=card.querySelector('.ec-primary-chat-btn'),sub=card.querySelector('.ec-primary-chat-sub');
    if(button){button.textContent=action.label+' →';button.onclick=action.action;}
    if(sub)sub.textContent='Chat is the main earning activity. Complete approved guided chats, then finish the recorded share stage for that session.';
  }

  function installDashboard(){
    var dash=document.getElementById('pg-dash'),partners=document.getElementById('partners-list');
    if(!dash||!partners)return;
    var chatHeading=findSectionByText(dash,'Chat Partners')||findSectionByText(dash,'Main Earning Activity');
    if(chatHeading)chatHeading.textContent='💬 Main Earning Activity — Earn Chat';
    if(!document.getElementById(CARD_ID)){
      var card=document.createElement('div');
      card.id=CARD_ID;
      card.innerHTML='<div class="ec-primary-chat-head"><div class="ec-primary-chat-icon">💬</div><div class="ec-primary-chat-copy"><div class="ec-primary-chat-label">Core earning activity</div><div class="ec-primary-chat-title">Complete guided chats and supporting tasks</div><div class="ec-primary-chat-sub"></div></div></div><button type="button" class="ec-primary-chat-btn">Start an Earn Chat session →</button>';
      if(chatHeading)chatHeading.parentNode.insertBefore(card,chatHeading);else partners.parentNode.insertBefore(card,partners);
    }
    var taskHeading=findSectionByText(dash,"Today's Tasks")||findSectionByText(dash,"Today's Supporting Tasks");
    if(taskHeading){
      taskHeading.textContent="⚡ Today's Supporting Tasks";
      if(!taskHeading.nextElementSibling||!taskHeading.nextElementSibling.classList.contains('ec-supporting-note')){
        var note=document.createElement('div');
        note.className='ec-supporting-note';
        note.textContent='Core tasks can add up to ₦8,500 today. Guided chats and recorded chat-sharing complete the rest of the ₦20,000 daily opportunity.';
        taskHeading.parentNode.insertBefore(note,taskHeading.nextSibling);
      }
    }
    updatePrimaryCard();
  }

  function updateWithdrawalPages(){
    var processing=document.getElementById('pg-proc');
    if(processing){var heading=processing.querySelector('h2'),paragraph=processing.querySelector('p');if(heading)heading.textContent='Withdrawal request submitted';if(paragraph)paragraph.textContent='Awaiting admin review';}
    var success=document.getElementById('pg-success');
    if(success){var successHeading=success.querySelector('h2'),successParagraph=success.querySelector('p');if(successHeading)successHeading.textContent='Withdrawal request submitted';if(successParagraph)successParagraph.textContent='Awaiting admin review. Approved requests follow the platform payout schedule.';}
  }

  function install(){addStyles();installDashboard();updateWithdrawalPages();}
  var originalUpdateUI=window.updateUI;
  if(typeof originalUpdateUI==='function'){
    window.updateUI=function(){var result=originalUpdateUI.apply(this,arguments);install();return result;};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  ['earnchat:state-updated','earnchat:page-ready','earnchat:app-ready'].forEach(function(name){window.addEventListener(name,install);});
})();