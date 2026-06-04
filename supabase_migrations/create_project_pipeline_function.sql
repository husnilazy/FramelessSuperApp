-- Run this SQL in Supabase SQL Editor
-- This replaces multiple client-side queries with one efficient server-side function

create or replace function get_project_pipeline()
returns json
language plpgsql
as $$
declare
  result json;
begin
  with project_data as (
    select
      p.id,
      p.title,
      p.client,
      p.status,
      coalesce(p.progress, 0) as progress,
      p.deadline,
      p.priority,
      p.project_type,
      p.updated_at,
      p.assigned_member_id,
      (
        select json_build_object(
          'id', tm.id,
          'name', tm.name,
          'avatarUrl', tm.avatar_url
        )
        from team_members tm
        where tm.id = p.assigned_member_id
      ) as owner,
      (
        select json_build_object(
          'total', count(*),
          'done', count(*) filter (where lower(t.status) in ('done', 'completed')),
          'active', count(*) filter (where lower(t.status) not in ('done', 'completed'))
        )
        from project_tasks t
        where t.project_id = p.id
      ) as task_stats
    from projects p
    order by p.updated_at desc
  ),
  grouped as (
    select
      case
        when lower(status) in ('planning', 'proposed', 'draft') then 'planning'
        when lower(status) in ('shooting', 'on_shoot') then 'shooting'
        when lower(status) in ('editing', 'post_production') then 'editing'
        when lower(status) in ('review', 'client_review', 'final') then 'review'
        when lower(status) in ('completed', 'done', 'delivered') then 'completed'
        else 'active'
      end as phase,
      json_build_object(
        'id', id,
        'title', title,
        'client', client,
        'status', status,
        'progress', progress,
        'deadline', deadline,
        'priority', priority,
        'projectType', project_type,
        'updatedAt', updated_at,
        'owner', owner,
        'taskStats', task_stats
      ) as project_json
    from project_data
  )
  select json_build_object(
    'pipeline', json_build_object(
      'planning',  coalesce((select json_agg(project_json) from grouped where phase = 'planning'), '[]'::json),
      'active',    coalesce((select json_agg(project_json) from grouped where phase = 'active'), '[]'::json),
      'shooting',  coalesce((select json_agg(project_json) from grouped where phase = 'shooting'), '[]'::json),
      'editing',   coalesce((select json_agg(project_json) from grouped where phase = 'editing'), '[]'::json),
      'review',    coalesce((select json_agg(project_json) from grouped where phase = 'review'), '[]'::json),
      'completed', coalesce((select json_agg(project_json) from grouped where phase = 'completed'), '[]'::json)
    ),
    'total', (select count(*) from project_data)
  ) into result;

  return result;
end;
$$;

-- Optional: Grant permission (usually not needed if using anon key with proper RLS, but safe to have)
-- grant execute on function get_project_pipeline() to anon, authenticated;