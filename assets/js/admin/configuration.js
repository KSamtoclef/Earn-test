import{api}from'../api.js';
import{normalizeBusinessConfig}from'../config-runtime.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const host=()=>$('#admin-content');
const numberValue=value=>Number.isFinite(Number(value))?Number(value):0;
const boolValue=formData=>value=>formData.get(value)==='on';
const notifyRendered=()=>window.dispatchEvent(new CustomEvent('earnchat:form-rendered',{detail:{root:host()}}));
const notifySaved=(form,section)=>window.dispatchEvent(new CustomEvent('earnchat:form-save-succeeded',{detail:{form,section}}));

const input=(name,label,value,{type='text',min=null,max=null,step=null,help='',required=false}={})=>`<div class="field"><label for="cfg-${name}">${esc(label)}</label><input id="cfg-${name}" name="${esc(name)}" type="${type}" value="${esc(value??'')}" ${min!==null?`min="${min}"`:''} ${max!==null?`max="${max}"`:''} ${step!==null?`step="${step}"`:''} ${required?'required':''}>${help?`<small class="field-help">${esc(help)}</small>`:''}</div>`;
const textarea=(name,label,value,help='')=>`<div class="field"><label for="cfg-${name}">${esc(label)}</label><textarea id="cfg-${name}" name="${esc(name)}">${esc(value??'')}</textarea>${help?`<small class="field-help">${esc(help)}</small>`:''}</div>`;
const check=(name,label,value,help='')=>`<label class="select-row"><input name="${esc(name)}" type="checkbox" ${value?'checked':''}><span><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:''}</span></label>`;
const section=(id,title,description,body)=>`<details class="admin-config-section" data-config-section="${id}" ${id==='general'?'open':''}><summary><span><b>${esc(title)}</b><small>${esc(description)}</small></span></summary><form class="admin-config-form" data-section="${id}">${body}<div class="admin-config-actions"><span class="config-form-status" role="status"></span><button class="primary" type="submit">Save ${esc(title)}</button></div></form></details>`;
const parseJson=(value,label)=>{try{return JSON.parse(value)}catch{throw new Error(`${label} must contain valid JSON.`)}};

function businessForm(config){const s=config.settings||{};return section('business','Business & Currency','Core monetary values and presence timing used by server-side functions.',`
 <div class="quick-grid">
  ${input('signup_bonus_ngn','Signup bonus NGN',s.signup_bonus_ngn??2000,{type:'number',min:0,required:true})}
  ${input('daily_cap_ngn','Daily earning cap NGN',s.daily_cap_ngn??20000,{type:'number',min:0,required:true})}
  ${input('nigeria_multiplier','Nigeria multiplier',s.nigeria_multiplier??1,{type:'number',min:.01,step:.01,required:true})}
  ${input('kenya_multiplier','Kenya multiplier',s.kenya_multiplier??.6,{type:'number',min:.01,step:.01,required:true})}
  ${input('referral_reward_ngn','Qualified referral reward NGN',s.referral_reward_ngn??500,{type:'number',min:0,required:true})}
  ${input('referral_withdraw_min_ngn','Referral withdrawal minimum NGN',s.referral_withdraw_min_ngn??40000,{type:'number',min:0,required:true})}
  ${input('referral_required_active_days','Referral active days',s.referral_required_active_days??2,{type:'number',min:0,max:365,required:true})}
  ${input('referrer_account_days','Referrer account days',s.referrer_account_days??5,{type:'number',min:0,max:365,required:true})}
  ${input('presence_online_seconds','Online-presence window seconds',s.presence_online_seconds??90,{type:'number',min:30,max:3600,required:true})}
  ${input('presence_heartbeat_seconds','Presence heartbeat seconds',s.presence_heartbeat_seconds??60,{type:'number',min:15,max:3600,required:true})}
 </div>
 <article class="admin-preview-card"><span class="eyebrow">CURRENCY PREVIEW</span><h3>Kenya values use the configured Kenya multiplier</h3><p>Customer displays and server credits continue to use country-specific currency formatting.</p></article>
 `)}
