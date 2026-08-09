import fs from'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const replace=(src,from,to,label)=>{if(!src.includes(from))throw new Error(`Missing ${label}`);return src.replace(from,to)};

let app=read('assets/js/app.js');
app=app.replaceAll("20260809-controls-r1","20260809-adminux-r2");
app=replace(app,"async function onRoute(name){document.body.classList.toggle('chat-active',name==='chat');","async function onRoute(name){document.body.classList.toggle('chat-active',name==='chat');document.body.classList.toggle('admin-active',name==='admin');",'admin route body state');
write('assets/js/app.js',app);

let admin=read('assets/js/admin/admin.js');
admin=admin.replaceAll('20260809-adminux-r1','20260809-adminux-r2');
write('assets/js/admin/admin.js',admin);

let ux=read('assets/js/admin/admin-experience.js');
ux=ux.replaceAll('20260809-adminux-r1','20260809-adminux-r2');
ux=replace(ux," const back=toolbar.querySelector('[data-admin-back]');\n if(back)back.disabled=readHistory().length===0;"," const back=toolbar.querySelector('[data-admin-back]');\n if(back)back.disabled=readHistory().length===0;\n const taskActions=toolbar.querySelector('[data-admin-task-actions]');\n if(taskActions)taskActions.classList.toggle('hidden',tab!=='tasks');",'task toolbar visibility');
ux=replace(ux,"  toolbar.innerHTML='<button class=\"secondary admin-history-back\" data-admin-back type=\"button\">← Back</button><button class=\"secondary admin-overview-button\" data-admin-overview type=\"button\">⌂ Overview</button><div class=\"admin-breadcrumb\"><small>ADMIN SECTION</small><b data-admin-current>Overview</b></div>';","  toolbar.innerHTML='<button class=\"secondary admin-history-back\" data-admin-back type=\"button\">← Back</button><button class=\"secondary admin-overview-button\" data-admin-overview type=\"button\">⌂ Overview</button><div class=\"admin-breadcrumb\"><small>ADMIN SECTION</small><b data-admin-current>Overview</b></div><div class=\"admin-context-actions hidden\" data-admin-task-actions><button class=\"secondary\" data-admin-new-task type=\"button\">＋ New task</button><button class=\"secondary\" data-admin-current-tasks type=\"button\">Current tasks ↓</button></div>';",'task toolbar actions');
ux=replace(ux,"  toolbar.querySelector('[data-admin-overview]').addEventListener('click',()=>{const tab=currentTab();if(tab!=='overview')pushHistory(tab);goTab('overview',{fromBack:true})});","  toolbar.querySelector('[data-admin-overview]').addEventListener('click',()=>{const tab=currentTab();if(tab!=='overview')pushHistory(tab);goTab('overview',{fromBack:true})});\n  toolbar.querySelector('[data-admin-new-task]').addEventListener('click',()=>document.querySelector('#view-admin #task-form')?.scrollIntoView({block:'start',behavior:'smooth'}));\n  toolbar.querySelector('[data-admin-current-tasks]').addEventListener('click',()=>document.querySelector('#view-admin #task-admin-list')?.scrollIntoView({block:'start',behavior:'smooth'}));",'task toolbar handlers');
write('assets/js/admin/admin-experience.js',ux);

let css=read('assets/css/admin-experience.css');
css += `\n\n/* Admin UX r2: route isolation and task navigation. */\nbody.admin-active .bottom-nav{display:none!important}\nbody.admin-active{overflow-x:hidden}\n.admin-context-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}\n.admin-context-actions.hidden{display:none!important}\n.admin-context-actions .secondary{width:auto}\n#view-admin #task-form,#view-admin #task-admin-list{scroll-margin-top:18px}\n@media(min-width:1200px){.admin-workspace-toolbar{grid-template-columns:auto auto minmax(150px,1fr) auto}.admin-context-actions{grid-column:auto}}\n@media(min-width:701px) and (max-width:1199px){.admin-workspace-toolbar{grid-template-columns:auto auto minmax(0,1fr)}.admin-context-actions{grid-column:1/-1;justify-content:flex-start}}\n@media(max-width:700px){.admin-context-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;width:100%}.admin-context-actions .secondary{width:100%}}\n`;
write('assets/css/admin-experience.css',css);

let html=read('index.html');
html=html.replaceAll('20260809-controls-r1','20260809-adminux-r2');
write('index.html',html);

for(const p of['scripts/validate-final-completion.mjs','scripts/validate-product-experience.mjs']){
 let s=read(p);s=s.replaceAll('20260809-controls-r1','20260809-adminux-r2');write(p,s);
}

const validator=`import fs from'node:fs';\nconst read=p=>fs.readFileSync(p,'utf8');\nconst app=read('assets/js/app.js'),admin=read('assets/js/admin/admin.js'),ux=read('assets/js/admin/admin-experience.js'),css=read('assets/css/admin-experience.css'),html=read('index.html');\nconst checks=[\n ['admin route state',app.includes(\"classList.toggle('admin-active',name==='admin')\")],\n ['admin enhancer wired',admin.includes('enhanceAdminExperience')&&admin.includes('adminux-r2')],\n ['admin back',ux.includes('data-admin-back')&&ux.includes('goBack')],\n ['admin overview',ux.includes('data-admin-overview')],\n ['task shortcuts',ux.includes('data-admin-new-task')&&ux.includes('data-admin-current-tasks')],\n ['customer nav isolated',css.includes('body.admin-active .bottom-nav{display:none!important}')],\n ['nonsticky header',css.includes('#view-admin .app-header{position:relative!important')],\n ['nonsticky bulk',css.includes('#view-admin .bulk-toolbar{position:relative!important')],\n ['nonsticky preview',css.includes('#view-admin .task-preview-panel{position:relative!important')],\n ['desktop side nav',css.includes('grid-template-columns:220px minmax(0,1fr)')],\n ['tablet layout',css.includes('@media(min-width:701px) and (max-width:1199px)')],\n ['mobile layout',css.includes('@media(max-width:700px)')],\n ['release cache bust',html.includes('20260809-adminux-r2')]\n];\nconst failed=checks.filter(([,ok])=>!ok);for(const [name,ok] of checks)console.log(ok?'PASS':'FAIL',name);if(failed.length)process.exit(1);\n`;
write('scripts/validate-admin-experience.mjs',validator);

let pkg=read('package.json');
pkg=pkg.replace('node scripts/validate-product-experience.mjs\"','node scripts/validate-product-experience.mjs && node scripts/validate-admin-experience.mjs\"');
write('package.json',pkg);
console.log('Applied Admin UX r2.');
