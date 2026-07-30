(()=>{'use strict';
if(document.getElementById('earnchat-unified-theme'))return;
const s=document.createElement('style');s.id='earnchat-unified-theme';s.textContent=`
:root{--uc-bg:#f4f7fb;--uc-card:#fff;--uc-ink:#172033;--uc-muted:#6d7888;--uc-line:#dfe6ef;--uc-primary:#2478f3;--uc-green:#10b981;--uc-warn:#f3b63f;--uc-danger:#eb5968;--uc-shadow:0 6px 18px rgba(31,53,91,.07)}
html,body{background:var(--uc-bg)!important;color:var(--uc-ink)!important}
body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;overflow-x:hidden!important}
.page{background:var(--uc-bg)!important;color:var(--uc-ink)!important;min-height:100dvh}
.topbar,.auth-top,.setup-top,.chat-head{background:#fff!important;color:var(--uc-ink)!important;border-bottom:1px solid var(--uc-line)!important;box-shadow:none!important;backdrop-filter:none!important}
.logo,.page h1,.page h2,.page h3,.page h4,.page b,.page strong{color:var(--uc-ink)!important}
.page p,.page small,.page label,.muted,.sub,.helper,.hint{color:var(--uc-muted)!important}
.auth-wrap,.authcard,.auth-card,.setup-card,.form-card,.card,.profcard,.wdcard,.tsk,.dprog,.lbcard,.ec-return-card,.share-task-required,.modal-card,.sheet,.panel,.v33-journey,.ec-level-card,.ec-primary-chat-card,.ec-sponsored-entry,.ec-sv-card,.ec-sv-steps{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:var(--uc-shadow)!important;border-radius:20px!important}
#pg-register,#pg-login,#pg-country,#pg-setup,#pg-kyc,#pg-wd,#pg-prof,#pg-history,#pg-support,#pg-dash{background:var(--uc-bg)!important}
#pg-register .authcard,#pg-login .authcard,#pg-register .auth-card,#pg-login .auth-card,#pg-country .authcard,#pg-country .auth-card{max-width:520px!important;margin:20px auto!important;padding:20px!important;background:#fff!important}
input,select,textarea,.input,.field,.country-option,.country-btn{background:#fff!important;color:var(--uc-ink)!important;border:1px solid #d6dee9!important;box-shadow:none!important;border-radius:14px!important}
input::placeholder,textarea::placeholder{color:#96a1b1!important}
input:focus,select:focus,textarea:focus,.country-option.selected,.country-btn.selected{border-color:var(--uc-primary)!important;box-shadow:0 0 0 3px rgba(36,120,243,.10)!important;outline:none!important}
button,.btn,.gbtn,.primary-btn{touch-action:manipulation}
.gbtn,.primary-btn,.btn-primary,.submit-btn,.ec-primary-chat-btn,.ec-sponsored-open,.ec-sv-start,.ec-sv-primary{background:var(--uc-primary)!important;color:#fff!important;border:0!important;box-shadow:none!important;border-radius:14px!important}
.gbtn *,.primary-btn *,.btn-primary *,.ec-primary-chat-btn *{color:#fff!important}
.obtn,.btn-secondary,.secondary-btn{background:#fff!important;color:#425268!important;border:1px solid var(--uc-line)!important;border-radius:14px!important;box-shadow:none!important}
button:disabled,.disabled,[aria-disabled="true"]{opacity:.55!important;box-shadow:none!important;cursor:not-allowed!important}
.notice,.info,.secure-note,.bonus-note,.ec-earn-guide{background:#eef5ff!important;color:#365d8b!important;border:1px solid #cfe0f8!important;border-radius:15px!important}
.success,.success-note,.ec-no-payment{background:#ecfaf4!important;color:#24744f!important;border:1px solid #bde8d0!important}
.warning,.pending-note{background:#fff7e6!important;color:#815d19!important;border:1px solid #f1d49b!important}
.balcard{background:linear-gradient(135deg,#2579ef,#5569ee)!important;color:#fff!important;border:0!important;box-shadow:none!important;padding:20px!important}
.balcard .bcamt,.balcard .bclbl,.balcard .bv,.balcard .bcsub,.balcard .bl{color:#fff!important}
.balcard .ec-main-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;margin-top:18px!important}
.balcard .ec-main-actions button{min-height:50px!important;border-radius:14px!important;font-size:15px!important;font-weight:800!important}
.balcard .ec-main-actions .primary{background:#fff!important;color:#245fca!important;border:0!important}
.balcard .ec-main-actions .secondary{background:rgba(255,255,255,.14)!important;color:#fff!important;border:1px solid rgba(255,255,255,.55)!important}
#pg-dash .partner,.partner-card,#partners-list>div{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:none!important}
#pg-dash .partner *,.partner-card *{color:inherit}
#pg-dash .partner .earn,.partner-card .earn,.te,.str-earn,.ec-sv-reward{color:var(--uc-green)!important}
#pg-dash .sect{color:#536174!important}
#pg-dash .tsk{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:none!important}
#pg-dash .tsk .tnm2,#pg-dash .tsk .tds{color:var(--uc-ink)!important}
#pg-dash .tsk .tds{color:var(--uc-muted)!important}
.v33-journey,.ec-level-card,.ec-primary-chat-card{background:#fff!important}
.v33-journey *,.ec-level-card *,.ec-primary-chat-card *{color:inherit}
.botnav{background:#fff!important;border-top:1px solid var(--uc-line)!important;box-shadow:none!important;backdrop-filter:none!important}
.nbtn{color:#929cab!important}.nbtn.on{color:var(--uc-primary)!important}
.chat-wrap,.chat-body,.messages{background:var(--uc-bg)!important}
.msg,.message,.bubble{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:none!important}
.msg.me,.message.me,.bubble.me{background:#eaf3ff!important;border-color:#c7ddff!important;color:#214a7a!important}
.chat-input,.composer{background:#fff!important;border-top:1px solid var(--uc-line)!important}
.modal,.overlay,.ec-progress-overlay{backdrop-filter:none!important}
.table,.history-item,.withdraw-item,.ref-item,.task-item{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:none!important;border-radius:15px!important}
.status-approved{color:var(--uc-green)!important}.status-pending{color:#b57912!important}.status-rejected{color:var(--uc-danger)!important}
@media(max-width:600px){.auth-wrap,.authcard,.auth-card,.setup-card,.form-card{margin:12px!important;padding:17px!important;border-radius:18px!important}.dbody{padding-left:14px!important;padding-right:14px!important}.page h1{font-size:27px!important}.page h2{font-size:21px!important}input,select,textarea,button{min-height:48px}.balcard .ec-main-actions{grid-template-columns:1fr 1fr!important}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
document.head.appendChild(s);
})();