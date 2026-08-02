import fs from'node:fs';
import path from'node:path';
const root=process.cwd(),output=path.join(root,'public');
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
for(const target of['index.html','assets']){const source=path.join(root,target);if(!fs.existsSync(source))throw new Error(`Missing build input: ${target}`);fs.cpSync(source,path.join(output,target),{recursive:true})}
for(const optional of['favicon.ico','robots.txt','manifest.webmanifest']){const source=path.join(root,optional);if(fs.existsSync(source))fs.copyFileSync(source,path.join(output,optional))}
for(const file of['index.html','assets/js/app.js','assets/js/api.js','assets/js/config-runtime.js','assets/js/final-completion.js','assets/js/features/task-status.js']){if(fs.readFileSync(path.join(root,file),'utf8')!==fs.readFileSync(path.join(output,file),'utf8'))throw new Error(`Built file differs from source: ${file}`)}
console.log('Static deployment bundle copied from authoritative source without behavior rewrites.');