function generalForm(config){const c=config.general;return section('general','General','Platform identity, availability, countries and support links.',`
 ${input('platform_name','Platform name',c.platform_name,{required:true,max:80})}
 ${input('production_origin','Production origin',c.production_origin,{type:'url',required:true,help:'Must be a complete HTTPS origin, for example https://earn-chat.com.'})}
 ${input('support_email','Support email',c.support_email,{type:'email'})}
 ${input('support_url','Support URL',c.support_url,{type:'url'})}
 ${input('terms_url','Terms URL',c.terms_url,{type:'url'})}
 ${input('privacy_url','Privacy URL',c.privacy_url,{type:'url'})}
 <div class="quick-grid">${check('country_ng','Enable Nigeria',c.enabled_countries.includes('NG'))}${check('country_ke','Enable Kenya',c.enabled_countries.includes('KE'))}</div>
 <div class="field"><label for="cfg-default_country">Default country</label><select id="cfg-default_country" name="default_country"><option value="NG" ${c.default_country==='NG'?'selected':''}>Nigeria</option><option value="KE" ${c.default_country==='KE'?'selected':''}>Kenya</option></select></div>
 ${check('registration_enabled','Registration enabled',c.registration_enabled,'Disabling this prevents new customer registration.')}
 ${check('maintenance_mode','Maintenance mode',c.maintenance_mode,'Customers see the maintenance message instead of protected features.')}
 ${textarea('maintenance_message','Maintenance message',c.maintenance_message)}
 `)}
function landingForm(config){const c=config.landing;return section('landing','Landing','Public landing and signup content.',`
 ${textarea('headline','Headline',c.headline)}
 ${textarea('subheadline','Subheadline',c.subheadline)}
 ${input('cta_label','Primary CTA label',c.cta_label,{max:80})}
 ${check('social_proof_enabled','Social proof enabled',c.social_proof_enabled)}
 ${check('verified_payments_enabled','Verified payments enabled',c.verified_payments_enabled)}
 ${check('member_feedback_enabled','Member feedback enabled',c.member_feedback_enabled)}
 <article class="admin-preview-card"><span class="eyebrow">CUSTOMER PREVIEW</span><h2 data-preview="landing-headline">${esc(c.headline)}</h2><p data-preview="landing-subheadline">${esc(c.subheadline)}</p><button class="primary" type="button" disabled data-preview="landing-cta">${esc(c.cta_label)}</button></article>
 `)}
function chatForm(config){const c=config.chat;return section('chat','Guided Chat','Timing, reply quality, recovery, prompts and partners.',`
 ${check('enabled','Guided Chat enabled',c.enabled)}
 <div class="quick-grid">
  ${input('minimum_seconds','Minimum seconds',c.minimum_seconds,{type:'number',min:30,max:900,required:true})}
  ${input('required_replies','Required replies',c.required_replies,{type:'number',min:1,max:10,required:true})}
  ${input('minimum_reply_length','Minimum reply length',c.minimum_reply_length,{type:'number',min:1,max:500,required:true})}
  ${input('attempt_expiry_minutes','Attempt expiry minutes',c.attempt_expiry_minutes,{type:'number',min:5,max:1440,required:true})}
  ${input('recovery_expiry_minutes','Browser recovery minutes',c.recovery_expiry_minutes,{type:'number',min:5,max:10080,required:true})}
  ${input('activity_points','Activity Points',c.activity_points,{type:'number',min:0,max:1000,required:true})}
 </div>
 ${input('completion_wording','Completion button wording',c.completion_wording,{max:100})}
 ${textarea('pending_wording','Timer-ready wording',c.pending_wording)}
 ${textarea('prompt_sets_json','Prompt sets JSON',JSON.stringify(c.prompt_sets,null,2),'Array of prompt sets. Each prompt requires prompt text and a suggestions array.')}
 ${textarea('partners_json','Partner profiles JSON',JSON.stringify(c.partners,null,2),'Array of name, short, place and topic objects.')}
 <article class="admin-preview-card"><span class="eyebrow">CHAT PREVIEW</span><h3><span data-preview="chat-replies">${c.required_replies}</span> replies · <span data-preview="chat-seconds">${c.minimum_seconds}</span> seconds</h3><p data-preview="chat-wording">${esc(c.pending_wording)}</p></article>
 `)}
