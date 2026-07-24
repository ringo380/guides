-- Aggregates the per-user jsonb progress blob into per-page counts.
-- Defined as a view so the SQL is reviewable and testable on its own rather
-- than embedded as a string inside the edge function.
--
-- Score scale: assets/javascripts/components/quiz.js records 1 for a correct
-- answer and 0 for incorrect (not a 0-100 percentage), so "passed" means
-- score >= 1. Do not change this threshold without re-reading that file.
--
-- jsonb_typeof guards are deliberate: progress is a client-written blob, so a
-- malformed entry must yield 0 rather than abort the whole aggregate.
-- Dropped rather than replaced: "create or replace view" cannot change a
-- column's data type, and the counts are cast to int below.
drop view if exists public.admin_progress_rollup;

create view public.admin_progress_rollup as
select
  page.key as page_key,
  -- All counts are cast to int: bigint serializes as a JSON string in some
  -- clients, which would send string-typed metrics to the dashboard.
  count(distinct p.user_id)::int as users_with_progress,
  coalesce(sum(
    case
      when jsonb_typeof(page.value -> 'sections_read') = 'array'
        then jsonb_array_length(page.value -> 'sections_read')
      else 0
    end
  ), 0)::int as sections_read,
  coalesce(sum(
    case
      when jsonb_typeof(page.value -> 'quizzes') = 'object'
        then (select count(*) from jsonb_each(page.value -> 'quizzes'))
      else 0
    end
  ), 0)::int as quizzes_attempted,
  coalesce(sum(
    case
      when jsonb_typeof(page.value -> 'quizzes') = 'object'
        then (
          select count(*)
          from jsonb_each(page.value -> 'quizzes') q
          where jsonb_typeof(q.value) = 'object'
            and (q.value ->> 'score') ~ '^-?[0-9]+(\.[0-9]+)?$'
            and (q.value ->> 'score')::numeric >= 1
        )
      else 0
    end
  ), 0)::int as quizzes_passed,
  coalesce(sum(
    case
      when jsonb_typeof(page.value -> 'exercises') = 'object'
        then (
          select count(*)
          from jsonb_each(page.value -> 'exercises') e
          where jsonb_typeof(e.value) = 'object'
            and (e.value ->> 'completed') = 'true'
        )
      else 0
    end
  ), 0)::int as exercises_completed
from public.runbook_progress p
cross join lateral jsonb_each(p.progress) as page
group by page.key;

comment on view public.admin_progress_rollup is
  'Per-page progress aggregate across signed-in users only. Does not include
   anonymous visitors, whose activity appears in GA4 instead.';
