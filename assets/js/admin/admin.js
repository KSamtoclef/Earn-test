import{api}from'../api.js';
import{renderAdmin as renderAdminCore}from'./core.js';
import{enhanceAdminExperience}from'./admin-experience.js?v=20260809-adminux-r2';

const originalUsers=api.adminUsers.bind(api);
const pageCache=new Map();
const SKIP_USER_PRELOAD=new Set(['overview','tasks','configuration','payments']);
api.adminUsers=async(limit=50,offset=0)=>{
 const tab=sessionStorage.getItem('earnchat-admin-tab')||'overview';
 if(offset===0&&SKIP_USER_PRELOAD.has(tab))return[];
 const key=`${limit}:${offset}`,cached=pageCache.get(key);
 if(cached&&Date.now()-cached.at<8000)return cached.data;
 const data=await originalUsers(limit,offset);
 pageCache.set(key,{data,at:Date.now()});
 return data;
};

async function renderAdmin(){
 const result=await renderAdminCore();
 enhanceAdminExperience();
 return result;
}

export{renderAdmin};