function tasksForm(config){const c=config.tasks;return section('tasks','Tasks and Visits','Global activity lifecycle and customer status wording.',`
 ${check('enabled','Tasks enabled',c.enabled)}
 ${check('visits_enabled','Sponsored Visits enabled',c.visits_enabled)}
 ${check('show_status_filters','Show status filters',c.show_status_filters)}
 <div class="quick-grid">${input('default_attempt_expiry_minutes','Default attempt expiry minutes',c.default_attempt_expiry_minutes,{type:'number',min:1,max:1440})}${input('featured_task_limit','Featured task limit',c.featured_task_limit,{type:'number',min:0,max:50})}</div>
 <div class="field"><label for="cfg-incomplete_attempt_policy">Incomplete attempt policy</label><select id="cfg-incomplete_attempt_policy" name="incomplete_attempt_policy"><option value="restart" ${c.incomplete_attempt_policy==='restart'?'selected':''}>Restart required</option><option value="resume" ${c.incomplete_attempt_policy==='resume'?'selected':''}>Allow resume</option></select></div>
 ${textarea('restart_required_message','Restart-required message',c.restart_required_message)}
 ${textarea('pending_review_message','Pending-review message',c.pending_review_message)}
 ${textarea('approved_message','Approved message',c.approved_message)}
 ${textarea('rejected_message','Rejected message',c.rejected_message)}
 `)}
function referralForm(config){const c=config.referrals;return section('referrals','Referrals','Direct-referral rewards, qualification and sharing copy.',`
 ${check('enabled','Referrals enabled',c.enabled)}
 ${check('direct_referral_only','Direct referrals only',true,'This safety rule is fixed and cannot be disabled.')}
 <div class="quick-grid">${input('fixed_reward_ngn','Qualified reward NGN',c.fixed_reward_ngn,{type:'number',min:0})}${input('required_active_days','Required active days',c.required_active_days,{type:'number',min:0,max:365})}${input('referrer_account_days','Referrer account days',c.referrer_account_days,{type:'number',min:0,max:365})}</div>
 ${textarea('sharing_copy','Referral sharing copy',c.sharing_copy)}
 `)}
function withdrawalForm(config){const c=config.withdrawals;return section('withdrawals','Withdrawals','Global payout availability, limits and review expectations.',`
 ${check('enabled','Withdrawals enabled',c.enabled)}
 ${check('bank_transfer_enabled','Bank transfer enabled',c.bank_transfer_enabled)}
 ${check('mpesa_enabled','M-Pesa enabled',c.mpesa_enabled)}
 <div class="quick-grid">${input('maximum_open_requests','Maximum open requests',c.maximum_open_requests,{type:'number',min:1,max:10})}${input('referral_minimum_ngn','Referral minimum NGN',c.referral_minimum_ngn,{type:'number',min:0})}${input('review_hours','Review hours',c.review_hours,{type:'number',min:1,max:720})}</div>
 ${textarea('maintenance_message','Withdrawal maintenance message',c.maintenance_message)}
 `)}
function kycForm(config){const c=config.kyc;return section('kyc','KYC','Country providers, URLs, instructions and review policy.',`
 ${check('enabled','KYC enabled',c.enabled)}
 ${check('reference_required','Provider reference required',c.reference_required)}
 ${input('review_hours','Review hours',c.review_hours,{type:'number',min:1,max:720})}
 <div class="admin-config-grid"><section><h3>Nigeria</h3>${input('provider_ng','Provider name',c.provider_ng)}${input('provider_url_ng','Provider HTTPS URL',c.provider_url_ng,{type:'url'})}${textarea('instructions_ng','Instructions',c.instructions_ng)}</section><section><h3>Kenya</h3>${input('provider_ke','Provider name',c.provider_ke)}${input('provider_url_ke','Provider HTTPS URL',c.provider_url_ke,{type:'url'})}${textarea('instructions_ke','Instructions',c.instructions_ke)}</section></div>
 ${textarea('maintenance_message','KYC maintenance message',c.maintenance_message)}
 `)}
