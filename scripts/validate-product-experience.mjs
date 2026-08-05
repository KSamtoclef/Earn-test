import fs from'node:fs';
const fail=[];
const read=p=>fs.readFileSync(p,'utf8');
for(const p of['index.html','assets/css/product-experience.css','assets/js/product-experience.js','public/index.html','public/assets/css/product-experience.css','public/assets/js/product-experience.js'])if(!fs.existsSync(p))fail.push(`Missing ${p}`);
if(!fail.length){
 const html=read('index.html'),built=read('public/index.html'),js=read('assets/js/product-experience.js'),css=read('assets/css/product-experience.css');
 for(const token of['product-experience.css?v=20260805-experience-r1','product-experience.js?v=20260805-experience-r1']){
  if(!html.includes(token))fail.push(`Source HTML missing ${token}`);
  if(!built.includes(token))fail.push(`Built HTML missing ${token}`);
 }
 for(const token of['TRANSPARENT REWARDS','WORK-BASED LEVELS','How a referral becomes qualified','Sponsored visits','Earn your next level','earnchat:member-state','earnchat:config-updated'])if(!js.includes(token))fail.push(`Experience runtime missing ${token}`);
 for(const token of['reward-flow','level-path','member-clarity-card','activity-guide','referral-explainer','earned-upgrade-banner'])if(!css.includes(token))fail.push(`Experience stylesheet missing ${token}`);
 if(js.includes('observe(document.documentElement'))fail.push('Experience runtime must not observe the full document');
 if((html.match(/product-experience\.js/g)||[]).length!==1)fail.push('Experience runtime must be loaded exactly once');
 if((html.match(/product-experience\.css/g)||[]).length!==1)fail.push('Experience stylesheet must be loaded exactly once');
}
if(fail.length){console.error(`Product experience validation failed:\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat product experience validation passed.');
