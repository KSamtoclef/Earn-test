(()=>{'use strict';
const PLAN=Object.freeze({signupBonus:2000,days:5,dailyCap:20000,withdrawalMinimum:70000,chatReward:2500,shareReward:250,tasks:Object.freeze({checkin:1000,video:2000,offer:3000,dailyShare:2500}),coreTaskTotal:8500});
window.EARNCHAT_PLAN=PLAN;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
function syncConfig(){if(!window.CONFIG)return;Object.assign(window.CONFIG,{signup_bonus:PLAN.signupBonus,first_withdrawal_day:PLAN.days,day_caps:Array(PLAN.days).fill(PLAN.dailyCap),daily_cap:PLAN.dailyCap,earn_per_msg:PLAN.chatReward,earn_per_share:PLAN.shareReward,min_withdrawal:PLAN.withdrawalMinimum,task_rewards:{checkin:PLAN.tasks.checkin,video:PLAN.tasks.video,offer:PLAN.tasks.offer,daily_share:PLAN.tasks.dailyShare}})}
function setText(sel,text){const el=q(sel);if(el&&el.textContent!==text)el.textContent=text}
function keepThemeLast(){const style=q('#earnchat-unified-theme');if(style&&style!==document.head.lastElementChild)document.head.appendChild(style)}
function removeDuplicateTaskSummary(){const dash=q('#pg-dash');if(!dash)return;const boxes=qa('div',dash).filter(el=>el.children.length<=3&&/required tasks can add up to/i.test(el.textContent||''));boxes.forEach(el=>{if(!el.dataset.ecRemoved){el.dataset.ecRemoved='1';el.remove()}})}
function updateKnownCopy(){
 setText('#pg-landing .big-stats .bs-card:first-child .bs-val','₦2,500');setText('#pg-landing .big-stats .bs-card:first-child .bs-lbl','Per Guided Chat');
 setText('#tsk-checkin .te','+₦1,000');setText('#tsk-video .te','+₦2,000');setText('#tsk-offer .te','+₦3,000');setText('#tsk-daily-share .str-earn','+₦2,500');
 const hero=q('#pg-landing .hero p');if(hero)hero.innerHTML='Complete guided chat activities and daily tasks.<br>Earn <strong style="color:#12aa82">₦2,500</strong> per completed guided chat. Withdraw after completing Day 5 and all requirements.';
 const registerBonus=q('#pg-register .bonus-note,#pg-register .signup-bonus,#pg-register [class*="bonus"]');if(registerBonus&&/2,000|starting balance|activation/i.test(registerBonus.textContent||''))registerBonus.textContent='🎁 ₦2,000 starting balance after account activation';
 const process=q('#pg-proc');if(process){const h=process.querySelector('h2'),p=process.querySelector('p');if(h)h.textContent='Withdrawal request submitted';if(p)p.textContent='Awaiting admin review'}
 const success=q('#pg-success');if(success){const h=success.querySelector('h2'),p=success.querySelector('p');if(h)h.textContent='Withdrawal request submitted';if(p)p.textContent='Awaiting admin review. Approved requests follow the platform payout schedule.'}
 removeDuplicateTaskSummary();keepThemeLast();
}
let installed=false;function installPageHook(){if(installed||typeof window.pg!=='function')return;const original=window.pg;window.pg=function(){const args=arguments,result=original.apply(this,args);requestAnimationFrame(()=>{syncConfig();updateKnownCopy();window.dispatchEvent(new CustomEvent('earnchat:page-ready',{detail:{page:args[0]}}))});return result};installed=true}
function run(){syncConfig();updateKnownCopy();installPageHook()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.addEventListener('earnchat:state-updated',run);window.addEventListener('earnchat:app-ready',run);
})();