function flagsForm(config){const flags=config.feature_flags;return section('feature_flags','Feature Flags','Enable or disable supported customer and Admin features.',Object.entries(flags).map(([name,value])=>check(name,name.replaceAll('_',' '),value)).join(''))}
function levelsForm(config){const levels=config.levels||{};return`<details class="admin-config-section" data-config-section="levels"><summary><span><b>Levels</b><small>Rewards, limits, eligibility and referral commission.</small></span></summary><div class="level-config-list">${Object.entries(levels).sort((a,b)=>Number(a[1].rank||0)-Number(b[1].rank||0)).map(([name,level])=>`<form class="admin-level-form" data-level="${esc(name)}"><h3>${esc(name)}</h3><div class="quick-grid">${[['chat_limit','Chat limit'],['chat_reward_ngn','Chat reward NGN'],['task_min_ngn','Task minimum NGN'],['task_max_ngn','Task maximum NGN'],['withdraw_min_ngn','Withdrawal minimum NGN'],['withdraw_max_ngn','Withdrawal maximum NGN'],['account_days','Account days'],['active_days','Active days'],['approved_chats','Approved chats'],['approved_tasks','Approved tasks'],['points_required','Points required'],['referral_commission_percent','Referral commission %']].map(([key,label])=>input(key,label,level[key]??0,{type:'number',min:0})).join('')}</div><div class="admin-config-actions"><span class="config-form-status" role="status"></span><button class="secondary" type="submit">Save ${esc(name)}</button></div></form>`).join('')}</div></details>`}

function payloadFor(section,form){const data=new FormData(form),bool=boolValue(data);switch(section){
 case'business':return{signup_bonus_ngn:numberValue(data.get('signup_bonus_ngn')),daily_cap_ngn:numberValue(data.get('daily_cap_ngn')),nigeria_multiplier:numberValue(data.get('nigeria_multiplier')),kenya_multiplier:numberValue(data.get('kenya_multiplier')),referral_reward_ngn:numberValue(data.get('referral_reward_ngn')),referral_withdraw_min_ngn:numberValue(data.get('referral_withdraw_min_ngn')),referral_required_active_days:numberValue(data.get('referral_required_active_days')),referrer_account_days:numberValue(data.get('referrer_account_days')),presence_online_seconds:numberValue(data.get('presence_online_seconds')),presence_heartbeat_seconds:numberValue(data.get('presence_heartbeat_seconds'))};
 case'general':return{platform_name:data.get('platform_name'),production_origin:data.get('production_origin'),support_email:data.get('support_email'),support_url:data.get('support_url'),terms_url:data.get('terms_url'),privacy_url:data.get('privacy_url'),maintenance_mode:bool('maintenance_mode'),maintenance_message:data.get('maintenance_message'),registration_enabled:bool('registration_enabled'),enabled_countries:[data.get('country_ng')==='on'?'NG':null,data.get('country_ke')==='on'?'KE':null].filter(Boolean),default_country:data.get('default_country')};
 case'landing':return{headline:data.get('headline'),subheadline:data.get('subheadline'),cta_label:data.get('cta_label'),social_proof_enabled:bool('social_proof_enabled'),verified_payments_enabled:bool('verified_payments_enabled'),member_feedback_enabled:bool('member_feedback_enabled')};
 case'chat':return{enabled:bool('enabled'),minimum_seconds:numberValue(data.get('minimum_seconds')),required_replies:numberValue(data.get('required_replies')),minimum_reply_length:numberValue(data.get('minimum_reply_length')),attempt_expiry_minutes:numberValue(data.get('attempt_expiry_minutes')),recovery_expiry_minutes:numberValue(data.get('recovery_expiry_minutes')),activity_points:numberValue(data.get('activity_points')),completion_wording:data.get('completion_wording'),pending_wording:data.get('pending_wording'),prompt_sets:parseJson(data.get('prompt_sets_json'),'Prompt sets'),partners:parseJson(data.get('partners_json'),'Partner profiles')};
 case'tasks':return{enabled:bool('enabled'),visits_enabled:bool('visits_enabled'),show_status_filters:bool('show_status_filters'),default_attempt_expiry_minutes:numberValue(data.get('default_attempt_expiry_minutes')),featured_task_limit:numberValue(data.get('featured_task_limit')),incomplete_attempt_policy:data.get('incomplete_attempt_policy'),restart_required_message:data.get('restart_required_message'),pending_review_message:data.get('pending_review_message'),approved_message:data.get('approved_message'),rejected_message:data.get('rejected_message')};
 case'referrals':return{enabled:bool('enabled'),direct_referral_only:true,fixed_reward_ngn:numberValue(data.get('fixed_reward_ngn')),required_active_days:numberValue(data.get('required_active_days')),referrer_account_days:numberValue(data.get('referrer_account_days')),sharing_copy:data.get('sharing_copy')};
 case'withdrawals':return{enabled:bool('enabled'),bank_transfer_enabled:bool('bank_transfer_enabled'),mpesa_enabled:bool('mpesa_enabled'),maximum_open_requests:numberValue(data.get('maximum_open_requests')),referral_minimum_ngn:numberValue(data.get('referral_minimum_ngn')),review_hours:numberValue(data.get('review_hours')),maintenance_message:data.get('maintenance_message')};
 case'kyc':return{enabled:bool('enabled'),reference_required:bool('reference_required'),review_hours:numberValue(data.get('review_hours')),provider_ng:data.get('provider_ng'),provider_ke:data.get('provider_ke'),provider_url_ng:data.get('provider_url_ng'),provider_url_ke:data.get('provider_url_ke'),instructions_ng:data.get('instructions_ng'),instructions_ke:data.get('instructions_ke'),maintenance_message:data.get('maintenance_message')};
 case'feature_flags':return Object.fromEntries([...data.keys()].map(key=>[key,bool(key)]));
 default:throw new Error(`Unsupported configuration section: ${section}`);
}}
function setBusy(form,busy,message=''){const button=$('button[type="submit"]',form),status=$('.config-form-status',form);if(button){button.disabled=busy;button.textContent=busy?'Saving…':button.dataset.label||button.textContent.replace('Saving…','Save')}if(status)status.textContent=message}
function bindPreviews(){const root=host();root.addEventListener('input',event=>{const form=event.target.closest('[data-section]');if(!form)return;if(form.dataset.section==='landing'){$('[data-preview="landing-headline"]',root).textContent=form.elements.headline.value;$('[data-preview="landing-subheadline"]',root).textContent=form.elements.subheadline.value;$('[data-preview="landing-cta"]',root).textContent=form.elements.cta_label.value}if(form.dataset.section==='chat'){$('[data-preview="chat-replies"]',root).textContent=form.elements.required_replies.value;$('[data-preview="chat-seconds"]',root).textContent=form.elements.minimum_seconds.value;$('[data-preview="chat-wording"]',root).textContent=form.elements.pending_wording.value}})}

