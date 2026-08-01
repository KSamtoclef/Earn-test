import fs from'node:fs';
const path='index.html';
let html=fs.readFileSync(path,'utf8');
html=html.replaceAll('20260731-launch-lite-r2','20260801-source-consolidated-r1').replaceAll('20260731-launch-lite-r3','20260801-source-consolidated-r1');
if(!html.includes('20260801-source-consolidated-r1'))throw new Error('Release alignment failed');
fs.writeFileSync(path,html);
