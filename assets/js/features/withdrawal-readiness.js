import{sb}from'../supabase-client.js';

const missingFunction=error=>{
 const message=String(error?.message||'').toLowerCase();
 return error?.code==='PGRST202'||message.includes('get_my_earnchat_withdrawal_readiness')&&message.includes('could not find');
};

export async function loadWithdrawalReadiness(wallet='work'){
 const target=wallet==='referral'?'referral':'work';
 const{data,error}=await sb.rpc('get_my_earnchat_withdrawal_readiness',{p_wallet:target});
 if(error){
  if(missingFunction(error))return null;
  throw error;
 }
 return data&&typeof data==='object'?data:null;
}
