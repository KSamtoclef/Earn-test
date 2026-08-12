import{money}from'../app-config.js';
import{loadWithdrawalReadiness}from'./withdrawal-readiness.js';

const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let readinessToken=0;

function ensureStyles(){
 if($('#earnchat-professional-upgrade-css'))return;
 const link=document.createElement('link');
 link.id='earnchat-professional-upgrade-css';
 link.rel='stylesheet';
 link.href='./assets/css/professional-upgrade.css?v=20260812-r3';
 document.head.appendChild(link);
}
function humanStatus(value){const text=String(value||'not_submitted').replaceAll('_',' ').trim();return text?text.charAt(0).toUpperCase()+text.slice(1):'Not submitted'}
function referralModeLabel(data){return data.referral_count_mode==='qualified'?'qualified':'registered'}
function statusItem(done,label,value){return`<div class="readiness-item ${done?'done':''}"><span>${done?'✓':'•'}</span><div><b>${esc(label)}</b><small>${esc(value)}</small></div></div>`}
function readinessMarkup(data){
 const country=data.country_code==='KE'?'KE':'NG';
 const referrals=Number(data.current_referrals||0),requiredReferrals=Number(data.required_referrals||0);
 const days=Number(data.current_days||0),requiredDays=Number(data.required_days||0);
 const minimum=Number(data.minimum_balance||0),available=Number(data.available_balance||0);
 const kycRequired=Boolean(data.kyc_required),mode=referralModeLabel(data);
 const kycLabel=kycRequired?humanStatus(data.kyc_status):'Not required';
 const extra=[];
 if(data.withdrawals_enabled===false)extra.push(statusItem(false,'Withdrawals','Temporarily unavailable'));
 if(data.payout_method_available===false)extra.push(statusItem(false,'Payout method','No payout method is currently available'));
 if(data.open_request_capacity===false)extra.push(statusItem(false,'Open request','Wait for your current withdrawal to finish'));
 return `<header><div><span class="eyebrow">WITHDRAWAL PROGRESS</span><h2>${data.ready?'Requirements complete':'Your current requirements'}</h2></div><span class="tag">${esc(String(data.wallet||'work'))} wallet</span></header><div class="readiness-grid">${statusItem(Boolean(data.days_complete),'Account age',`${days} of ${requiredDays} complete days`)}${statusItem(Boolean(data.referrals_complete),'Referrals',`${referrals} of ${requiredReferrals} ${mode}`)}${statusItem(Boolean(data.kyc_complete),'Verification',kycLabel)}${statusItem(Boolean(data.balance_complete),'Minimum balance',`${money(available,country)} available · ${money(minimum,country)} required`)}${extra.join('')}</div>${data.security_clear===false?'<p class="form-message error show">This account currently needs a security review before withdrawal.</p>':''}`;
}
function homeReadinessMarkup(data){
 const checks=[data.days_complete,data.referrals_complete,data.kyc_complete,data.balance_complete,data.security_clear!==false,data.withdrawals_enabled!==false,data.payout_method_available!==false,data.open_request_capacity!==false];
 const complete=checks.filter(Boolean).length;
 return`<header><div><span class="eyebrow">WITHDRAWAL</span><h3>${data.ready?'Ready when you choose to withdraw':`${complete} of ${checks.length} checks complete`}</h3></div><span class="tag">${data.ready?'Ready':'In progress'}</span></header><p>Your account age, referral rule, verification, balance and payout availability are checked by the server.</p><button class="secondary" data-go="withdraw" type="button">View withdrawal requirements</button>`;
}
function applyWithdrawalButton(data){
 const button=$('#withdraw-form button[type="submit"]');if(!button)return;
 let note=$('#withdraw-eligibility-note');if(!note){note=document.createElement('p');note.id='withdraw-eligibility-note';note.className='field-help withdrawal-eligibility-note';button.insertAdjacentElement('beforebegin',note)}
 const missing=[];
 if(data.withdrawals_enabled===false)missing.push('withdrawals currently unavailable');
 if(data.payout_method_available===false)missing.push('payout method');
 if(data.open_request_capacity===false)missing.push('current withdrawal must finish');
 if(!data.days_complete)missing.push('account age');
 if(!data.referrals_complete)missing.push(`${referralModeLabel(data)} referrals`);
 if(!data.kyc_complete)missing.push('verification');
 if(!data.balance_complete)missing.push('minimum balance');
 if(data.security_clear===false)missing.push('security review');
 button.disabled=!data.ready;
 button.textContent=data.ready?'Request withdrawal':'Complete requirements first';
 note.textContent=data.ready?'All withdrawal checks are complete.':`Still needed: ${missing.join(', ')}.`;
 note.classList.toggle('ready',Boolean(data.ready));
}
function ensureReadinessCard(view,data){
 let card=$('.withdrawal-readiness-card',view);
 if(!card){
  card=document.createElement('article');card.className='card withdrawal-readiness-card';
  if(view.id==='view-home'){const anchor=$('.next-action',view)||$('.home-secondary-grid',view);anchor?.insertAdjacentElement('afterend',card)}
  else{const anchor=$('.wallet-tabs',view)||$('.app-header',view);anchor?.insertAdjacentElement('afterend',card)}
 }
 if(card){card.classList.toggle('home-readiness',view.id==='view-home');card.innerHTML=view.id==='view-home'?homeReadinessMarkup(data):readinessMarkup(data)}
 if(view.id==='view-withdraw')applyWithdrawalButton(data);
}
async function refreshWithdrawalReadiness(){
 const views=['#view-home','#view-withdraw'].map(id=>$(id)).filter(Boolean);
 if(!views.some(view=>view.classList.contains('active')))return;
 const token=++readinessToken;
 try{
  const wallet=$('#view-withdraw.active #wallet-ref.active')?'referral':'work';
  const data=await loadWithdrawalReadiness(wallet);
  if(token!==readinessToken||!data)return;
  for(const view of views)if(view.classList.contains('active'))ensureReadinessCard(view,data);
 }catch(error){if(token!==readinessToken)return;console.warn('Withdrawal readiness unavailable:',error?.message||error)}
}
function formatProfileStatus(){const node=$('#profile-kyc');if(node)node.textContent=humanStatus(node.textContent)}
function referralExplanation(){
 const box=$('#referral-explainer');
 if(box)box.innerHTML='<h3>How referrals count</h3><p>A genuine signup can count toward withdrawal immediately. Referral rewards remain separate and are credited only after the configured qualification activity.</p>';
}
function enforcePostSessionActions(){
 const ready=$('#chat-ready');if(!ready)return;
 const buttons=[...ready.querySelectorAll('[data-chat-next]')];if(!buttons.length)return;
 for(const button of buttons){
  const route=button.dataset.chatNext;
  if(route==='visits'){button.textContent='Sponsored visits';button.className='primary'}
  else if(route==='referrals'){button.textContent='Referrals';button.className='secondary'}
  else button.remove();
 }
}
function watchPostSessionActions(){
 const ready=$('#chat-ready');if(!ready||ready.dataset.postSessionWatch==='1')return;
 ready.dataset.postSessionWatch='1';
 new MutationObserver(enforcePostSessionActions).observe(ready,{childList:true,subtree:true});
 enforcePostSessionActions();
}
function refresh(){ensureStyles();formatProfileStatus();referralExplanation();watchPostSessionActions();enforcePostSessionActions();void refreshWithdrawalReadiness()}
function refreshSoon(){requestAnimationFrame(refresh);setTimeout(refresh,120)}

window.addEventListener('earnchat:member-state',refreshSoon);
window.addEventListener('earnchat:config-updated',refreshSoon);
window.addEventListener('earnchat:admin-config-saved',refreshSoon);
document.addEventListener('earnchat:route-view',refreshSoon);
document.addEventListener('earnchat:chat-completion-requested',()=>setTimeout(enforcePostSessionActions,0));
document.addEventListener('click',event=>{if(event.target.closest('#wallet-work,#wallet-ref')){setTimeout(()=>void refreshWithdrawalReadiness(),40);setTimeout(()=>void refreshWithdrawalReadiness(),220)}});
document.addEventListener('DOMContentLoaded',refreshSoon);
