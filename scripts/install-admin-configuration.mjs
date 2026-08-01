import fs from'node:fs';

function update(path,transform){const before=fs.readFileSync(path,'utf8'),after=transform(before);if(before===after)throw new Error(`No changes produced for ${path}`);fs.writeFileSync(path,after)}

update('assets/js/api.js',source=>{
 const marker=" adminUpdateBusiness:async payload=>mutateAdmin('admin_update_earnchat_business_settings',{p_payload:payload},{config:true,member:true,section:'business',event:'earnchat:admin-config-saved'}),";
 if(!source.includes(marker))throw new Error('API Admin business marker missing');
 return source.replace(marker," adminUpdateConfiguration:async(section,payload)=>mutateAdmin('admin_update_earnchat_configuration',{p_section:section,p_payload:payload},{config:true,member:true,section,event:'earnchat:admin-config-saved'}),\n"+marker);
});

update('assets/js/admin/core.js',source=>{
 const importMarker="import{money}from'../app-config.js';";
 if(!source.includes(importMarker))throw new Error('Admin import marker missing');
 source=source.replace(importMarker,importMarker+"\nimport{renderConfiguration}from'./configuration.js';");
 const start=source.indexOf('async function configuration(){');
 const end=source.indexOf('async function analytics(){',start);
 if(start<0||end<0)throw new Error('Legacy Admin configuration block not found');
 source=source.slice(0,start)+source.slice(end);
 const rendererMarker='withdrawals,kyc,payments,configuration,analytics,audit';
 if(!source.includes(rendererMarker))throw new Error('Admin renderer marker missing');
 source=source.replace(rendererMarker,'withdrawals,kyc,payments,configuration:renderConfiguration,analytics,audit');
 return source;
});
