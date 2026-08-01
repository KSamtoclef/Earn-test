import{api}from'../api.js';
import{countryFromStorage,money}from'../app-config.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const REQUIRED_SECONDS=45;
let completing=false,chatInterval=null,patchTimer=null,timerObserver=null;

function route(){return document.body.dataset.route||location.hash.replace(/^#\/?/,'').split('?')[0]}
function savedChat(){try{return JSON.parse(sessionStorage.getItem('earnchat-chat-recovery')||'null')}catch{return null}}
function formatTime(value){const seconds=Math.max(0,Number(value||0));return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
function message(text,type='ok'){const box=$('#chat-message');if(!box)return;box.textContent=text;box.className=`form-message ${type} show`}
function patchWording(){
 const homeCopy=$('#home-next-copy');if(homeCopy)homeCopy.textContent=homeCopy.textContent.replace(/About 2 minutes/gi,'About 45 seconds');
 const summary=$('#earn-summary');if(summary)$$('p',summary).forEach(node=>{node.textContent=node.textContent.replace(/minimum two minutes/gi,'minimum 45 seconds')});
 const ready=$('#chat-ready small');if(ready)ready.textContent=ready.textContent.replace(/two minutes/gi,'45 seconds');
 $$('#chat-messages .msg.them').forEach(node=>{node.textContent=node.textContent.replace(/Stay here until the two-minute session is ready to finish\.?/i,'Your replies are complete. Finish when the 45-second timer is ready.')});
}
function boundedPatch(){clearTimeout(patchTimer);let pass=0;const run=()=>{patchWording();pass++;if(pass<5)patchTimer=setTimeout(run,pass*60)};run()}
function ensureCompletionButton(){
 const ready=$('#chat-ready');if(!ready)return null;
 let live=$('#chat-complete-live',ready);if(live)return live;
 const legacy=$('#chat-complete',ready);if(!legacy)return null;
 legacy.hidden=true;legacy.setAttribute('aria-hidden','true');legacy.tabIndex=-1;
 live=legacy.cloneNode(true);live.id='chat-complete-live';live.hidden=false;live.removeAttribute('aria-hidden');live.tabIndex=0;live.disabled=true;live.dataset.authoritativeChat='45';
 legacy.insertAdjacentElement('afterend',live);return live;
}
function authoritativeValues(){const saved=savedChat(),startedAt=Number(saved?.startedAt||Date.now()),elapsed=Math.max(0,Math.floor((Date.now()-startedAt)/1000)),remaining=Math.max(0,REQUIRED_SECONDS-elapsed),replyCount=Array.isArray(saved?.replyTexts)?saved.replyTexts.length:0;return{elapsed,remaining,replyCount}}
function renderClock(){
 if(route()!=='chat')return;
 const timer=$('#chat-timer'),complete=ensureCompletionButton(),ready=$('#chat-ready');if(!timer||!complete)return;
 const{elapsed,remaining,replyCount}=authoritativeValues(),expected=`${formatTime(elapsed)} / 00:45`;
 if(timer.textContent!==expected)timer.textContent=expected;timer.dataset.authoritativeTimer='45';
 if(replyCount===4&&ready){ready.classList.remove('hidden');complete.disabled=remaining>0||completing;complete.textContent=completing?'Verifying…':remaining>0?`Ready in ${remaining}s`:'Complete guided session'}
 else{complete.disabled=true;complete.textContent='Complete guided session'}
}
function protectTimer(){
 timerObserver?.disconnect();timerObserver=null;
 const timer=$('#chat-timer');if(!timer)return;
 timerObserver=new MutationObserver(()=>{if(route()!=='chat')return;const{elapsed}=authoritativeValues(),expected=`${formatTime(elapsed)} / 00:45`;if(timer.textContent!==expected)timer.textContent=expected});
 timerObserver.observe(timer,{childList:true,characterData:true,subtree:true});
}
function completionPanel(result,state){const amount=Number(result?.amount||0),status=String(result?.status||'approved').replaceAll('_',' '),remaining=Number(result?.remaining??Math.max(0,Number(state?.config?.levels?.[state?.profile?.level_name||'Starter']?.chat_limit||4)-Number(state?.today_chats||0))),points=amount>0?2:0,country=state?.profile?.country||countryFromStorage();return`<b>Chat completed</b><small>${amount?`${money(amount,country)} ${status}`:`Activity ${status}`} · +${points} Activity Points · ${remaining} chat${remaining===1?'':'s'} remaining.</small><p class="next-activity-label">Choose your next activity</p><div class="chat-next-grid"><button class="secondary" data-go="earn" type="button">${remaining?'Another chat':'Earn hub'}</button><button class="secondary" data-go="tasks" type="button">Tasks</button><button class="secondary" data-go="visits" type="button">Sponsored visit</button><button class="secondary" data-go="referrals" type="button">Share referral</button><button class="primary" data-go="home" type="button">Return Home</button></div>`}
async function complete(){
 const saved=savedChat();if(completing||!saved||!Array.isArray(saved.replyTexts)||saved.replyTexts.length!==4)return;const elapsed=Math.floor((Date.now()-Number(saved.startedAt||Date.now()))/1000);if(elapsed<REQUIRED_SECONDS)return;
 completing=true;const button=$('#chat-complete-live');if(button){button.disabled=true;button.textContent='Verifying…'}
 try{const result=await api.completeChat(saved.attemptId,saved.replyTexts,{duplicate_replies:false,reply_lengths:saved.replyTexts.map(text=>String(text).trim().length),minimum_seconds:REQUIRED_SECONDS});sessionStorage.removeItem('earnchat-chat-recovery');const state=await api.refreshState();message('Conversation recorded successfully.');const ready=$('#chat-ready');if(ready)ready.innerHTML=completionPanel(result,state);stopChatLoop()}catch(error){message(error.message||'Conversation could not be completed.','error');completing=false;renderClock()}
}
function interceptCompletion(event){const button=event.target.closest('#chat-complete-live');if(!button)return;event.preventDefault();event.stopImmediatePropagation();complete()}
function enhance(){patchWording();if(route()!=='chat')return;document.body.classList.add('compact-guided-chat');ensureCompletionButton();const suggestions=$('#chat-suggestions');if(suggestions){suggestions.setAttribute('aria-label','Quick reply suggestions');const buttons=[...suggestions.querySelectorAll('button')];buttons.slice(2).forEach(button=>button.remove())}protectTimer();renderClock()}
function stopChatLoop(){clearInterval(chatInterval);chatInterval=null;timerObserver?.disconnect();timerObserver=null;document.body.classList.remove('compact-guided-chat')}
function startChatLoop(){stopChatLoop();boundedPatch();if(route()!=='chat')return;enhance();chatInterval=setInterval(renderClock,1000)}
function schedule(delay=20){setTimeout(startChatLoop,delay)}

document.addEventListener('click',interceptCompletion,true);
window.addEventListener('hashchange',()=>schedule(20));
window.addEventListener('earnchat:member-state',boundedPatch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopChatLoop();else schedule(20)});
boundedPatch();schedule(0);