export async function renderConfiguration(){
 const target=host();if(!target)return;
 const cached=api.peekBusiness?.();
 if(!cached)target.innerHTML='<article class="card"><b>Loading authoritative configuration…</b></article>';
 try{
  const config=normalizeBusinessConfig(cached||await api.business());
  target.innerHTML=`<article class="card config-version-card"><span class="eyebrow">AUTHORITATIVE CONFIGURATION</span><h2>Platform control center</h2><p>Version <b>${esc(config.configuration_version||config.version)}</b>${config.updated_at?` · Updated ${new Date(config.updated_at).toLocaleString()}`:''}</p><p>Security infrastructure, routes, RLS and credentials remain code-controlled.</p></article>${businessForm(config)}${generalForm(config)}${landingForm(config)}${chatForm(config)}${tasksForm(config)}${referralForm(config)}${withdrawalForm(config)}${kycForm(config)}${flagsForm(config)}${levelsForm(config)}`;
  $$('.admin-config-form',target).forEach(form=>{const button=$('button[type="submit"]',form);if(button)button.dataset.label=button.textContent;form.onsubmit=async event=>{event.preventDefault();const sectionName=form.dataset.section;setBusy(form,true);try{const payload=payloadFor(sectionName,form),response=sectionName==='business'?await api.adminUpdateBusiness(payload):await api.adminUpdateConfiguration(sectionName,payload);notifySaved(form,sectionName);setBusy(form,false,`Saved. Configuration version ${response?.configuration_version||response?.version||'updated'}.`)}catch(error){setBusy(form,false,error.message||'Configuration could not be saved.')}}});
  $$('.admin-level-form',target).forEach(form=>{const button=$('button[type="submit"]',form);if(button)button.dataset.label=button.textContent;form.onsubmit=async event=>{event.preventDefault();setBusy(form,true);try{const payload=Object.fromEntries([...new FormData(form).entries()].map(([key,value])=>[key,numberValue(value)]));await api.adminUpdateLevel(form.dataset.level,payload);notifySaved(form,'levels');setBusy(form,false,`${form.dataset.level} saved.`)}catch(error){setBusy(form,false,error.message||'Level could not be saved.')}}});
  bindPreviews();notifyRendered();
 }catch(error){target.innerHTML=`<div class="form-message error show">${esc(error.message||'Configuration could not load.')}</div><button id="configuration-retry" class="primary" type="button">Retry</button>`;$('#configuration-retry',target)?.addEventListener('click',renderConfiguration,{once:true})}
}
