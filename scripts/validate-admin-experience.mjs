import fs from'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const app=read('assets/js/app.js'),api=read('assets/js/api.js'),admin=read('assets/js/admin/admin.js'),core=read('assets/js/admin/core.js'),ux=read('assets/js/admin/admin-experience.js'),css=read('assets/css/admin-experience.css'),html=read('index.html');
const checks=[
 ['admin route state',app.includes("classList.toggle('admin-active',name==='admin')")],
 ['admin enhancer wired',admin.includes('enhanceAdminExperience')&&admin.includes('20260812-professional-r3')],
 ['admin back',ux.includes('data-admin-back')&&ux.includes('goBack')],
 ['admin overview',ux.includes('data-admin-overview')],
 ['analytics removed without duplicates',!core.includes("'analytics'")&&!core.includes("analytics:'Analytics'")&&!ux.includes("analytics:'Analytics'")&&!api.includes('adminAnalytics')],
 ['event recording preserved',api.includes("event:async(name,session,page,metadata={})=>rpc('record_earnchat_event'")],
 ['task shortcuts',ux.includes('data-admin-new-task')&&ux.includes('data-admin-current-tasks')],
 ['customer nav isolated',css.includes('body.admin-active .bottom-nav{display:none!important}')],
 ['nonsticky header',css.includes('#view-admin .app-header{position:relative!important')],
 ['nonsticky bulk',css.includes('#view-admin .bulk-toolbar{position:relative!important')],
 ['nonsticky preview',css.includes('#view-admin .task-preview-panel{position:relative!important')],
 ['desktop side nav',css.includes('grid-template-columns:220px minmax(0,1fr)')],
 ['tablet layout',css.includes('@media(min-width:701px) and (max-width:1199px)')],
 ['mobile layout',css.includes('@media(max-width:700px)')],
 ['release cache bust',html.includes('20260812-professional-r3')]
];
const failed=checks.filter(([,ok])=>!ok);for(const [name,ok] of checks)console.log(ok?'PASS':'FAIL',name);if(failed.length)process.exit(1);
