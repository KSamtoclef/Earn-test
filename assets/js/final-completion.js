import{api}from'./api.js';
import{normalizeBusinessConfig}from'./config-runtime.js';

const CONFIG_KEY='earnchat-business-config:v1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const protectedRoutes=new Set(['home','earn','chat','tasks','visits','upgrade','referrals','withdraw','profile']);
const routeFlags={earn:'guided_chat',chat:'guided_chat',tasks:'tasks',visits:'sponsored_visits',upgrade:'upgrade',referrals:'referrals',withdraw:'withdrawals'};
let config=normalizeBusinessConfig(readCachedConfig());
let scheduled=false;

function readCachedConfig(){
 try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'null')?.data||{}}catch{return{}}
}
function explicitBrowserCountry(){
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
 const languages=(navigator.languages||[navigator.language||'']).join(' ').toLowerCase();
 if(/nairobi/i.test(zone)||/(?:sw|en)-ke/.test(languages))return'KE';
 if(/lagos/i.test(zone)||/en-ng/.test(languages))return'NG';
 return null;
}
function prepareCountry(){
 if(localStorage.getItem('earnchat-country'))return;
 const selected=explicitBrowserCountry()||config.general.default_country||'NG';
 localStorage.setItem('earnchat-country',selected==='KE'?'KE':'NG');
}
function neutralizeFirstPaint(){
 for(const id of['preview-balance','landing-chat','home-work','home-referral','ref-balance','ref-remaining','withdraw-available','withdraw-limits']){
  const node=document.getElementById(id);if(node)node.textContent='—';
 }
 const detail=document.getElementById('landing-chat-detail');if(detail)detail.textContent='Reward shown after country selection';
}
function ensureRuntimeLinks(){
 const general=config.general;
 const links=[['Support',general.support_url||general.support_email&&`mailto:${general.support_email}`],['Terms',general.terms_url],['Privacy',general.privacy_url]].filter(([,url])=>url);
 let nav=$('#runtime-policy-links');
 if(!links.length){nav?.remove();return}
 if(!nav){nav=document.createElement('nav');nav.id='runtime-policy-links';nav.className='runtime-policy-links';const landing=$('#view-landing .landing-container');landing?.append(nav)}
 nav.innerHTML=links.map(([label,url])=>`<a href="${String(url).replaceAll('"','&quot;')}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('');
 let profileLinks=$('#profile-policy-links');
 if(!profileLinks){profileLinks=document.createElement('article');profileLinks.id='profile-policy-links';profileLinks.className='card runtime-profile-links';$('#view-profile .container')?.append(profileLinks)}
 if(profileLinks)profileLinks.innerHTML=`<h3>Help and policies</h3>${links.map(([label,url])=>`<a class="secondary" href="${String(url).replaceAll('"','&quot;')}" target="_blank" rel="noopener noreferrer">${label}</a>`).join('')}`;
}
function applyBranding(){
 const name=config.general.platform_name||'Earn Chat';
 document.title=name;
 const brand=$('.brand span:last-child');if(brand)brand.textContent=name;
 const loader=$('#startup-loader strong');if(loader&&!loader.textContent.includes('…'))loader.textContent=`Opening ${name}…`;
 $$('.final-cta h2').forEach(node=>node.textContent=`Create your free ${name} account`);
}
function applyFeatureVisibility(){
 const flags=config.feature_flags||{};
 for(const [route,flag] of Object.entries(routeFlags)){
  const enabled=flags[flag]!==false;
  $$(`[data-go="${route}"],[data-route="${route}"]`).forEach(node=>{
   node.classList.toggle('hidden',!enabled);
   if('disabled'in node)node.disabled=!enabled;
   node.setAttribute('aria-hidden',String(!enabled));
  });
 }
 const publicRegistration=config.general.registration_enabled&&flags.public_registration!==false;
 $$('[data-go="register"]').forEach(node=>{node.classList.toggle('hidden',!publicRegistration);if('disabled'in node)node.disabled=!publicRegistration});
}
function enforceFixedAdminRules(){
 const policy=$('#cfg-incomplete_attempt_policy');
 if(policy){policy.value='restart';policy.disabled=true;const help=policy.parentElement?.querySelector('.field-help')||document.createElement('small');help.className='field-help';help.textContent='Restart is a fixed integrity rule so incomplete external activities cannot be resumed with stale timing.';if(!help.parentElement)policy.parentElement?.append(help)}
 const direct=$('input[name="direct_referral_only"]');if(direct){direct.checked=true;direct.disabled=true}
}
function applyTaskPresentation(){
 const limit=Math.max(0,Number(config.tasks.featured_task_limit||0));
 for(const host of[$('#task-list'),$('#visit-list')]){
  if(!host)continue;
  const cards=$$('[data-task-card]',host);
  cards.forEach((card,index)=>card.classList.toggle('hidden',limit>0&&index>=limit));
 }
}
function maintenanceRouteGuard(){
 const route=document.body.dataset.route||'landing';
 let notice=$('#runtime-maintenance');
 const blocked=config.general.maintenance_mode&&protectedRoutes.has(route)&&route!=='admin';
 if(!blocked){notice?.remove();return}
 if(!notice){notice=document.createElement('div');notice.id='runtime-maintenance';notice.className='runtime-maintenance';document.body.append(notice)}
 notice.innerHTML=`<div><span class="eyebrow">TEMPORARILY UNAVAILABLE</span><h2>${config.general.platform_name||'Earn Chat'} maintenance</h2><p>${config.general.maintenance_message}</p><button type="button" data-go="landing" class="primary">Return to homepage</button></div>`;
}
function applyAll(){
 scheduled=false;
 applyBranding();ensureRuntimeLinks();applyFeatureVisibility();enforceFixedAdminRules();applyTaskPresentation();maintenanceRouteGuard();
 document.documentElement.style.setProperty('--runtime-presence-heartbeat',String(Math.max(15,Number(config.settings?.presence_heartbeat_seconds||60))));
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(applyAll)}
function installStyles(){
 const style=document.createElement('style');
 style.textContent='.runtime-policy-links{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;padding:1.25rem 0 6rem}.runtime-policy-links a,.runtime-profile-links a{font-weight:800;text-decoration:none}.runtime-profile-links{display:grid;gap:.7rem}.runtime-maintenance{position:fixed;inset:0;z-index:9999;background:rgba(238,246,255,.96);display:grid;place-items:center;padding:1.5rem}.runtime-maintenance>div{width:min(480px,100%);background:#fff;border:1px solid #cbdced;border-radius:28px;padding:2rem;box-shadow:0 22px 60px rgba(10,39,79,.18)}';
 document.head.append(style);
}

prepareCountry();neutralizeFirstPaint();installStyles();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-route']});
window.addEventListener('hashchange',schedule);
window.addEventListener('earnchat:config-updated',event=>{if(event.detail?.config)config=normalizeBusinessConfig(event.detail.config);schedule()});
window.addEventListener('earnchat:member-state',event=>{if(event.detail?.config)config=normalizeBusinessConfig(event.detail.config);schedule()});

document.addEventListener('DOMContentLoaded',schedule,{once:true});
void api.business().then(fresh=>{
 const previous=localStorage.getItem('earnchat-country');
 config=normalizeBusinessConfig(fresh);
 const inferred=explicitBrowserCountry();
 const desired=inferred||config.general.default_country||'NG';
 if(!localStorage.getItem('earnchat-country-confirmed')&&!inferred&&previous!==desired&&!sessionStorage.getItem('earnchat-default-country-applied')){
  localStorage.setItem('earnchat-country',desired);
  sessionStorage.setItem('earnchat-default-country-applied','1');
  location.reload();return;
 }
 schedule();
}).catch(schedule);
