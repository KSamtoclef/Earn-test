import{sb}from'./supabase-client.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unwrap=r=>{if(r.error)throw r.error;return r.data};
const country=()=>localStorage.getItem('earnchat-country')==='KE'?'KE':'NG';
let renderToken=0;

function addStyles(){
 if($('#kyc-bulk-upgrade-style'))return;
 const s=document.createElement('style');
 s.id='kyc-bulk-upgrade-style';
 s.textContent=`
 .kyc-config-card{background:linear-gradient(145deg,#fff,#f4f9ff);border:1px solid #cfe0ef;border-radius:22px;padding:18px;box-shadow:0 14px 36px rgba(36,74,112,.08)}
 .kyc-config-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.kyc-country-box{padding:14px;border-radius:18px;background:#f8fbff;border:1px solid #d7e4ef}.kyc-country-box h3{margin:0 0 10px}.kyc-test-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.kyc-test-row button{width:auto;white-space:nowrap}.kyc-provider-card{background:linear-gradient(135deg,#eef5ff,#ecfbf5);border:1px solid #cbdfee;border-radius:20px;padding:17px}.kyc-provider-card p{color:#53677d;line-height:1.55}.bulk-toolbar{position:sticky;top:74px;z-index:8;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#102942;color:#fff;border-radius:17px;padding:11px;margin:10px 0}.bulk-toolbar button{width:auto;min-height:42px;padding:9px 13px}.bulk-toolbar span{margin-right:auto;font-weight:800}.select-row{display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:start}.select-row>input{width:20px;height:20px;margin-top:3px}.compact-onboarding{max-width:420px!important;padding:18px!important;text-align:left!important}.compact-onboarding h2{font-size:24px;margin:5px 0 8px}.onboard-list{display:grid;gap:9px;margin:14px 0}.onboard-item{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:center;padding:10px;border:1px solid #d7e3ed;border-radius:14px;background:#fff}.onboard-item i{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#e8f2ff;color:#2169ce;font-style:normal;font-weight:900}.onboard-item b,.onboard-item small{display:block}.onboard-item small{color:#64758a;margin-top:2px}.onboard-actions{display:grid;grid-template-columns:auto 1fr;gap:9px}
 @media(max-width:680px){.kyc-config-grid{grid-template-columns:1fr}.kyc-test-row{grid-template-columns:1fr}.kyc-test-row button{width:100%}.bulk-toolbar{top:62px}.bulk-toolbar span{width:100%}}
 `;
 document.head.appendChild(s);
}

async function kycConfig(){return unwrap(await sb.rpc('get_earnchat_kyc_config'))}
async function submitKyc(reference,metadata){return unwrap(await sb.rpc('submit_earnchat_kyc',{p_reference:reference||null,p_metadata:metadata||{}}))}

function compactOnboarding(){
 const modal=$('#tour-modal'),sheet=$('.modal-sheet',modal);
 if(!modal||!sheet||sheet.dataset.compact==='1')return;
 sheet.dataset.compact='1';
 sheet.className='modal-sheet compact-onboarding';
 sheet.innerHTML=`<span class="eyebrow">START HERE</span><h2>Begin with one activity</h2><p>Your dashboard already shows today’s limits and your next action.</p><div class="onboard-list"><div class="onboard-item"><i>1</i><div><b>Open Earn</b><small>See the guided chats available today.</small></div></div><div class="onboard-item"><i>2</i><div><b>Complete one chat</b><small>Use a suggestion or write your own meaningful reply.</small></div></div><div class="onboard-item"><i>3</i><div><b>Explore tasks afterward</b><small>Every linked activity shows a guide before opening.</small></div></div></div><div class="onboard-actions"><button id="tour-skip" class="text-link" type="button">Close</button><button id="tour-next" class="primary" type="button">Open Earn</button></div>`;
 const close=()=>{localStorage.setItem('earnchat-tour-complete','1');modal.classList.remove('show')};
 $('#tour-skip',sheet).onclick=close;
 $('#tour-next',sheet).onclick=()=>{close();location.hash='#/earn'};
}

function ensureKycModal(){
 let modal=$('#kyc-provider-modal');
 if(modal)return modal;
 modal=document.createElement('div');
 modal.id='kyc-provider-modal';
 modal.className='modal';
 modal.innerHTML=`<div class="modal-sheet"><div class="modal-head"><div><span class="eyebrow">IDENTITY VERIFICATION</span><h2 style="margin:5px 0">Verify your account</h2></div><button id="kyc-provider-close" type="button">×</button></div><div id="kyc-provider-message" class="form-message"></div><div id="kyc-provider-content"></div></div>`;
 document.body.appendChild(modal);
 $('#kyc-provider-close',modal).onclick=()=>modal.classList.remove('show');
 modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show')});
 return modal;
}

