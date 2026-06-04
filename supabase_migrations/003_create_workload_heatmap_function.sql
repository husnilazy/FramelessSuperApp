-- =============================================
-- Function: get_workload_heatmap()
-- Replaces: /api/admin/workload-heatmap
-- =============================================

create or replace function get_workload_heatmap()
returns json
language plpgsql
as $$
declare
  result json;
  day_dates date[];
begin
  -- Generate next 7 days
  day_dates := array(
    select (current_date + i)::date 
    from generate_series(0, 6) as i
  );

  with members as (
    select * from team_members where is_active = true order by order_index
  ),
  all_tasks as (select * from project_tasks),
  all_events as (select * from calendar_events)
  select json_build_object(
    'days', to_json(day_dates),
    'heatmap', (
      select json_agg(
        json_build_object(
          'memberId', m.id,
          'name', m.name,
          'role', m.role,
          'avatarUrl', m.avatar_url,
          'days', (
            select json_agg(
              json_build_object(
                'date', d,
                'dayName', to_char(d, 'Dy'),
                'tasks', (
                  select count(*) from all_tasks t 
                  where t.member_id = m.id and t.due_date::date = d
                ),
                'events', (
                  select count(*) from all_events e 
                  where (e.assigned_to = m.id or e.assigned_to = 'all') 
                    and e.start_date::date = d
                ),
                'total', (
                  select count(*) from all_tasks t where t.member_id = m.id and t.due_date::date = d
                ) + (
                  select count(*) from all_events e 
                  where (e.assigned_to = m.id or e.assigned_to = 'all') and e.start_date::date = d
                ),
                'intensity', (
                  select 
                    case 
                      when total_load = 0 then 0
                      when total_load <= 1 then 1
                      when total_load <= 3 then 2
                      when total_load <= 5 then 3
                      else 4
                    end
                  from (
                    select 
                      (select count(*) from all_tasks t where t.member_id = m.id and t.due_date::date = d) +
                      (select count(*) from all_events e where (e.assigned_to = m.id or e.assigned_to = 'all') and e.start_date::date = d) as total_load
                  ) sub
                )
              )
            )
            from unnest(day_dates) as d
          )
        )
      )
      from members m
    )
  ) into result;

  return result;
end;
$$;