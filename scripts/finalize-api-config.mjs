import fs from'node:fs';

const path='assets/js/api.js';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing final API target: ${label}`);source=source.replace(from,to)};
replace(
" startTask:async id=>rpc('start_earnchat_task',{p_task:id}),\n submitTask:async(id,proof={})=>mutateMember('submit_earnchat_task',{p_claim:id,p_proof:proof}),",
" startTask:async id=>rpc('start_earnchat_task',{p_task:id}),\n cancelTask:async id=>mutateMember('cancel_earnchat_task_claim',{p_claim:id}),\n submitTask:async(id,proof={})=>mutateMember('submit_earnchat_task',{p_claim:id,p_proof:proof}),",
'cancel task API'
);
fs.writeFileSync(path,source);
