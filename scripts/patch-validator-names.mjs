import fs from'node:fs';
const path='scripts/validate-production.mjs';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing validator token: ${label}`);source=source.replace(from,to)};
replace("'featureForm','levelForm'","'flagsForm','levelsForm'",'Admin configuration function names');
replace("['restart-required','pending-review','approved','rejected'","['task-incomplete','task-pending','approved','rejected'",'task lifecycle class names');
fs.writeFileSync(path,source);
// Triggered after workflow creation.
