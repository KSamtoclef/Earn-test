(()=>{'use strict';
const PLAN=Object.freeze({signupBonus:2000,days:5,dailyCap:20000,withdrawalMinimum:70000,chatReward:2500,shareReward:250,tasks:Object.freeze({checkin:1000,video:2000,offer:3000,dailyShare:2500}),coreTaskTotal:8500});
window.EARNCHAT_PLAN=PLAN;
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
function syncConfig(){
 if(!window.CONFIG)return;
 Object.assign(window.CONFIG,{signup_bonus:PLAN.signupBonus,first_withdrawal_day:PLAN.days,day_caps:Array(PLAN.days).fill(PLAN.dailyCap),daily_cap:PLAN.dailyCap,earn_per_msg:PLAN.chatReward,earn_per_share:PLAN.shareReward,min_withdrawal:PLAN.withdrawalMinimum,task_rewards:{checkin:PLAN.tasks.checkin,video:PLAN.tasks.video,offer:PLAN.tasks.offer,daily_share:PLAN.tasks.dailyShare}});
}
function setText(sel,text){const el=q(sel);if(el&&el.textContent!==text)el.textContent=text;}
function replaceKnownText(root){
 if(!root)return;
 const replacements=[
  [/₦1,000\s*per\s*reply/gi,'₦2,500 per completed guided chat'],
  [/₦1,000\s*\/\s*reply/gi,'₦2,500 per guided chat'],
  [/\+₦1,000\s*\/\s*reply/gi,'+₦2,500 per guided chat'],
  [/Required tasks can add up to\s*₦10,000\s*today/gi,'Core tasks can add up to ₦8,500 today'],
  [/upgrade instantly/gi,'Earn your next level'],
  [/buy\s+(a\s+)?tier/gi,'complete premium tasks'],
  [/pay\s+to\s+upgrade/gi,'earn points to progress'],
  [/payment processed within 24 hours after verification/gi,'Approved withdrawals follow the platform payout schedule']
 ];
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(node=>{const parent=node.parentElement;if(!parent||['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName))return;let value=node.nodeValue||'';replacements.forEach(([pattern,next])=>{value=value.replace(pattern,next)});if(value!==node.nodeValue)node.nodeValue=value});
}
function syncKnownElements(){
 setText('#pg-landing .big-stats .bs-card:first-child .bs-val','₦2,500');
 setText('#pg-landing .big-stats .bs-card:first-child .bs-lbl','Per Guided Chat');
 setText('#tsk-checkin .te','+₦1,000');
 setText('#tsk-video .te','+₦2,000');
 setText('#tsk-offer .te','+₦3,000');
 setText('#tsk-daily-share .str-earn','+₦2,500');
 const hero=q('#pg-landing .hero p');if(hero)hero.innerHTML='Complete guided chat activities and daily tasks.<br>Earn <strong style="color:#12aa82">₦2,500</strong> per completed guided chat. Withdraw after completing Day 5 and all requirements.';
 const registerBonus=q('#pg-register .bonus-note, #pg-register .signup-bonus, #pg-register [class*="bonus"]');
 if(registerBonus&&/2,000|starting balance|activation/i.test(registerBonus.textContent||''))registerBonus.textContent='🎁 ₦2,000 starting balance after account activation';
 const process=q('#pg-proc');if(process){const h=process.querySelector('h2'),p=process.querySelector('p');if(h)h.textContent='Withdrawal request submitted';if(p)p.textContent='Awaiting admin review';}
 const success=q('#pg-success');if(success){const h=success.querySelector('h2'),p=success.querySelector('p');if(h)h.textContent='Withdrawal request submitted';if(p)p.textContent='Awaiting admin review. Approved requests follow the platform payout schedule.';}
 const active=q('.page.on')||document.body;replaceKnownText(active);
}
let installed=false;
function installPageHook(){
 if(installed||typeof window.pg!=='function')return;
 const original=window.pg;
 window.pg=function(){const result=original.apply(this,arguments);requestAnimationFrame(()=>{syncConfig();syncKnownElements();window.dispatchEvent(new CustomEvent('earnchat:page-ready',{detail:{page:arguments[0]}}))});return result};
 installed=true;
}
function run(){syncConfig();syncKnownElements();installPageHook();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.addEventListener('earnchat:state-updated',run);
window.addEventListener('earnchat:app-ready',run);
})();