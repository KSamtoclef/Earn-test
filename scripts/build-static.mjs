import fs from'node:fs';
import path from'node:path';

const root=process.cwd();
const output=path.join(root,'public');
const requiredInputs=['index.html','assets'];

fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});

for(const target of requiredInputs){
  const source=path.join(root,target);
  if(!fs.existsSync(source))throw new Error(`Missing build input: ${target}`);
  fs.cpSync(source,path.join(output,target),{recursive:true});
}
for(const optional of['favicon.ico','robots.txt','manifest.webmanifest']){
  const source=path.join(root,optional);
  if(fs.existsSync(source))fs.copyFileSync(source,path.join(output,optional));
}

const sourceApp=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
const outputApp=fs.readFileSync(path.join(output,'assets/js/app.js'),'utf8');
const sourceConfig=fs.readFileSync(path.join(root,'assets/js/config-runtime.js'),'utf8');
const outputConfig=fs.readFileSync(path.join(output,'assets/js/config-runtime.js'),'utf8');
if(sourceApp!==outputApp)throw new Error('Built application differs from the committed source.');
if(sourceConfig!==outputConfig)throw new Error('Built configuration runtime differs from the committed source.');
for(const token of['chatMinimumSeconds','chatRequiredReplies','chatMinimumReplyLength','chatRecoveryMs','chatPromptSets','data-chat-next']){
  if(!sourceApp.includes(token))throw new Error(`Application source is missing required dynamic contract: ${token}`);
}
for(const token of['minimum_seconds:45','required_replies:4','minimum_reply_length:12','recovery_expiry_minutes:360']){
  if(!sourceConfig.includes(token))throw new Error(`Safe configuration fallback is missing: ${token}`);
}
for(const token of['About 2 minutes','minimum two minutes','two-minute session','120-elapsed',' / 02:00','#public-stats','#public-total','#public-online','const CHAT_SECONDS=45','CHAT_RECOVERY_MS=']){
  if(sourceApp.includes(token))throw new Error(`Application source contains obsolete behavior: ${token}`);
}
if(!fs.existsSync(path.join(output,'index.html')))throw new Error('Static build did not produce public/index.html');
if(!fs.existsSync(path.join(output,'assets/js/app.js')))throw new Error('Static build did not produce public/assets/js/app.js');
if(!fs.existsSync(path.join(output,'assets/js/config-runtime.js')))throw new Error('Static build did not produce public/assets/js/config-runtime.js');
console.log('Static deployment bundle copied from validated authoritative source.');
