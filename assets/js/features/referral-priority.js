const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

function referralUrl(){return $('#ref-link')?.value?.trim()||''}

async function shareReferral(button){
 const url=referralUrl();
 if(!url){location.hash='#/referrals';return}
 const text='Join me on Earn Chat, complete approved activities and track your rewards.';
 try{
  if(navigator.share){
   await navigator.share({title:'Join Earn Chat',text,url});
   button.textContent='Shared';
  }else{
   await navigator.clipboard.writeText(url);
   button.textContent='Referral link copied';
  }
 }catch(error){
  if(error?.name==='AbortError')return;
  try{await navigator.clipboard.writeText(url);button.textContent='Referral link copied'}catch{button.textContent='Open Referrals'}
 }
 setTimeout(()=>button.textContent='Share referral link',1600);
}

function enhanceHome(){
 const home=$('#view-home');
 if(!home)return;
 const quick=$('.quick-grid',home),refButton=quick?.querySelector('[data-go="referrals"]');
 if(refButton&&!refButton.dataset.referralPriority){
  refButton.dataset.referralPriority='1';
  refButton.classList.add('referral-priority-quick');
  refButton.insertAdjacentHTML('afterbegin','<span class="priority-badge">Highest priority</span>');
  quick.prepend(refButton);
 }
 if($('#home-referral-priority'))return;
 const next=$('.next-action',home);
 if(!next)return;
 const card=document.createElement('article');
 card.id='home-referral-priority';
 card.className='referral-priority-card';
 card.innerHTML='<div><span class="eyebrow">SHARE AND GROW</span><h2>Invite genuine members</h2><p>Share your personal link and track each referral through the required active days.</p></div><button class="primary" data-go="referrals" type="button">Open referrals and share →</button>';
 next.before(card);
}

function enhanceReferralPage(){
 const copy=$('#copy-ref');
 if(!copy||$('#share-ref'))return;
 const button=document.createElement('button');
 button.id='share-ref';
 button.className='primary referral-share-button';
 button.type='button';
 button.textContent='Share referral link';
 button.onclick=()=>shareReferral(button);
 copy.insertAdjacentElement('afterend',button);
 const link=$('#ref-link');
 if(link)link.addEventListener('input',()=>{button.disabled=!referralUrl()});
 button.disabled=!referralUrl();
}

function enhance(){enhanceHome();enhanceReferralPage()}
function schedule(){[40,180,600].forEach(delay=>setTimeout(enhance,delay))}

window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
new MutationObserver(()=>schedule()).observe(document.body,{childList:true,subtree:true});
schedule();
