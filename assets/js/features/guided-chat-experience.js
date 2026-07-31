import{api}from'../api.js';
import{countryFromStorage,money}from'../app-config.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const REQUIRED_SECONDS=45;
let completing=false;

function savedChat(){try{return JSON.parse(sessionStorage.getItem('earnchat-chat-recovery')||'null')}catch{return null}}
function formatTime(value){const seconds=Math.max(0,Number(value||0));return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
function message(text,type='ok'){const box=$('#chat-message');if(!box)return;box.textContent=text;box.className=`form-message ${type} show`}
function replaceLegacyWording(){const homeCopy=$('#home-next-copy');if(homeCopy&&/2 minutes/i.test(homeCopy.textContent))homeCopy.textContent=homeCopy.textContent.replace(/About 2 minutes/i,'About 45 seconds');const summary=$('#earn-summary');if(summary)$$('p',summary).forEach(node=>{node.textContent=node.textContent.replace(/minimum two minutes/gi,'minimum 45 seconds')});$$('#chat-messages .msg.them').forEach(node=>{node.textContent=node.textContent.replace(/Stay here until the two-minute session is ready to finish\.?/i,'You are done replying. The conversation can finish when the 45-second timer is complete.')})}
function renderClock(){if(!location.hash.includes('chat'))return;const saved=savedChat(),timer=$('#chat-timer'),complete=$('#chat-complete'),ready=$('#chat-ready');if(!saved||!timer||!complete)return;const elapsed=Math.max(0,Math.floor((Date.now()-Number(saved.startedAt||Date.now()))/1000)),remaining=Math.max(0,REQUIRED_SECONDS-elapsed),replyCount=Array.isArray(saved.replyTexts)?saved.replyTexts.length:0;timer.textContent=`${formatTime(elapsed)} / 00:45`;timer.dataset.compactTimer='1';if(replyCount===4&&ready){ready.classList.remove('hidden');complete.disabled=remaining>0||completing;complete.textContent=remaining>0?`Ready in ${remaining}s`:'Complete conversation'}}
async function complete(){const saved=savedChat();if(completing||!saved||!Array.isArray(saved.replyTexts)||saved.replyTexts.length!==4)return;const elapsed=Math.floor((Date.now()-Number(saved.startedAt||Date.now()))/1000);if(elapsed<REQUIRED_SECONDS)return;completing=true;const button=$('#chat-complete');if(button){button.disabled=true;button.textContent='Verifying…'}try{const result=await api.completeChat(saved.attemptId,saved.replyTexts,{duplicate_replies:false,reply_lengths:saved.replyTexts.map(text=>String(text).trim().length),minimum_seconds:REQUIRED_SECONDS});sessionStorage.removeItem('earnchat-chat-recovery');const amount=Number(result?.amount||0),country=countryFromStorage();message(amount?`Conversation complete. ${money(amount,country)} approved.`:'Conversation completed and recorded.');const ready=$('#chat-ready');if(ready)ready.innerHTML='<b>Conversation completed</b><small>Your activity has been recorded.</small><div class="wallet-tabs"><button class="secondary" data-go="earn" type="button">Back to Earn</button><button class="primary" data-go="tasks" type="button">Explore tasks</button></div>'}catch(error){message(error.message||'Conversation could not be completed.','error');completing=false;renderClock()}}
function enhance(){replaceLegacyWording();if(!location.hash.includes('chat'))return;document.body.classList.add('compact-guided-chat');const completeButton=$('#chat-complete');if(completeButton&&!completeButton.dataset.compactReady){completeButton.dataset.compactReady='1';completeButton.onclick=complete}const suggestions=$('#chat-suggestions');if(suggestions){suggestions.setAttribute('aria-label','Quick reply suggestions');const buttons=[...suggestions.querySelectorAll('button')];buttons.slice(2).forEach(button=>button.remove())}renderClock()}
function schedule(){[30,140,400].forEach(delay=>setTimeout(enhance,delay))}

setInterval(()=>{enhance();if(!location.hash.includes('chat'))document.body.classList.remove('compact-guided-chat')},350);
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
schedule();
