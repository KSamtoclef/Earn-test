-- Earn Chat task restart contract
-- Run after the configuration-control upgrade.
begin;

create or replace function public.cancel_earnchat_task_claim(p_claim uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare c public.earnchat_task_claims%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into c from public.earnchat_task_claims where id=p_claim and user_id=auth.uid() for update;
 if not found then raise exception 'Task attempt not found'; end if;
 if c.status<>'started' then raise exception 'Only an incomplete task can be restarted'; end if;
 update public.earnchat_task_claims
 set status='expired',review_reason='Restarted by member',returned_at=coalesce(returned_at,now())
 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',c.id,'status','expired');
end$$;

revoke all on function public.cancel_earnchat_task_claim(uuid) from public,anon;
grant execute on function public.cancel_earnchat_task_claim(uuid) to authenticated;

commit;
