-- Earn Chat authoritative production domain
-- Safe to run after the configuration-control upgrade.
begin;

update public.earnchat_business_settings
set general_config=jsonb_set(
      coalesce(general_config,'{}'::jsonb),
      '{production_origin}',
      to_jsonb('https://earn-chat.com'::text),
      true
    ),
    configuration_version=coalesce(configuration_version,1)+1,
    updated_at=now()
where id=true
  and coalesce(general_config->>'production_origin','') is distinct from 'https://earn-chat.com';

commit;

select
 general_config->>'production_origin' as production_origin,
 configuration_version,
 updated_at
from public.earnchat_business_settings
where id=true;
