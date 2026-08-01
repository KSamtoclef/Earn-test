import fs from'node:fs';

const previous='20260801-source-consolidated-r1';
const next='20260802-stability-r2';
for(const path of['index.html','assets/js/app.js','assets/js/supabase-client.js']){
  const source=fs.readFileSync(path,'utf8');
  if(!source.includes(previous))throw new Error(`${path} is missing ${previous}`);
  fs.writeFileSync(path,source.replaceAll(previous,next));
}
