import fs from'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const app=read('assets/js/app.js'),admin=read('assets/js/admin/admin.js'),ux=read('assets/js/admin/admin-experience.js'),css=read('assets/css/admin-experience.css'),html=read('index.html');
const checks=[
 ['admin route state',app.includes("classList.toggle('admin-active',name==='admin')")],
 ['admin enhancer wired',admin.includes('enhanceAdminExperience')&&admin.includes('adminux-r2')],
 ['admin back',ux.includes('data-admin-back')&&ux.includes('goBack')],
 ['admin overview',ux.includes('data-admin-overview')],
 ['task shortcuts',ux.includes('data-admin-new-task')&&ux.includes('data-admin-current-tasks')],
 ['customer nav isolated',css.includes('body.admin-active .bottom-nav{display:none!important}')],
 ['nonsticky header',css.includes('#view-admin .app-header{position:relative!important')],
 ['nonsticky bulk',css.includes('#view-admin .bulk-toolbar{position:relative!important')],
 ['nonsticky preview',css.includes('#view-admin .task-preview-panel{position:relative!important')],
 ['desktop side nav',css.includes('grid-template-columns:220px minmax(0,1fr)')],
 ['tablet layout',css.includes('@media(min-width:701px) and (max-width:1199px)')],
 ['mobile layout',css.includes('@media(max-width:700px)')],
 ['release cache bust',html.includes('20260809-adminux-r2')]
];
const failed=checks.filter(([,ok])=>!ok);for(const [name,ok] of checks)console.log(ok?'PASS':'FAIL',name);if(failed.length)process.exit(1);
