import{api}from'./api.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let currentState=null,currentConfig=null;

function addLandingExperience(){
 const stats=$('#view-landing .stats');
 if(!stats||$('#earnchat-reward-flow'))return;
 const hero=$('#view-landing .hero-copy');
 if(hero&&!$('.product-promise',hero)){
  const promise=document.createElement('div');promise.className='product-promise';promise.textContent='Your activity unlocks higher levels — never payment';hero.appendChild(promise);
  const actions=document.createElement('div');actions.className='hero-actions';actions.innerHTML='<button class="secondary" data-go="register" type="button">Create free account</button><button class="text-link" data-go="login" type="button">Member login →</button>';hero.appendChild(actions);
 }
 const section=document.createElement('section');
 section.id='earnchat-reward-flow';section.className='landing-section experience-section';
 section.innerHTML=`<div class="section-heading"><span>TRANSPARENT REWARDS</span><h2>Know what happens after every activity</h2><p>Earn Chat separates work in progress from money that is ready to use.</p></div><div class="reward-flow"><article><i>1</i><h3>Complete an activity</h3><p>Follow the chat, sponsored-visit or referral requirements shown on screen.</p></article><article><i>2</i><h3>Pending review</h3><p>Your submission is checked. You never need to repeat an item already pending.</p></article><article><i>3</i><h3>Available balance</h3><p>Approved rewards move into the correct country wallet and become withdrawable when eligible.</p></article></div><div class="section-heading" style="margin-top:2.5rem"><span>WORK-BASED LEVELS</span><h2>Earn your upgrade through real activity</h2><p>Approved chats, sponsored visits, active days and genuine referrals move you forward.</p></div><div class="level-path"><article><i>S</i><h3>Starter</h3><p>Learn the system and begin approved activities.</p></article><article><i>A</i><h3>Active</h3><p>Build a consistent record of completed work.</p></article><article><i>P</i><h3>Pro</h3><p>Unlock stronger limits through proven activity.</p></article><article><i>E</i><h3>Elite</h3><p>Reach the highest activity-based level.</p></article></div><div class="no-pay-note">No paid upgrade. No activation purchase. Your approved work controls your progress.</div>`;
 stats.insertAdjacentElement('afterend',section);
}

function homeClarity(state=currentState){
 const grid=$('#view-home .home-secondary-grid');
 if(!grid)return;
 let card=$('#home-clarity-card');
 if(!card){card=document.createElement('article');card.id='home-clarity-card';card.className='member-clarity-card';grid.insertAdjacentElement('afterend',card)}
 const profile=state?.profile||state?.member||{};
 const wallet=state?.wallet||{};
 const points=Number(profile.activity_points??state?.activity_points??0);
 const days=Number(profile.active_days_count??state?.active_days_count??0);
 const pending=Number(wallet.work_pending??0)+Number(wallet.referral_pending??0);
 card.innerHTML=`<header><div><h3>Your account at a glance</h3><p>See what is ready, what is pending, and what helps you reach the next level.</p></div></header><div class="member-clarity-grid"><div><small>Pending review</small><b>${pending?pending.toLocaleString():'Check activity history'}</b></div><div><small>Activity points</small><b>${points.toLocaleString()} AP</b></div><div><small>Active days</small><b>${days.toLocaleString()} active day${days===1?'':'s'}</b></div></div>`;
}

function ensureActivityGuide(containerId,type){
 const host=$(containerId);if(!host)return;
 const view=host.closest('.view');if(!view)return;
 let guide=$('.activity-guide',view);
 if(!guide){
  guide=document.createElement('section');guide.className='activity-guide';
  const visit=type==='visit';
  guide.innerHTML='<h2>Sponsored visits made simple</h2><p>Open the approved partner page, stay for the required time, then return to submit.</p><div class="activity-guide-grid"><span>1 · Check reward and time</span><span>2 · Follow the approved guide</span><span>3 · Return and submit</span></div>';
  host.insertAdjacentElement('beforebegin',guide);
  const key=document.createElement('div');key.className='task-status-key';key.innerHTML='<span>Available</span><span>In progress</span><span>Restart required</span><span>Pending review</span><span>Approved</span><span>Rejected</span>';guide.insertAdjacentElement('afterend',key);
 }
 enrichTaskCards(host,type);
}

function enrichTaskCards(host,type){
 for(const card of host.querySelectorAll('.list-card')){
  if(card.dataset.experienceReady)continue;
  const tags=[...card.querySelectorAll('.tag')].map(x=>x.textContent.trim()).filter(Boolean);
  card.dataset.experienceReady='1';
  if(!tags.length)continue;
  const meta=document.createElement('div');meta.className='experience-meta';
  meta.innerHTML=tags.slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')+'<span>Sponsored visit</span>';
  const guide=card.querySelector('.guide');if(guide)guide.insertAdjacentElement('beforebegin',meta);else card.appendChild(meta);
 }
}

function referralClarity(){
 const field=$('#view-referrals .field');if(!field)return;
 const cfg=currentConfig?.referrals||currentConfig?.configuration?.referrals||{};
 const days=Number(cfg.qualifying_active_days_count||cfg.required_active_days||2);
 let box=$('#referral-explainer');
 if(!box){box=document.createElement('section');box.id='referral-explainer';box.className='referral-explainer';field.insertAdjacentElement('beforebegin',box)}
 box.innerHTML=`<h3>How a referral becomes qualified</h3><p>Your link records the signup, but rewards are released only after genuine activity.</p><div class="referral-steps"><span>The member creates an account through your link</span><span>The member completes approved activity on ${days} active day${days===1?'':'s'}</span><span>The server confirms qualification and credits the correct country reward</span></div>`;
}

function upgradeClarity(){
 const view=$('#view-upgrade');if(!view||$('.earned-upgrade-banner',view))return;
 const container=$('.container',view);if(!container)return;
 const banner=document.createElement('section');banner.className='earned-upgrade-banner';
 banner.innerHTML='<h2>Earn your next level</h2><p>Your level increases through approved chats, sponsored visits, active days and genuine referrals. There is nothing to buy.</p><strong>Keep working—the dashboard will show exactly what remains.</strong>';
 const header=$('.app-header',container);if(header)header.insertAdjacentElement('afterend',banner);else container.prepend(banner);
}

function refreshExperience(){addLandingExperience();homeClarity();ensureActivityGuide('#visit-list','visit');referralClarity();upgradeClarity()}

for(const id of['#visit-list']){const host=$(id);if(host)new MutationObserver(()=>ensureActivityGuide(id,'visit')).observe(host,{childList:true})}
window.addEventListener('earnchat:member-state',event=>{currentState=event.detail;homeClarity(currentState)});
window.addEventListener('earnchat:config-updated',event=>{currentConfig=event.detail?.config||currentConfig;referralClarity()});
window.addEventListener('earnchat:route-change',refreshExperience);
document.addEventListener('DOMContentLoaded',async()=>{
 try{currentConfig=api.peekBusiness?.()||await api.business()}catch{}
 try{currentState=await api.state()}catch{}
 refreshExperience();
});
