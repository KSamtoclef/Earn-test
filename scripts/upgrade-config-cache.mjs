import fs from'node:fs';

const path='assets/js/api.js';
let source=fs.readFileSync(path,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Missing API migration target: ${label}`);source=source.replace(from,to)};

replace(
"export function invalidateAdminOverview(){adminOverviewCache=null;adminOverviewAt=0;adminOverviewPromise=null}\n",
"export function invalidateAdminOverview(){adminOverviewCache=null;adminOverviewAt=0;adminOverviewPromise=null}\nexport function invalidateBusinessConfig(section='all'){\n  configCache=null;configAt=0;configPromise=null;\n  window.dispatchEvent(new CustomEvent('earnchat:config-invalidated',{detail:{section}}));\n}\n",
'invalidateBusinessConfig'
);

replace(
"  const request=rpc('get_earnchat_business_config').then(data=>{configCache=data;configAt=Date.now();return data});",
"  const request=rpc('get_earnchat_business_config').then(data=>{\n    configCache=data;configAt=Date.now();\n    window.dispatchEvent(new CustomEvent('earnchat:config-updated',{detail:{version:data?.version||data?.settings?.version||null,section:'all',config:data,updated_at:data?.updated_at||data?.settings?.updated_at||null}}));\n    return data;\n  });",
'business config event'
);

replace(
"async function mutateAdmin(name,args={}){const data=await rpc(name,args);invalidateAdminOverview();return data}",
"async function mutateAdmin(name,args={},options={}){\n  const data=await rpc(name,args);\n  invalidateAdminOverview();\n  if(options.config)invalidateBusinessConfig(options.section||'all');\n  if(options.member)invalidateMemberState();\n  if(options.event)window.dispatchEvent(new CustomEvent(options.event,{detail:{data,section:options.section||null}}));\n  return data;\n}",
'mutateAdmin options'
);

replace(
" adminUpdateKycConfig:async payload=>mutateAdmin('admin_update_earnchat_kyc_config',{p_payload:payload}),",
" adminUpdateKycConfig:async payload=>mutateAdmin('admin_update_earnchat_kyc_config',{p_payload:payload},{config:true,member:true,section:'kyc',event:'earnchat:admin-config-saved'}),",
'KYC config invalidation'
);
replace(
" adminUpdateBusiness:async payload=>mutateAdmin('admin_update_earnchat_business_settings',{p_payload:payload}),",
" adminUpdateBusiness:async payload=>mutateAdmin('admin_update_earnchat_business_settings',{p_payload:payload},{config:true,member:true,section:'business',event:'earnchat:admin-config-saved'}),",
'business config invalidation'
);
replace(
" adminUpdateLevel:async(level,payload)=>mutateAdmin('admin_update_earnchat_level',{p_level:level,p_payload:payload}),",
" adminUpdateLevel:async(level,payload)=>mutateAdmin('admin_update_earnchat_level',{p_level:level,p_payload:payload},{config:true,member:true,section:'levels',event:'earnchat:admin-config-saved'}),",
'level config invalidation'
);
replace(
" business:businessConfig,",
" business:businessConfig,\n refreshBusiness:()=>businessConfig(true),\n invalidateBusiness:invalidateBusinessConfig,",
'public config API'
);

fs.writeFileSync(path,source);
// Triggered after the workflow definition was installed.
