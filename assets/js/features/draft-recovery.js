const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

const FORM_CONFIG={
  'task-form':{storage:'local',label:'Sponsored visit draft'},
  'kyc-config-form':{storage:'local',label:'KYC settings draft'},
  'mission-form':{storage:'local',label:'Qualification draft'},
  'feedback-form':{storage:'local',label:'Feedback draft'},
  'business-form':{storage:'local',label:'Business settings draft'},
  'register-form':{storage:'session',label:'Signup draft'},
  'task-proof-field':{storage:'session',label:'Sponsored visit answer draft'}
};
const BLOCKED_IDS=new Set(['register-password','login-password','payout-account','payout-name','payout-provider','kyc-reference']);
const BLOCKED_TYPES=new Set(['password','file']);
const timers=new WeakMap();

function configFor(form){
  if(!form?.id)return null;
  if(FORM_CONFIG[form.id])return FORM_CONFIG[form.id];
  if(form.matches('form.level-form'))return{storage:'local',label:'Level settings draft'};
  return null;
}
function storageFor(config){return config.storage==='local'?localStorage:sessionStorage}
function draftKey(form){return`earnchat-draft:v2:${form.id}`}
function controls(form){
  return $$('input,textarea,select',form).filter(element=>
    element.name!=='csrf'&&!BLOCKED_IDS.has(element.id)&&!BLOCKED_TYPES.has(element.type)&&!element.disabled
  );
}
function serialize(form){
  const values={};
  for(const element of controls(form)){
    const name=element.id||element.name;
    if(!name)continue;
    values[name]=element.type==='checkbox'||element.type==='radio'
      ?{checked:element.checked}
      :{value:element.value};
  }
  return values;
}
function meaningful(values){
  return Object.values(values).some(item=>item.checked===true||String(item.value??'').trim()!=='');
}
function statusRow(form){
  let row=$('.draft-status-row',form);
  if(row)return row;
  row=document.createElement('div');
  row.className='draft-status-row';
  row.innerHTML='<small class="draft-status" aria-live="polite">Draft protection active</small><button class="draft-clear" type="button">Clear draft</button>';
  const submit=form.querySelector('button[type="submit"],button.primary');
  if(submit)submit.before(row);else form.appendChild(row);
  $('.draft-clear',row)?.addEventListener('click',()=>clearDraft(form,true));
  return row;
}
function setStatus(form,text){
  const node=$('.draft-status',statusRow(form));
  if(node)node.textContent=text;
}
function saveDraft(form){
  const config=configFor(form);
  if(!config)return;
  const values=serialize(form),storage=storageFor(config),key=draftKey(form);
  if(!meaningful(values)){
    storage.removeItem(key);
    setStatus(form,'Draft protection active');
    return;
  }
  storage.setItem(key,JSON.stringify({version:2,savedAt:Date.now(),values}));
  setStatus(form,'Draft saved just now');
}
function scheduleSave(form){
  clearTimeout(timers.get(form));
  timers.set(form,setTimeout(()=>saveDraft(form),400));
}
function restoreDraft(form){
  const config=configFor(form);
  if(!config||form.dataset.draftReady==='1')return;
  form.dataset.draftReady='1';
  statusRow(form);
  let draft=null;
  try{draft=JSON.parse(storageFor(config).getItem(draftKey(form))||'null')}catch{}
  if(!draft?.values)return;
  for(const element of controls(form)){
    const item=draft.values[element.id||element.name];
    if(!item)continue;
    if(element.type==='checkbox'||element.type==='radio')element.checked=!!item.checked;
    else element.value=item.value??'';
    element.dispatchEvent(new Event('change',{bubbles:true}));
  }
  const time=new Date(draft.savedAt||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  setStatus(form,`Draft restored from ${time}`);
}
function clearDraft(form,reset=false){
  const config=configFor(form);
  if(!config)return;
  clearTimeout(timers.get(form));
  storageFor(config).removeItem(draftKey(form));
  if(reset){
    for(const element of controls(form)){
      if(element.type==='checkbox'||element.type==='radio')element.checked=false;
      else if(element.tagName==='SELECT')element.selectedIndex=0;
      else element.value='';
    }
    form.dispatchEvent(new Event('change',{bubbles:true}));
  }
  setStatus(form,'Draft cleared');
}
function initialize(root=document){
  const forms=[];
  if(root instanceof HTMLFormElement)forms.push(root);
  if(root.querySelectorAll)forms.push(...root.querySelectorAll('form,#task-proof-field'));
  for(const form of forms){
    if(form.matches('form.level-form')&&!form.id)form.id=`level-form-${form.dataset.level||'unknown'}`;
    restoreDraft(form);
  }
}
function targetForm(target){
  const form=target.closest?.('form,#task-proof-field');
  return configFor(form)?form:null;
}

document.addEventListener('input',event=>{const form=targetForm(event.target);if(form)scheduleSave(form)},true);
document.addEventListener('change',event=>{const form=targetForm(event.target);if(form)scheduleSave(form)},true);
document.addEventListener('reset',event=>{const form=event.target;if(configFor(form))setTimeout(()=>clearDraft(form,false),0)},true);
document.addEventListener('earnchat:form-rendered',event=>initialize(event.detail?.root||event.target||document));
document.addEventListener('earnchat:form-save-succeeded',event=>{const form=event.detail?.form||event.target;if(configFor(form))clearDraft(form,false)});
document.addEventListener('earnchat:form-save-failed',event=>{const form=event.detail?.form||event.target;if(configFor(form))setStatus(form,'Save failed — draft kept')});
initialize();
