import{ROUTES}from'./app-config.js';
let authRequired=()=>false,onRoute=()=>{};
const clean=()=>{const raw=location.hash.replace(/^#\/?/,'').split('?')[0];return ROUTES.includes(raw)?raw:'landing'};
export function configureRouter({isAuthenticated,routeHandler}){authRequired=isAuthenticated;onRoute=routeHandler;window.addEventListener('hashchange',resolveRoute);window.addEventListener('popstate',resolveRoute)}
export function route(){return clean()}
export function navigate(name,replace=false){if(!ROUTES.includes(name))name='home';const hash='#/'+name;if(location.hash===hash){resolveRoute();return}if(replace)history.replaceState({},'',hash);else history.pushState({},'',hash);resolveRoute()}
export function resolveRoute(){let name=clean();const publicRoutes=['landing','register','login'];if(!publicRoutes.includes(name)&&!authRequired())name='login';if(publicRoutes.includes(name)&&authRequired())name='home';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.body.dataset.route=name;document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===name));onRoute(name);if(clean()!==name)history.replaceState({},'','#/'+name)}
