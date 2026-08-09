import fs from'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html');
const routes=read('assets/js/app-config.js');
const app=read('assets/js/app.js');
const admin=read('assets/js/admin/core.js');
const config=read('assets/js/admin/configuration.js');
const journey=read('assets/js/features/level-journey.js');
const migration=read('supabase/earnchat_sponsored_visits_only_20260809.sql');
const checks=[
 ['no Tasks customer route',!routes.includes("'tasks'")&&!html.includes('id="view-tasks"')&&!html.includes('data-go="tasks"')&&!app.includes("name==='tasks'")],
 ['no Tasks customer wording',!/>Tasks</.test(html)&&!html.includes('linked tasks')],
 ['Sponsored Visits customer route',routes.includes("'visits'")&&html.includes('id="view-visits"')&&html.includes('Sponsored Visits')],
 ['Admin is visits-only',admin.includes("tasks:'Sponsored Visits'")&&admin.includes("category:'Visit'")&&admin.includes("r.category==='Visit'")],
 ['legacy Tasks flag hidden and disabled',config.includes("name!=='tasks'")&&config.includes('tasks:false')],
 ['no task level requirement',!journey.includes("requirement('tasks'")&&!journey.includes('data-go="tasks"')],
 ['database ends non-Visit items',migration.includes("where category<>'Visit' and status<>'ended'")],
 ['database blocks non-Visit creation',migration.includes('earnchat_enforce_sponsored_visit_only')&&migration.includes("new.category is distinct from 'Visit'")],
 ['historical tables preserved',!migration.includes('drop table')&&!migration.includes('delete from public.earnchat_task_claims')],
 ['release cache bust',html.includes('20260809-visits-only-r1')]
];
const failed=checks.filter(([,ok])=>!ok);
for(const[name,ok]of checks)console.log(ok?'PASS':'FAIL',name);
if(failed.length)process.exit(1);
