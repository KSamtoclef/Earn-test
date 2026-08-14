const STYLE_ID='earnchat-ui-redesign-r1';

const css=`
:root{--ec-blue:#3478e5;--ec-blue-2:#5a78f4;--ec-green:#45c86a;--ec-yellow:#ffc43d;--ec-red:#f45b5b;--ec-ink:#17191f;--ec-muted:#6f737d;--ec-bg:#f7f8fb;--ec-card:#fff;--ec-border:#e9ebf0;--ec-shadow:0 10px 28px rgba(24,31,45,.08)}
body{background:var(--ec-bg)!important;color:var(--ec-ink)!important}
.app-shell{background:linear-gradient(180deg,#fbfcff 0%,#f6f7fb 100%)!important}
#view-home .container,#view-earn .container,#view-upgrade .container,#view-referrals .container,#view-visits .container,#view-withdraw .container,#view-profile .container{max-width:680px!important;padding-left:16px!important;padding-right:16px!important}
#view-home .home-header{display:none!important}
.ec-member-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0 10px}
.ec-brand{display:flex;align-items:center;gap:10px;font-weight:900;font-size:20px;letter-spacing:-.02em}
.ec-brand-mark{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;color:#fff;font-weight:900;background:linear-gradient(135deg,#3478e5,#6b63f6);box-shadow:0 8px 18px rgba(52,120,229,.22)}
.ec-top-actions{display:flex;gap:8px}
.ec-icon-btn{width:44px;height:42px;border:1px solid var(--ec-border);background:#fff;border-radius:14px;font-weight:800;color:#4d5562;box-shadow:0 5px 14px rgba(24,31,45,.05)}
#view-home .balance-card{margin:10px 0 12px!important;border:0!important;border-radius:28px!important;padding:24px 20px 18px!important;background:linear-gradient(135deg,#397be8 0%,#596ff2 58%,#56a7ad 100%)!important;box-shadow:0 18px 36px rgba(52,120,229,.22)!important;color:#fff!important;overflow:hidden;position:relative}
#view-home .balance-card:after{content:"";position:absolute;width:240px;height:240px;border-radius:50%;right:-90px;top:-110px;background:rgba(255,255,255,.10)}
#view-home .balance-card>small{font-weight:800;letter-spacing:.02em;opacity:.94;position:relative;z-index:1}
#view-home .balance-card .amount{font-size:42px!important;font-weight:950!important;line-height:1.05;margin:12px 0 2px;position:relative;z-index:1}
#view-home #home-work-pending{position:relative;z-index:1;font-size:12px;opacity:.82}
#view-home .level-row{position:relative;z-index:1;margin-top:18px!important;padding-top:0!important;border-top:0!important;display:flex;align-items:center;justify-content:space-between}
#view-home .level-row>div{display:flex;flex-direction:column;gap:2px}
#view-home #home-level{font-weight:900}
#view-home #home-country{font-size:12px;opacity:.78}
#view-home #view-progress{display:none!important}
#view-home .home-actions{display:grid!important;grid-template-columns:1fr 1fr;gap:12px!important;margin:0 0 14px!important}
#view-home .home-actions button{min-height:56px!important;border-radius:18px!important;font-size:16px!important;font-weight:950!important;box-shadow:none!important}
#view-home .home-actions .home-earn-btn{background:#fff!important;color:var(--ec-blue)!important;border:1px solid #e4e8f0!important}
#view-home .home-actions .home-withdraw-btn{color:#fff!important;border:1px solid rgba(255,255,255,.55)!important;background:linear-gradient(135deg,#557cf1,#4b9bbd)!important}
.ec-trust-card{background:#fff;border:1px solid var(--ec-border);border-radius:24px;padding:18px;box-shadow:var(--ec-shadow);margin:12px 0 14px}
.ec-trust-head{display:flex;align-items:center;gap:13px}.ec-trust-icon{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:#eaf2ff;color:var(--ec-blue);font-size:25px}.ec-trust-copy{flex:1}.ec-trust-copy small{display:block;color:var(--ec-muted);font-weight:700}.ec-trust-copy b{display:block;font-size:25px;margin-top:2px}.ec-trust-pill{padding:8px 12px;border-radius:999px;background:#e9f1ff;color:var(--ec-blue);font-weight:900;font-size:13px}.ec-trust-bar{height:10px;background:#e9eaed;border-radius:99px;overflow:hidden;margin-top:16px}.ec-trust-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4d8df0,#4fc77a);border-radius:99px}.ec-trust-note{text-align:center;color:var(--ec-muted);font-size:13px;margin:12px 0 0;font-weight:700}
#view-home .home-secondary-grid,#view-home .progress-card,#view-home .next-action,#view-home .section-title,#view-home .quick-grid{display:none!important}
#view-home .container:after{content:"";display:block;height:88px}
#view-earn .app-header,#view-upgrade .app-header,#view-referrals .app-header,#view-visits .app-header,#view-withdraw .app-header,#view-profile .app-header{padding:12px 0 16px!important}
#view-earn .app-header h1,#view-upgrade .app-header h1,#view-referrals .app-header h1,#view-visits .app-header h1,#view-withdraw .app-header h1,#view-profile .app-header h1{font-size:30px!important;letter-spacing:-.04em!important;font-weight:950!important}
#view-earn .app-header small,#view-upgrade .app-header small,#view-referrals .app-header small,#view-visits .app-header small,#view-withdraw .app-header small,#view-profile .app-header small{color:var(--ec-muted)!important;font-weight:600}
#earn-summary{border-radius:24px!important;border:1px solid #dfe7fb!important;background:#eef4ff!important;box-shadow:none!important;padding:18px!important}
#earn-summary .progress{height:9px!important;border-radius:99px!important;background:#dce5f6!important;margin-top:14px}
#earn-summary .progress i{background:var(--ec-blue)!important;border-radius:99px}
#view-earn .section-title{margin:22px 0 12px!important}
#view-earn .section-title h2,#view-upgrade .section-title h2,#view-referrals .section-title h2{font-size:22px!important;font-weight:950!important}
#chat-partners{display:grid;gap:12px}
#chat-partners .list-card{border:1px solid var(--ec-border)!important;border-radius:24px!important;background:#fff!important;box-shadow:var(--ec-shadow)!important;padding:17px!important}
#chat-partners .partner-card header{align-items:center!important}
#chat-partners .partner-card .primary{width:100%;margin-top:14px;border-radius:15px!important;min-height:48px;font-weight:900}
#chat-partners .tag{background:#edf6ef!important;color:#26924a!important;border:0!important;font-weight:800}
#upgrade-content{display:grid;gap:12px}
#upgrade-content .card,#upgrade-content .list-card{border:1px solid var(--ec-border)!important;border-radius:24px!important;background:#fff!important;box-shadow:var(--ec-shadow)!important;padding:18px!important}
#upgrade-content .primary{border-radius:15px!important;font-weight:900}
#upgrade-content .route-skeleton{box-shadow:none!important;background:#fff!important}
#view-referrals .balance-card{border-radius:26px!important;background:linear-gradient(135deg,#397be8,#5a78f4)!important;color:#fff!important;border:0!important;box-shadow:0 18px 34px rgba(52,120,229,.20)!important}
#view-referrals .balance-card .amount{font-size:40px!important;font-weight:950!important}
#view-referrals .field input{background:#fff!important;border:1px solid #dfe3ea!important;border-radius:16px!important;height:54px!important;font-weight:700}
.ec-share-wa{width:100%;min-height:54px;margin:10px 0 8px;border:0;border-radius:17px;background:#25d366;color:#fff;font-weight:950;font-size:16px;box-shadow:0 12px 22px rgba(37,211,102,.18)}
#view-referrals .secondary{border-radius:16px!important;min-height:48px!important;font-weight:850}
#ref-list{display:grid;gap:10px}
#ref-list .list-card{border:1px solid var(--ec-border)!important;border-radius:20px!important;background:#fff!important;box-shadow:var(--ec-shadow)!important}
#view-visits .list-card,#view-withdraw .card,#view-withdraw .list-card,#view-profile .list-card,#view-profile .card{border:1px solid var(--ec-border)!important;border-radius:22px!important;background:#fff!important;box-shadow:var(--ec-shadow)!important}
.bottom-nav{background:rgba(255,255,255,.92)!important;backdrop-filter:blur(18px)!important;border-top:1px solid rgba(226,229,235,.9)!important;box-shadow:0 -8px 25px rgba(24,31,45,.06)!important}
.bottom-nav button{font-weight:850!important;color:#9aa0aa!important}.bottom-nav button.active,.bottom-nav button[aria-current="page"]{color:var(--ec-blue)!important}.bottom-nav button span{font-size:22px!important}
@media(max-width:520px){#view-home .container,#view-earn .container,#view-upgrade .container,#view-referrals .container,#view-visits .container,#view-withdraw .container,#view-profile .container{padding-left:14px!important;padding-right:14px!important}.ec-brand{font-size:19px}.ec-brand-mark{width:40px;height:40px}.ec-icon-btn{width:42px;height:40px}#view-home .balance-card .amount{font-size:38px!important}}
`;

