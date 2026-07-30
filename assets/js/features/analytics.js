import{api}from'../api.js';
const sid=sessionStorage.getItem('earnchat-analytics-session')||crypto.randomUUID();sessionStorage.setItem('earnchat-analytics-session',sid);
let last='';
function route(){return location.hash.replace(/^#\/?/,'')||'landing'}
function record(name,metadata={}){api.event(name,sid,route(),metadata).catch(()=>{})}
function view(){const r=route();if(r===last)return;last=r;record('route_view',{route:r})}
window.addEventListener('hashchange',view);window.addEventListener('pageshow',view);document.addEventListener('click',e=>{const go=e.target.closest('[data-go]');if(go)record('navigation_click',{target:go.dataset.go});if(e.target.closest('#landing-cta'))record('signup_clicked');if(e.target.closest('#chat-send'))record('chat_reply_sent');if(e.target.closest('.task-start'))record('task_guide_opened')},{passive:true});view();
