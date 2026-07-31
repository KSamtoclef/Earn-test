import{sb}from'../supabase-client.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let authenticated=false,enhanceTimer=null;

function addTheme(){
 if(document.querySelector('link[data-professional-ui]'))return;
 const link=document.createElement('link');
 link.rel='stylesheet';
 link.href='./assets/css/professional-ui.css?v=20260731-professional-ui-r1';
 link.dataset.professionalUi='1';
 document.head.appendChild(link);
}

function activate(route){location.hash=`#/${authenticated?route:'register'}`}

function makeInteractive(element,route,label){
 if(!element||element.dataset.interactiveReady==='1')return;
 element.dataset.interactiveReady='1';
 element.dataset.surfaceRoute=route;
 if(element.querySelector('button,a,input,select,textarea')){
  element.classList.add('designed-surface');
  return;
 }
 element.classList.add('interactive-surface');
 element.setAttribute('role','button');
 element.setAttribute('tabindex','0');
 element.setAttribute('aria-label',label);
 if(!element.querySelector('.surface-action')){
  const action=document.createElement('span');
  action.className='surface-action';
  action.textContent=label;
  element.appendChild(action);
 }
 const open=()=>activate(route);
 element.addEventListener('click',open);
 element.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  open();
 });
}

function addSectionCta(section,text,route){
 if(!section||section.querySelector('.section-cta'))return;
 const button=document.createElement('button');
 button.type='button';
 button.className='section-cta';
 button.textContent=text;
 button.onclick=()=>activate(route);
 const heading=section.querySelector('.section-heading');
 (heading||section).appendChild(button);
}

function enhanceLanding(){
 const steps=$$('.steps-grid article');
 makeInteractive(steps[0],'register','Create your account');
 makeInteractive(steps[1],'earn','Explore earning activities');
 makeInteractive(steps[2],'withdraw','See how withdrawals work');
 const earning=$$('.earn-grid article');
 makeInteractive(earning[0],'earn','Open guided chats');
 makeInteractive(earning[1],'tasks','View linked tasks');
 makeInteractive(earning[2],'visits','View sponsored visits');
 makeInteractive(earning[3],'referrals','View referral rewards');
 const stats=$$('.stats .stat');
 makeInteractive(stats[0],'profile','View level progress');
 makeInteractive(stats[1],'earn','View guided-chat rewards');
 makeInteractive(stats[2],'tasks','Explore ways to earn');
 makeInteractive($('.phone-preview'),'home','Open the Earn Chat experience');
 addSectionCta($('.steps-grid')?.closest('.landing-section'),'Create your free account','register');
 addSectionCta($('.earn-grid')?.closest('.landing-section'),'Explore earning options','earn');
 const proof=$('#social-proof-section');
 if(proof&&!proof.classList.contains('hidden'))addSectionCta(proof,'Join Earn Chat','register');
}

function simplifyHomeExplore(){
 const grid=$('.quick-grid','#view-home');
 if(!grid||grid.dataset.simplified==='1')return;
 grid.dataset.simplified='1';
 const keep=new Set(['referrals','visits']);
 [...grid.querySelectorAll('[data-go]')].forEach(card=>{
  const route=card.dataset.go;
  if(!keep.has(route))card.remove();
 });
 const heading=grid.previousElementSibling;
 if(heading?.textContent?.includes('Explore'))heading.textContent='More ways to earn';
}

function enhanceLevelPills(){
 $$('.app-header .pill').forEach(pill=>{
  if(pill.dataset.levelLink==='1')return;
  pill.dataset.levelLink='1';
  pill.setAttribute('role','button');
  pill.setAttribute('tabindex','0');
  pill.setAttribute('aria-label','Open level progress');
  const open=()=>{sessionStorage.setItem('earnchat-scroll-level','1');activate('profile')};
  pill.addEventListener('click',open);
  pill.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
 });
 if(location.hash.includes('profile')&&sessionStorage.getItem('earnchat-scroll-level')==='1'){
  const target=$('#profile-level-journey');
  if(target){sessionStorage.removeItem('earnchat-scroll-level');target.scrollIntoView({behavior:'smooth',block:'start'})}
 }
}

function enhanceKycAction(){
 const status=$('#profile-kyc')?.textContent?.trim().toLowerCase(),button=$('#submit-kyc');
 if(!button)return;
 if(status==='approved'){
  button.disabled=true;
  button.textContent='KYC approved ✓';
  button.setAttribute('aria-disabled','true');
 }else if(status==='submitted'||status==='under_review'){
  button.disabled=true;
  button.textContent='KYC under review';
  button.setAttribute('aria-disabled','true');
 }else{
  button.disabled=false;
  button.textContent='Submit KYC for review';
  button.removeAttribute('aria-disabled');
 }
}

function enhanceHome(){
 simplifyHomeExplore();
 makeInteractive($('.balance-card','#view-home'),'withdraw','Open work wallet');
 const wallets=$$('.mini-wallet','#view-home');
 makeInteractive(wallets[0],'referrals','Open referral wallet');
 makeInteractive(wallets[1],'earn','Open today’s guided chats');
 makeInteractive($('.progress-card','#view-home'),'profile','View level progress');
 makeInteractive($('.next-action','#view-home'),$('#home-next')?.textContent?.includes('task')?'tasks':'earn','Open recommended next step');
}

function enhanceCustomerPages(){
 makeInteractive($('.balance-card','#view-referrals'),'referrals','View referral progress');
 $$('.list-card.partner-card').forEach(card=>card.classList.add('designed-surface'));
 enhanceLevelPills();
 enhanceKycAction();
}

function enhance(){enhanceLanding();enhanceHome();enhanceCustomerPages()}
function schedule(delay=70){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,delay)}

async function init(){
 addTheme();
 try{authenticated=!!(await sb.auth.getSession()).data.session}catch{authenticated=false}
 schedule(0);
 window.addEventListener('hashchange',()=>schedule(60));
 window.addEventListener('pageshow',()=>schedule(60));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(60)});
 sb.auth.onAuthStateChange((_event,session)=>{authenticated=!!session;schedule(60)});
}

init();
