import fs from'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const failures=[];
const requireToken=(source,token,label)=>{if(!source.includes(token))failures.push(`${label}: ${token}`)};
const forbidToken=(source,token,label)=>{if(source.includes(token))failures.push(`${label}: ${token}`)};

const html=read('index.html');
const app=read('assets/js/app.js');
const loader=read('assets/js/supabase-client.js');
const professional=read('assets/js/features/professional-upgrade.js');
const admin=read('assets/js/admin/professional-controls.js');
const sql=read('supabase/earnchat_professional_hardening_20260812.sql');

requireToken(html,'id="view-upgrade"','Upgrade route must exist in the permanent application shell');
requireToken(html,'20260812-professional-r3','Professional release cache version missing from HTML');
requireToken(loader,"RELEASE_VERSION='20260812-professional-r3'",'Professional release cache version missing from loader');
requireToken(app,"const RELEASE='20260812-professional-r3'",'Professional release cache version missing from app');
requireToken(app,'Structured guided sessions with clear requirements and approval.','Guided Session source wording missing');
requireToken(app,'Welcome. ${set[0].prompt}','Guided session must not impersonate a named person');
forbidToken(app,'Another chat','Post-session flow must not return the old Another chat CTA');
forbidToken(app,'alert(','Native browser alert must not be used');
forbidToken(app,'confirm(','Native browser confirm must not be used');
requireToken(app,'actionDialog','Professional confirmation modal missing');
forbidToken(professional,'ensureUpgradeShell','Professional overlay must not own the Upgrade route');
forbidToken(professional,'renderUpgradeFallback','Professional overlay must not duplicate the level renderer');
requireToken(professional,'open_request_capacity','Withdrawal readiness must include open-request capacity');
requireToken(professional,'payout_method_available','Withdrawal readiness must include payout-method availability');
requireToken(professional,'referralModeLabel','Withdrawal UI must respect configured referral counting mode');
requireToken(admin,'data-guided-session-manager','Structured Guided Session manager missing');
requireToken(admin,'data-add-session','Admin must support adding sessions');
requireToken(admin,'data-add-prompt','Admin must support adding prompts');
requireToken(sql,"coalesce(p.kyc_status,'not_submitted')<>'approved'",'Null-safe KYC enforcement missing');
requireToken(sql,'extract(epoch from (now()-coalesce(p.account_created_at,now())))/86400','Complete 24-hour account-day enforcement missing');
requireToken(sql,"'open_request_capacity',open_request_capacity",'Server readiness must expose open-request capacity');
requireToken(sql,"'payout_method_available',payout_method_available",'Server readiness must expose payout-method availability');
requireToken(sql,'referral_withdraw_min_ngn=20000','Legacy referral minimum alignment missing');

if(failures.length){
 console.error(`Professional hardening validation failed with ${failures.length} issue(s):\n- ${failures.join('\n- ')}`);
 process.exit(1);
}
console.log('Earn Chat professional hardening validation passed.');
console.log('Verified permanent Upgrade shell, direct Guided Session source, professional dialogs, exact withdrawal readiness, structured Admin session editing and hardened SQL.');
