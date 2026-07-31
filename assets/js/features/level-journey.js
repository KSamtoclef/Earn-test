import{api}from'../api.js';
import{money}from'../app-config.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const ORDER=['Starter','Active','Pro','Elite'];
const CACHE_MS=8000;
let lastState=null,lastLoadedAt=0,timer=null,statePromise=null;

function currentRoute(){return document.body.dataset.route||location.hash.replace(/^#\/?/,'').split('?')[0]}
function ensureShell(){
 let section=$('#view-upgrade');
 if(!section){
  section=document.createElement('section');
  section.id='view-upgrade';
  section.className='view';
  section.innerHTML='<div class="container"><header class="app-header"><div><h1>Upgrade</h1><small>Earn higher levels through genuine activity.</small></div><button class="level-pill-button" data-go="upgrade" type="button" aria-label="View current level progress">Starter</button></header><div id="upgrade-content"><article class="card"><b>Loading your level journey…</b><p>Checking your points, activity and level requirements.</p></article></div></div>';
  const admin=$('#view-admin');
  (admin||$('main.app-shell')).insertAdjacentElement(admin?'beforebegin':'beforeend',section);
 }
 const nav=$('.bottom-nav');
 if(nav&&nav.dataset.levelNav!=='1'){
  nav.dataset.levelNav='1';
  nav.innerHTML='<button data-route="home" data-go="home"><span>⌂</span>Home</button><button data-route="earn" data-go="earn"><span>⚡</span>Earn</button><button data-route="upgrade" data-go="upgrade"><span>↑</span>Upgrade</button><button data-route="referrals" data-go="referrals"><span>👥</span>Referrals</button><button data-route="profile" data-go="profile"><span>◉</span>Profile</button>';
 }
 if(location.hash.replace(/^#\/?/,'').startsWith('upgrade')){
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view===section));
  document.body.dataset.route='upgrade';
  document.body.classList.remove('hide-bottom-nav');
  if(nav)nav.hidden=false;
  $$('[data-route]',nav||document).forEach(button=>button.classList.toggle('active',button.dataset.route==='upgrade'));
 }
}
function daysSince(value){const t=Date.parse(value||'');return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):0}
function countryAmount(base,country,multiplier){return Math.round(Number(base||0)*(country==='KE'?Number(multiplier||.6):1))}
function formatAmount(base,state){return money(countryAmount(base,state.profile?.country||'NG',state.config?.settings?.kenya_multiplier),state.profile?.country||'NG')}
function requirement(key,label,current,target,action,help){const c=Math.max(0,Number(current||0)),t=Math.max(0,Number(target||0));return{key,label,current:c,target:t,done:t===0||c>=t,action,help}}
function kycRequirement(profile,target){const needed=target?.kyc_requirement||'none',status=profile.kyc_status||'not_submitted';if(needed==='none')return requirement('kyc','KYC',1,1,null,'No KYC required for this level.');const done=needed==='submitted'?['submitted','under_review','approved'].includes(status):status==='approved';return{key:'kyc',label:needed==='approved'?'Approved KYC':'Submit KYC',current:done?1:0,target:1,done,action:'profile',help:done?`Current status: ${status.replace('_',' ')}`:`Current status: ${status.replace('_',' ')}. Complete verification in Profile.`}}
function requirementList(state,target){const p=state.profile||{};return[
 requirement('points','Activity Points',p.activity_points,target.points_required,'points','Earn points from approved chats, tasks, active days, KYC and qualified referrals.'),
 requirement('account-days','Account days',daysSince(p.account_created_at),target.account_days,null,'Account age increases automatically each day.'),
 requirement('active-days','Active days',p.active_days_count,target.active_days,'home','Complete a qualifying chat or task on different days.'),
 requirement('chats','Approved chats',p.approved_chats_count,target.approved_chats,'earn','Complete guided conversations that pass approval.'),
 requirement('tasks','Approved tasks',p.approved_tasks_count,target.approved_tasks,'tasks','Complete available tasks and submit valid proof.'),
 kycRequirement(p,target)
]}
function currentIndex(name){const i=ORDER.indexOf(name);return i<0?0:i}
function benefitRows(state,name){const l=state.config?.levels?.[name]||{};return[
 ['Chat reward',formatAmount(l.chat_reward_ngn||0,state)],
 ['Daily chats',String(Number(l.chat_limit||0))],
 ['Referral commission',`${Number(l.referral_commission_percent||0)}%`],
 ['Withdrawal minimum',formatAmount(l.withdraw_min_ngn||0,state)],
 ['Activity Points',String(Number(l.points_required||0))]
]}
function levelStatus(current,name){const ci=currentIndex(current),i=currentIndex(name);return i<ci?'Completed':i===ci?'Current':i===ci+1?'Next':'Locked'}
function levelCard(state,name){const current=state.profile?.level_name||'Starter',l=state.config?.levels?.[name]||{},status=levelStatus(current,name),benefits=benefitRows(state,name).map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('');return`<article class="upgrade-level-card ${status.toLowerCase()}"><header><div><span class="level-state">${status}</span><h2>${name}</h2></div><span class="level-rank">${Number(l.rank||ORDER.indexOf(name)+1)}</span></header><div class="level-benefits">${benefits}</div><p>${name==='Starter'?'Your starting level. Build genuine activity to unlock more.':`${Number(l.account_days||0)} account days · ${Number(l.active_days||0)} active days · ${Number(l.approved_chats||0)} chats · ${Number(l.approved_tasks||0)} tasks`}</p>${status==='Next'?'<button class="secondary" data-scroll="next-requirements" type="button">View requirements</button>':''}</article>`}
function actionLabel(item){if(item.key==='points')return'How to earn points';if(item.key==='active-days')return'Go to today’s checklist';if(item.key==='chats')return'Open guided chats';if(item.key==='tasks')return'Open tasks';if(item.key==='kyc')return'Open KYC';return''}
function requirementCard(item){const pct=item.target?Math.min(100,Math.round(item.current/item.target*100)):100,remaining=Math.max(0,item.target-item.current);return`<article class="upgrade-requirement ${item.done?'done':''}" data-requirement="${item.key}"><span class="requirement-icon">${item.done?'✓':'○'}</span><div><header><b>${item.label}</b><strong>${Math.min(item.current,item.target)} / ${item.target}</strong></header><div class="progress"><i style="width:${pct}%"></i></div><p>${item.done?'Completed.':item.key==='account-days'?`${remaining} day${remaining===1?'':'s'} remaining. ${item.help}`:item.help}</p>${item.action?`<button class="text-action" data-requirement-action="${item.action}" type="button">${actionLabel(item)} →</button>`:''}</div></article>`}
function progressData(state){const current=state.profile?.level_name||'Starter',index=currentIndex(current),next=ORDER[Math.min(index+1,ORDER.length-1)],target=state.config?.levels?.[next]||{},requirements=requirementList(state,target),required=requirements.filter(x=>x.target>0),score=current==='Elite'?100:Math.round(required.reduce((sum,item)=>sum+Math.min(100,item.target?item.current/item.target*100:100),0)/(required.length||1));return{current,next,target,requirements,score,isTop:current==='Elite'}}
function renderUpgrade(state){const host=$('#upgrade-content');if(!host)return;const data=progressData(state),points=Number(state.profile?.activity_points||0),rate=Number(state.config?.levels?.[data.current]?.referral_commission_percent||0);host.innerHTML=`<section class="upgrade-hero"><div><span class="eyebrow">YOUR LEVEL JOURNEY</span><h2>${data.isTop?'Elite unlocked':`${data.current} → ${data.next}`}</h2><p>${data.isTop?'You have reached the highest level. Keep your account quality strong.':'No payment required. Complete genuine platform activity to move forward.'}</p></div><div class="upgrade-score"><b>${data.score}%</b><small>${data.isTop?'COMPLETE':'READY'}</small></div><div class="progress"><i style="width:${data.score}%"></i></div><div class="upgrade-current-stats"><span><b>${points}</b> Activity Points</span><span><b>${rate}%</b> referral commission</span><span><b>${formatAmount(state.config?.levels?.[data.current]?.chat_reward_ngn||0,state)}</b> per chat</span></div></section><section class="upgrade-map"><div class="section-title"><h2>All levels</h2><p>See what each level unlocks.</p></div><div class="upgrade-level-grid">${ORDER.map(name=>levelCard(state,name)).join('')}</div></section>${data.isTop?'':`<section id="next-requirements" class="upgrade-requirements-section"><div class="section-title"><h2>What to do next</h2><p>Complete every requirement below to unlock ${data.next}.</p></div><div class="upgrade-requirements">${data.requirements.map(requirementCard).join('')}</div></section>`}<section id="activity-points-guide" class="points-guide"><div class="section-title"><h2>How Activity Points work</h2><p>Points help you progress, but every other level requirement must also be completed.</p></div><div class="points-grid"><button data-go="earn" type="button"><b>+2</b><span>Approved guided chat</span></button><button data-go="tasks" type="button"><b>+3</b><span>Approved task</span></button><button data-go="home" type="button"><b>+5</b><span>Qualifying active day</span></button><button data-go="profile" type="button"><b>+10</b><span>Approved KYC</span></button><button data-go="referrals" type="button"><b>+10</b><span>Qualified referral</span></button></div></section>`;const pill=$('#view-upgrade .level-pill-button');if(pill){pill.textContent=data.current;pill.setAttribute('aria-label',`View ${data.current} level progress`)}}
function renderCompact(state){const data=progressData(state);const home=$('#view-home .container');if(home){let card=$('#home-upgrade-summary');if(!card){card=document.createElement('section');card.id='home-upgrade-summary';card.className='home-upgrade-summary';const balance=$('.balance-card',home);balance?.insertAdjacentElement('afterend',card)}const missing=data.requirements.filter(x=>!x.done).slice(0,3);card.innerHTML=`<header><div><span class="eyebrow">LEVEL PROGRESS</span><h2>${data.current} → ${data.next}</h2></div><b>${data.score}%</b></header><div class="progress"><i style="width:${data.score}%"></i></div><ul>${missing.map(x=>`<li><span>○</span>${x.key==='account-days'?`${Math.max(0,x.target-x.current)} account days remaining`:`${Math.max(0,x.target-x.current)} more ${x.label.toLowerCase()}`}</li>`).join('')||'<li><span>✓</span>All next-level requirements completed</li>'}</ul><button class="primary" data-go="upgrade" type="button">View upgrade journey</button>`}
 const route=currentRoute(),target=['earn','tasks','visits','referrals','withdraw','profile'].includes(route)?$(`#view-${route} .container`):null;if(target){let strip=$(`#view-${route} .route-level-strip`);if(!strip){strip=document.createElement('button');strip.type='button';strip.className='route-level-strip';strip.dataset.go='upgrade';const header=$('.app-header',target);header?.insertAdjacentElement('afterend',strip)}strip.innerHTML=`<span><b>${data.current}</b><small>${data.score}% toward ${data.next}</small></span><strong>View criteria →</strong>`}}