function injectStyle(){if(document.getElementById(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=css;document.head.appendChild(style)}
function addHomeHeader(){const view=document.querySelector('#view-home');if(!view||view.querySelector('.ec-member-topbar'))return;const container=view.querySelector('.container');const oldHeader=view.querySelector('.home-header');if(!container)return;const bar=document.createElement('div');bar.className='ec-member-topbar';bar.innerHTML='<div class="ec-brand"><span class="ec-brand-mark">EC</span><span>Earn Chat</span></div><div class="ec-top-actions"><button class="ec-icon-btn" id="ec-theme-toggle" type="button" aria-label="Toggle theme">◐</button><button class="ec-icon-btn" id="ec-tutorial" type="button" aria-label="Open tutorial">?</button></div>';container.insertBefore(bar,oldHeader||container.firstChild);document.getElementById('ec-tutorial')?.addEventListener('click',()=>document.getElementById('tour-modal')?.classList.add('show'));document.getElementById('ec-theme-toggle')?.addEventListener('click',()=>document.documentElement.classList.toggle('ec-dim'))}
function addTrustCard(){const view=document.querySelector('#view-home');if(!view||view.querySelector('.ec-trust-card'))return;const balance=view.querySelector('.balance-card');if(!balance)return;const card=document.createElement('article');card.className='ec-trust-card';card.innerHTML='<div class="ec-trust-head"><div class="ec-trust-icon">◌</div><div class="ec-trust-copy"><small>Account progress</small><b id="ec-trust-value">0 pts</b></div><span class="ec-trust-pill" id="ec-trust-level">Starter</span></div><div class="ec-trust-bar"><i id="ec-trust-fill"></i></div><p class="ec-trust-note" id="ec-trust-note">Keep completing approved activities to progress.</p></article>';balance.insertAdjacentElement('afterend',card)}
function updateTrustCard(){const value=document.getElementById('ec-trust-value'),level=document.getElementById('ec-trust-level'),fill=document.getElementById('ec-trust-fill');const source=document.getElementById('home-chat-progress');if(source){const m=source.textContent.match(/(\d+)\s+of\s+(\d+)/i);if(m&&fill)fill.style.width=`${Math.min(100,Math.round(Number(m[1])/Math.max(1,Number(m[2]))*100))}%`}const lv=document.getElementById('home-level');if(lv&&level)level.textContent=lv.textContent.replace(/ level$/i,'');if(value&&source)value.textContent=source.textContent.replace(/sessions completed/i,'completed')}
function addReferralShare(){const view=document.querySelector('#view-referrals');if(!view||view.querySelector('.ec-share-wa'))return;const copy=document.getElementById('copy-ref');if(!copy)return;const button=document.createElement('button');button.className='ec-share-wa';button.type='button';button.textContent='Share on WhatsApp';copy.insertAdjacentElement('afterend',button);button.addEventListener('click',()=>{const link=document.getElementById('ref-link')?.value||location.href;const message=`Join me on Earn Chat and complete activities to earn rewards.\n${link}`;window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener')})}
function boot(){injectStyle();addHomeHeader();addTrustCard();addReferralShare();updateTrustCard();const observer=new MutationObserver(()=>{addHomeHeader();addTrustCard();addReferralShare();updateTrustCard()});observer.observe(document.body,{subtree:true,childList:true});setTimeout(()=>observer.disconnect(),12000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
