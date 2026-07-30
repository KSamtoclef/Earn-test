export const SUPABASE_URL='https://ijjmgrfgyqtsvigzjdjp.supabase.co';
export const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqam1ncmZneXF0c3ZpZ3pqZGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NjMxMzcsImV4cCI6MjA5OTAzOTEzN30.TFOOIJDK9YXa8mSBXcgQ2IqIfqD-0UhcBhIEN8QxeDE';
export const ROUTES=['landing','register','login','home','earn','chat','tasks','visits','referrals','withdraw','profile','admin'];
export const COUNTRY_FALLBACK={NG:{code:'NG',name:'Nigeria',currency:'NGN',symbol:'₦',locale:'en-NG',cycle:50000},KE:{code:'KE',name:'Kenya',currency:'KES',symbol:'KSh ',locale:'en-KE',cycle:40000}};
export const CHAT_PROMPTS=[
 {prompt:'What is one goal you are working toward right now?',suggestions:['I am working toward improving my skills and becoming more consistent.','My main goal is to build something useful and learn from the process.','I want to improve my daily routine and make steady progress.']},
 {prompt:'What has been the most difficult part of that goal?',suggestions:['The hardest part has been staying consistent when progress feels slow.','Finding enough time and staying focused has been difficult.','I sometimes need a clearer plan so I know what to do next.']},
 {prompt:'What is one practical step you can take this week?',suggestions:['I can break the goal into smaller tasks and complete one each day.','I can set a fixed time and remove distractions before I begin.','I can track my progress and adjust the plan when something is not working.']},
 {prompt:'What advice would you give someone with a similar goal?',suggestions:['Start small, stay patient and focus on progress instead of perfection.','Create a simple plan and keep showing up even on difficult days.','Ask for feedback, learn from mistakes and keep improving gradually.']}
];
export function countryFromStorage(){return localStorage.getItem('earnchat-country')==='KE'?'KE':'NG'}
export function money(amount,country='NG'){const c=COUNTRY_FALLBACK[country]||COUNTRY_FALLBACK.NG;return c.symbol+Math.floor(Number(amount)||0).toLocaleString(c.locale)}
