(()=>{'use strict';
const q=(s,r=document)=>r.querySelector(s);
function removeTopBanner(){const banner=q('#demo-heading');if(banner)banner.remove()}
function addStyles(){
 if(q('#earnchat-mobile-landing-fix'))return;
 const style=document.createElement('style');
 style.id='earnchat-mobile-landing-fix';
 style.textContent=`
 html,body{min-height:100%;height:auto!important;overflow-x:hidden!important;background:#f7f9fc!important}
 body{overflow-y:auto!important;-webkit-overflow-scrolling:touch;color:#162033!important}
 #demo-heading{display:none!important}
 #pg-landing.page.on{display:block!important;width:100%!important;min-height:100dvh!important;height:auto!important;max-height:none!important;overflow:visible!important;padding:24px 20px calc(60px + env(safe-area-inset-bottom))!important;background:radial-gradient(circle at 8% 8%,rgba(219,234,255,.8),transparent 28%),radial-gradient(circle at 92% 4%,rgba(255,232,224,.65),transparent 24%),#f7f9fc!important;color:#162033!important}
 #pg-landing #hero-logo{margin-top:2px!important;padding:4px 0!important}
 #pg-landing .live{margin-bottom:18px!important;background:#fff!important;border:1px solid #8ee2cb!important;color:#168d70!important;box-shadow:0 8px 24px rgba(31,53,91,.07)!important}
 #pg-landing .flags{margin:8px auto 16px!important;max-width:390px!important}
 #pg-landing .flag{background:#fff!important;border:1px solid #e3e8f0!important;color:#566274!important;box-shadow:0 6px 18px rgba(31,53,91,.06)!important}
 #pg-landing .hero{margin-top:10px!important}
 #pg-landing .hero h1{font-size:clamp(31px,8vw,43px)!important;line-height:1.12!important;margin-bottom:13px!important;color:#162033!important;letter-spacing:-.7px!important}
 #pg-landing .hero h1 span{color:#12aa82!important}
 #pg-landing .hero p{max-width:370px!important;margin:0 auto 19px!important;color:#657286!important;font-size:14px!important;line-height:1.65!important}
 #pg-landing .big-stats{width:100%!important;max-width:390px!important;margin:0 auto 16px!important;background:#fff!important;border:1px solid #e3e8f0!important;border-radius:21px!important;box-shadow:0 14px 36px rgba(31,53,91,.09)!important}
 #pg-landing .bs-val{color:#12aa82!important}
 #pg-landing .bs-lbl{color:#697588!important}
 #pg-landing .bs-div{background:#e7ebf1!important}
 #pg-landing .gbtn{max-width:390px!important;background:linear-gradient(135deg,#13c99b,#20b984)!important;color:#071a15!important;box-shadow:0 12px 28px rgba(18,173,132,.22)!important;border:0!important}
 #pg-landing .obtn{max-width:390px!important;background:#fff!important;color:#526174!important;border:1px solid #dce3ec!important;box-shadow:0 8px 22px rgba(31,53,91,.06)!important}
 #pg-landing .v33-hero-note{color:#7b8798!important}
 #pg-landing .v33-quick-path{max-width:390px!important;gap:9px!important}
 #pg-landing .v33-quick-step{background:#fff!important;border:1px solid #e1e7ef!important;box-shadow:0 7px 20px rgba(31,53,91,.055)!important}
 #pg-landing .v33-quick-step strong{color:#202b3e!important}
 #pg-landing .v33-quick-step span{color:#718095!important}
 #pg-landing .adbox,#pg-landing .how-sec,#pg-landing .testis,#pg-landing .paylist{max-width:390px!important}
 #pg-landing .adbox{background:#fff!important;border:1px dashed #b9c8da!important;color:#263247!important;box-shadow:0 9px 25px rgba(31,53,91,.06)!important}
 #pg-landing .adbox .al{color:#7b8797!important}
 #pg-landing .adbox .ab{color:#283449!important}
 #pg-landing .adbox .ae{color:#129b77!important}
 #pg-landing .how-sec{margin:28px auto 0!important}
 #pg-landing .sech{color:#6f7d90!important}
 #pg-landing .hi,#pg-landing .tc,#pg-landing .paylist{background:#fff!important;border:1px solid #e1e7ef!important;color:#1d293b!important;box-shadow:0 9px 26px rgba(31,53,91,.065)!important}
 #pg-landing .hi .ht,#pg-landing .tnm,#pg-landing .pnm{color:#1c2738!important}
 #pg-landing .hi .hd,#pg-landing .ttxt,#pg-landing .tlc,#pg-landing .ptm{color:#6f7d90!important}
 #pg-landing .trust-badge{background:#fff!important;border:1px solid #e1e7ef!important;color:#435166!important;box-shadow:0 6px 18px rgba(31,53,91,.05)!important}
 #pg-landing>*{flex-shrink:0}
 @media(max-width:370px){#pg-landing.page.on{padding-left:14px!important;padding-right:14px!important}.v33-quick-path{gap:6px!important}.v33-quick-step{padding:9px 4px!important}}
 `;
 document.head.appendChild(style);
}
function replaceText(selector,text){const el=q(selector);if(el&&el.textContent!==text)el.textContent=text}
function fixLandingCopy(){
 const hero=q('#pg-landing .hero p');
 if(hero)hero.innerHTML='Complete guided chat activities and daily tasks.<br>Earn <strong style="color:#12aa82">₦2,500</strong> per completed guided chat. Withdraw after completing Day 5 and all requirements.';
 replaceText('#pg-landing .bs-card:first-child .bs-val','₦2,500');
 replaceText('#pg-landing .bs-card:first-child .bs-lbl','Per Guided Chat');
 const how=q('#pg-landing .how-sec');
 if(how){const cards=[...how.querySelectorAll('.hi')];if(cards[1]){const t=cards[1].querySelector('.ht'),d=cards[1].querySelector('.hd');if(t)t.textContent='Complete guided chats daily';if(d)d.textContent='Finish guided chat activities and earn ₦2,500 for each approved completed chat.'}if(cards[2]){const t=cards[2].querySelector('.ht'),d=cards[2].querySelector('.hd');if(t)t.textContent='Complete sharing activities';if(d)d.textContent='Open the approved sharing flow and return. Earn Chat records the action, not private message delivery.'}}
}
function cleanKnownPreviewText(){
 document.querySelectorAll('.demo-local-note').forEach(el=>el.remove());
 const summary=q('#wd-country-summary');if(summary&&/demo/i.test(summary.textContent||''))summary.textContent=summary.textContent.replace(/demo\s*local\s*request/gi,'Local test request');
}
function run(){removeTopBanner();addStyles();fixLandingCopy();cleanKnownPreviewText()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.addEventListener('earnchat:state-updated',run);
})();