import{sb}from'../supabase-client.js';

const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const ACTIVE_ROUTES=new Set(['tasks','visits']);
let lastRows=null,lastLoadedAt=0,loadPromise=null,renderToken=0;

function route(){return document.body.dataset.route||location.hash.replace(/^#\/?/,'').split('?')[0]||'landing'}
async function claims(force=false){
 if(!force&&lastRows&&Date.now()-lastLoadedAt<10000)return lastRows;
 if(loadPromise)return loadPromise;
 loadPromise=(async()=>{
  const session=(await sb.auth.getSession()).data.session;
  if(!session?.user)return[];
  const result=await sb.from('earnchat_task_claims').select('id,task_id,status,started_at,submitted_at,review_reason').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(100);
  if(result.error)throw result.error;
  const latest=new Map();
  (result.data||[]).forEach(row=>{if(!latest.has(row.task_id))latest.set(row.task_id,row)});
  lastRows=[...latest.values()];lastLoadedAt=Date.now();return lastRows;
 })().finally(()=>{loadPromise=null});
 return loadPromise;
}
function normalizedStatus(value){
 const status=String(value||'').toLowerCase();
 if(status==='started')return'incomplete';
 if(['pending','submitted','under_review'].includes(status))return'pending';
 if(status==='approved')return'approved';
 if(['rejected','cancelled','expired'].includes(status))return'rejected';
 return'available';
}
function statusFor(card,map){
 if(card.classList.contains('lock'))return{key:'locked',row:null};
 const id=q('.task-start',card)?.dataset.id,row=map.get(id);
 return{key:row?normalizedStatus(row.status):'available',row};
}
function copyFor(key,row){
 if(key==='incomplete')return{title:'Not completed',detail:'This activity was opened but not submitted. Restart it and complete every step before submitting.',button:'Restart task',disabled:false};
 if(key==='pending')return{title:'Pending review',detail:'Your submission was received. The reward will appear only after it is reviewed and approved.',button:'Pending review',disabled:true};
 if(key==='approved')return{title:'Approved',detail:'This activity has been reviewed and approved.',button:'Approved',disabled:true};
 if(key==='rejected')return{title:'Needs another attempt',detail:row?.review_reason||'The previous attempt was not approved. Restart the activity and follow every instruction.',button:'Restart task',disabled:false};
 if(key==='locked')return{title:'Locked',detail:'Reach the required level before starting this activity.',button:null,disabled:true};
 return null;
}
function decorateCard(card,key,row){
 card.dataset.taskStatus=key;
 card.classList.toggle('task-incomplete',key==='incomplete');
 card.classList.toggle('task-pending',key==='pending');
 card.classList.toggle('task-approved',key==='approved');
 card.classList.toggle('task-rejected',key==='rejected');
 q('.task-state-note',card)?.remove();
 const action=q('.task-start',card),copy=copyFor(key,row);
 if(!copy){if(action&&!card.classList.contains('lock')){action.disabled=false;action.textContent='View guide and start'}return}
 const note=document.createElement('div');
 note.className=`task-state-note ${key}`;
 note.innerHTML=`<b>${copy.title}</b><small>${copy.detail}</small>`;
 const guide=q('.guide',card);
 (guide||action)?.insertAdjacentElement(guide?'afterend':'beforebegin',note);
 if(action&&copy.button){
  action.disabled=copy.disabled;
  action.textContent=copy.button;
  action.dataset.taskLifecycle=key;
  if(key==='incomplete'||key==='rejected')action.setAttribute('aria-label',`${copy.button}: ${q('h3',card)?.textContent||'activity'}`);
 }
}
function applyFilter(host,tabs){
 const selected=q('.active',tabs)?.dataset.status||'all';
 qa(':scope > .list-card',host).forEach(card=>{card.hidden=selected!=='all'&&card.dataset.taskStatus!==selected});
}
async function enhance(force=false){
 const current=route();if(!ACTIVE_ROUTES.has(current))return;
 const token=++renderToken,host=q(current==='visits'?'#visit-list':'#task-list');if(!host)return;
 try{
  const rows=await claims(force);if(token!==renderToken||route()!==current)return;
  const map=new Map(rows.map(row=>[row.task_id,row]));
  let tabs=q('.task-status-tabs',host.parentElement);
  if(!tabs){
   tabs=document.createElement('div');tabs.className='task-status-tabs';
   tabs.innerHTML=[['all','All'],['available','Available'],['incomplete','Restart'],['pending','Pending review'],['approved','Approved'],['rejected','Try again'],['locked','Locked']].map(([value,label],index)=>`<button type="button" data-status="${value}" class="${index?'':'active'}">${label}</button>`).join('');
   host.before(tabs);
   tabs.onclick=event=>{const button=event.target.closest('[data-status]');if(!button)return;qa('button',tabs).forEach(item=>item.classList.toggle('active',item===button));applyFilter(host,tabs)};
  }
  qa(':scope > .list-card',host).forEach(card=>{const state=statusFor(card,map);decorateCard(card,state.key,state.row)});
  applyFilter(host,tabs);
 }catch(error){console.error('Task status enhancement failed:',error)}
}
function invalidate(){lastRows=null;lastLoadedAt=0;if(ACTIVE_ROUTES.has(route()))enhance(true)}
window.addEventListener('earnchat:route-view',event=>{if(ACTIVE_ROUTES.has(event.detail?.route))enhance()});
window.addEventListener('earnchat:member-state-invalidated',invalidate);
window.addEventListener('earnchat:task-started',invalidate);
window.addEventListener('earnchat:task-submitted',invalidate);
if(ACTIVE_ROUTES.has(route()))enhance();
