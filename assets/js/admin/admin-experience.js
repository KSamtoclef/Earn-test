const STYLE_ID='earnchat-admin-experience-style';
const TOOLBAR_ID='admin-workspace-toolbar';
const HISTORY_KEY='earnchat-admin-history';
let installed=false;
let suppressHistory=false;

const labels={overview:'Overview',live:'Live users',users:'Users',tasks:'Tasks',claims:'Task claims',chats:'Chats',referrals:'Referrals',qualifications:'Qualifications',withdrawals:'Withdrawals',kyc:'KYC',payments:'Payments',configuration:'Configuration',analytics:'Analytics',audit:'Audit log'};

function currentTab(){
 const active=document.querySelector('#admin-tabs [data-tab].active');
 return active?.dataset.tab||sessionStorage.getItem('earnchat-admin-tab')||'overview';
}
function readHistory(){
 try{return JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]').filter(x=>labels[x]).slice(-30)}catch{return[]}
}
function writeHistory(history){sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-30)))}
function pushHistory(tab){
 if(!tab||!labels[tab])return;
 const history=readHistory();
 if(history[history.length-1]!==tab)history.push(tab);
 writeHistory(history);
}
function updateToolbar(){
 const toolbar=document.getElementById(TOOLBAR_ID);
 if(!toolbar)return;
 const tab=currentTab();
 const current=toolbar.querySelector('[data-admin-current]');
 if(current)current.textContent=labels[tab]||'Administrator';
 const back=toolbar.querySelector('[data-admin-back]');
 if(back)back.disabled=readHistory().length===0;
}
function goTab(tab,{fromBack=false}={}){
 const button=document.querySelector(`#admin-tabs [data-tab="${CSS.escape(tab)}"]`);
 if(!button)return;
 suppressHistory=fromBack;
 button.click();
 suppressHistory=false;
 requestAnimationFrame(()=>{
  document.querySelector('#view-admin .app-header')?.scrollIntoView({block:'start',behavior:'smooth'});
  updateToolbar();
 });
}
function goBack(){
 const history=readHistory();
 const previous=history.pop();
 writeHistory(history);
 if(previous)goTab(previous,{fromBack:true});
 else goTab('overview',{fromBack:true});
}
function ensureStyles(){
 if(document.getElementById(STYLE_ID))return;
 const link=document.createElement('link');
 link.id=STYLE_ID;
 link.rel='stylesheet';
 link.href='./assets/css/admin-experience.css?v=20260809-adminux-r1';
 document.head.appendChild(link);
}
function ensureToolbar(){
 const header=document.querySelector('#view-admin .app-header');
 if(!header)return;
 const exit=header.querySelector('[data-go="home"]');
 if(exit){exit.textContent='Exit Admin → Customer Home';exit.classList.add('admin-exit-button')}
 let toolbar=document.getElementById(TOOLBAR_ID);
 if(!toolbar){
  toolbar=document.createElement('div');
  toolbar.id=TOOLBAR_ID;
  toolbar.className='admin-workspace-toolbar';
  toolbar.innerHTML='<button class="secondary admin-history-back" data-admin-back type="button">← Back</button><button class="secondary admin-overview-button" data-admin-overview type="button">⌂ Overview</button><div class="admin-breadcrumb"><small>ADMIN SECTION</small><b data-admin-current>Overview</b></div>';
  header.appendChild(toolbar);
  toolbar.querySelector('[data-admin-back]').addEventListener('click',goBack);
  toolbar.querySelector('[data-admin-overview]').addEventListener('click',()=>{const tab=currentTab();if(tab!=='overview')pushHistory(tab);goTab('overview',{fromBack:true})});
 }
 updateToolbar();
}
function installNavigationTracking(){
 if(installed)return;
 installed=true;
 document.addEventListener('click',event=>{
  const button=event.target.closest('#view-admin #admin-tabs [data-tab]');
  if(!button)return;
  const before=currentTab();
  const next=button.dataset.tab;
  if(!suppressHistory&&before&&before!==next)pushHistory(before);
  requestAnimationFrame(updateToolbar);
 },true);
 document.addEventListener('change',event=>{
  if(!event.target.matches('#view-admin #admin-section-select'))return;
  const before=currentTab();
  const next=event.target.value;
  if(!suppressHistory&&before&&before!==next)pushHistory(before);
  requestAnimationFrame(updateToolbar);
 },true);
 window.addEventListener('resize',()=>requestAnimationFrame(updateToolbar),{passive:true});
}

export function enhanceAdminExperience(){
 ensureStyles();
 ensureToolbar();
 installNavigationTracking();
 requestAnimationFrame(updateToolbar);
}
