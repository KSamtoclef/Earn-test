(()=>{'use strict';
if(document.getElementById('earnchat-unified-theme'))return;
const s=document.createElement('style');s.id='earnchat-unified-theme';s.textContent=`
:root{--uc-bg:#f6f8fc;--uc-card:#fff;--uc-ink:#172033;--uc-muted:#6d788a;--uc-line:#e2e8f0;--uc-primary:#2278f2;--uc-green:#13b98d;--uc-warn:#f6b73c;--uc-danger:#ef5c68;--uc-shadow:0 12px 32px rgba(31,53,91,.09)}
html,body{background:var(--uc-bg)!important;color:var(--uc-ink)!important}
body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
.page{background:radial-gradient(circle at 0 0,rgba(218,232,255,.55),transparent 24%),radial-gradient(circle at 100% 0,rgba(255,232,225,.45),transparent 22%),var(--uc-bg)!important;color:var(--uc-ink)!important;min-height:100dvh}
.topbar,.auth-top,.setup-top,.chat-head{background:rgba(255,255,255,.96)!important;color:var(--uc-ink)!important;border-bottom:1px solid var(--uc-line)!important;box-shadow:0 5px 18px rgba(31,53,91,.05)!important;backdrop-filter:blur(16px)}
.logo,.page h1,.page h2,.page h3,.page h4,.page b,.page strong{color:var(--uc-ink)}
.page p,.page small,.page label,.muted,.sub,.helper,.hint{color:var(--uc-muted)!important}
.auth-wrap,.authcard,.auth-card,.setup-card,.form-card,.card,.profcard,.wdcard,.tsk,.dprog,.lbcard,.ec-return-card,.share-task-required,.modal-card,.sheet,.panel{background:var(--uc-card)!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:var(--uc-shadow)!important;border-radius:22px!important}
#pg-register,#pg-login,#pg-country,#pg-setup,#pg-kyc,#pg-wd,#pg-prof,#pg-history,#pg-support{background:radial-gradient(circle at 8% 4%,rgba(217,232,255,.75),transparent 26%),radial-gradient(circle at 94% 2%,rgba(255,231,224,.58),transparent 24%),var(--uc-bg)!important}
#pg-register .authcard,#pg-login .authcard,#pg-register .auth-card,#pg-login .auth-card,#pg-country .authcard,#pg-country .auth-card{max-width:520px!important;margin:24px auto!important;padding:22px!important;background:#fff!important}
input,select,textarea,.input,.field,.country-option,.country-btn{background:#fff!important;color:var(--uc-ink)!important;border:1px solid #d9e1eb!important;box-shadow:none!important;border-radius:15px!important}
input::placeholder,textarea::placeholder{color:#98a3b3!important}
input:focus,select:focus,textarea:focus,.country-option.selected,.country-btn.selected{border-color:var(--uc-primary)!important;box-shadow:0 0 0 3px rgba(34,120,242,.12)!important;outline:none!important}
button,.btn,.gbtn,.primary-btn{touch-action:manipulation}
.gbtn,.primary-btn,.btn-primary,.submit-btn{background:linear-gradient(135deg,#2480f5,#4f6ff2)!important;color:#fff!important;border:0!important;box-shadow:0 10px 24px rgba(36,120,243,.22)!important;border-radius:15px!important}
.gbtn *, .primary-btn *, .btn-primary *{color:#fff!important}
.obtn,.btn-secondary,.secondary-btn{background:#fff!important;color:#425268!important;border:1px solid var(--uc-line)!important;border-radius:15px!important;box-shadow:0 7px 18px rgba(31,53,91,.05)!important}
button:disabled,.disabled,[aria-disabled="true"]{opacity:.55!important;box-shadow:none!important;cursor:not-allowed!important}
.notice,.info,.secure-note,.bonus-note,.ec-earn-guide{background:#eef5ff!important;color:#365d8b!important;border:1px solid #cfe0f8!important;border-radius:15px!important}
.success,.success-note{background:#ebfaf3!important;color:#24744f!important;border:1px solid #bde8d0!important}
.warning,.pending-note{background:#fff7e6!important;color:#815d19!important;border:1px solid #f1d49b!important}
.balcard{background:linear-gradient(135deg,#2377f2,#5f64f4 58%,#2e9ab7)!important;color:#fff!important;border:0!important;box-shadow:0 16px 40px rgba(40,91,194,.22)!important}
.balcard *{color:#fff!important}
.botnav{background:rgba(255,255,255,.97)!important;border-top:1px solid var(--uc-line)!important;box-shadow:0 -8px 26px rgba(31,53,91,.07)!important;backdrop-filter:blur(16px)}
.nbtn{color:#929cab!important}.nbtn.on{color:var(--uc-primary)!important}
.chat-wrap,.chat-body,.messages{background:var(--uc-bg)!important}
.msg,.message,.bubble{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:0 5px 16px rgba(31,53,91,.05)!important}
.msg.me,.message.me,.bubble.me{background:#eaf3ff!important;border-color:#c7ddff!important;color:#214a7a!important}
.chat-input,.composer{background:#fff!important;border-top:1px solid var(--uc-line)!important}
.modal,.overlay,.ec-progress-overlay{backdrop-filter:blur(5px)}
.table,.history-item,.withdraw-item,.ref-item,.task-item,.partner-card{background:#fff!important;color:var(--uc-ink)!important;border:1px solid var(--uc-line)!important;box-shadow:0 7px 20px rgba(31,53,91,.055)!important;border-radius:16px!important}
.status-approved{color:var(--uc-green)!important}.status-pending{color:#b57912!important}.status-rejected{color:var(--uc-danger)!important}
@media(max-width:600px){.auth-wrap,.authcard,.auth-card,.setup-card,.form-card{margin:14px!important;padding:18px!important;border-radius:20px!important}.dbody{padding-left:15px!important;padding-right:15px!important}.page h1{font-size:28px!important}.page h2{font-size:22px!important}input,select,textarea,button{min-height:48px}}
`;
document.head.appendChild(s);
})();