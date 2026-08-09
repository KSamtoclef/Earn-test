import fs from'node:fs';

const failures=[];
const read=name=>fs.readFileSync(name,'utf8');
const requireFile=name=>{if(!fs.existsSync(name))failures.push(`Missing final completion file: ${name}`)};
const requireToken=(source,token,label)=>{if(!source.includes(token))failures.push(`${label}: ${token}`)};
const forbidToken=(source,token,label)=>{if(source.includes(token))failures.push(`${label}: ${token}`)};

for(const file of[
 'public/index.html','public/assets/js/app.js','public/assets/js/api.js','public/assets/js/final-completion.js',
 'supabase/earnchat_final_completion_20260802.sql','supabase/earnchat_final_task_runtime_20260802.sql','supabase/earnchat_admin_runtime_unification_20260802.sql','supabase/PRODUCTION_RUN_ORDER.md'
])requireFile(file);

if(!failures.length){
 const html=read('public/index.html');
 const app=read('public/assets/js/app.js');
 const api=read('public/assets/js/api.js');
 const completion=read('public/assets/js/final-completion.js');
 const finalSql=read('supabase/earnchat_final_completion_20260802.sql');
 const taskSql=read('supabase/earnchat_final_task_runtime_20260802.sql');
 const unifiedSql=read('supabase/earnchat_admin_runtime_unification_20260802.sql');
 const runOrder=read('supabase/PRODUCTION_RUN_ORDER.md');

 requireToken(html,'final-completion.js?v=20260809-adminux-r2','Completion runtime is not loaded');
 requireToken(html,'product-experience.js?v=20260809-adminux-r2','Product experience runtime is not loaded');
 requireToken(html,'product-experience.css?v=20260809-adminux-r2','Product experience stylesheet is not loaded');
 for(const token of['id="preview-balance">—','id="landing-chat">—','id="home-work">—','id="withdraw-available">—'])requireToken(html,token,'Country-neutral first paint missing');
 forbidToken(html,'id="preview-balance">₦','Kenyan first paint can expose Naira');

 for(const token of['nigeria_multiplier','kenya_multiplier','presence_heartbeat_seconds','featuredLimit','qualifying_active_days_count'])requireToken(app,token,'Built customer runtime contract missing');
 requireToken(api,'presence_online_seconds','Built Admin presence contract missing');
 for(const token of['platform_name','support_url','terms_url','privacy_url','maintenance_mode','public_registration','default_country'])requireToken(completion,token,'Completion configuration bridge missing');
 for(const token of['installRouteObservers','taskObserver','adminObserver','scheduleRouteRefresh'])requireToken(completion,token,'Route-scoped runtime update missing');
 forbidToken(completion,'observe(document.documentElement','Full-document observer must not return');
 forbidToken(completion,"attributeFilter:['class','data-route']",'Global class observer must not return');

 for(const token of['earnchat_convert_country_amount','referral_required_active_days','referrer_account_days','earnchat_assert_runtime_available','qualifying_active_days_count','20260802-final-completion-r1'])requireToken(finalSql,token,'Final database completion contract missing');
 for(const token of['expires_at','default_attempt_expiry_minutes','get_my_open_task_claim','activity_points','20260802-final-completion-r2'])requireToken(taskSql,token,'Final task runtime contract missing');
 for(const token of['admin_update_earnchat_configuration','admin_update_earnchat_business_settings','admin_update_earnchat_kyc_config','fixed_reward_ngn','referral_minimum_ngn','provider_url_ng','configuration_version'])requireToken(unifiedSql,token,'Admin/runtime unification contract missing');
 for(const token of['earnchat_final_completion_20260802.sql','earnchat_final_task_runtime_20260802.sql','earnchat_admin_runtime_unification_20260802.sql'])requireToken(runOrder,token,'Final SQL run order missing');
}

if(failures.length){
 console.error(`Final completion validation failed with ${failures.length} issue(s):\n- ${failures.join('\n- ')}`);
 process.exit(1);
}
console.log('Earn Chat final completion validation passed.');
console.log('Verified country-safe first paint, country multipliers, Admin propagation, route-scoped runtime updates, presence timing, referral conversion, task expiry and final SQL run order.');