function makeLevelControls(){$$('.app-header .pill').forEach(span=>{if(span.tagName==='BUTTON')return;const button=document.createElement('button');button.type='button';button.className=`${span.className} level-pill-button`;button.dataset.go='upgrade';button.textContent=span.textContent||'Starter';button.setAttribute('aria-label',`View ${button.textContent.trim()} level progress`);span.replaceWith(button)});const homeLevel=$('#home-level');if(homeLevel&&homeLevel.dataset.levelReady!=='1'){homeLevel.dataset.levelReady='1';homeLevel.setAttribute('role','button');homeLevel.setAttribute('tabindex','0');homeLevel.setAttribute('aria-label','View level progress');homeLevel.onclick=()=>location.hash='#/upgrade';homeLevel.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();location.hash='#/upgrade'}}}const progress=$('#view-progress');if(progress){progress.dataset.go='upgrade';progress.textContent='Upgrade progress →'}}
function unlockLockedTaskButtons(){$$('.task-start[disabled],.task-start.locked-level-action').forEach(button=>{button.disabled=false;button.classList.add('locked-level-action');button.dataset.go='upgrade';button.removeAttribute('data-id');button.setAttribute('aria-label',`${button.textContent}. View upgrade requirements`)})}
async function state(force=false){if(!force&&lastState&&Date.now()-lastLoadedAt<CACHE_MS)return lastState;if(statePromise)return statePromise;statePromise=api.state().then(data=>{if(!data?.profile)throw new Error('Your level profile was not returned.');lastState=data;lastLoadedAt=Date.now();return data}).finally(()=>{statePromise=null});return statePromise}
function showLoadError(error){const host=$('#upgrade-content');if(!host)return;host.innerHTML=`<article class="card upgrade-load-error"><h2>Level progress could not load</h2><p>${String(error?.message||'Check your connection and try again.')}</p><button id="upgrade-retry" class="primary" type="button">Retry level progress</button></article>`;$('#upgrade-retry')?.addEventListener('click',()=>schedule(0,true),{once:true})}
async function enhance(force=false){ensureShell();makeLevelControls();unlockLockedTaskButtons();const route=currentRoute();if(!['home','earn','tasks','visits','upgrade','referrals','withdraw','profile'].includes(route))return;try{const data=await state(force);renderCompact(data);if(route==='upgrade')renderUpgrade(data)}catch(error){if(route==='upgrade')showLoadError(error)}}
function schedule(delay=80,force=false){clearTimeout(timer);timer=setTimeout(()=>enhance(force),delay)}

document.addEventListener('click',event=>{const scroll=event.target.closest('[data-scroll]');if(scroll){document.getElementById(scroll.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'});return}const action=event.target.closest('[data-requirement-action]');if(!action)return;const target=action.dataset.requirementAction;if(target==='points'){document.getElementById('activity-points-guide')?.scrollIntoView({behavior:'smooth',block:'start'});return}location.hash=`#/${target}`;setTimeout(()=>{if(target==='home')document.getElementById('member-welcome-card')?.scrollIntoView({behavior:'smooth',block:'start'});if(target==='profile')document.getElementById('submit-kyc')?.scrollIntoView({behavior:'smooth',block:'center'})},180)},true);
window.addEventListener('earnchat:member-state',event=>{if(!event.detail)return;lastState=event.detail;lastLoadedAt=Date.now();schedule(0,false)});
window.addEventListener('hashchange',()=>schedule(30,false));
window.addEventListener('pageshow',()=>schedule(60,false));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(60,true)});
ensureShell();schedule(0,true);
