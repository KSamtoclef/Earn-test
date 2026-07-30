import{ROUTES}from'./app-config.js';
let isAuthenticated=()=>false,onRoute=()=>{};
const publicRoutes=new Set(['landing','register','login']);
const navHiddenRoutes=new Set(['landing','register','login','chat','admin']);
const clean=()=>{const raw=location.hash.replace(/^#\/?/,'').split('?')[0];return ROUTES.includes(raw)?raw:'landing'};
export function configureRouter({isAuthenticated:authCheck,routeHandler}){isAuthenticated=authCheck;onRoute=routeHandler;window.addEventListener('hashchange',resolveRoute);window.addEventListener('popstate',resolveRoute)}
export function route(){return clean()}
export function navigate(name,replace=false){if(!ROUTES.includes(name))name=isAuthenticated()?'home':'landing';const hash='#/'+name;if(location.hash===hash){resolveRoute();return}if(replace)history.replaceState({},'',hash);else history.pushState({},'',hash);resolveRoute()}
export function resolveRoute(){let name=clean();if(!publicRoutes.has(name)&&!isAuthenticated())name='login';if(publicRoutes.has(name)&&isAuthenticated())name='home';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.body.dataset.route=name;const hideNav=navHiddenRoutes.has(name);document.body.classList.toggle('hide-bottom-nav',hideNav);const nav=document.querySelector('.bottom-nav');if(nav)nav.hidden=hideNav;document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===name));Promise.resolve(onRoute(name)).catch(error=>console.error('Route render failed:',error));if(clean()!==name)history.replaceState({},'','#/'+name)}
