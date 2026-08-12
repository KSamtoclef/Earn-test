import{api}from'../api.js';

const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num=(value,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.min(max,Math.max(min,Math.round(parsed))):fallback};
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
  const merged={
   ...payload,
   required_account_days:num(data.get('required_account_days'),5,0,365),
   required_referrals:num(data.get('required_referrals'),5,0,1000000),
   referral_count_mode:data.get('referral_count_mode')==='qualified'?'qualified':'registered',
   kyc_required:data.get('kyc_required')==='on'
  };
  return original(section,merged);
 };
}

function injectWithdrawalControls(root=document){
 const form=$('.admin-config-form[data-section="withdrawals"]',root);
 if(!form||$('[data-professional-withdrawal-controls]',form))return;
 const current=rawWithdrawals();
 const requiredDays=num(current.required_account_days,5,0,365);
 const requiredReferrals=num(current.required_referrals,5,0,1000000);
 const mode=current.referral_count_mode==='qualified'?'qualified':'registered';
 const kyc=current.kyc_required!==false;
 const wrap=document.createElement('section');
 wrap.dataset.professionalWithdrawalControls='true';
 wrap.className='admin-preview-card';
 wrap.innerHTML=`<span class="eyebrow">ELIGIBILITY</span><h3>Withdrawal requirements</h3><div class="quick-grid">
  <div class="field"><label for="cfg-required_account_days">Minimum account age (days)</label><input id="cfg-required_account_days" name="required_account_days" type="number" min="0" max="365" value="${requiredDays}" required></div>
  <div class="field"><label for="cfg-required_referrals">Required referrals</label><input id="cfg-required_referrals" name="required_referrals" type="number" min="0" value="${requiredReferrals}" required></div>
  <div class="field"><label for="cfg-referral_count_mode">Referral counting rule</label><select id="cfg-referral_count_mode" name="referral_count_mode"><option value="registered" ${mode==='registered'?'selected':''}>Count after registration</option><option value="qualified" ${mode==='qualified'?'selected':''}>Count after qualification</option></select></div>
 </div>
 <label class="select-row"><input name="kyc_required" type="checkbox" ${kyc?'checked':''}><span><b>KYC required for withdrawal</b><small>Turn this off only when verification is not required for payouts.</small></span></label>
 <p>Registration counting means a genuine account created through a referral link counts immediately. Referral reward qualification remains separate.</p>`;
 const actions=$('.admin-config-actions',form);
 actions?.insertAdjacentElement('beforebegin',wrap);
}

function relabelGuidedSessionControls(root=document){
 const form=$('.admin-config-form[data-section="chat"]',root);
 if(!form)return;
 const label=$('label[for="cfg-partners_json"]',form);
 if(label)label.textContent='Guided session profiles JSON';
 const section=form.closest('.admin-config-section');
 const summary=section?.querySelector('summary small');
 if(summary)summary.textContent='Timing, reply quality, recovery, prompts and guided session profiles.';
}

function install(root=document){
 installApiMerge();
 injectWithdrawalControls(root);
 relabelGuidedSessionControls(root);
}

window.addEventListener('earnchat:form-rendered',event=>install(event.detail?.root||document));
document.addEventListener('DOMContentLoaded',()=>install(document));

export{install as installProfessionalAdminControls};
