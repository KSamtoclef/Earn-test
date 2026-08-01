import{ROUTES}from'./app-config.js';

let isAuthenticated=()=>false,onRoute=()=>{},scheduled=false,configured=false,lastResolved='';
const publicRoutes=new Set(['landing','register','login']);
const navHiddenRoutes=new Set(['landing','register','login','chat','admin']);
const clean=()=>{const raw=location.hash.replace(/^#\/?/,'').split('?')[0];return ROUTES.includes(raw)?raw:'landing'};
function scheduleResolve(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;resolveRoute()})}
export function configureRouter({isAuthenticated:authCheck,routeHandler}){
  isAuthenticated=authCheck;
  onRoute=routeHandler;
  if(configured)return;
  configured=true;
  window.addEventListener('hashchange',scheduleResolve,{passive:true});
  window.addEventListener('popstate',scheduleResolve,{passive:true});
}
export function route(){return clean()}
export function navigate(name,replace=false){
  if(!ROUTES.includes(name))name=isAuthenticated()?'home':'landing';
  const hash='#/'+name;
  if(location.hash===hash){scheduleResolve();return}
  if(replace)history.replaceState({},'',hash);else history.pushState({},'',hash);
  scheduleResolve();
}
export function resolveRoute(){
  let name=clean();
  if(!publicRoutes.has(name)&&!isAuthenticated())name='login';
  if(publicRoutes.has(name)&&isAuthenticated())name='home';
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id==='view-'+name));
  document.body.dataset.route=name;
  const hideNav=navHiddenRoutes.has(name);
  document.body.classList.toggle('hide-bottom-nav',hideNav);
  const nav=document.querySelector('.bottom-nav');if(nav)nav.hidden=hideNav;
  document.querySelectorAll('[data-route]').forEach(button=>button.classList.toggle('active',button.dataset.route===name));
  if(lastResolved!==name){lastResolved=name;document.dispatchEvent(new CustomEvent('earnchat:route-view',{detail:{route:name}}))}
  Promise.resolve(onRoute(name)).catch(error=>console.error('Route render failed:',error));
  if(clean()!==name)history.replaceState({},'','#/'+name);
}
