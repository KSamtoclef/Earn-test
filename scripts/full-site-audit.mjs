import fs from 'node:fs';
import path from 'node:path';

const failures=[];
const warnings=[];
const read=p=>fs.readFileSync(p,'utf8');
const exists=p=>fs.existsSync(p);
const requireToken=(src,t,label)=>{if(!src.includes(t))failures.push(`${label}: ${t}`)};
const forbidToken=(src,t,label)=>{if(src.includes(t))failures.push(`${label}: ${t}`)};

const index=read('index.html');
const app=read('assets/js/app.js');
const api=read('assets/js/api.js');
const admin=read('assets/js/admin.js');
const completion=read('assets/js/final-completion.js');
const runtime=read('assets/js/config-runtime.js');
const pkg=JSON.parse(read('package.json'));
const vercel=JSON.parse(read('vercel.json'));

const ids=[...index.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if(duplicates.length)failures.push(`Duplicate DOM ids: ${duplicates.join(', ')}`);

const referenced=[...new Set([...app.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]))];
const missingRefs=referenced.filter(id=>!ids.includes(id));
if(missingRefs.length)warnings.push(`App references dynamic or missing ids: ${missingRefs.join(', ')}`);

for(const token of[
 "const RELEASE='20260802-countdown-r1'",
 'function startChatCountdown()',
 "visibilitychange",
 "pageshow",
 "00:00 · Ready",
 'get_earnchat_kyc_config',
 'provider_url_ng',
 'provider_url_ke',
 'nigeria_multiplier',
 'kenya_multiplier',
 'presence_heartbeat_seconds',
 'featured_task_limit',
 'qualifying_active_days_count'
])requireToken(app+api+runtime,token,'Runtime contract missing');

for(const token of[
 'admin_update_earnchat_configuration',
 'admin_update_earnchat_business_settings',
 'admin_update_earnchat_kyc_config',
 'earnchat:admin-config-saved'
])requireToken(admin+api,token,'Admin contract missing');

for(const token of[
 'platform_name','support_url','terms_url','privacy_url','maintenance_mode','default_country','installRouteObservers'
])requireToken(completion,token,'Completion bridge missing');

for(const token of[
 'id="preview-balance">₦',
 'id="landing-chat">₦',
 'id="home-work">₦',
 'id="withdraw-available">₦'
])forbidToken(index,token,'Country-specific first paint remains');

for(const token of['service_role','SUPABASE_SERVICE_ROLE','postgresql://','anon_key='])forbidToken(index+app+api+admin+completion,token,'Privileged secret or connection string exposed');

if(vercel.outputDirectory!=='public')failures.push('Vercel outputDirectory is not public');
if(!String(pkg.scripts?.test||'').includes('validate'))failures.push('npm test does not run validation');
if(!String(pkg.scripts?.build||'').includes('build-static.mjs'))failures.push('npm build does not use static build');

const tempCandidates=[
 '.github/workflows/fix-chat-countdown.yml',
 '.github/workflows/diagnose-chat-countdown.yml',
 '.github/workflows/final-admin-unification.yml',
 '.github/workflows/diagnose-admin-unification-r2.yml',
 'scripts/fix-chat-countdown.mjs',
 'chat-countdown-diagnostic.log',
 'admin-unification-diagnostic.log',
 'admin-unification-diagnostic-r2.log'
];
const leftovers=tempCandidates.filter(exists);
if(leftovers.length)warnings.push(`Temporary release/diagnostic files remain: ${leftovers.join(', ')}`);

console.log(`Checked ${ids.length} DOM ids, ${referenced.length} direct app element references, Admin/runtime contracts, country safety, secrets, build and Vercel configuration.`);
if(warnings.length)console.log(`WARNINGS (${warnings.length}):\n- ${warnings.join('\n- ')}`);
if(failures.length){console.error(`FAILURES (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1)}
console.log('Full-site static audit passed.');
// trigger 2026-08-03
