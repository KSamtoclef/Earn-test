export const SUPABASE_URL='https://ijjmgrfgyqtsvigzjdjp.supabase.co';
export const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqam1ncmZneXF0c3ZpZ3pqZGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NjMxMzcsImV4cCI6MjA5OTAzOTEzN30.TFOOIJDK9YXa8mSBXcgQ2IqIfqD-0UhcBhIEN8QxeDE';
export const ROUTES=['landing','register','login','home','earn','chat','tasks','visits','upgrade','referrals','withdraw','profile','admin'];
export const COUNTRY_FALLBACK={NG:{code:'NG',name:'Nigeria',currency:'NGN',symbol:'₦',locale:'en-NG',cycle:50000},KE:{code:'KE',name:'Kenya',currency:'KES',symbol:'KSh ',locale:'en-KE',cycle:40000}};
export const CHAT_PROMPTS=[
 {prompt:'Hey! How has your day been so far?',suggestions:['It has been good. I have been trying to stay productive.','It has been a little busy, but I am doing okay.']},
 {prompt:'Nice. What is one thing you would still like to finish today?',suggestions:['I want to complete an important task before I rest.','I would like to organize my plans for tomorrow.']},
 {prompt:'That sounds useful. What usually helps you stay focused?',suggestions:['A short list and a quiet place usually help me focus.','I work better when I start with the easiest step.']},
 {prompt:'I like that. What is one small win you had recently?',suggestions:['I completed something I had been delaying for a while.','I stayed consistent with one of my goals this week.']}
];
export function countryFromStorage(){return localStorage.getItem('earnchat-country')==='KE'?'KE':'NG'}
export function money(amount,country='NG'){const c=COUNTRY_FALLBACK[country]||COUNTRY_FALLBACK.NG;return c.symbol+Math.floor(Number(amount)||0).toLocaleString(c.locale)}
