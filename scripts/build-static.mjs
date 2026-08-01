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

if(!fs.existsSync(path.join(output,'index.html')))throw new Error('Static build did not produce public/index.html');
console.log('Static deployment bundle created in public/.');
