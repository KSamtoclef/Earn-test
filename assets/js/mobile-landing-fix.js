(()=>{'use strict';
function q(selector,root=document){return root.querySelector(selector)}
function addStyles(){
 if(q('#earnchat-mobile-landing-fix'))return;
 const style=document.createElement('style');
 style.id='earnchat-mobile-landing-fix';
 style.textContent=`
 html,body{min-height:100%;height:auto!important;overflow-x:hidden!important}
 body{overflow-y:auto!important;-webkit-overflow-scrolling:touch}
 #demo-heading{position:sticky!important;top:0!important;min-height:42px!important;padding:11px 12px!important;display:flex!important;align-items:center!important;justify-content:center!important;line-height:1.2!important;font-size:12px!important}
 #pg-landing.page.on{display:block!important;width:100%!important;min-height:calc(100dvh - 42px)!important;height:auto!important;max-height:none!important;overflow:visible!important;padding:18px 20px calc(54px + env(safe-area-inset-bottom))!important}
 #pg-landing #hero-logo{margin-top:4px!important;padding:6px 0!important}
 #pg-landing .live{margin-bottom:14px!important}
 #pg-landing .flags{margin-top:5px!important;margin-bottom:10px!important}
 #pg-landing .hero{margin-top:12px!important}
 #pg-landing .hero h1{font-size:clamp(30px,8vw,42px)!important;line-height:1.13!important;margin-bottom:10px!important}
 #pg-landing .hero p{max-width:360px!important;margin-bottom:16px!important}
 #pg-landing .big-stats{width:100%!important;max-width:390px!important;margin-left:auto!important;margin-right:auto!important}
 #pg-landing .gbtn,#pg-landing .obtn,#pg-landing .v33-quick-path,#pg-landing .adbox,#pg-landing .how-sec,#pg-landing .testis,#pg-landing .paylist{max-width:390px!important}
 #pg-landing .how-sec{margin-left:auto!important;margin-right:auto!important}
 #pg-landing .hi{min-height:auto!important}
 #pg-landing>*{flex-shrink:0}
 @media(max-width:370px){
  #pg-landing.page.on{padding-left:14px!important;padding-right:14px!important}
  #pg-landing .v33-quick-path{gap:5px!important}
  #pg-landing .v33-quick-step{padding:9px 4px!important}
 }
 `;
 document.head.appendChild(style);
}
function replaceText(selector,text){const el=q(selector);if(el&&el.textContent!==text)el.textContent=text}
function fixLandingCopy(){
 const hero=q('#pg-landing .hero p');
 if(hero)hero.innerHTML='Complete guided chat activities and daily tasks.<br>Earn <strong style="color:var(--g)">₦2,500</strong> per completed guided chat. Withdraw after completing Day 5 and all requirements.';
 replaceText('#pg-landing .bs-card:first-child .bs-val','₦2,500');
 replaceText('#pg-landing .bs-card:first-child .bs-lbl','Per Guided Chat');
 const how=q('#pg-landing .how-sec');
 if(how){
  const cards=[...how.querySelectorAll('.hi')];
  if(cards[1]){
   const title=cards[1].querySelector('.ht'),desc=cards[1].querySelector('.hd');
   if(title)title.textContent='Complete guided chats daily';
   if(desc)desc.textContent='Finish guided chat activities and earn ₦2,500 for each approved completed chat.';
  }
  if(cards[2]){
   const title=cards[2].querySelector('.ht'),desc=cards[2].querySelector('.hd');
   if(title)title.textContent='Complete sharing activities';
   if(desc)desc.textContent='Open the approved sharing flow and return. Earn Chat records the action, not private message delivery.';
  }
 }
}
function run(){addStyles();fixLandingCopy()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.addEventListener('earnchat:state-updated',run);
})();