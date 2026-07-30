(()=>{'use strict';
const LEVELS={
 Starter:{rank:0,chatLimit:4,chatReward:250,taskMin:100,taskMax:500,withdrawMin:40000,withdrawMax:120000,requirements:{accountDays:0,activeDays:0,chats:0,tasks:0,kyc:'none'}},
 Active:{rank:1,chatLimit:6,chatReward:300,taskMin:200,taskMax:700,withdrawMin:40000,withdrawMax:180000,requirements:{accountDays:5,activeDays:3,chats:12,tasks:15,kyc:'submitted'}},
 Pro:{rank:2,chatLimit:8,chatReward:500,taskMin:500,taskMax:1500,withdrawMin:50000,withdrawMax:300000,requirements:{accountDays:10,activeDays:7,chats:25,tasks:35,kyc:'approved',mission:'pro'}},
 Elite:{rank:3,chatLimit:10,chatReward:700,taskMin:700,taskMax:3000,withdrawMin:60000,withdrawMax:500000,requirements:{accountDays:20,activeDays:15,chats:50,tasks:80,kyc:'approved',mission:'elite'}}
};
const COUNTRIES={
 NG:{code:'NG',name:'Nigeria',currency:'NGN',symbol:'₦',multiplier:1,payouts:['bank'],phoneCode:'+234'},
 KE:{code:'KE',name:'Kenya',currency:'KES',symbol:'KSh ',multiplier:.6,payouts:['mpesa','bank'],phoneCode:'+254'}
};
const CONFIG={version:'2026-07-30-economy-1',dailyCapBase:20000,referralRewardBase:2000,referralWithdrawMinBase:40000,referralRequiredActiveDays:2,referrerAccountDays:5,levels:LEVELS,countries:COUNTRIES};
function country(code){return COUNTRIES[code]||COUNTRIES.NG}
function level(name){return LEVELS[name]||LEVELS.Starter}
function amount(base,code){const c=country(code);return Math.round(Number(base||0)*c.multiplier)}
function money(base,code){const c=country(code);return c.symbol+amount(base,code).toLocaleString(c.code==='KE'?'en-KE':'en-NG')}
function levelFromState(state){const raw=String(state&&state.level||state&&state.activityLevel||'Starter');return LEVELS[raw]?raw:'Starter'}
window.EARNCHAT_BUSINESS=Object.freeze({...CONFIG,country,level,amount,money,levelFromState});
window.dispatchEvent(new CustomEvent('earnchat:business-ready',{detail:{version:CONFIG.version}}));
})();