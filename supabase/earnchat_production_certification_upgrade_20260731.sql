-- Earn Chat production certification recovery and consistency upgrade
-- Run once after the consolidated installer and KYC/bulk upgrade.
begin;

-- Task claims now have a server expiry so abandoned activities can be recovered or cleared.
alter table public.earnchat_task_claims add column if not exists expires_at timestamptz;
update public.earnchat_task_claims c
set expires_at=coalesce(c.expires_at,c.started_at+make_interval(secs=>greatest(1800,coalesce(t.required_seconds,0)+1800)))
from public.earnchat_tasks t
where t.id=c.task_id and c.expires_at is null;
update public.earnchat_task_claims set status='expired' where status='started' and expires_at<=now();
with ranked as(
 select id,row_number() over(partition by user_id order by started_at desc,id desc) rn
 from public.earnchat_task_claims where status='started'
)
update public.earnchat_task_claims c set status='expired' from ranked r where c.id=r.id and r.rn>1;
create unique index if not exists earnchat_one_started_task_per_user on public.earnchat_task_claims(user_id) where status='started';
create index if not exists earnchat_open_task_expiry_idx on public.earnchat_task_claims(user_id,status,expires_at);

create or replace function public.start_earnchat_task(p_task uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();t public.earnchat_tasks%rowtype;p public.profiles%rowtype;ur int;tr int;dc int;tc int;reward bigint;cid uuid;expiry timestamptz;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.profiles where id=uid for update;
 if not found or p.earning_suspended or p.security_review_required then raise exception 'Earning unavailable'; end if;
 update public.earnchat_task_claims set status='expired' where user_id=uid and status='started' and coalesce(expires_at,started_at+interval '30 minutes')<=now();
 if exists(select 1 from public.earnchat_task_claims where user_id=uid and status='started') then raise exception 'Finish your current task first'; end if;
 select * into t from public.earnchat_tasks where id=p_task and status='active' and(starts_at is null or starts_at<=now())and(ends_at is null or ends_at>=now());
 if not found or t.country_code not in('ALL',p.country) then raise exception 'Task unavailable'; end if;
 select rank into ur from public.earnchat_level_settings where level_name=p.level_name;
 select rank into tr from public.earnchat_level_settings where level_name=t.required_level;
 if ur<tr then raise exception 'Required level: %',t.required_level; end if;
 select count(*) into dc from public.earnchat_task_claims where task_id=t.id and user_id=uid and started_at::date=current_date and status not in('rejected','expired','cancelled');
 if dc>=t.daily_claim_limit then raise exception 'Daily claim limit reached'; end if;
 if t.total_claim_limit is not null then
  select count(*) into tc from public.earnchat_task_claims where task_id=t.id and status in('started','pending','approved');
  if tc>=t.total_claim_limit then raise exception 'Task capacity reached'; end if;
 end if;
 reward:=public.earnchat_country_amount(t.base_reward_ngn,p.country);
 expiry:=now()+make_interval(secs=>greatest(1800,t.required_seconds+1800));
 insert into public.earnchat_task_claims(task_id,user_id,reward_amount,currency,country_code,expires_at)
 values(t.id,uid,reward,p.currency,p.country,expiry) returning id into cid;
 return jsonb_build_object('claim_id',cid,'task_id',t.id,'title',t.title,'url',t.external_url,'started_at',now(),'expires_at',expiry,'required_seconds',t.required_seconds,'reward',reward,'currency',p.currency,'approval_type',t.approval_type,'proof_type',t.proof_type,'proof_required',t.proof_required,'instructions',t.instructions);
end$$;

create or replace function public.get_my_open_task_claim()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
 select case when c.id is null then null else jsonb_build_object(
  'claim_id',c.id,'task_id',c.task_id,'title',t.title,'description',t.description,'url',t.external_url,
  'provider_name',t.provider_name,'category',t.category,'required_level',t.required_level,
  'started_at',c.started_at,'expires_at',c.expires_at,'required_seconds',t.required_seconds,
  'reward',c.reward_amount,'currency',c.currency,'country_code',c.country_code,
  'approval_type',t.approval_type,'proof_type',t.proof_type,'proof_required',t.proof_required,'instructions',t.instructions
 ) end
 from (select * from public.earnchat_task_claims where user_id=auth.uid() and status='started' and coalesce(expires_at,started_at+interval '30 minutes')>now() order by started_at desc limit 1)c
 join public.earnchat_tasks t on t.id=c.task_id
$$;

grant execute on function public.get_my_open_task_claim() to authenticated;

create or replace function public.cancel_earnchat_task_claim(p_claim uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 update public.earnchat_task_claims set status='cancelled',returned_at=now() where id=p_claim and user_id=auth.uid() and status='started';
 if not found then raise exception 'Open task claim not found'; end if;
 return jsonb_build_object('ok',true);
end$$;
grant execute on function public.cancel_earnchat_task_claim(uuid) to authenticated;

create or replace function public.submit_earnchat_task(p_claim uuid,p_proof jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();c public.earnchat_task_claims%rowtype;t public.earnchat_tasks%rowtype;s text;credited bigint:=0;
begin
 select * into c from public.earnchat_task_claims where id=p_claim and user_id=uid for update;
 if not found or c.status<>'started' then raise exception 'Invalid claim'; end if;
 if c.expires_at is not null and c.expires_at<=now() then update public.earnchat_task_claims set status='expired' where id=c.id;raise exception 'Task claim expired'; end if;
 select * into t from public.earnchat_tasks where id=c.task_id;
 if extract(epoch from(now()-c.started_at))<t.required_seconds then raise exception 'Required time not completed'; end if;
 if t.proof_type='text' and length(trim(coalesce(p_proof->>'text','')))<3 then raise exception 'A text answer is required'; end if;
 if t.proof_type='reference' and length(trim(coalesce(p_proof->>'reference',p_proof->>'text','')))<3 then raise exception 'A completion reference is required'; end if;
 if t.proof_type='partner' and coalesce(p_proof->>'partner_token','')='' then raise exception 'Partner verification is required'; end if;
 s:=case when t.approval_type='instant' then 'approved' else 'pending' end;
 update public.earnchat_task_claims set returned_at=now(),submitted_at=now(),status=s,proof=coalesce(p_proof,'{}'::jsonb) where id=c.id;
 if s='approved' then credited:=public.earnchat_credit(uid,'work','task',c.id,c.reward_amount,c.country_code,'Approved linked task');perform public.mark_earnchat_active_day(uid);
 else update public.profiles set work_pending_balance=work_pending_balance+c.reward_amount,updated_at=now() where id=uid;
 end if;
 return jsonb_build_object('ok',true,'status',s,'amount',credited,'pending_amount',case when s='pending' then c.reward_amount else 0 end,'currency',c.currency);
end$$;

-- Chat attempt recovery and safe cancellation.
create index if not exists earnchat_open_chat_expiry_idx on public.earnchat_chat_attempts(user_id,status,expires_at);
create or replace function public.get_my_open_chat_attempt()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare a public.earnchat_chat_attempts%rowtype;
begin
 update public.earnchat_chat_attempts set status='expired' where user_id=auth.uid() and status='started' and expires_at<=now();
 select * into a from public.earnchat_chat_attempts where user_id=auth.uid() and status='started' and expires_at>now() order by started_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('attempt_id',a.id,'partner',a.partner_key,'started_at',a.started_at,'expires_at',a.expires_at,'required_replies',4,'minimum_seconds',120);
end$$;
grant execute on function public.get_my_open_chat_attempt() to authenticated;

create or replace function public.cancel_earnchat_chat_attempt(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 update public.earnchat_chat_attempts set status='cancelled',completed_at=now() where id=p_attempt and user_id=auth.uid() and status='started';
 if not found then raise exception 'Open chat attempt not found'; end if;
 return jsonb_build_object('ok',true);
end$$;
grant execute on function public.cancel_earnchat_chat_attempt(uuid) to authenticated;

-- KYC URL validation and detailed bulk results.
create or replace function public.admin_update_earnchat_kyc_config(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare uid uuid:=auth.uid();ng text:=nullif(trim(p_payload->>'url_ng'),'');ke text:=nullif(trim(p_payload->>'url_ke'),'');
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if ng is not null and ng !~* '^https://[^[:space:]]+$' then raise exception 'Nigeria KYC URL must use HTTPS'; end if;
 if ke is not null and ke !~* '^https://[^[:space:]]+$' then raise exception 'Kenya KYC URL must use HTTPS'; end if;
 update public.earnchat_business_settings set
  kyc_enabled=coalesce((p_payload->>'enabled')::boolean,kyc_enabled),
  kyc_provider_ng=coalesce(nullif(trim(p_payload->>'provider_ng'),''),kyc_provider_ng),
  kyc_provider_ke=coalesce(nullif(trim(p_payload->>'provider_ke'),''),kyc_provider_ke),
  kyc_url_ng=ng,kyc_url_ke=ke,
  kyc_instructions_ng=coalesce(nullif(trim(p_payload->>'instructions_ng'),''),kyc_instructions_ng),
  kyc_instructions_ke=coalesce(nullif(trim(p_payload->>'instructions_ke'),''),kyc_instructions_ke),
  kyc_reference_required=coalesce((p_payload->>'reference_required')::boolean,kyc_reference_required),
  kyc_review_hours=greatest(1,coalesce((p_payload->>'review_hours')::integer,kyc_review_hours)),updated_at=now()
 where id=true;
 insert into public.earnchat_admin_audit(admin_id,action,target_type,details) values(uid,'kyc_configuration_updated','business_settings',coalesce(p_payload,'{}'::jsonb));
 return public.get_earnchat_kyc_config();
end$$;

create or replace function public.admin_bulk_review_earnchat_kyc(p_submissions uuid[],p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;succeeded int:=0;failed int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid KYC decision'; end if;
 foreach item in array coalesce(p_submissions,array[]::uuid[]) loop
  begin perform public.admin_review_earnchat_kyc(item,p_decision,p_reason);succeeded:=succeeded+1;
  exception when others then failed:=failed+1;failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'reason',sqlerrm));end;
 end loop;
 return jsonb_build_object('ok',failed=0,'succeeded',succeeded,'failed',failed,'failures',failures);
end$$;

create or replace function public.admin_bulk_review_task_claims(p_claims uuid[],p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;succeeded int:=0;failed int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_decision not in('approved','rejected') then raise exception 'Invalid task decision'; end if;
 foreach item in array coalesce(p_claims,array[]::uuid[]) loop
  begin perform public.admin_review_task_claim(item,p_decision,p_reason);succeeded:=succeeded+1;
  exception when others then failed:=failed+1;failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'reason',sqlerrm));end;
 end loop;
 return jsonb_build_object('ok',failed=0,'succeeded',succeeded,'failed',failed,'failures',failures);
end$$;

create or replace function public.admin_bulk_update_user_control(p_users uuid[],p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item uuid;succeeded int:=0;failed int:=0;failures jsonb:='[]'::jsonb;
begin
 if not public.earnchat_is_admin() then raise exception 'Administrator permission required'; end if;
 if p_action not in('review_on','review_off','suspend','restore') then raise exception 'Invalid user-control action'; end if;
 foreach item in array coalesce(p_users,array[]::uuid[]) loop
  begin perform public.admin_update_earnchat_user_control(item,p_action,p_reason);succeeded:=succeeded+1;
  exception when others then failed:=failed+1;failures:=failures||jsonb_build_array(jsonb_build_object('id',item,'reason',sqlerrm));end;
 end loop;
 return jsonb_build_object('ok',failed=0,'succeeded',succeeded,'failed',failed,'failures',failures);
end$$;

grant execute on function public.admin_update_earnchat_kyc_config(jsonb) to authenticated;
grant execute on function public.admin_bulk_review_earnchat_kyc(uuid[],text,text) to authenticated;
grant execute on function public.admin_bulk_review_task_claims(uuid[],text,text) to authenticated;
grant execute on function public.admin_bulk_update_user_control(uuid[],text,text) to authenticated;

update public.earnchat_business_settings set version='2026-07-31-production-certification-r1',updated_at=now() where id=true;
commit;
select 'Earn Chat production certification upgrade completed' as status;
