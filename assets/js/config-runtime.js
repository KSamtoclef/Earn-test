import{COUNTRY_FALLBACK,CHAT_PROMPT_SETS}from'./app-config.js';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const number=(value,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>{
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;
};
const integer=(value,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>Math.round(number(value,fallback,min,max));
const text=(value,fallback='',max=500)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback;
const boolean=(value,fallback=false)=>typeof value==='boolean'?value:fallback;
const stringList=(value,fallback=[])=>Array.isArray(value)?value.map(item=>text(item,'',120)).filter(Boolean):fallback;

export const CONFIG_DEFAULTS=Object.freeze({
  version:'fallback-1',
  general:{
    platform_name:'Earn Chat',
    production_origin:'https://earn-chat.com',
    support_email:'',
    maintenance_mode:false,
    maintenance_message:'Earn Chat is temporarily unavailable. Please try again shortly.',
    registration_enabled:true,
    enabled_countries:['NG','KE'],
    default_country:'NG',
    terms_url:'',
    privacy_url:'',
    support_url:''
  },
  landing:{
    headline:'Chat, complete sponsored visits and earn real cash.',
    subheadline:'Complete approved guided chats, sponsored visits and qualified referrals from one secure account.',
    cta_label:'Start earning free',
    social_proof_enabled:true,
    verified_payments_enabled:true,
    member_feedback_enabled:true
  },
  chat:{
    enabled:true,
    minimum_seconds:45,
    required_replies:4,
    minimum_reply_length:12,
    attempt_expiry_minutes:30,
    recovery_expiry_minutes:360,
    activity_points:2,
    completion_wording:'Complete guided session',
    pending_wording:'Complete the conversation when the timer is ready.',
    prompt_sets:CHAT_PROMPT_SETS,
    partners:[
      {name:'Noah T.',short:'N',place:'Houston, USA',topic:'Goals and personal growth'},
      {name:'Amina R.',short:'A',place:'London, United Kingdom',topic:'Work and daily routines'},
      {name:'Grace M.',short:'G',place:'Toronto, Canada',topic:'Learning and future plans'}
    ]
  },
  tasks:{
    enabled:true,
    visits_enabled:true,
    default_attempt_expiry_minutes:30,
    incomplete_attempt_policy:'restart',
    restart_required_message:'This sponsored visit was opened but not completed. Restart it to begin again.',
    pending_review_message:'Submitted successfully. Your review is pending.',
    approved_message:'Approved. Your reward has been credited.',
    rejected_message:'This submission was not approved. Review the reason and try again.',
    show_status_filters:true,
    featured_task_limit:4
  },
  referrals:{
    enabled:true,
    fixed_reward_ngn:500,
    required_active_days:2,
    referrer_account_days:5,
    direct_referral_only:true,
    sharing_copy:'Join me on Earn Chat and complete approved activities.'
  },
  withdrawals:{
    enabled:true,
    maintenance_message:'Withdrawals are temporarily unavailable.',
    maximum_open_requests:1,
    referral_minimum_ngn:40000,
    review_hours:48,
    bank_transfer_enabled:true,
    mpesa_enabled:true
  },
  kyc:{
    enabled:true,
    provider_ng:'',provider_ke:'',provider_url_ng:'',provider_url_ke:'',
    instructions_ng:'',instructions_ke:'',reference_required:true,review_hours:48,
    maintenance_message:'Identity verification is temporarily unavailable.'
  },
  feature_flags:{
    guided_chat:true,tasks:false,sponsored_visits:true,referrals:true,withdrawals:true,
    qualifications:true,social_proof:true,member_feedback:true,kyc:true,upgrade:true,
    admin_analytics:true,public_registration:true
  }
});

function normalizePromptSets(value){
  if(!Array.isArray(value)||!value.length)return CONFIG_DEFAULTS.chat.prompt_sets;
  const sets=value.map(set=>Array.isArray(set)?set.map(item=>({
    prompt:text(item?.prompt,'',240),
    suggestions:stringList(item?.suggestions,[]).slice(0,4)
  })).filter(item=>item.prompt):[]).filter(set=>set.length);
  return sets.length?sets:CONFIG_DEFAULTS.chat.prompt_sets;
}
function normalizePartners(value){
  if(!Array.isArray(value)||!value.length)return CONFIG_DEFAULTS.chat.partners;
  const partners=value.map(item=>({
    name:text(item?.name,'',80),short:text(item?.short,'',3),place:text(item?.place,'',100),topic:text(item?.topic,'',120)
  })).filter(item=>item.name&&item.short);
  return partners.length?partners:CONFIG_DEFAULTS.chat.partners;
}

export function normalizeBusinessConfig(raw={}){
  const root=object(raw),settings=object(root.settings),generalRaw=object(root.general||settings.general_config),landingRaw=object(root.landing||settings.landing_config),chatRaw=object(root.chat||settings.chat_config),tasksRaw=object(root.tasks||settings.task_config),referralsRaw=object(root.referrals||settings.referral_config),withdrawalsRaw=object(root.withdrawals||settings.withdrawal_config),kycRaw=object(root.kyc||settings.kyc_config),flagsRaw=object(root.feature_flags||settings.feature_flags);
  const enabledCountries=stringList(generalRaw.enabled_countries,CONFIG_DEFAULTS.general.enabled_countries).filter(code=>code==='NG'||code==='KE');
  return{
    ...root,
    version:text(root.version||settings.version,CONFIG_DEFAULTS.version,80),
    updated_at:root.updated_at||settings.updated_at||null,
    settings,
    levels:object(root.levels),
    general:{
      platform_name:text(generalRaw.platform_name,CONFIG_DEFAULTS.general.platform_name,80),
      production_origin:text(generalRaw.production_origin,CONFIG_DEFAULTS.general.production_origin,200),
      support_email:text(generalRaw.support_email,'',160),
      maintenance_mode:boolean(generalRaw.maintenance_mode,false),
      maintenance_message:text(generalRaw.maintenance_message,CONFIG_DEFAULTS.general.maintenance_message,500),
      registration_enabled:boolean(generalRaw.registration_enabled,true),
      enabled_countries:enabledCountries.length?enabledCountries:CONFIG_DEFAULTS.general.enabled_countries,
      default_country:generalRaw.default_country==='KE'?'KE':'NG',
      terms_url:text(generalRaw.terms_url,'',300),privacy_url:text(generalRaw.privacy_url,'',300),support_url:text(generalRaw.support_url,'',300)
    },
    landing:{
      headline:text(landingRaw.headline,CONFIG_DEFAULTS.landing.headline,180),
      subheadline:text(landingRaw.subheadline,CONFIG_DEFAULTS.landing.subheadline,500),
      cta_label:text(landingRaw.cta_label,CONFIG_DEFAULTS.landing.cta_label,80),
      social_proof_enabled:boolean(landingRaw.social_proof_enabled,true),
      verified_payments_enabled:boolean(landingRaw.verified_payments_enabled,true),
      member_feedback_enabled:boolean(landingRaw.member_feedback_enabled,true)
    },
    chat:{
      enabled:boolean(chatRaw.enabled,true),
      minimum_seconds:integer(chatRaw.minimum_seconds,45,0,900),
      required_replies:integer(chatRaw.required_replies,4,1,10),
      minimum_reply_length:integer(chatRaw.minimum_reply_length,12,1,500),
      attempt_expiry_minutes:integer(chatRaw.attempt_expiry_minutes,30,5,1440),
      recovery_expiry_minutes:integer(chatRaw.recovery_expiry_minutes,360,5,10080),
      activity_points:integer(chatRaw.activity_points,2,0,1000),
      completion_wording:text(chatRaw.completion_wording,CONFIG_DEFAULTS.chat.completion_wording,100),
      pending_wording:text(chatRaw.pending_wording,CONFIG_DEFAULTS.chat.pending_wording,220),
      prompt_sets:normalizePromptSets(chatRaw.prompt_sets),partners:normalizePartners(chatRaw.partners)
    },
    tasks:{
      enabled:boolean(tasksRaw.enabled,true),visits_enabled:boolean(tasksRaw.visits_enabled,true),
      default_attempt_expiry_minutes:integer(tasksRaw.default_attempt_expiry_minutes,30,1,1440),
      incomplete_attempt_policy:['restart','resume'].includes(tasksRaw.incomplete_attempt_policy)?tasksRaw.incomplete_attempt_policy:'restart',
      restart_required_message:text(tasksRaw.restart_required_message,CONFIG_DEFAULTS.tasks.restart_required_message,300),
      pending_review_message:text(tasksRaw.pending_review_message,CONFIG_DEFAULTS.tasks.pending_review_message,300),
      approved_message:text(tasksRaw.approved_message,CONFIG_DEFAULTS.tasks.approved_message,300),
      rejected_message:text(tasksRaw.rejected_message,CONFIG_DEFAULTS.tasks.rejected_message,300),
      show_status_filters:boolean(tasksRaw.show_status_filters,true),featured_task_limit:integer(tasksRaw.featured_task_limit,4,0,50)
    },
    referrals:{
      enabled:boolean(referralsRaw.enabled,true),fixed_reward_ngn:integer(referralsRaw.fixed_reward_ngn,Number(settings.referral_reward_ngn||500),0,100000000),
      required_active_days:integer(referralsRaw.required_active_days,Number(settings.referral_required_active_days||2),0,365),
      referrer_account_days:integer(referralsRaw.referrer_account_days,Number(settings.referrer_account_days||5),0,365),
      direct_referral_only:true,sharing_copy:text(referralsRaw.sharing_copy,CONFIG_DEFAULTS.referrals.sharing_copy,300)
    },
    withdrawals:{
      enabled:boolean(withdrawalsRaw.enabled,true),maintenance_message:text(withdrawalsRaw.maintenance_message,CONFIG_DEFAULTS.withdrawals.maintenance_message,300),
      maximum_open_requests:integer(withdrawalsRaw.maximum_open_requests,1,1,10),
      referral_minimum_ngn:integer(withdrawalsRaw.referral_minimum_ngn,Number(settings.referral_withdraw_min_ngn||40000),0,1000000000),
      review_hours:integer(withdrawalsRaw.review_hours,48,1,720),bank_transfer_enabled:boolean(withdrawalsRaw.bank_transfer_enabled,true),mpesa_enabled:boolean(withdrawalsRaw.mpesa_enabled,true)
    },
    kyc:{
      enabled:boolean(kycRaw.enabled,true),provider_ng:text(kycRaw.provider_ng,'',120),provider_ke:text(kycRaw.provider_ke,'',120),
      provider_url_ng:text(kycRaw.provider_url_ng,'',300),provider_url_ke:text(kycRaw.provider_url_ke,'',300),
      instructions_ng:text(kycRaw.instructions_ng,'',1000),instructions_ke:text(kycRaw.instructions_ke,'',1000),
      reference_required:boolean(kycRaw.reference_required,true),review_hours:integer(kycRaw.review_hours,48,1,720),maintenance_message:text(kycRaw.maintenance_message,CONFIG_DEFAULTS.kyc.maintenance_message,300)
    },
    feature_flags:Object.fromEntries(Object.entries(CONFIG_DEFAULTS.feature_flags).map(([key,fallback])=>[key,boolean(flagsRaw[key],fallback)]))
  };
}

export const getGeneralConfig=config=>normalizeBusinessConfig(config).general;
export const getLandingConfig=config=>normalizeBusinessConfig(config).landing;
export const getChatConfig=config=>normalizeBusinessConfig(config).chat;
export const getTaskConfig=config=>normalizeBusinessConfig(config).tasks;
export const getReferralConfig=config=>normalizeBusinessConfig(config).referrals;
export const getWithdrawalConfig=config=>normalizeBusinessConfig(config).withdrawals;
export const getKycConfig=config=>normalizeBusinessConfig(config).kyc;
export const getFeatureFlags=config=>normalizeBusinessConfig(config).feature_flags;
export const getLevelConfig=(config,level='Starter')=>normalizeBusinessConfig(config).levels?.[level]||{};
export const isFeatureEnabled=(config,name)=>getFeatureFlags(config)[name]!==false;
export const getCountryConfig=(config,country='NG')=>({...(COUNTRY_FALLBACK[country]||COUNTRY_FALLBACK.NG),enabled:getGeneralConfig(config).enabled_countries.includes(country)});
export function getPublicOrigin(config){
  const value=getGeneralConfig(config).production_origin;
  try{const url=new URL(value);return url.protocol==='https:'?url.origin:location.origin}catch{return location.origin}
}
