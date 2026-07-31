const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

const ADMIN_FORMS={
 'task-form':{storage:'local',label:'Task draft'},
 'kyc-config-form':{storage:'local',label:'KYC settings draft'},
 'mission-form':{storage:'local',label:'Qualification draft'},
 'feedback-form':{storage:'local',label:'Feedback draft'},
 'business-form':{storage:'local',label:'Business settings draft'}
};
const CUSTOMER_FORMS={
 'register-form':{storage:'session',label:'Signup draft'},
 'task-proof-field':{storage:'session',label:'Task answer draft'}
};
const BLOCKED_IDS=new Set(['register-password','login-password','payout-account','payout-name','payout-provider','kyc-reference']);
const BLOCKED_TYPES=new Set(['password','file']);
const timers=new WeakMap();

function store(type){return type==='local'?localStorage:sessionStorage}
function key(form){return`earnchat-draft:${form.id}`}
function controls(form){return $$('input,textarea,select',form).filter(el=>el.name!=='csrf'&&!BLOCKED_IDS.has(el.id)&&!BLOCKED_TYPES.has(el.type)&&!el.disabled)}
function serialize(form){const values={};for(const el of controls(form)){if(!el.id&&!el.name)continue;const name=el.id||el.name;if(el.type==='checkbox'||el.type==='radio')values[name]={checked:el.checked};else values[name]={value:el.value}}return values}
function hasMeaningfulValue(values){return Object.values(values).some(item=>item.checked===true||String(item.value??'').trim()!=='')}
function statusNode(form){let row=$('.draft-status-row',form);if(row)return row;row=document.createElement('div');row.className='draft-status-row';row.innerHTML='<small class="draft-status" aria-live="polite">Draft protection active</small><button class="draft-clear" type="button">Clear draft</button>';const submit=form.querySelector('button[type="submit"],button.primary');if(submit)submit.before(row);else form.appendChild(row);$('.draft-clear',row).onclick=()=>clear(form,true);return row}
function setStatus(form,text){const node=$('.draft-status',statusNode(form));if(node)node.textContent=text}
function save(form,config){const values=serialize(form),storage=store(config.storage);if(!hasMeaningfulValue(values)){storage.removeItem(key(form));setStatus(form,'Draft protection active');return}storage.setItem(key(form),JSON.stringify({version:1,savedAt:Date.now(),values}));setStatus(form,'Draft saved just now')}
function scheduleSave(form,config){clearTimeout(timers.get(form));const timer=setTimeout(()=>save(form,config),350);timers.set(form,timer)}
function restore(form,config){if(form.dataset.draftReady==='1')return;form.dataset.draftReady='1';statusNode(form);let draft=null;try{draft=JSON.parse(store(config.storage).getItem(key(form))||'null')}catch{}if(!draft?.values)return;for(const el of controls(form)){const name=el.id||el.name,item=draft.values[name];if(!item)continue;if(el.type==='checkbox'||el.type==='radio')el.checked=!!item.checked;else el.value=item.value??'';el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('input',{bubbles:true}))}const when=new Date(draft.savedAt||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});setStatus(form,`Draft restored from ${when}`)}
function clear(form,reset=false){const config=configFor(form);if(!config)return;store(config.storage).removeItem(key(form));if(reset){for(const el of controls(form)){if(el.type==='checkbox'||el.type==='radio')el.checked=false;else if(el.tagName==='SELECT')el.selectedIndex=0;else el.value=''}form.dispatchEvent(new Event('change',{bubbles:true}))}setStatus(form,'Draft cleared')}
function configFor(form){if(!form?.id)return null;return ADMIN_FORMS[form.id]||CUSTOMER_FORMS[form.id]||(/^level-form/.test(form.className)?{storage:'local',label:'Level settings draft'}:null)}
function identifyForm(target){const direct=target.closest('form');if(direct&&configFor(direct))return direct;const proof=target.closest('#task-proof-field');return proof||null}
function scan(){for(const id of Object.keys({...ADMIN_FORMS,...CUSTOMER_FORMS})){const form=$(`#${id}`);if(form)restore(form,ADMIN_FORMS[id]||CUSTOMER_FORMS[id])}$$('form.level-form').forEach(form=>{if(!form.id)form.id=`level-form-${form.dataset.level||'unknown'}`;restore(form,{storage:'local',label:'Level settings draft'})})}
function scheduleScan(){[80,350,900].forEach(delay=>setTimeout(scan,delay))}

document.addEventListener('input',event=>{const form=identifyForm(event.target);const config=configFor(form);if(form&&config)scheduleSave(form,config)},true);
document.addEventListener('change',event=>{const form=identifyForm(event.target);const config=configFor(form);if(form&&config)scheduleSave(form,config)},true);
document.addEventListener('reset',event=>{const form=event.target,config=configFor(form);if(config)setTimeout(()=>clear(form,false),0)},true);
document.addEventListener('submit',event=>{const form=event.target,config=configFor(form);if(!config)return;let checks=0;const watch=()=>{if(!form.isConnected){store(config.storage).removeItem(key(form));return}checks+=1;if(checks<16)setTimeout(watch,500)};setTimeout(watch,500)},true);
document.addEventListener('click',event=>{if(event.target.closest('[data-tab],#admin-section-select,[data-go],.edit-task,.edit-mission'))scheduleScan()},true);
window.addEventListener('hashchange',scheduleScan);
window.addEventListener('pageshow',scheduleScan);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleScan()});
scheduleScan();
