import{sb}from'./supabase-client.js';
const unwrap=r=>{if(r.error)throw r.error;return r.data};
const rpc=(name,args={})=>sb.rpc(name,args).then(unwrap);
const select=(table,columns='*')=>sb.from(table).select(columns);
const maskAccount=value=>{const raw=String(value||'').replace(/\s+/g,'');if(!raw)return'';return`${'•'.repeat(Math.max(4,Math.min(8,raw.length-4)))}${raw.slice(-4)}`};
const maskWithdrawal=row=>({...row,payout_snapshot:{account_name:row.payout_snapshot?.account_name||'',provider:row.payout_snapshot?.provider||'',account_number:maskAccount(row.payout_snapshot?.account_number)}});
const MEMBER_CACHE_MS=10000,CONFIG_CACHE_MS=60000,ADMIN_CACHE_MS=12000;
let memberCache=null,memberAt=0,memberPromise=null,configCache=null,configAt=0,configPromise=null,adminOverviewCache=null,adminOverviewAt=0,adminOverviewPromise=null;
export function invalidateMemberState(){memberCache=null;memberAt=0;window.dispatchEvent(new CustomEvent('earnchat:member-state-invalidated'))}
export function invalidateAdminOverview(){adminOverviewCache=null;adminOverviewAt=0}
async function memberState(force=false){if(!force&&memberCache&&Date.now()-memberAt<MEMBER_CACHE_MS)return memberCache;if(memberPromise)return memberPromise;memberPromise=rpc('get_my_earnchat_state').then(data=>{memberCache=data;memberAt=Date.now();window.dispatchEvent(new CustomEvent('earnchat:member-state',{detail:data}));return data}).finally(()=>{memberPromise=null});return memberPromise}
async function businessConfig(force=false){if(!force&&configCache&&Date.now()-configAt<CONFIG_CACHE_MS)return configCache;if(configPromise)return configPromise;configPromise=rpc('get_earnchat_business_config').then(data=>{configCache=data;configAt=Date.now();return data}).finally(()=>{configPromise=null});return configPromise}
async function adminOverview(force=false){if(!force&&adminOverviewCache&&Date.now()-adminOverviewAt<ADMIN_CACHE_MS)return adminOverviewCache;if(adminOverviewPromise)return adminOverviewPromise;adminOverviewPromise=rpc('admin_get_earnchat_overview').then(data=>{adminOverviewCache=data;adminOverviewAt=Date.now();return data}).finally(()=>{adminOverviewPromise=null});return adminOverviewPromise}
async function mutateMember(name,args={}){const data=await rpc(name,args);invalidateMemberState();return data}
async function mutateAdmin(name,args={}){const data=await rpc(name,args);invalidateAdminOverview();return data}
export const api={
 session:async()=>unwrap(await sb.auth.getSession()),
 signup:async(email,password,fullName,country)=>unwrap(await sb.auth.signUp({email,password,options:{data:{full_name:fullName,country}}})),
 login:async(email,password)=>unwrap(await sb.auth.signInWithPassword({email,password})),
 logout:async()=>{const data=unwrap(await sb.auth.signOut());invalidateMemberState();return data},
 ensureProfile:async(fullName,country)=>mutateMember('ensure_earnchat_profile',{p_full_name:fullName||null,p_country:country||null}),
 state:memberState,
 refreshState:()=>memberState(true),
 business:businessConfig,
 publicStats:async()=>rpc('get_public_earnchat_stats'),
 payments:async()=>unwrap(await select('earnchat_payment_activity','masked_name,country_code,amount,currency,payout_method,paid_at').eq('is_visible',true).eq('is_verified',true).order('paid_at',{ascending:false}).limit(2)),
 feedback:async()=>unwrap(await select('earnchat_member_feedback','quote,country_code').eq('is_visible',true).eq('verified_paid_member',true).order('created_at',{ascending:false}).limit(3)),
 tasks:async()=>rpc('list_earnchat_tasks'),
 startTask:async id=>rpc('start_earnchat_task',{p_task:id}),
 submitTask:async(id,proof={})=>mutateMember('submit_earnchat_task',{p_claim:id,p_proof:proof}),
 openTaskClaim:async()=>rpc('get_my_open_task_claim'),
 startChat:async partner=>rpc('start_earnchat_chat',{p_partner:partner||null}),
 completeChat:async(attempt,replies,quality={})=>mutateMember('complete_earnchat_chat',{p_attempt:attempt,p_replies:replies,p_quality:quality}),
 openChatAttempt:async()=>rpc('get_my_open_chat_attempt'),
 cancelChatAttempt:async attempt=>rpc('cancel_earnchat_chat_attempt',{p_attempt:attempt}),
 referrals:async userId=>unwrap(await select('earnchat_referrals').eq('referrer_id',userId).order('signup_at',{ascending:false})),
 registerReferral:async code=>mutateMember('register_earnchat_referral',{p_code:code}),
 qualificationMissions:async()=>unwrap(await select('earnchat_qualification_missions').eq('status','active').order('created_at',{ascending:false})),
 qualificationSubmissions:async userId=>unwrap(await select('earnchat_qualification_submissions').eq('user_id',userId).order('started_at',{ascending:false})),
 startQualification:async id=>rpc('start_earnchat_qualification',{p_mission:id}),
 submitQualification:async(id,proof)=>mutateMember('submit_earnchat_qualification',{p_submission:id,p_proof:proof||{}}),
 kycConfig:async()=>rpc('get_earnchat_kyc_config'),
 submitKyc:async(reference,metadata={})=>mutateMember('submit_earnchat_kyc',{p_reference:reference||null,p_metadata:metadata}),
 withdraw:async(wallet,amount,method,payout)=>mutateMember('request_earnchat_withdrawal',{p_wallet:wallet,p_amount:amount,p_method:method,p_payout:payout}),
 ledger:async userId=>unwrap(await select('earnchat_ledger').eq('user_id',userId).order('created_at',{ascending:false}).limit(60)),
 withdrawals:async userId=>unwrap(await select('earnchat_withdrawals').eq('user_id',userId).order('created_at',{ascending:false}).limit(50)),
 event:async(name,session,page,metadata={})=>rpc('record_earnchat_event',{p_event:name,p_session:session||null,p_page:page||null,p_metadata:metadata}),
 isAdmin:async()=>rpc('earnchat_is_admin'),
 adminOverview,
 adminTasks:async()=>rpc('admin_list_earnchat_tasks'),
 adminSaveTask:async(id,payload)=>mutateAdmin('admin_upsert_earnchat_task',{p_id:id||null,p_payload:payload}),
 adminDeleteTask:async id=>mutateAdmin('admin_delete_earnchat_task',{p_task:id}),
 adminClaims:async(limit=50,offset=0)=>unwrap(await select('earnchat_task_claims').order('submitted_at',{ascending:false}).range(offset,offset+limit-1)),
 adminReviewClaim:async(id,decision,reason)=>mutateAdmin('admin_review_task_claim',{p_claim:id,p_decision:decision,p_reason:reason||null}),
 adminReverseClaim:async(id,reason)=>mutateAdmin('admin_reverse_task_claim',{p_claim:id,p_reason:reason||'Administrator reversal'}),
 adminBulkReviewClaims:async(ids,decision,reason)=>mutateAdmin('admin_bulk_review_task_claims',{p_claims:ids,p_decision:decision,p_reason:reason||null}),
 adminKyc:async(limit=50,offset=0)=>unwrap(await select('earnchat_kyc_submissions').order('created_at',{ascending:false}).range(offset,offset+limit-1)),
 adminKycConfig:async()=>rpc('get_earnchat_kyc_config'),
 adminUpdateKycConfig:async payload=>mutateAdmin('admin_update_earnchat_kyc_config',{p_payload:payload}),
 adminReviewKyc:async(id,decision,reason)=>mutateAdmin('admin_review_earnchat_kyc',{p_submission:id,p_decision:decision,p_reason:reason||null}),
 adminBulkReviewKyc:async(ids,decision,reason)=>mutateAdmin('admin_bulk_review_earnchat_kyc',{p_submissions:ids,p_decision:decision,p_reason:reason||null}),
 adminWithdrawals:async(limit=50,offset=0)=>(unwrap(await select('earnchat_withdrawals').order('created_at',{ascending:false}).range(offset,offset+limit-1))||[]).map(maskWithdrawal),
 adminReviewWithdrawal:async(id,status,reason,reference,publish)=>mutateAdmin('admin_review_earnchat_withdrawal',{p_withdrawal:id,p_status:status,p_reason:reason||null,p_reference:reference||null,p_publish:!!publish}),
 adminUsers:async(limit=50,offset=0)=>unwrap(await select('profiles','id,email,full_name,country,currency,level_name,activity_points,active_days_count,approved_chats_count,approved_tasks_count,task_rejection_count,chat_rejection_count,work_available_balance,work_pending_balance,referral_available_balance,referral_pending_balance,total_withdrawn,kyc_status,security_review_required,fraud_review_status,earning_suspended,is_admin,last_visit_at,account_created_at').order('account_created_at',{ascending:false}).range(offset,offset+limit-1)),
 adminUserControl:async(userId,action,reason)=>mutateAdmin('admin_update_earnchat_user_control',{p_user:userId,p_action:action,p_reason:reason||null}),
 adminBulkUserControl:async(ids,action,reason)=>mutateAdmin('admin_bulk_update_user_control',{p_users:ids,p_action:action,p_reason:reason||null}),
 adminPresence:async()=>unwrap(await select('earnchat_site_presence').gt('last_seen',new Date(Date.now()-90000).toISOString()).order('last_seen',{ascending:false}).limit(100)),
 adminChats:async(limit=50,offset=0)=>unwrap(await select('earnchat_chat_sessions').order('completed_at',{ascending:false}).range(offset,offset+limit-1)),
 adminReverseChat:async(id,reason)=>mutateAdmin('admin_reverse_earnchat_chat',{p_session:id,p_reason:reason||'Administrator reversal'}),
 adminReferrals:async(limit=50,offset=0)=>unwrap(await select('earnchat_referrals').order('signup_at',{ascending:false}).range(offset,offset+limit-1)),
 adminReviewReferral:async(id,decision,reason)=>mutateAdmin('admin_review_earnchat_referral',{p_referral:id,p_decision:decision,p_reason:reason||null}),
 adminQualifications:async()=>unwrap(await select('earnchat_qualification_missions').order('created_at',{ascending:false})),
 adminQualificationSubmissions:async(limit=50,offset=0)=>unwrap(await select('earnchat_qualification_submissions').order('submitted_at',{ascending:false}).range(offset,offset+limit-1)),
 adminSaveQualification:async(id,payload)=>mutateAdmin('admin_upsert_earnchat_qualification',{p_id:id||null,p_payload:payload}),
 adminReviewQualification:async(id,decision,reason)=>mutateAdmin('admin_review_earnchat_qualification',{p_submission:id,p_decision:decision,p_reason:reason||null}),
 adminPayments:async(limit=50,offset=0)=>unwrap(await select('earnchat_payment_activity').order('paid_at',{ascending:false}).range(offset,offset+limit-1)),
 adminSetPaymentVisibility:async(id,visible)=>mutateAdmin('admin_set_payment_visibility',{p_payment:id,p_visible:!!visible}),
 adminFeedback:async(limit=50,offset=0)=>unwrap(await select('earnchat_member_feedback').order('created_at',{ascending:false}).range(offset,offset+limit-1)),
 adminSaveFeedback:async(id,quote,country,verified,visible)=>mutateAdmin('admin_upsert_earnchat_feedback',{p_id:id||null,p_quote:quote,p_country:country,p_verified:!!verified,p_visible:!!visible}),
 adminAudit:async(limit=50,offset=0)=>unwrap(await select('earnchat_admin_audit').order('created_at',{ascending:false}).range(offset,offset+limit-1)),
 adminAnalytics:async(limit=50,offset=0)=>unwrap(await select('earnchat_analytics_events').order('created_at',{ascending:false}).range(offset,offset+limit-1)),
 adminUpdateBusiness:async payload=>mutateAdmin('admin_update_earnchat_business_settings',{p_payload:payload}),
 adminUpdateLevel:async(level,payload)=>mutateAdmin('admin_update_earnchat_level',{p_level:level,p_payload:payload}),
 presence:async payload=>rpc('upsert_earnchat_presence',payload),
 presenceInactive:async sessionId=>rpc('mark_earnchat_presence_inactive',{p_session_id:sessionId})
};