async function openKycFlow(){
 const modal=ensureKycModal(),content=$('#kyc-provider-content',modal),message=$('#kyc-provider-message',modal);
 message.className='form-message';
 content.innerHTML='<div class="card"><b>Loading verification instructions…</b></div>';
 modal.classList.add('show');
 try{
  const cfg=await kycConfig(),code=country(),local=cfg?.[code]||{},enabled=cfg?.enabled!==false,required=cfg?.reference_required!==false,hours=Number(cfg?.review_hours||48),url=String(local.url||'').trim();
  if(!enabled){content.innerHTML='<article class="kyc-provider-card"><h3>Verification is temporarily unavailable</h3><p>Please return later.</p></article>';return}
  content.innerHTML=`<article class="kyc-provider-card"><span class="tag">${code==='KE'?'🇰🇪 Kenya':'🇳🇬 Nigeria'}</span><h3>${esc(local.provider||'Approved verification provider')}</h3><p>${esc(local.instructions||'Complete the approved verification steps and return here.')}</p><small>Typical review time: up to ${hours} hours.</small></article>${url?'<button id="kyc-open-provider" class="primary" type="button">Open verification page ↗</button>':'<div class="form-message error show">The administrator has not added a KYC URL for your country yet.</div>'}<div class="field ${required?'':'hidden'}"><label>Verification reference</label><input id="kyc-reference" placeholder="Enter the reference received after verification"></div><button id="kyc-send" class="secondary" type="button" ${url?'':'disabled'}>Submit for review</button>`;
  if(url)$('#kyc-open-provider',content).onclick=()=>window.open(url,'_blank','noopener,noreferrer');
  $('#kyc-send',content).onclick=async()=>{
   const ref=$('#kyc-reference',content)?.value.trim()||'';
   if(required&&!ref){message.textContent='Enter the verification reference before submitting.';message.className='form-message error show';return}
   const b=$('#kyc-send',content);b.disabled=true;b.textContent='Submitting…';
   try{await submitKyc(ref,{provider:local.provider||null,country:code,verification_url:url});message.textContent='Verification submitted for review.';message.className='form-message ok show';const status=$('#profile-kyc');if(status)status.textContent='submitted'}catch(error){message.textContent=error.message||'Verification could not be submitted.';message.className='form-message error show';b.disabled=false;b.textContent='Submit for review'}
  };
 }catch(error){content.innerHTML=`<div class="form-message error show">${esc(error.message||'KYC configuration could not load.')}</div>`}
}

function bulkToolbar(){return `<div class="bulk-toolbar"><span><b class="bulk-count">0</b> selected</span><button class="secondary bulk-select-all" type="button">Select all</button><button class="primary bulk-approve" type="button">Approve selected</button><button class="danger bulk-reject" type="button">Reject selected</button></div>`}

function bindBulk(scope){
 const checks=()=>$$('.bulk-check:checked',scope).map(x=>x.value),update=()=>{$('.bulk-count',scope).textContent=checks().length};
 scope.onchange=e=>{if(e.target.matches('.bulk-check'))update()};
 $('.bulk-select-all',scope).onclick=()=>{$$('.bulk-check',scope).forEach(x=>x.checked=true);update()};
 const run=async decision=>{const ids=checks();if(!ids.length)return alert('Select at least one KYC submission.');const reason=decision==='rejected'?(prompt('Rejection reason:','Verification could not be confirmed.')||'Rejected'):null;try{const result=unwrap(await sb.rpc('admin_bulk_review_earnchat_kyc',{p_submissions:ids,p_decision:decision,p_reason:reason}));alert(`${result.succeeded||0} updated${result.failed?`; ${result.failed} failed`:''}.`);renderAdminKyc()}catch(error){alert(error.message||'Bulk action failed.')}};
 $('.bulk-approve',scope).onclick=()=>run('approved');
 $('.bulk-reject',scope).onclick=()=>run('rejected');
}

