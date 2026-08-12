import{api}from'../api.js';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num=(value,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.min(max,Math.max(min,Math.round(parsed))):fallback};
const parseArray=(value,fallback=[])=>{try{const parsed=JSON.parse(String(value||'[]'));return Array.isArray(parsed)?parsed:fallback}catch{return fallback}};
let installed=false;

function rawWithdrawals(){
 const config=api.peekBusiness?.()||{};
 return config.withdrawals||config.settings?.withdrawal_config||{};
}
function installApiMerge(){
 if(installed)return;
 installed=true;
 const original=api.adminUpdateConfiguration.bind(api);
 api.adminUpdateConfiguration=async(section,payload)=>{
  if(section!=='withdrawals')return original(section,payload);
  const form=$('.admin-config-form[data-section="withdrawals"]');
  if(!form)return original(section,payload);
  const data=new FormData(form);
  return original(section,{
   ...payload,
   required_account_days:num(data.get('required_account_days'),5,0,365),
   required_referrals:num(data.get('required_referrals'),5,0,1000000),
   referral_count_mode:data.get('referral_count_mode')==='qualified'?'qualified':'registered',
   kyc_required:data.get('kyc_required')==='on'
  });
 };
}
function injectWithdrawalControls(root=document){
 const form=$('.admin-config-form[data-section="withdrawals"]',root);
 if(!form||$('[data-professional-withdrawal-controls]',form))return;
 const current=rawWithdrawals();
 const requiredDays=num(current.required_account_days,5,0,365),requiredReferrals=num(current.required_referrals,5,0,1000000),mode=current.referral_count_mode==='qualified'?'qualified':'registered',kyc=current.kyc_required!==false;
 const wrap=document.createElement('section');wrap.dataset.professionalWithdrawalControls='true';wrap.className='admin-preview-card';
 wrap.innerHTML=`<span class="eyebrow">ELIGIBILITY</span><h3>Withdrawal requirements</h3><div class="quick-grid">
  <div class="field"><label for="cfg-required_account_days">Minimum account age (complete days)</label><input id="cfg-required_account_days" name="required_account_days" type="number" min="0" max="365" value="${requiredDays}" required><small class="field-help">A day means a complete 24-hour period.</small></div>
  <div class="field"><label for="cfg-required_referrals">Required referrals</label><input id="cfg-required_referrals" name="required_referrals" type="number" min="0" value="${requiredReferrals}" required></div>
  <div class="field"><label for="cfg-referral_count_mode">Referral counting rule</label><select id="cfg-referral_count_mode" name="referral_count_mode"><option value="registered" ${mode==='registered'?'selected':''}>Count after registration</option><option value="qualified" ${mode==='qualified'?'selected':''}>Count after qualification</option></select></div>
 </div>
 <label class="select-row"><input name="kyc_required" type="checkbox" ${kyc?'checked':''}><span><b>KYC required for withdrawal</b><small>Keep this enabled when identity verification is required for payouts.</small></span></label>
 <p>Registration counting and referral-reward qualification are independent rules.</p>`;
 $('.admin-config-actions',form)?.insertAdjacentElement('beforebegin',wrap);
}
function sessionRow(item={},index=0){
 const name=item.name||`Session ${index+1}`,short=(item.short||name.charAt(0)||'S').slice(0,3),topic=item.topic||'';
 return`<article class="guided-session-admin-row" data-session-row><header><b>Session ${index+1}</b><button class="text-link" type="button" data-remove-session>Remove</button></header><div class="quick-grid"><div class="field"><label>Session name</label><input data-session-field="name" value="${esc(name)}" maxlength="80" required></div><div class="field"><label>Short label</label><input data-session-field="short" value="${esc(short)}" maxlength="3" required></div></div><div class="field"><label>Topic / purpose</label><input data-session-field="topic" value="${esc(topic)}" maxlength="160"></div></article>`;
}
function promptRow(item={},index=0){
 const suggestions=Array.isArray(item.suggestions)?item.suggestions.join('\n'):'';
 return`<article class="guided-prompt-row" data-prompt-row><header><b>Prompt ${index+1}</b><button class="text-link" type="button" data-remove-prompt>Remove</button></header><div class="field"><label>Question / prompt</label><textarea data-prompt-field="prompt">${esc(item.prompt||'')}</textarea></div><div class="field"><label>Suggested replies</label><textarea data-prompt-field="suggestions" placeholder="One suggestion per line">${esc(suggestions)}</textarea></div></article>`;
}
function promptSet(set=[],index=0){return`<section class="guided-script" data-prompt-set><header><div><span class="eyebrow">SCRIPT ${index+1}</span><h4>Session script</h4></div><button class="text-link" type="button" data-remove-script>Remove script</button></header><div data-prompt-list>${set.map(promptRow).join('')}</div><button class="secondary" type="button" data-add-prompt>Add prompt</button></section>`}
function syncGuidedEditor(editor,partnersSource,promptsSource){
 const partners=$$('[data-session-row]',editor).map(row=>({name:$('[data-session-field="name"]',row)?.value.trim()||'Session',short:($('[data-session-field="short"]',row)?.value.trim()||'S').slice(0,3),place:'Guided Session',topic:$('[data-session-field="topic"]',row)?.value.trim()||'Structured activity'}));
 const promptSets=$$('[data-prompt-set]',editor).map(set=>$$('[data-prompt-row]',set).map(row=>({prompt:$('[data-prompt-field="prompt"]',row)?.value.trim()||'Continue with the guided session.',suggestions:String($('[data-prompt-field="suggestions"]',row)?.value||'').split('\n').map(v=>v.trim()).filter(Boolean)}))).filter(set=>set.length);
 partnersSource.value=JSON.stringify(partners,null,2);
 promptsSource.value=JSON.stringify(promptSets.length?promptSets:[[{prompt:'How has your day been so far?',suggestions:['It has been productive.','It has been busy, but I am doing okay.']}]],null,2);
}
function renumberGuidedEditor(editor){
 $$('[data-session-row]',editor).forEach((row,index)=>{const b=$('header b',row);if(b)b.textContent=`Session ${index+1}`});
 $$('[data-prompt-set]',editor).forEach((set,setIndex)=>{const eye=$('.eyebrow',set);if(eye)eye.textContent=`SCRIPT ${setIndex+1}`;$$('[data-prompt-row]',set).forEach((row,index)=>{const b=$('header b',row);if(b)b.textContent=`Prompt ${index+1}`})});
}
function buildGuidedSessionManager(root=document){
 const form=$('.admin-config-form[data-section="chat"]',root);if(!form||$('[data-guided-session-manager]',form))return;
 const partnersSource=$('#cfg-partners_json',form),promptsSource=$('#cfg-prompt_sets_json',form);if(!partnersSource||!promptsSource)return;
 const partners=parseArray(partnersSource.value,[{name:'Daily Check-in',short:'D',place:'Guided Session',topic:'Goals and progress'}]);
 const promptSets=parseArray(promptsSource.value,[]);
 const editor=document.createElement('section');editor.dataset.guidedSessionManager='true';editor.className='guided-session-manager';
 editor.innerHTML=`<header class="guided-manager-head"><div><span class="eyebrow">GUIDED SESSIONS</span><h3>Session manager</h3><p>Create the customer-facing sessions and scripts without editing JSON.</p></div></header><div class="guided-manager-block"><div class="guided-manager-title"><h4>Session profiles</h4><button class="secondary" type="button" data-add-session>Add session</button></div><div data-session-list>${partners.map(sessionRow).join('')}</div></div><div class="guided-manager-block"><div class="guided-manager-title"><h4>Questions & suggested replies</h4><button class="secondary" type="button" data-add-script>Add script</button></div><div data-script-list>${(promptSets.length?promptSets:[[]]).map(promptSet).join('')}</div></div>`;
 const firstRaw=partnersSource.closest('.field')||promptsSource.closest('.field');firstRaw?.insertAdjacentElement('beforebegin',editor);
 const advanced=document.createElement('details');advanced.className='guided-json-advanced';advanced.innerHTML='<summary>Advanced JSON view</summary>';
 const promptField=promptsSource.closest('.field'),partnerField=partnersSource.closest('.field');if(promptField)advanced.append(promptField);if(partnerField)advanced.append(partnerField);editor.insertAdjacentElement('afterend',advanced);
 editor.addEventListener('input',()=>syncGuidedEditor(editor,partnersSource,promptsSource));
 editor.addEventListener('click',event=>{
  const addSession=event.target.closest('[data-add-session]'),removeSession=event.target.closest('[data-remove-session]'),addScript=event.target.closest('[data-add-script]'),removeScript=event.target.closest('[data-remove-script]'),addPrompt=event.target.closest('[data-add-prompt]'),removePrompt=event.target.closest('[data-remove-prompt]');
  if(addSession){$('[data-session-list]',editor).insertAdjacentHTML('beforeend',sessionRow({},$$('[data-session-row]',editor).length))}
  else if(removeSession){if($$('[data-session-row]',editor).length>1)removeSession.closest('[data-session-row]').remove()}
  else if(addScript){$('[data-script-list]',editor).insertAdjacentHTML('beforeend',promptSet([], $$('[data-prompt-set]',editor).length))}
  else if(removeScript){if($$('[data-prompt-set]',editor).length>1)removeScript.closest('[data-prompt-set]').remove()}
  else if(addPrompt){const set=addPrompt.closest('[data-prompt-set]'),list=$('[data-prompt-list]',set);list.insertAdjacentHTML('beforeend',promptRow({},$$('[data-prompt-row]',set).length))}
  else if(removePrompt){const set=removePrompt.closest('[data-prompt-set]');if($$('[data-prompt-row]',set).length>1)removePrompt.closest('[data-prompt-row]').remove()}
  else return;
  renumberGuidedEditor(editor);syncGuidedEditor(editor,partnersSource,promptsSource);
 });
 syncGuidedEditor(editor,partnersSource,promptsSource);
 const section=form.closest('.admin-config-section'),title=$('summary b',section),summary=$('summary small',section),enabled=$('input[name="enabled"]',form)?.closest('.select-row')?.querySelector('b');
 if(title)title.textContent='Guided Sessions';if(summary)summary.textContent='Timing, reply quality, session profiles, questions and suggested replies.';if(enabled)enabled.textContent='Guided sessions enabled';
}
function install(root=document){installApiMerge();injectWithdrawalControls(root);buildGuidedSessionManager(root)}

window.addEventListener('earnchat:form-rendered',event=>install(event.detail?.root||document));
document.addEventListener('DOMContentLoaded',()=>install(document));

export{install as installProfessionalAdminControls};
