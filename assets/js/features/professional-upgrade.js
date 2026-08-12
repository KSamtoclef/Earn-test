import{money}from'../app-config.js';
import{loadWithdrawalReadiness}from'./withdrawal-readiness.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const legacyNames=new Map([
 ['Noah T.','Daily Check-in'],
 ['Amina R.','Planning Session'],
 ['Grace M.','Learning Session']
]);
let readinessToken=0;

function ensureStyles(){
 if($('#earnchat-professional-upgrade-css'))return;
 const link=document.createElement('link');
 link.id='earnchat-professional-upgrade-css';
 link.rel='stylesheet';
 link.href='./assets/css/professional-upgrade.css?v=20260812-r1';
 document.head.appendChild(link);
}

function cleanGuidedSessionLanguage(){
 const earnHeader=$('#view-earn .app-header small');
 if(earnHeader)earnHeader.textContent='Structured guided sessions with clear limits and approval.';
 const subtitle=$('#chat-subtitle');
 if(subtitle){
  const parts=subtitle.textContent.split('·').map(part=>part.trim()).filter(Boolean);
  subtitle.textContent=parts.length>1?`Guided Session · ${parts.slice(1).join(' · ')}`:'Guided session';
 }
 const activeTitle=$('#chat-title');
 if(activeTitle&&legacyNames.has(activeTitle.textContent.trim()))activeTitle.textContent=legacyNames.get(activeTitle.textContent.trim());
 for(const card of $$('.partner-card')){
  const title=$('h3',card);
  if(title&&legacyNames.has(title.textContent.trim()))title.textContent=legacyNames.get(title.textContent.trim());
  const description=$('header p',card);
  if(description){
   const parts=description.textContent.split('·').map(part=>part.trim()).filter(Boolean);
   const topic=parts.length>1?parts.slice(1).join(' · '):parts[0]||'Structured activity';
   description.textContent=`Guided Session · ${topic}`;
  }
  for(const tag of $$('.tag',card))if(/guided conversation partner/i.test(tag.textContent))tag.textContent='Guided session';
 }
 const chatPerson=$('#view-chat .chat-person');
 if(chatPerson){
  const small=$('small',chatPerson);
  if(small)small.textContent='Guided session';
 }
 const firstMessage=$('#chat-messages .msg.them');
 if(firstMessage&&/^Hi,\s*I[’']m\s+/i.test(firstMessage.textContent)){
  firstMessage.textContent=firstMessage.textContent.replace(/^Hi,\s*I[’']m\s+[^.]+\.\s*/i,'Welcome. ');
 }
}

function cleanPublicCopy(){
 const earnCards=$$('#view-landing .earn-grid article');
 for(const card of earnCards){
  const heading=$('h3',card)?.textContent.trim();
  if(heading==='Guided chats'){
   const p=$('p',card);if(p)p.textContent='Complete structured guided sessions with clear reply and timing requirements.';
  }
  if(heading==='Qualified referrals'){
   $('h3',card).textContent='Referrals';
   const p=$('p',card);if(p)p.textContent='A genuine signup through your link counts toward withdrawal progress. Referral rewards use separate activity qualification.';
  }
 }
 const referralHeader=$('#view-referrals .app-header small');
 if(referralHeader)referralHeader.textContent='Track registrations for withdrawal progress and qualification for referral rewards.';
}

function statusItem(done,label,value){
 return `<div class="readiness-item ${done?'done':''}"><span>${done?'✓':'•'}</span><div><b>${esc(label)}</b><small>${esc(value)}</small></div></div>`;
}

function readinessMarkup(data){
 const country=data.country_code==='KE'?'KE':'NG';
 const referrals=Number(data.current_referrals||0);
 const requiredReferrals=Number(data.required_referrals||0);
 const days=Number(data.current_days||0);
 const requiredDays=Number(data.required_days||0);
 const minimum=Number(data.minimum_balance||0);
 const available=Number(data.available_balance||0);
 const mode=data.referral_count_mode==='qualified'?'qualified':'registered';
 const kycRequired=Boolean(data.kyc_required);
 const kycLabel=kycRequired?String(data.kyc_status||'not submitted').replaceAll('_',' '):'not required';
 return `<header><div><span class="eyebrow">WITHDRAWAL PROGRESS</span><h2>${data.ready?'Requirements complete':'Your current requirements'}</h2></div><span class="tag">${esc(String(data.wallet||'work'))} wallet</span></header>
 <div class="readiness-grid">
  ${statusItem(Boolean(data.days_complete),'Account age',`${days} of ${requiredDays} days`)}
  ${statusItem(Boolean(data.referrals_complete),'Referrals',`${referrals} of ${requiredReferrals} ${mode}`)}
  ${statusItem(Boolean(data.kyc_complete),'Verification',kycLabel)}
  ${statusItem(Boolean(data.balance_complete),'Minimum balance',`${money(available,country)} available · ${money(minimum,country)} required`)}
 </div>
 ${data.security_clear===false?'<p class="form-message error show">This account currently needs a security review before withdrawal.</p>':''}`;
}

function ensureReadinessCard(view,data){
 let card=$('.withdrawal-readiness-card',view);
 if(!card){
  card=document.createElement('article');
  card.className='card withdrawal-readiness-card';
  if(view.id==='view-home'){
   const anchor=$('.next-action',view)||$('.home-secondary-grid',view);
   anchor?.insertAdjacentElement('afterend',card);
  }else if(view.id==='view-referrals'){
   const anchor=$('.field',view)||$('.balance-card',view);
   anchor?.insertAdjacentElement('beforebegin',card);
  }else{
   const anchor=$('.wallet-tabs',view)||$('.app-header',view);
   anchor?.insertAdjacentElement('afterend',card);
  }
 }
 if(card)card.innerHTML=readinessMarkup(data);
}

async function refreshWithdrawalReadiness(){
 const views=['#view-home','#view-referrals','#view-withdraw'].map(id=>$(id)).filter(Boolean);
 if(!views.some(view=>view.classList.contains('active')))return;
 const token=++readinessToken;
 try{
  const wallet=$('#view-withdraw.active #wallet-ref.active')?'referral':'work';
  const data=await loadWithdrawalReadiness(wallet);
  if(token!==readinessToken||!data)return;
  for(const view of views)if(view.classList.contains('active'))ensureReadinessCard(view,data);
 }catch(error){
  if(token!==readinessToken)return;
  console.warn('Withdrawal readiness unavailable:',error?.message||error);
 }
}

function referralExplanation(){
 const view=$('#view-referrals');
 if(!view)return;
 let box=$('#referral-rule-note',view);
 if(!box){
  box=document.createElement('article');
  box.id='referral-rule-note';
  box.className='card referral-rule-note';
  const list=$('#ref-list',view);
  list?.insertAdjacentElement('beforebegin',box);
 }
 if(box)box.innerHTML='<h3>Two referral statuses</h3><p><b>Registered:</b> counts toward your withdrawal referral requirement as soon as a genuine account is created through your link.</p><p><b>Qualified:</b> used separately to decide referral reward and commission eligibility after the required activity.</p>';
}

function refresh(){
 ensureStyles();
 cleanPublicCopy();
 cleanGuidedSessionLanguage();
 referralExplanation();
 void refreshWithdrawalReadiness();
}

window.addEventListener('earnchat:route-change',refresh);
window.addEventListener('earnchat:member-state',()=>void refreshWithdrawalReadiness());
window.addEventListener('earnchat:config-updated',refresh);
window.addEventListener('earnchat:admin-config-saved',()=>void refreshWithdrawalReadiness());
document.addEventListener('click',event=>{
 if(event.target.closest('#wallet-work,#wallet-ref'))setTimeout(()=>void refreshWithdrawalReadiness(),0);
});
document.addEventListener('DOMContentLoaded',refresh);
