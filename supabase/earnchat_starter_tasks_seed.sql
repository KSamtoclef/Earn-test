-- Earn Chat editable starter tasks
-- Run once in Supabase SQL Editor after the production installer/upgrade.
-- Safe to rerun: deterministic IDs update the same records instead of creating duplicates.
-- All tasks are PAUSED and use safe placeholder URLs. Replace each URL in Admin before activating.

begin;

insert into public.earnchat_tasks(
 id,title,description,external_url,provider_name,category,country_code,
 base_reward_ngn,required_level,required_seconds,daily_claim_limit,total_claim_limit,
 approval_type,proof_type,proof_required,instructions,status,updated_at
) values
(
 '10000000-0000-4000-8000-000000000001'::uuid,
 'Explore a featured website homepage',
 'Visit the featured website, read the main information and explore at least one section.',
 'https://example.com/earnchat-test-1',
 'Featured Website Partner','Visit','ALL',150,'Starter',45,1,10,
 'instant','none',false,
 E'1. Open the approved website.\n2. Wait for the page to load completely.\n3. Read the main information and explore at least one section.\n4. Stay on the page for at least 45 seconds.\n5. Return to Earn Chat and submit.',
 'paused',now()
),
(
 '10000000-0000-4000-8000-000000000002'::uuid,
 'Read a short page and explain the main topic',
 'Read the provided page and submit a short explanation of its main topic.',
 'https://example.com/earnchat-test-2',
 'Earn Chat Learning Partner','Reading','ALL',250,'Starter',90,1,10,
 'pending','text',true,
 E'1. Open the reading page.\n2. Read it carefully for at least 90 seconds.\n3. Identify the main topic.\n4. Return to Earn Chat.\n5. Explain the topic in one or two original sentences.\n6. Do not copy the page word for word.',
 'paused',now()
),
(
 '10000000-0000-4000-8000-000000000003'::uuid,
 'Check whether a mobile page loads correctly',
 'Open the webpage on a mobile device and report whether the text, images and buttons display correctly.',
 'https://example.com/earnchat-test-3',
 'Website Testing Partner','Testing','ALL',400,'Active',120,1,10,
 'pending','text',true,
 E'1. Open the webpage using your mobile browser.\n2. Check the heading, images and buttons.\n3. Scroll from the top to the bottom.\n4. Return to Earn Chat.\n5. Write "Everything loaded correctly" or clearly describe the problem you noticed.',
 'paused',now()
),
(
 '10000000-0000-4000-8000-000000000004'::uuid,
 'Explore a service page and identify one benefit',
 'Review the service page and submit one genuine benefit mentioned there.',
 'https://example.com/earnchat-test-4',
 'Digital Services Partner','Review','ALL',250,'Starter',75,1,10,
 'pending','text',true,
 E'1. Open the service page.\n2. Read the description and listed benefits.\n3. Stay on the page for at least 75 seconds.\n4. Return to Earn Chat.\n5. Submit one real benefit stated on the page.',
 'paused',now()
),
(
 '10000000-0000-4000-8000-000000000005'::uuid,
 'Review a campaign information page',
 'Visit the campaign page and identify its main offer, date or participation requirement.',
 'https://example.com/earnchat-test-5',
 'Campaign Information Partner','Reading','ALL',200,'Starter',60,1,10,
 'pending','text',true,
 E'1. Open the campaign information page.\n2. Read the full page for at least 60 seconds.\n3. Identify the main offer, date or requirement.\n4. Return to Earn Chat.\n5. Submit the information in your own words.',
 'paused',now()
),
(
 '10000000-0000-4000-8000-000000000006'::uuid,
 'Complete a short partner feedback activity',
 'Complete the approved feedback activity and submit the completion reference shown by the provider.',
 'https://example.com/earnchat-test-6',
 'User Experience Partner','Survey','ALL',350,'Active',120,1,10,
 'pending','reference',true,
 E'1. Open the approved feedback page.\n2. Complete the required questions honestly.\n3. Do not include passwords or sensitive personal information.\n4. Submit the activity.\n5. Copy the completion reference shown by the provider.\n6. Return to Earn Chat and enter the reference.',
 'paused',now()
)
on conflict(id) do update set
 title=excluded.title,
 description=excluded.description,
 external_url=excluded.external_url,
 provider_name=excluded.provider_name,
 category=excluded.category,
 country_code=excluded.country_code,
 base_reward_ngn=excluded.base_reward_ngn,
 required_level=excluded.required_level,
 required_seconds=excluded.required_seconds,
 daily_claim_limit=excluded.daily_claim_limit,
 total_claim_limit=excluded.total_claim_limit,
 approval_type=excluded.approval_type,
 proof_type=excluded.proof_type,
 proof_required=excluded.proof_required,
 instructions=excluded.instructions,
 status=excluded.status,
 updated_at=now();

commit;

select id,title,status,external_url
from public.earnchat_tasks
where id in(
 '10000000-0000-4000-8000-000000000001'::uuid,
 '10000000-0000-4000-8000-000000000002'::uuid,
 '10000000-0000-4000-8000-000000000003'::uuid,
 '10000000-0000-4000-8000-000000000004'::uuid,
 '10000000-0000-4000-8000-000000000005'::uuid,
 '10000000-0000-4000-8000-000000000006'::uuid
)
order by title;
