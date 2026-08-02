import fs from 'node:fs';

const path='assets/js/app.js';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing ${label}`);source=source.replace(from,to)};

replace(
"function clearChat(){clearInterval(app.chatTimer);app.chatTimer=null;app.chat=null;localStorage.removeItem(chatRecoveryKey())}",
"function clearChat(){clearTimeout(app.chatTimer);app.chatTimer=null;app.chat=null;localStorage.removeItem(chatRecoveryKey())}",
'clearChat timer cleanup'
);

replace(
"function updateChatTimer(){if(!app.chat)return;const total=chatMinimumSeconds(),required=chatRequiredReplies(),elapsed=Math.max(0,Math.floor((Date.now()-app.chat.startedAt)/1000)),remaining=Math.max(0,total-elapsed),fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;const timer=$('#chat-timer'),complete=$('#chat-complete');if(timer)timer.textContent=`${fmt(Math.min(elapsed,total))} / ${fmt(total)}`;if(app.chat.replies.length===required){$('#chat-ready')?.classList.remove('hidden');if(complete){complete.disabled=remaining>0;complete.textContent=remaining>0?`Ready in ${remaining}s`:chatConfig().completion_wording}}}",
"function updateChatTimer(){if(!app.chat)return;const total=Math.max(1,Number(chatMinimumSeconds()||45)),required=Math.max(1,Number(chatRequiredReplies()||4)),started=Number(app.chat.startedAt||Date.now()),elapsed=Math.max(0,Math.floor((Date.now()-started)/1000)),remaining=Math.max(0,total-elapsed),fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;const timer=$('#chat-timer'),complete=$('#chat-complete');if(timer){timer.textContent=remaining>0?`${fmt(remaining)} remaining`:'00:00 · Ready';timer.dataset.remaining=String(remaining)}if(app.chat.replies.length===required){$('#chat-ready')?.classList.remove('hidden');if(complete){complete.disabled=remaining>0;complete.textContent=remaining>0?`Ready in ${remaining}s`:chatConfig().completion_wording}}else if(complete){complete.disabled=true}return remaining}",
'chat countdown renderer'
);

replace(
"function openChatUi(message=''){const set=chatPrompts(),required=chatRequiredReplies(),seconds=chatMinimumSeconds();$('#chat-title').textContent=app.chat.meta.name;$('#chat-subtitle').textContent=`${app.chat.meta.place} · ${app.chat.meta.topic}`;$('#chat-avatar').textContent=app.chat.meta.short;$('#chat-messages').innerHTML='';$('#chat-input').value='';$('#chat-input').disabled=app.chat.replies.length>=required;$('#chat-send').disabled=app.chat.replies.length>=required;$('#chat-ready').classList.add('hidden');const readyCopy=$('#chat-ready small');if(readyCopy)readyCopy.textContent=chatConfig().pending_wording;clearMessage('#chat-message');if(message)showMessage('#chat-message',message,'ok');addChatMessage('them',`Hi, I’m ${app.chat.meta.name.split(' ')[0]} . ${set[0].prompt}`.replace(' .','.'));app.chat.replyTexts.forEach((text,index)=>{addChatMessage('me',text);if(index+1<app.chat.replyTexts.length||app.chat.replyTexts.length<required)addChatMessage('them',set[Math.min(index+1,set.length-1)].prompt)});if(app.chat.replyTexts.length===required)addChatMessage('them',`Thanks for sharing. Your ${required} guided replies are complete. You can finish when the ${seconds}-second timer is ready.`);renderChatStage();clearInterval(app.chatTimer);app.chatTimer=setInterval(updateChatTimer,1000);updateChatTimer();navigate('chat')}",
"function startChatCountdown(){clearTimeout(app.chatTimer);const tick=()=>{if(!app.chat){app.chatTimer=null;return}updateChatTimer();app.chatTimer=setTimeout(tick,Math.max(200,1000-Date.now()%1000))};tick()}function openChatUi(message=''){const set=chatPrompts(),required=chatRequiredReplies(),seconds=chatMinimumSeconds();$('#chat-title').textContent=app.chat.meta.name;$('#chat-subtitle').textContent=`${app.chat.meta.place} · ${app.chat.meta.topic}`;$('#chat-avatar').textContent=app.chat.meta.short;$('#chat-messages').innerHTML='';$('#chat-input').value='';$('#chat-input').disabled=app.chat.replies.length>=required;$('#chat-send').disabled=app.chat.replies.length>=required;$('#chat-ready').classList.add('hidden');const readyCopy=$('#chat-ready small');if(readyCopy)readyCopy.textContent=chatConfig().pending_wording;clearMessage('#chat-message');if(message)showMessage('#chat-message',message,'ok');addChatMessage('them',`Hi, I’m ${app.chat.meta.name.split(' ')[0]} . ${set[0].prompt}`.replace(' .','.'));app.chat.replyTexts.forEach((text,index)=>{addChatMessage('me',text);if(index+1<app.chat.replyTexts.length||app.chat.replyTexts.length<required)addChatMessage('them',set[Math.min(index+1,set.length-1)].prompt)});if(app.chat.replyTexts.length===required)addChatMessage('them',`Thanks for sharing. Your ${required} guided replies are complete. You can finish when the ${seconds}-second timer is ready.`);renderChatStage();navigate('chat');requestAnimationFrame(()=>{updateChatTimer();startChatCountdown()})}",
'chat countdown startup'
);

replace(
"clearInterval(app.chatTimer);localStorage.removeItem(chatRecoveryKey());",
"clearTimeout(app.chatTimer);app.chatTimer=null;localStorage.removeItem(chatRecoveryKey());",
'completion timer cleanup'
);

if(!source.includes("document.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.chat)updateChatTimer()})")){
 source += "\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden&&app.chat){updateChatTimer();startChatCountdown()}});window.addEventListener('pageshow',()=>{if(app.chat){updateChatTimer();startChatCountdown()}});\n";
}
source=source.replace("const RELEASE='20260802-unified-r1';","const RELEASE='20260802-countdown-r1';");
fs.writeFileSync(path,source);
console.log('Guided chat countdown repaired.');
