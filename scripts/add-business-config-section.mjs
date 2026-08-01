import fs from'node:fs';

function update(path,transform){const before=fs.readFileSync(path,'utf8'),after=transform(before);if(before===after)throw new Error(`No changes produced for ${path}`);fs.writeFileSync(path,after)}

update('assets/js/admin/configuration.js',source=>{
 const marker='function generalForm(config){';
 if(!source.includes(marker))throw new Error('General form marker missing');
 const business=`function businessForm(config){const s=config.settings||{};return section('business','Business & Currency','Core monetary values and presence timing used by server-side functions.',\`\n <div class="quick-grid">\n  \${input('signup_bonus_ngn','Signup bonus NGN',s.signup_bonus_ngn??2000,{type:'number',min:0,required:true})}\n  \${input('daily_cap_ngn','Daily earning cap NGN',s.daily_cap_ngn??20000,{type:'number',min:0,required:true})}\n  \${input('nigeria_multiplier','Nigeria multiplier',s.nigeria_multiplier??1,{type:'number',min:.01,step:.01,required:true})}\n  \${input('kenya_multiplier','Kenya multiplier',s.kenya_multiplier??.6,{type:'number',min:.01,step:.01,required:true})}\n  \${input('referral_reward_ngn','Qualified referral reward NGN',s.referral_reward_ngn??500,{type:'number',min:0,required:true})}\n  \${input('referral_withdraw_min_ngn','Referral withdrawal minimum NGN',s.referral_withdraw_min_ngn??40000,{type:'number',min:0,required:true})}\n  \${input('referral_required_active_days','Referral active days',s.referral_required_active_days??2,{type:'number',min:0,max:365,required:true})}\n  \${input('referrer_account_days','Referrer account days',s.referrer_account_days??5,{type:'number',min:0,max:365,required:true})}\n  \${input('presence_online_seconds','Online-presence window seconds',s.presence_online_seconds??90,{type:'number',min:30,max:3600,required:true})}\n  \${input('presence_heartbeat_seconds','Presence heartbeat seconds',s.presence_heartbeat_seconds??60,{type:'number',min:15,max:3600,required:true})}\n </div>\n <article class="admin-preview-card"><span class="eyebrow">CURRENCY PREVIEW</span><h3>Kenya values use the configured Kenya multiplier</h3><p>Customer displays and server credits continue to use country-specific currency formatting.</p></article>\n \`)}\n`;
 source=source.replace(marker,business+marker);
 const payloadMarker="function payloadFor(section,form){const data=new FormData(form),bool=boolValue(data);switch(section){\n case'general':";
 if(!source.includes(payloadMarker))throw new Error('Payload marker missing');
 source=source.replace(payloadMarker,"function payloadFor(section,form){const data=new FormData(form),bool=boolValue(data);switch(section){\n case'business':return{signup_bonus_ngn:numberValue(data.get('signup_bonus_ngn')),daily_cap_ngn:numberValue(data.get('daily_cap_ngn')),nigeria_multiplier:numberValue(data.get('nigeria_multiplier')),kenya_multiplier:numberValue(data.get('kenya_multiplier')),referral_reward_ngn:numberValue(data.get('referral_reward_ngn')),referral_withdraw_min_ngn:numberValue(data.get('referral_withdraw_min_ngn')),referral_required_active_days:numberValue(data.get('referral_required_active_days')),referrer_account_days:numberValue(data.get('referrer_account_days')),presence_online_seconds:numberValue(data.get('presence_online_seconds')),presence_heartbeat_seconds:numberValue(data.get('presence_heartbeat_seconds'))};\n case'general':");
 const renderMarker='${generalForm(config)}${landingForm(config)}';
 if(!source.includes(renderMarker))throw new Error('Configuration render marker missing');
 source=source.replace(renderMarker,'${businessForm(config)}${generalForm(config)}${landingForm(config)}');
 const saveMarker='const response=await api.adminUpdateConfiguration(sectionName,payloadFor(sectionName,form));';
 if(!source.includes(saveMarker))throw new Error('Configuration save marker missing');
 source=source.replace(saveMarker,"const payload=payloadFor(sectionName,form),response=sectionName==='business'?await api.adminUpdateBusiness(payload):await api.adminUpdateConfiguration(sectionName,payload);");
 return source;
});

update('assets/js/app.js',source=>{
 const oldLanding="function landingValues(){const starter=app.config?.levels?.Starter?.chat_reward_ngn??250,chat=app.country==='KE'?Math.round(starter*Number(app.config?.settings?.kenya_multiplier||.6)):starter,cycle=app.country==='KE'?40000:50000;return{chat,cycle}}";
 const newLanding="function landingValues(){const settings=app.config?.settings||{},starter=app.config?.levels?.Starter?.chat_reward_ngn??250,multiplier=app.country==='KE'?Number(settings.kenya_multiplier||.6):Number(settings.nigeria_multiplier||1),chat=Math.round(starter*multiplier),cycle=Math.round(Number(settings.daily_cap_ngn||20000)*multiplier),signup=Math.round(Number(settings.signup_bonus_ngn||2000)*multiplier);return{chat,cycle,signup}}";
 if(!source.includes(oldLanding))throw new Error('Landing values marker missing');
 source=source.replace(oldLanding,newLanding);
 const preview="$('#preview-balance').textContent=money(app.country==='KE'?1200:2000,app.country);";
 if(!source.includes(preview))throw new Error('Landing preview marker missing');
 source=source.replace(preview,"$('#preview-balance').textContent=money(v.signup,app.country);");
 const signupStart="const c=COUNTRY_FALLBACK[selected],starter=levels().Starter||{},reward=money(amountFromBase(starter.chat_reward_ngn||250),selected),summary=$('#signup-country-summary');";
 if(!source.includes(signupStart))throw new Error('Signup summary marker missing');
 source=source.replace(signupStart,"const c=COUNTRY_FALLBACK[selected],starter=levels().Starter||{},settings=app.config?.settings||{},multiplier=selected==='KE'?Number(settings.kenya_multiplier||.6):Number(settings.nigeria_multiplier||1),reward=money(Math.round(Number(starter.chat_reward_ngn||250)*multiplier),selected),signup=money(Math.round(Number(settings.signup_bonus_ngn||2000)*multiplier),selected),summary=$('#signup-country-summary');");
 const signupCopy="Currency: ${c.currency} · Starter chat: ${reward}<br>Main payout:";
 if(!source.includes(signupCopy))throw new Error('Signup copy marker missing');
 source=source.replace(signupCopy,"Currency: ${c.currency} · Welcome bonus: ${signup} · Starter chat: ${reward}<br>Main payout:");
 return source;
});

