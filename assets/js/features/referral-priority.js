const $=(selector,root=document)=>root.querySelector(selector);
let renderTimer=null;

function referralUrl(){return $('#ref-link')?.value?.trim()||''}
async function shareReferral(button){
  const url=referralUrl();
  if(!url){location.hash='#/referrals';return}
  const text='Join me on Earn Chat, complete approved activities and track your rewards.';
  let channel='clipboard';
  try{
    if(navigator.share){channel='native';await navigator.share({title:'Join Earn Chat',text,url});button.textContent='Shared'}
    else{await navigator.clipboard.writeText(url);button.textContent='Referral link copied'}
    document.dispatchEvent(new CustomEvent('earnchat:referral-shared',{detail:{channel}}));
  }catch(error){
    if(error?.name==='AbortError')return;
    try{await navigator.clipboard.writeText(url);button.textContent='Referral link copied';document.dispatchEvent(new CustomEvent('earnchat:referral-shared',{detail:{channel:'clipboard'}}))}
    catch{button.textContent='Open Referrals'}
  }
  setTimeout(()=>{if(button.isConnected)button.textContent='Share referral link'},1600);
}
function enhanceHome(){
  const home=$('#view-home');if(!home)return;
  const quick=$('.quick-grid',home),refButton=quick?.querySelector('[data-go="referrals"]');
  if(refButton&&!refButton.dataset.referralPriority){
    refButton.dataset.referralPriority='1';refButton.classList.add('referral-priority-quick');
    refButton.insertAdjacentHTML('afterbegin','<span class="priority-badge">Highest priority</span>');quick.prepend(refButton);
  }
  if($('#home-referral-priority'))return;
  const next=$('.next-action',home);if(!next)return;
  const card=document.createElement('article');card.id='home-referral-priority';card.className='referral-priority-card';
  card.innerHTML='<div><span class="eyebrow">SHARE AND GROW</span><h2>Invite genuine members</h2><p>Share your personal link and track each referral through the required active days.</p></div><button class="primary" data-go="referrals" type="button">Open referrals and share →</button>';
  next.before(card);
}
function enhanceReferralPage(){
  const copy=$('#copy-ref');if(!copy||$('#share-ref'))return;
  const button=document.createElement('button');button.id='share-ref';button.className='primary referral-share-button';button.type='button';button.textContent='Share referral link';button.disabled=!referralUrl();
  button.addEventListener('click',()=>shareReferral(button));copy.insertAdjacentElement('afterend',button);
  $('#ref-link')?.addEventListener('input',()=>{button.disabled=!referralUrl()});
}
function enhance(){const route=document.body.dataset.route;if(route==='home')enhanceHome();if(route==='referrals')enhanceReferralPage()}
function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(enhance,40)}
document.addEventListener('earnchat:route-view',schedule);
window.addEventListener('earnchat:member-state',schedule);
schedule();
