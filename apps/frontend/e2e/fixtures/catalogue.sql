\set ON_ERROR_STOP on

begin;

do $$
begin
  if current_database() !~ '_e2e$' then
    raise exception
      'refusing to reset non-e2e database: %',
      current_database();
  end if;
end
$$;

set local timezone to 'UTC';

truncate table postings;

with fixture as (
  select
    n,
    (array[
      'greenhouse',
      'ashby',
      'lever',
      'djinni',
      'dou',
      'jobico',
      'linkedin'
    ])[((n - 1) % 7) + 1] as source
  from generate_series(1, 45) as series(n)
)
insert into postings (
  id,
  source,
  url,
  title,
  company,
  description_text,
  location_raw,
  posted_at,
  extra,
  seniority,
  years_required,
  remote_policy,
  location,
  salary_min,
  salary_max,
  stack,
  responsibilities_text,
  requirements_text,
  normalized_at,
  indexed_at,
  first_seen_at,
  last_seen_at,
  delisted_at
)
select
  format('%s:e2e-%s', source, lpad(n::text, 2, '0')),
  source,
  format('https://example.test/jobs/%s', n),
  case
    when n = 1 then 'TitleBeacon SharedAlpha Engineer'
    when n = 7 then 'ExperienceBeacon Unknown Requirement'
    when n = 8 then 'ExperienceBeacon Three Years'
    when n = 9 then 'ExperienceBeacon Eight Years'
    when n = 10 then 'Розробник Python Київ'
    when n = 11 then 'UnnormalizedBeacon Engineer'
    when n = 12 then 'UnindexedBeacon Engineer'
    when n between 40 and 43 then 'SalaryBeacon Engineer'
    when n = 44 then 'DelistedBeacon Engineer'
    when n = 13 then 'DetailBeacon Platform Engineer'
    when n = 14 then 'SparseBeacon Engineer'
    when n = 15 then 'HostileBeacon Engineer'
    else format('Fixture Engineer %s', n)
  end,
  case
    when n = 2 then 'CompanyBeacon Labs'
    else format('Fixture Company %s', n)
  end,
  case
    when n = 1 then 'SharedBeta RecentBeacon backend work'
    when n = 6 then 'DescriptionBeacon platform work'
    when n = 13 then E'DetailBeacon owns the deployment pipeline.\nSecond stored line.'
    when n = 15 then E'HostileBeacon <script>alert(1)</script>\n- literal dash line start\n'
      || repeat('z', 400)
    when n = 30 then 'RecentBeacon older posting'
    else format('Fixture description %s', n)
  end,
  'Europe',
  case
    when n = 45 then null
    when n in (22, 23) then current_timestamp - interval '22 hours'
    else current_timestamp - make_interval(hours => n)
  end,
  '{}'::jsonb,
  case n % 5
    when 1 then 'intern'
    when 2 then 'junior'
    when 3 then 'mid'
    when 4 then 'senior'
    else 'lead'
  end,
  case
    when n = 7 then null
    when n = 8 then 3
    when n = 9 then 8
    else n % 10
  end,
  case n % 3
    when 1 then 'remote'
    when 2 then 'hybrid'
    else 'onsite'
  end,
  'Europe',
  case
    when n = 43 then 300000
    when n = 42 then 120000
    when n in (40, 41) then null
    when n in (20, 21) then 200000
    when n in (22, 23) then 180000
    else 50000 + n * 1000
  end,
  case
    when n = 43 then 320000
    when n = 42 then null
    when n = 41 then 250000
    when n = 40 then null
    when n in (20, 21) then 220000
    when n in (22, 23) then 200000
    else 70000 + n * 1000
  end,
  case
    when n = 3 then array['StackBeacon', 'Python']
    else array['Python', 'PostgreSQL']
  end,
  case
    when n = 5 then 'ResponsibilityBeacon owns services'
    when n = 13 then 'DetailResponsibilityBeacon owns the pipeline'
    when n = 14 then null
    else 'Own production services'
  end,
  case
    when n = 4 then 'RequirementBeacon distributed systems'
    when n = 13 then E'DetailRequirementBeacon five years\nSecond requirement line.'
    when n = 14 then null
    else 'Production engineering experience'
  end,
  case when n = 11 then null else current_timestamp end,
  case when n in (11, 12) then null else current_timestamp end,
  case
    when n = 45 then current_timestamp - interval '1 minute'
    else current_timestamp - make_interval(hours => n)
         + interval '5 minutes'
  end,
  case
    when n = 44 then current_timestamp - interval '3 days'
    else current_timestamp
  end,
  case when n = 44 then current_timestamp else null end
from fixture;

do $$
declare
  live_count integer;
  generated_count integer;
begin
  select count(*) into live_count
  from postings
  where delisted_at is null;

  select count(*) into generated_count
  from postings
  where search_document is not null;

  if live_count <> 44 then
    raise exception 'expected 44 live fixture rows, got %', live_count;
  end if;

  if generated_count <> 45 then
    raise exception
      'expected 45 generated search documents, got %',
      generated_count;
  end if;
end
$$;

commit;
