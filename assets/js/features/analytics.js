import{api}from'../api.js';
const sid=sessionStorage.getItem('earnchat-analytics-session')||crypto.randomUUID();sessionStorage.setItem('earnchat-analytics-session',sid);
let lastRoute='',lastAction='';
function route(){return location.hash.replace(/^#\/?/,'')||'landing'}
function record(name,metadata={}){api.event(name,sid,route(),metadata).catch(()=>{})}
function view(){const current=route();if(current===lastRoute)return;lastRoute=current;record('route_view',{route:current})}
function action(name,metadata={}){const key=`${name}:${JSON.stringify(metadata)}`;if(key===lastAction)return;lastAction=key;record(name,metadata);setTimeout(()=>{if(lastAction===key)lastAction=''},800)}
window.addEventListener('hashchange',view);
window.addEventListener('pageshow',view);
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-go]');
 if(target)action('navigation_click',{target:target.dataset.go});
 if(event.target.closest('#landing-cta'))action('signup_clicked');
 if(event.target.closest('.task-start'))action('task_guide_opened');
 if(event.target.closest('#chat-complete'))action('chat_completion_requested');
 if(event.target.closest('#withdraw-form button[type="submit"]'))action('withdrawal_submission_requested');
},{passive:true});
view();
