import fs from'node:fs';
const path='assets/js/app.js';
let source=fs.readFileSync(path,'utf8');
const fixes=[
 ['function renderAppHeaderfunction renderAppHeader','function renderAppHeader'],
 ['function renderProofField(task){function renderProofField(task){','function renderProofField(task){'],
 ['function renderPayoutFields(){function renderPayoutFields(){','function renderPayoutFields(){']
];
for(const[from,to]of fixes)source=source.replace(from,to);
fs.writeFileSync(path,source);
