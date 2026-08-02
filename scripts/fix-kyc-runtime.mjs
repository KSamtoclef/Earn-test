import fs from'node:fs';

const appPath='assets/js/app.js';
const indexPath='index.html';
let app=fs.readFileSync(appPath,'utf8');
let index=fs.readFileSync(indexPath,'utf8');

const replacement=`async function openKycFlow(){
 const modal=ensureKycModal(),content=$('#kyc-provider-content',modal);
 clearMessage('#kyc-provider-message');
 content.innerHTML='<article class="card"><b>Loading verification instructions…</b></article>';
 modal.classList.add('show');
 try{
  const cfg=await api.kycConfig();
  const local=country()==='KE'?(cfg?.KE||{}):(cfg?.NG||{});
  const url=safeHttps(local.url);
  const required=cfg?.reference_required!==false;
  if(cfg?.enabled===false||featureFlags().kyc===false){
   content.innerHTML='<article class="card"><h3>Verification is temporarily unavailable</h3><p>Please return later.</p></article>';
   return;
  }
  content.innerHTML=\`<article class="kyc-provider-card"><span class="tag">\${country()==='KE'?'🇰🇪 Kenya':'🇳🇬 Nigeria'}</span><h3>\${esc(local.provider||'Approved verification provider')}</h3><p>\${esc(local.instructions||'Complete the approved verification steps and return here.')}</p><small>Typical review time: up to \${Number(cfg?.review_hours||48)} hours.</small></article>\${url?'<button id="kyc-open-provider" class="primary" type="button">Verify your KYC now ↗</button>':'<div class="form-message error show">The administrator has not added a KYC URL for your country yet.</div>'}<div class="field"><label>Verification reference\${required?'':' (optional)'}</label><input id="kyc-reference" placeholder="\${required?'Enter the reference received after verification':'Optional: enter a reference when the provider gives you one'}"></div><button id="kyc-send" class="secondary" type="button" \${url?'':'disabled'}>Submit for review</button>\`;
  if(url)$('#kyc-open-provider',content).onclick=()=>window.open(url.href,'_blank','noopener,noreferrer');
  $('#kyc-send',content).onclick=async()=>{
   const ref=$('#kyc-reference',content)?.value.trim()||'';
   if(required&&!ref)return showMessage('#kyc-provider-message','Enter the verification reference before submitting.');
   const b=$('#kyc-send',content);b.disabled=true;b.textContent='Submitting…';
   try{
    await api.submitKyc(ref,{provider:local.provider||null,country:country(),verification_url:url?.href||null});
    showMessage('#kyc-provider-message','Verification submitted for review.','ok');
    await refreshState();renderProfile();
   }catch(error){
    showMessage('#kyc-provider-message',error.message||'Verification could not be submitted.');
    b.disabled=false;b.textContent='Submit for review';
   }
  };
 }catch(error){
  content.innerHTML=\`<div class="form-message error show">\${esc(error.message||'KYC configuration could not load.')}</div>\`;
 }
}`;

const pattern=/async function openKycFlow\(\)\{[\s\S]*?\n\nfunction openTour\(\)/;
if(!pattern.test(app))throw new Error('Could not locate the customer KYC flow.');
app=app.replace(pattern,`${replacement}\n\nfunction openTour()`);
app=app.replace("const RELEASE='20260802-stability-r2';","const RELEASE='20260802-kyc-r1';");
if(!app.includes('const cfg=await api.kycConfig();'))throw new Error('Authoritative KYC fetch was not installed.');
if(!app.includes("Verification reference${required?'':' (optional)'}"))throw new Error('Optional KYC reference label was not installed.');
fs.writeFileSync(appPath,app);

index=index.replaceAll('20260802-stability-r2','20260802-kyc-r1');
fs.writeFileSync(indexPath,index);
console.log('Customer KYC now reads the authoritative Admin KYC configuration.');
