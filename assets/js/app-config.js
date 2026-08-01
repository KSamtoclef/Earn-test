export const SUPABASE_URL='https://ijjmgrfgyqtsvigzjdjp.supabase.co';
export const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqam1ncmZneXF0c3ZpZ3pqZGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NjMxMzcsImV4cCI6MjA5OTAzOTEzN30.TFOOIJDK9YXa8mSBXcgQ2IqIfqD-0UhcBhIEN8QxeDE';
export const ROUTES=['landing','register','login','home','earn','chat','tasks','visits','upgrade','referrals','withdraw','profile','admin'];
export const COUNTRY_FALLBACK={NG:{code:'NG',name:'Nigeria',currency:'NGN',symbol:'₦',locale:'en-NG',cycle:50000},KE:{code:'KE',name:'Kenya',currency:'KES',symbol:'KSh ',locale:'en-KE',cycle:40000}};
export const CHAT_PROMPT_SETS=[
 [
  {prompt:'Hey! How has your day been so far?',suggestions:['It has been good. I have been trying to stay productive.','It has been a little busy, but I am doing okay.']},
  {prompt:'Nice. What is one thing you would still like to finish today?',suggestions:['I want to complete an important task before I rest.','I would like to organize my plans for tomorrow.']},
  {prompt:'What usually helps you stay focused?',suggestions:['A short list and a quiet place usually help me focus.','I work better when I start with the easiest step.']},
  {prompt:'What is one small win you had recently?',suggestions:['I completed something I had been delaying for a while.','I stayed consistent with one of my goals this week.']}
 ],
 [
  {prompt:'Hi! What is something you are looking forward to this week?',suggestions:['I am looking forward to completing an important goal.','I am hoping to have a calm and productive week.']},
  {prompt:'What small step can help you move toward it?',suggestions:['I can start by making a simple plan today.','I can complete one useful task before doing anything else.']},
  {prompt:'Who or what normally encourages you when things feel difficult?',suggestions:['Talking with someone I trust usually encourages me.','Remembering why I started helps me continue.']},
  {prompt:'What would make today feel successful for you?',suggestions:['Finishing my main task would make today successful.','Making steady progress would be enough for me.']}
 ],
 [
  {prompt:'Hello! What kind of activity helps you relax after a busy day?',suggestions:['Listening to music helps me relax after a busy day.','Taking a quiet walk usually helps me clear my mind.']},
  {prompt:'When do you normally make time for it?',suggestions:['I usually make time for it in the evening.','I try to take a short break whenever my work is done.']},
  {prompt:'What is one healthy habit you would like to improve?',suggestions:['I would like to improve my sleeping routine.','I want to become more consistent with daily exercise.']},
  {prompt:'What is one easy way you could begin?',suggestions:['I can begin with a small daily reminder.','I can start with ten minutes and build from there.']}
 ],
 [
  {prompt:'Hey there! What is something useful you learned recently?',suggestions:['I learned a better way to organize my daily tasks.','I learned something that can help me improve my work.']},
  {prompt:'How do you think you will use what you learned?',suggestions:['I will apply it the next time I plan my day.','I will practice it until it becomes easier.']},
  {prompt:'What skill would you like to learn next?',suggestions:['I would like to improve my communication skills.','I want to learn a useful digital skill.']},
  {prompt:'What could be your first step?',suggestions:['I can find a beginner lesson and start today.','I can set aside a small amount of time each day.']}
 ]
];
export const CHAT_PROMPTS=CHAT_PROMPT_SETS[0];
export function countryFromStorage(){return localStorage.getItem('earnchat-country')==='KE'?'KE':'NG'}
export function money(amount,country='NG'){const c=COUNTRY_FALLBACK[country]||COUNTRY_FALLBACK.NG;return c.symbol+Math.floor(Number(amount)||0).toLocaleString(c.locale)}