async function renderAdminKyc(){
 const token=++renderToken,host=$('#admin-content');
 if(!host)return;
 host.innerHTML='<div class="card"><b>Loading KYC configuration and pending reviews…</b></div>';
 try{
  const [cfg,submissions,profiles]=await Promise.all([
   kycConfig(),
   unwrap(await sb.from('earnchat_kyc_submissions').select('*').in('status',['submitted','under_review']).order('created_at',{ascending:false}).limit(500)),
   unwrap(await sb.from('profiles').select('id,full_name,email,country').limit(2000))
  ]);
  if(token!==renderToken||!$('#admin-tabs [data-tab="kyc"].active'))return;
  const users=Object.fromEntries(profiles.map(x=>[x.id,x]));
  host.innerHTML=`<article class="kyc-config-card"><span class="eyebrow">KYC SETTINGS</span><h2>Provider links and instructions</h2><p>These links appear to users according to their selected country.</p><form id="kyc-config-form"><div class="kyc-config-grid"><section class="kyc-country-box"><h3>🇳🇬 Nigeria</h3><div class="field"><label>Provider name</label><input id="kc-provider-ng" value="${esc(cfg?.NG?.provider||'')}"></div><div class="kyc-test-row"><div class="field"><label>Verification URL</label><input id="kc-url-ng" type="url" placeholder="https://provider.example/nigeria" value="${esc(cfg?.NG?.url||'')}"></div><button id="kc-test-ng" class="secondary" type="button">Test URL</button></div><div class="field"><label>User instructions</label><textarea id="kc-ins-ng">${esc(cfg?.NG?.instructions||'')}</textarea></div></section><section class="kyc-country-box"><h3>🇰🇪 Kenya</h3><div class="field"><label>Provider name</label><input id="kc-provider-ke" value="${esc(cfg?.KE?.provider||'')}"></div><div class="kyc-test-row"><div class="field"><label>Verification URL</label><input id="kc-url-ke" type="url" placeholder="https://provider.example/kenya" value="${esc(cfg?.KE?.url||'')}"></div><button id="kc-test-ke" class="secondary" type="button">Test URL</button></div><div class="field"><label>User instructions</label><textarea id="kc-ins-ke">${esc(cfg?.KE?.instructions||'')}</textarea></div></section></div><div class="quick-grid"><div class="field"><label>Estimated review hours</label><input id="kc-hours" type="number" min="1" value="${Number(cfg?.review_hours||48)}"></div><div class="field"><label>Reference requirement</label><select id="kc-reference"><option value="true" ${cfg?.reference_required!==false?'selected':''}>Reference required</option><option value="false" ${cfg?.reference_required===false?'selected':''}>Reference optional</option></select></div></div><label class="select-row"><input id="kc-enabled" type="checkbox" ${cfg?.enabled!==false?'checked':''}><span><b>KYC enabled</b><small>Turn off only while the provider is unavailable.</small></span></label><button class="primary" type="submit">Save KYC configuration</button></form></article><div class="section-title"><h2>Pending KYC reviews</h2></div><section id="bulk-kyc">${bulkToolbar()}<div class="list">${submissions.map(r=>{const u=users[r.user_id]||{};return `<article class="list-card select-row"><input class="bulk-check" type="checkbox" value="${r.id}"><div><header><div><h3>${esc(u.full_name||'Member')}</h3><p>${esc(u.email||r.user_id)} · ${esc(u.country||'—')}</p></div><span class="tag">${esc(r.status)}</span></header><p>Reference: ${esc(r.provider_reference||'Not supplied')}</p><small>Submitted ${new Date(r.created_at).toLocaleString()}</small></div></article>`}).join('')||'<article class="list-card"><h3>No pending KYC submissions</h3></article>'}</div></section>`;
  $('#kc-test-ng',host).onclick=()=>testUrl($('#kc-url-ng',host).value);
  $('#kc-test-ke',host).onclick=()=>testUrl($('#kc-url-ke',host).value);
  $('#kyc-config-form',host).onsubmit=async e=>{e.preventDefault();const payload={enabled:$('#kc-enabled',host).checked,provider_ng:$('#kc-provider-ng',host).value.trim(),provider_ke:$('#kc-provider-ke',host).value.trim(),url_ng:$('#kc-url-ng',host).value.trim(),url_ke:$('#kc-url-ke',host).value.trim(),instructions_ng:$('#kc-ins-ng',host).value.trim(),instructions_ke:$('#kc-ins-ke',host).value.trim(),reference_required:$('#kc-reference',host).value==='true',review_hours:Number($('#kc-hours',host).value||48)};try{unwrap(await sb.rpc('admin_update_earnchat_kyc_config',{p_payload:payload}));alert('KYC configuration saved.')}catch(error){alert(error.message||'KYC configuration could not be saved.')}};
  bindBulk($('#bulk-kyc',host));
 }catch(error){if(token===renderToken)host.innerHTML=`<div class="form-message error show">${esc(error.message||'KYC administration could not load.')}</div>`}
}

function testUrl(value){
 const url=String(value||'').trim();
 if(!/^https:\/\//i.test(url))return alert('Enter a complete HTTPS URL first.');
 window.open(url,'_blank','noopener,noreferrer');
}

function scheduleKycRender(){
 const waits=[0,120,350,700,1200];
 waits.forEach(ms=>setTimeout(()=>{if($('#admin-tabs [data-tab="kyc"].active')&&!$('#kyc-config-form'))renderAdminKyc()},ms));
}

function bindAdmin(){
 document.addEventListener('click',e=>{const tab=e.target.closest('#admin-tabs [data-tab]');if(tab?.dataset.tab==='kyc')scheduleKycRender()},true);
 window.addEventListener('hashchange',()=>{if(location.hash.includes('/admin'))setTimeout(()=>{if($('#admin-tabs [data-tab="kyc"].active'))scheduleKycRender()},250)});
}

function bindKycButton(){document.addEventListener('click',e=>{const b=e.target.closest('#submit-kyc');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openKycFlow()},true)}

function init(){addStyles();compactOnboarding();bindKycButton();bindAdmin()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
