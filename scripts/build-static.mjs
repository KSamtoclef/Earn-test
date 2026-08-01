import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const output=path.join(root,'public');
const copyTargets=['index.html','assets'];

fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});

for(const target of copyTargets){
  const source=path.join(root,target);
  const destination=path.join(output,target);
  if(!fs.existsSync(source))throw new Error(`Missing build input: ${target}`);
  fs.cpSync(source,destination,{recursive:true});
}

for(const optional of ['favicon.ico','robots.txt','manifest.webmanifest']){
  const source=path.join(root,optional);
  if(fs.existsSync(source))fs.copyFileSync(source,path.join(output,optional));
}

const appPath=path.join(output,'assets/js/app.js');
let app=fs.readFileSync(appPath,'utf8');
const replace=(from,to,label)=>{
  if(!app.includes(from))throw new Error(`Chat build transform could not find: ${label}`);
  app=app.replace(from,to);
};

replace("import{CHAT_PROMPTS,COUNTRY_FALLBACK,countryFromStorage,money}from'./app-config.js';","import{CHAT_PROMPT_SETS,COUNTRY_FALLBACK,countryFromStorage,money}from'./app-config.js';",'chat prompt import');
replace("const serverTime=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:Date.now()};","const serverTime=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:Date.now()};\nconst CHAT_SECONDS=45,CHAT_RECOVERY_MS=6*60*60*1000;\nconst chatRecoveryKey=()=>`earnchat-chat-recovery:${app.user?.id||'guest'}`;\nconst chatPrompts=()=>CHAT_PROMPT_SETS[Number(app.chat?.promptSet||0)]||CHAT_PROMPT_SETS[0];\nconst choosePromptSet=seed=>{let hash=0;for(const c of String(seed||Date.now()))hash=(hash*31+c.charCodeAt(0))>>>0;let index=hash%CHAT_PROMPT_SETS.length;const last=Number(localStorage.getItem('earnchat-last-prompt-set'));if(Number.isInteger(last)&&index===last)index=(index+1)%CHAT_PROMPT_SETS.length;localStorage.setItem('earnchat-last-prompt-set',String(index));return index};",'chat constants');
replace("`About 2 minutes · ${reward} after approval`","`About 45 seconds · ${reward} after approval`",'home timing copy');
replace("${today} of ${limit} approved · four replies · minimum two minutes","${today} of ${limit} approved · four replies · minimum 45 seconds",'earn timing copy');
replace("function persistChat(){if(!app.chat)return sessionStorage.removeItem('earnchat-chat-recovery');sessionStorage.setItem('earnchat-chat-recovery',JSON.stringify({attemptId:app.chat.attemptId,partner:app.chat.partner,startedAt:app.chat.startedAt,stage:app.chat.stage,replies:app.chat.replies,replyTexts:app.chat.replyTexts}))}","function persistChat(){const key=chatRecoveryKey();if(!app.chat)return localStorage.removeItem(key);localStorage.setItem(key,JSON.stringify({attemptId:app.chat.attemptId,partner:app.chat.partner,startedAt:app.chat.startedAt,stage:app.chat.stage,replies:app.chat.replies,replyTexts:app.chat.replyTexts,promptSet:app.chat.promptSet,savedAt:Date.now(),expiresAt:Date.now()+CHAT_RECOVERY_MS}))}",'persistent chat recovery');
replace("function clearChat(){clearInterval(app.chatTimer);app.chat=null;sessionStorage.removeItem('earnchat-chat-recovery')}","function clearChat(){clearInterval(app.chatTimer);app.chat=null;localStorage.removeItem(chatRecoveryKey())}",'clear persistent chat');
replace("try{saved=JSON.parse(sessionStorage.getItem('earnchat-chat-recovery')||'null')}catch{}","try{saved=JSON.parse(localStorage.getItem(chatRecoveryKey())||'null');if(saved?.expiresAt&&Date.now()>Number(saved.expiresAt)){localStorage.removeItem(chatRecoveryKey());saved=null}}catch{localStorage.removeItem(chatRecoveryKey())}",'restore persistent chat');
replace("app.chat={partner:meta.name,meta,attemptId:open.attempt_id,startedAt:serverTime(open.started_at),stage:same?Number(saved.stage||0):0,replies:same&&Array.isArray(saved.replies)?saved.replies:[],replyTexts:same&&Array.isArray(saved.replyTexts)?saved.replyTexts:[]};","app.chat={partner:meta.name,meta,attemptId:open.attempt_id,startedAt:serverTime(open.started_at),stage:same?Number(saved.stage||0):0,replies:same&&Array.isArray(saved.replies)?saved.replies:[],replyTexts:same&&Array.isArray(saved.replyTexts)?saved.replyTexts:[],promptSet:same&&Number.isInteger(Number(saved.promptSet))?Number(saved.promptSet):choosePromptSet(open.attempt_id)};",'resume prompt set');
replace("function updateChatTimer(){if(!app.chat)return;const elapsed=Math.max(0,Math.floor((Date.now()-app.chat.startedAt)/1000)),remaining=Math.max(0,120-elapsed),fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;$('#chat-timer').textContent=`${fmt(elapsed)} / 02:00`;if(app.chat.replies.length===4){$('#chat-ready').classList.remove('hidden');$('#chat-complete').disabled=remaining>0;$('#chat-complete').textContent=remaining>0?`Ready in ${remaining}s`:'Complete guided session'}}","function updateChatTimer(){if(!app.chat)return;const elapsed=Math.max(0,Math.floor((Date.now()-app.chat.startedAt)/1000)),remaining=Math.max(0,CHAT_SECONDS-elapsed),fmt=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;$('#chat-timer').textContent=`${fmt(Math.min(elapsed,CHAT_SECONDS))} / 00:45`;if(app.chat.replies.length===4){$('#chat-ready').classList.remove('hidden');$('#chat-complete').disabled=remaining>0;$('#chat-complete').textContent=remaining>0?`Ready in ${remaining}s`:'Complete guided session'}}",'45-second timer');
replace("app.chat={partner,meta,attemptId:attempt.attempt_id,startedAt:serverTime(attempt.started_at),stage:0,replies:[],replyTexts:[]};","app.chat={partner,meta,attemptId:attempt.attempt_id,startedAt:serverTime(attempt.started_at),stage:0,replies:[],replyTexts:[],promptSet:choosePromptSet(attempt.attempt_id)};",'new chat prompt set');
replace("function openChatUi(message=''){$('#chat-title').textContent=app.chat.meta.name;$('#chat-subtitle').textContent=`${app.chat.meta.place} · ${app.chat.meta.topic}`;$('#chat-avatar').textContent=app.chat.meta.short;$('#chat-messages').innerHTML='';$('#chat-input').value='';$('#chat-input').disabled=false;$('#chat-send').disabled=false;$('#chat-ready').classList.add('hidden');clearMessage('#chat-message');addChatMessage('them',message||`Hi, I’m ${app.chat.meta.name.split(' ')[0]}. ${CHAT_PROMPTS[Math.min(app.chat.stage,3)].prompt}`);app.chat.replyTexts.forEach(text=>addChatMessage('me',text));renderChatStage();clearInterval(app.chatTimer);app.chatTimer=setInterval(updateChatTimer,1000);updateChatTimer();navigate('chat')}","function openChatUi(message=''){const set=chatPrompts();$('#chat-title').textContent=app.chat.meta.name;$('#chat-subtitle').textContent=`${app.chat.meta.place} · ${app.chat.meta.topic}`;$('#chat-avatar').textContent=app.chat.meta.short;$('#chat-messages').innerHTML='';$('#chat-input').value='';$('#chat-input').disabled=app.chat.replies.length>=4;$('#chat-send').disabled=app.chat.replies.length>=4;$('#chat-ready').classList.add('hidden');clearMessage('#chat-message');if(message)showMessage('#chat-message',message,'ok');addChatMessage('them',`Hi, I’m ${app.chat.meta.name.split(' ')[0]}. ${set[0].prompt}`);app.chat.replyTexts.forEach((text,index)=>{addChatMessage('me',text);if(index+1<app.chat.replyTexts.length||app.chat.replyTexts.length<4)addChatMessage('them',set[Math.min(index+1,set.length-1)].prompt)});if(app.chat.replyTexts.length===4)addChatMessage('them','Thanks for sharing. Your four guided replies are complete. You can finish when the 45-second timer is ready.');renderChatStage();clearInterval(app.chatTimer);app.chatTimer=setInterval(updateChatTimer,1000);updateChatTimer();navigate('chat')}",'restore full conversation');
replace("const stage=Math.min(app.chat.stage,CHAT_PROMPTS.length-1),p=CHAT_PROMPTS[stage];","const set=chatPrompts(),stage=Math.min(app.chat.stage,set.length-1),p=set[stage];",'active prompt stage');
replace("addChatMessage('them',CHAT_PROMPTS[app.chat.stage].prompt);","addChatMessage('them',chatPrompts()[app.chat.stage].prompt);",'next rotating prompt');
replace("addChatMessage('them','Thanks for sharing. Your four guided replies are complete. Stay here until the two-minute session is ready to finish.');","addChatMessage('them','Thanks for sharing. Your four guided replies are complete. You can finish when the 45-second timer is ready.');",'final chat message');
replace("if(Math.floor((Date.now()-app.chat.startedAt)/1000)<120)return;","if(Math.floor((Date.now()-app.chat.startedAt)/1000)<CHAT_SECONDS)return;",'completion threshold');
replace("sessionStorage.removeItem('earnchat-chat-recovery');","localStorage.removeItem(chatRecoveryKey());",'completion recovery cleanup');

fs.writeFileSync(appPath,app);

const forbidden=[' / 02:00','minimum two minutes','two-minute session','<120)return','120-elapsed'];
for(const token of forbidden)if(app.includes(token))throw new Error(`Built chat still contains obsolete rule: ${token}`);
for(const token of ['CHAT_SECONDS=45',' / 00:45','CHAT_RECOVERY_MS','CHAT_PROMPT_SETS','localStorage.setItem(key','45-second timer'])if(!app.includes(token))throw new Error(`Built chat is missing required contract: ${token}`);

if(!fs.existsSync(path.join(output,'index.html')))throw new Error('Static build did not produce public/index.html');
console.log('Static deployment bundle created in public/ with authoritative 45-second persistent chat.');
