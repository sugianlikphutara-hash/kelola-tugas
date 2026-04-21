-- Sinkron dengan definisi vw_task_monitoring yang aktif di Supabase.
-- Kolom baru ditambahkan di bagian paling akhir untuk menghindari konflik urutan
-- saat menggunakan CREATE OR REPLACE VIEW pada PostgreSQL.

create or replace view public.vw_task_monitoring as
select
  t.id as task_id,
  t.code as task_code,
  t.title as task_title,
  t.description as task_description,
  t.sequence_no,
  t.start_date,
  t.due_date,
  t.actual_start_date,
  t.actual_end_date,
  t.progress_percent,
  t.result_summary as task_result_summary,
  t.notes as task_notes,
  ms_task.code as task_status_code,
  ms_task.name as task_status_name,
  mp.code as priority_code,
  mp.name as priority_name,
  ap.id as action_plan_id,
  ap.title as action_plan_title,
  ap.description as action_plan_description,
  ap.planned_start_date as action_plan_planned_start_date,
  ap.planned_end_date as action_plan_planned_end_date,
  ap.actual_start_date as action_plan_actual_start_date,
  ap.actual_end_date as action_plan_actual_end_date,
  ap.progress_percent as action_plan_progress_percent,
  wp.id as work_plan_id,
  wp.title as work_plan_title,
  wp.description as work_plan_description,
  wp.start_date as work_plan_start_date,
  wp.end_date as work_plan_end_date,
  sa.id as sub_activity_id,
  sa.code as sub_activity_code,
  sa.name as sub_activity_name,
  a.assignment_id,
  a.employee_id as assignee_employee_id,
  e.full_name as assignee_name,
  a.assignment_role,
  a.is_primary,
  a.assigned_at,
  a.accepted_at,
  a.started_at,
  a.completed_at,
  coalesce(pr.progress_report_count, 0::bigint) as progress_report_count,
  coalesce(td.document_count, 0::bigint) as evidence_count,
  t.approval_status,
  e.nick_name as assignee_nick_name
from
  tasks t
  left join master_statuses ms_task on ms_task.id = t.status_id
  left join master_priorities mp on mp.id = t.priority_id
  left join action_plans ap on ap.id = t.action_plan_id
  left join work_plans wp on wp.id = ap.work_plan_id
  left join sub_activities sa on sa.id = wp.sub_activity_id
  left join (
    select
      ta.id as assignment_id,
      ta.task_id,
      ta.employee_id,
      ta.assignment_role,
      ta.is_primary,
      ta.assigned_at,
      ta.accepted_at,
      ta.started_at,
      ta.completed_at,
      row_number() over (
        partition by ta.task_id
        order by ta.is_primary desc, ta.created_at
      ) as rn
    from
      task_assignments ta
  ) a on a.task_id = t.id
  and a.rn = 1
  left join employees e on e.id = a.employee_id
  left join (
    select
      task_progress_reports.task_id,
      count(*) as progress_report_count
    from
      task_progress_reports
    group by
      task_progress_reports.task_id
  ) pr on pr.task_id = t.id
  left join (
    select
      task_documents.task_id,
      count(*) as document_count
    from
      task_documents
    group by
      task_documents.task_id
  ) td on td.task_id = t.id;
