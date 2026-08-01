import{api}from'../api.js';

const SESSION_KEY='earnchat-analytics-session';
const sid=sessionStorage.getItem(SESSION_KEY)||crypto.randomUUID();
sessionStorage.setItem(SESSION_KEY,sid);
let lastRoute='';
const recent=new Map();

function route(){return location.hash.replace(/^#\/?/,'')||'landing'}
function record(name,metadata={}){
  api.event(name,sid,route(),metadata).catch(()=>{});
}
function deduped(name,metadata={}){
  const key=`${name}:${JSON.stringify(metadata)}`,now=Date.now(),last=recent.get(key)||0;
  if(now-last<1000)return;
  recent.set(key,now);
  if(recent.size>40){for(const [entry,time] of recent)if(now-time>5000)recent.delete(entry)}
  record(name,metadata);
}
function routeView(){
  const current=route();
  if(current===lastRoute)return;
  lastRoute=current;
  record('route_view',{route:current});
}

window.addEventListener('hashchange',routeView);
window.addEventListener('pageshow',routeView);
document.addEventListener('earnchat:route-view',event=>deduped('route_view',event.detail||{}));
document.addEventListener('earnchat:signup-clicked',()=>deduped('signup_clicked'));
document.addEventListener('earnchat:task-opened',event=>deduped('task_guide_opened',{task_id:event.detail?.taskId||null}));
document.addEventListener('earnchat:chat-completion-requested',()=>deduped('chat_completion_requested'));
document.addEventListener('earnchat:withdrawal-requested',event=>deduped('withdrawal_submission_requested',{wallet:event.detail?.wallet||null}));
document.addEventListener('earnchat:upgrade-opened',()=>deduped('upgrade_opened'));
document.addEventListener('earnchat:referral-shared',event=>deduped('referral_shared',{channel:event.detail?.channel||'unknown'}));
routeView();
