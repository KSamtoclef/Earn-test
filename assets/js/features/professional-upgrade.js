import{money}from'../app-config.js';
import{loadWithdrawalReadiness}from'./withdrawal-readiness.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const legacyNames=new Map([
 ['Noah T.','Daily Check-in'],
 ['Amina R.','Planning Session'],
 ['Grace M.','Learning Session']
]);
const LEVEL_ORDER=['Starter','Active','Pro','Elite'];
let readinessToken=0,latestState=null;

function routeName(){return document.body.dataset.route||location.hash.replace(/^#\/?/,'').split('?')[0]||'landing'}
function ensureStyles(){
 if($('#earnchat-professional-upgrade-css'))return;
 const link=document.createElement('link');
 link.id='earnchat-professional-upgrade-css';
 link.rel='stylesheet';
 link.href='./assets/css/professional-upgrade.css?v=20260812-r2';
 document.head.appendChild(link);
}
function ensureUpgradeShell(){
 let view=$('#view-upgrade');
 if(!view){
  view=document.createElement('section');
  view.id='view-upgrade';
  view.className='view';
  view.innerHTML='<div class="container"><header class="app-header"><div><h1>Upgrade</h1><small>Progress through approved activity.</small></div><span class="pill">Starter</span></header><div id="upgrade-content"><article class="card professional-upgrade-fallback"><b>Loading your level progress…</b></article></div></div>';
  const admin=$('#view-admin');
  (admin||$('main.app-shell'))?.insertAdjacentElement(admin?'beforebegin':'beforeend',view);
 }
 if(routeName()==='upgrade'){
  $$('.view').forEach(section=>section.classList.toggle('active',section===view));
  document.body.dataset.route='upgrade';
  const nav=$('.bottom-nav');if(nav)nav.hidden=false;
  $$('[data-route]',nav||document).forEach(button=>button.classList.toggle('active',button.dataset.route==='upgrade'));
 }
 return view;
}
function daysSince(value){const time=Date.parse(value||'');return Number.isFinite(time)?Math.max(0,Math.floor((Date.now()-time)/86400000)):0}
function renderUpgradeFallback(state=latestState){
 if(routeName()!=='upgrade')return;
 const view=ensureUpgradeShell(),host=$('#upgrade-content',view);
 if(!host||host.querySelector('.upgrade-hero,.next-benefits,.upgrade-load-error'))return;
 if(!state?.profile){host.innerHTML='<article class="card professional-upgrade-fallback"><b>Loading your level progress…</b><p>Your current activity and level requirements will appear here.</p></article>';return}
 const current=state.profile.level_name||'Starter',index=Math.max(0,LEVEL_ORDER.indexOf(current)),next=LEVEL_ORDER[Math.min(LEVEL_ORDER.length-1,index+1)],isTop=index===LEVEL_ORDER.length-1,target=state.config?.levels?.[next]||{};
 const kycNeed=target.kyc_requirement||'none',kycStatus=state.profile.kyc_status||'not_submitted';
 const items=[
  ['Activity points',Number(state.profile.activity_points||0),Number(target.points_required||0)],
  ['Account days',daysSince(state.profile.account_created_at),Number(target.account_days||0)],
  ['Active days',Number(state.profile.active_days_count||0),Number(target.active_days||0)],
  ['Approved sessions',Number(state.profile.approved_chats_count||0),Number(target.approved_chats||0)]
 ];
 if(kycNeed!=='none')items.push(['KYC',kycStatus==='approved'||kycNeed==='submitted'&&['submitted','under_review','approved'].includes(kycStatus)?1:0,1]);
 const measured=items.filter(([, ,goal])=>goal>0),score=isTop?100:Math.round(measured.reduce((sum,[,now,goal])=>sum+Math.min(1,now/goal),0)/(measured.length||1)*100);
 const rows=items.filter(([, ,goal])=>goal>0).map(([label,now,goal])=>`<div class="fallback-requirement ${now>=goal?'done':''}"><span>${now>=goal?'✓':'○'}</span><div><b>${esc(label)}</b><small>${Math.min(now,goal)} of ${goal}</small></div></div>`).join('');
 host.innerHTML=`<section class="professional-upgrade-fallback"><span class="eyebrow">LEVEL PROGRESS</span><div class="fallback-level-line"><h2>${esc(current)}${isTop?'':` → ${esc(next)}`}</h2><b>${score}%</b></div><div class="progress"><i style="width:${score}%"></i></div>${isTop?'<p>You have reached the highest available level.</p>':`<div class="fallback-requirements">${rows}</div><button class="primary" data-go="earn" type="button">Continue earning</button>`}</section>`;
 const pill=$('#view-upgrade .pill');if(pill)pill.textContent=current;
}
function replaceText(node,pattern,replacement){if(node&&pattern.test(node.textContent))node.textContent=node.textContent.replace(pattern,replacement)}
function cleanGuidedSessionLanguage(){
 const earnHeader=$('#view-earn .app-header small');if(earnHeader)earnHeader.textContent='Structured guided sessions with clear requirements and approval.';
 const earnTitle=$('#view-earn .section-title h2');if(earnTitle)earnTitle.textContent='Available guided sessions';
 const summary=$('#earn-summary');
 if(summary){
  const eyebrow=$('.eyebrow',summary);if(eyebrow)eyebrow.textContent=eyebrow.textContent.replace(/CHAT PLAN/i,'SESSION PLAN');
  replaceText($('h3',summary),/guided chats?/gi,match=>match.toLowerCase().endsWith('s')?'guided sessions':'guided session');
 }
 for(const card of $$('.partner-card')){
  const title=$('h3',card);if(title&&legacyNames.has(title.textContent.trim()))title.textContent=legacyNames.get(title.textContent.trim());
  const description=$('header p',card);
  if(description){const parts=description.textContent.split('·').map(part=>part.trim()).filter(Boolean),topic=parts.length>1?parts.slice(1).join(' · '):parts[0]||'Structured activity';description.textContent=`Guided Session · ${topic}`}
  for(const tag of $$('.tag',card))if(/guided conversation partner/i.test(tag.textContent))tag.textContent='Guided session';
  const button=$('.start-chat',card);if(button&&!button.disabled)button.textContent='Start session';
 }
 const unavailable=$('#chat-partners .list-card h3');if(unavailable)unavailable.textContent=unavailable.textContent.replace(/Guided Chat is unavailable/i,'Guided sessions are unavailable').replace(/Daily chat limit reached/i,'Daily session limit reached');
 const homeProgress=$('#home-chat-progress');replaceText(homeProgress,/guided chats?/gi,match=>match.toLowerCase().endsWith('s')?'guided sessions':'guided session');
 const homeNext=$('#home-next-title');replaceText(homeNext,/guided chats?/gi,match=>match.toLowerCase().endsWith('s')?'guided sessions':'guided session');
 const homeButton=$('#home-next');if(homeButton&&/guided chat/i.test(homeButton.textContent))homeButton.textContent='Start session';
 for(const button of $$('#view-home .quick')){const title=$('b',button),small=$('small',button);if(title?.textContent.trim()==='Chat'){title.textContent='Sessions';if(small)small.textContent='Guided activities'}}
 const subtitle=$('#chat-subtitle');if(subtitle){const parts=subtitle.textContent.split('·').map(part=>part.trim()).filter(Boolean);subtitle.textContent=parts.length>1?`Guided Session · ${parts.slice(1).join(' · ')}`:'Guided session'}
 const activeTitle=$('#chat-title');if(activeTitle&&legacyNames.has(activeTitle.textContent.trim()))activeTitle.textContent=legacyNames.get(activeTitle.textContent.trim());
 const chatPerson=$('#view-chat .chat-person');if(chatPerson){const small=$('small',chatPerson);if(small&&!small.textContent.includes('·'))small.textContent='Guided session'}
 const firstMessage=$('#chat-messages .msg.them');if(firstMessage&&/^Hi,\s*I[’']m\s+/i.test(firstMessage.textContent))firstMessage.textContent=firstMessage.textContent.replace(/^Hi,\s*I[’']m\s+[^.]+\.\s*/i,'Welcome. ');
 const ready=$('#chat-ready');if(ready){replaceText($('b',ready),/Conversation requirements completed/i,'Session requirements completed');replaceText($('small',ready),/conversation/gi,'session');const complete=$('#chat-complete',ready);if(complete&&/conversation/i.test(complete.textContent))complete.textContent=complete.textContent.replace(/conversation/gi,'session')}
 const tour=$('#tour-modal .modal-sheet');if(tour){for(const node of $$('small,b',tour)){node.textContent=node.textContent.replace(/guided chats?/gi,match=>match.toLowerCase().endsWith('s')?'guided sessions':'guided session').replace(/one chat/gi,'one session')}}
}
function cleanPublicCopy(){
 const earnCards=$$('#view-landing .earn-grid article');
 for(const card of earnCards){const heading=$('h3',card)?.textContent.trim();if(heading==='Guided chats'||heading==='Guided Chat'){$('h3',card).textContent='Guided sessions';const p=$('p',card);if(p)p.textContent='Complete structured sessions with clear reply requirements.'}if(heading==='Qualified referrals'){$('h3',card).textContent='Referrals';const p=$('p',card);if(p)p.textContent='A genuine signup counts toward withdrawal progress; reward qualification is separate.'}}
 const referralHeader=$('#view-referrals .app-header small');if(referralHeader)referralHeader.textContent='Track signups and referral reward qualification.';
 const stats=$$('#view-landing .stats small');for(const node of stats)if(/Chats · sponsored visits · referrals/i.test(node.textContent))node.textContent='Sessions · sponsored visits · referrals';
 const none=$('#home-clarity-card .member-clarity-grid div:first-child b');if(none?.textContent==='None shown')none.textContent='None';
}
function cleanProfileStatus(){
 const node=$('#profile-kyc');if(!node)return;const value=String(node.textContent||'not_submitted').replaceAll('_',' ').trim();node.textContent=value?value.charAt(0).toUpperCase()+value.slice(1):'Not submitted';
}
function statusItem(done,label,value){return`<div class="readiness-item ${done?'done':''}"><span>${done?'✓':'•'}</span><div><b>${esc(label)}</b><small>${esc(value)}</small></div></div>`}
function readinessMarkup(data){
 const country=data.country_code==='KE'?'KE':'NG',referrals=Number(data.current_referrals||0),requiredReferrals=Number(data.required_referrals||0),days=Number(data.current_days||0),requiredDays=Number(data.required_days||0),minimum=Number(data.minimum_balance||0),available=Number(data.available_balance||0),kycRequired=Boolean(data.kyc_required),kycLabel=kycRequired?String(data.kyc_status||'not submitted').replaceAll('_',' '):'not required';
 return `<header><div><span class="eyebrow">WITHDRAWAL PROGRESS</span><h2>${data.ready?'Requirements complete':'Your current requirements'}</h2></div><span class="tag">${esc(String(data.wallet||'work'))} wallet</span></header><div class="readiness-grid">${statusItem(Boolean(data.days_complete),'Account age',`${days} of ${requiredDays} days`)}${statusItem(Boolean(data.referrals_complete),'Referrals',`${referrals} of ${requiredReferrals} registered`)}${statusItem(Boolean(data.kyc_complete),'Verification',kycLabel)}${statusItem(Boolean(data.balance_complete),'Minimum balance',`${money(available,country)} available · ${money(minimum,country)} required`)}</div>${data.security_clear===false?'<p class="form-message error show">This account currently needs a security review before withdrawal.</p>':''}`;
}
function homeReadinessMarkup(data){const complete=[data.days_complete,data.referrals_complete,data.kyc_complete,data.balance_complete].filter(Boolean).length;return`<header><div><span class="eyebrow">WITHDRAWAL</span><h3>${complete} of 4 requirements complete</h3></div><span class="tag">${data.ready?'Ready':'In progress'}</span></header><p>Account age, registered referrals, verification and minimum balance are checked securely.</p><button class="secondary" data-go="withdraw" type="button">View withdrawal requirements</button>`}
function applyWithdrawalButton(data){
 const button=$('#withdraw-form button[type="submit"]');if(!button)return;
 let note=$('#withdraw-eligibility-note');if(!note){note=document.createElement('p');note.id='withdraw-eligibility-note';note.className='field-help withdrawal-eligibility-note';button.insertAdjacentElement('beforebegin',note)}
 const missing=[];if(!data.days_complete)missing.push('account age');if(!data.referrals_complete)missing.push('referrals');if(!data.kyc_complete)missing.push('verification');if(!data.balance_complete)missing.push('minimum balance');if(data.security_clear===false)missing.push('security review');
 button.disabled=!data.ready;button.textContent=data.ready?'Request withdrawal':'Complete requirements first';
 note.textContent=data.ready?'All withdrawal requirements are complete.':`Still needed: ${missing.join(', ')}.`;
 note.classList.toggle('ready',Boolean(data.ready));
}
function ensureReadinessCard(view,data){
 let card=$('.withdrawal-readiness-card',view);
 if(!card){card=document.createElement('article');card.className='card withdrawal-readiness-card';if(view.id==='view-home'){const anchor=$('.next-action',view)||$('.home-secondary-grid',view);anchor?.insertAdjacentElement('afterend',card)}else{const anchor=$('.wallet-tabs',view)||$('.app-header',view);anchor?.insertAdjacentElement('afterend',card)}}
 if(card){card.classList.toggle('home-readiness',view.id==='view-home');card.innerHTML=view.id==='view-home'?homeReadinessMarkup(data):readinessMarkup(data)}
 if(view.id==='view-withdraw')applyWithdrawalButton(data);
}
async function refreshWithdrawalReadiness(){
 const views=['#view-home','#view-withdraw'].map(id=>$(id)).filter(Boolean);if(!views.some(view=>view.classList.contains('active')))return;
 const token=++readinessToken;
 try{const wallet=$('#view-withdraw.active #wallet-ref.active')?'referral':'work',data=await loadWithdrawalReadiness(wallet);if(token!==readinessToken||!data)return;for(const view of views)if(view.classList.contains('active'))ensureReadinessCard(view,data)}catch(error){if(token!==readinessToken)return;console.warn('Withdrawal readiness unavailable:',error?.message||error)}
}
function referralExplanation(){
 $('#referral-rule-note')?.remove();
 const box=$('#referral-explainer');if(box)box.innerHTML='<h3>How referrals count</h3><p><b>Registered</b> counts toward withdrawal as soon as a genuine signup is recorded. <b>Qualified</b> unlocks the referral reward after the required activity.</p>';
}
function refresh(){ensureStyles();ensureUpgradeShell();cleanPublicCopy();cleanGuidedSessionLanguage();cleanProfileStatus();referralExplanation();renderUpgradeFallback();void refreshWithdrawalReadiness()}
function refreshSoon(){requestAnimationFrame(refresh);setTimeout(refresh,120)}

window.addEventListener('earnchat:route-change',refreshSoon);
window.addEventListener('earnchat:member-state',event=>{latestState=event.detail||latestState;refreshSoon()});
window.addEventListener('earnchat:config-updated',refreshSoon);
window.addEventListener('earnchat:admin-config-saved',refreshSoon);
document.addEventListener('earnchat:route-view',refreshSoon);
document.addEventListener('click',event=>{if(event.target.closest('#wallet-work,#wallet-ref')){setTimeout(()=>void refreshWithdrawalReadiness(),40);setTimeout(()=>void refreshWithdrawalReadiness(),220)}if(event.target.closest('.start-chat'))setTimeout(refresh,220)});
document.addEventListener('DOMContentLoaded',refreshSoon);
ensureUpgradeShell();
