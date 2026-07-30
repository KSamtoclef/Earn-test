(function(){
'use strict';
var STYLE_ID='earnchat-landing-conversion-style';
function countryCode(){
  try{return (window.S&&window.S.country)||localStorage.getItem('earnchat-country')||'NG'}catch(error){return 'NG'}
}
function copyFor(code){
  return code==='KE'?{
    adjective:'Kenyans',
    earning:'KSh 40,000',
    chat:'KSh 150',
    task:'KSh 60',
    cta:'Start Free — Earn up to KSh 40,000'
  }:{
    adjective:'Nigerians',
    earning:'₦50,000',
    chat:'₦250',
    task:'₦100',
    cta:'Start Free — Earn up to ₦50,000'
  }
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  var style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent='\
 #pg-landing .hero{max-width:650px;margin-left:auto;margin-right:auto}\
 #pg-landing .hero p{max-width:610px;margin:18px auto 0;line-height:1.55}\
 #pg-landing .big-stats{background:#fff;border:1px solid #dce6f2;box-shadow:0 12px 30px rgba(15,35,65,.07)}\
 #pg-landing .bs-val{font-size:22px!important;line-height:1.15}\
 #pg-landing .bs-lbl{font-size:11px!important;line-height:1.3}\
 #land-signup-btn{min-height:62px;font-size:17px!important;font-weight:800!important;box-shadow:0 12px 26px rgba(17,185,139,.22)!important}\
 #land-signup-btn:active{transform:translateY(1px)}\
 .v33-hero-note{max-width:560px;margin-left:auto!important;margin-right:auto!important;line-height:1.45}\
 #earnchat-earning-promise{display:inline-block;margin-top:8px;padding:7px 12px;border-radius:999px;background:#eafbf5;color:#087a5d;font-size:13px;font-weight:800}\
 @media(max-width:560px){#pg-landing .hero h1{font-size:42px!important;line-height:1.08!important}#pg-landing .big-stats{padding:15px 8px!important}#land-signup-btn{font-size:16px!important;padding-left:12px!important;padding-right:12px!important}}';
  document.head.appendChild(style);
}
function setCard(card,value,label){
  if(!card)return;
  var valueNode=card.querySelector('.bs-val');
  var labelNode=card.querySelector('.bs-lbl');
  if(valueNode)valueNode.textContent=value;
  if(labelNode)labelNode.textContent=label;
}
function updateLanding(){
  var landing=document.getElementById('pg-landing');
  if(!landing)return;
  ensureStyle();
  var code=countryCode();
  var copy=copyFor(code);
  var hero=landing.querySelector('.hero');
  if(hero){
    var heading=hero.querySelector('h1');
    if(heading)heading.innerHTML='Chat with Foreigners<br><span>Complete Tasks. Earn Real Cash.</span>';
    var paragraph=hero.querySelector('p');
    if(paragraph)paragraph.innerHTML='Start free and earn through approved chats, linked tasks and qualified referrals.<br><strong>Earn up to '+copy.earning+' during your 5-day activity cycle.</strong>';
  }
  var stats=landing.querySelectorAll('.big-stats .bs-card');
  if(stats.length>=3){
    setCard(stats[0],'5 Days','Activity cycle');
    setCard(stats[1],'More Ways','Tasks + referrals');
    setCard(stats[2],'4 Daily','Starter chats');
  }
  var signup=document.getElementById('land-signup-btn');
  if(signup)signup.textContent=copy.cta;
  var note=landing.querySelector('.v33-hero-note');
  if(note)note.textContent='Free signup • No payment required • Usually takes less than one minute';
  var ad=landing.querySelector('#land-ad1 .ab');
  if(ad)ad.textContent='🎯 Current earning opportunities for '+copy.adjective+' — tap to explore';
  var steps=landing.querySelectorAll('.v33-quick-step span');
  if(steps.length>=3){
    steps[0].textContent='Create your free account';
    steps[1].textContent='Complete chats and linked tasks';
    steps[2].textContent='Unlock higher earning levels';
  }
  landing.setAttribute('data-landing-ready','true');
}
function removeLegacyShareUi(){
  var legacy=document.getElementById('tsk-daily-share');
  if(legacy)legacy.remove();
}
function refresh(){updateLanding();removeLegacyShareUi()}
function settle(){
  refresh();
  requestAnimationFrame(refresh);
  setTimeout(refresh,120);
  setTimeout(refresh,600);
  setTimeout(refresh,1600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',settle,{once:true});else settle();
window.addEventListener('earnchat:state-updated',settle);
window.addEventListener('earnchat:business-ready',settle);
window.addEventListener('earnchat:app-ready',settle);
window.addEventListener('storage',function(event){if(event.key==='earnchat-country')settle()});
window.addEventListener('pageshow',settle);
})();