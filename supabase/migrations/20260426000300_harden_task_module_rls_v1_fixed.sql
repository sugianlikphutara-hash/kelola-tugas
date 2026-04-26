-- Enable RLS for target task module tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_evidence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_follow_ups ENABLE ROW LEVEL SECURITY;

-- 1. tasks
DROP POLICY IF EXISTS "tasks_select_authenticated" ON public.tasks;
CREATE POLICY "tasks_select_authenticated" ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tasks_insert_deny" ON public.tasks;
CREATE POLICY "tasks_insert_deny" ON public.tasks FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "tasks_update_deny" ON public.tasks;
CREATE POLICY "tasks_update_deny" ON public.tasks FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "tasks_delete_deny" ON public.tasks;
CREATE POLICY "tasks_delete_deny" ON public.tasks FOR DELETE TO authenticated USING (false);

-- 2. task_assignments
DROP POLICY IF EXISTS "task_assignments_select_authenticated" ON public.task_assignments;
CREATE POLICY "task_assignments_select_authenticated" ON public.task_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_assignments_insert_deny" ON public.task_assignments;
CREATE POLICY "task_assignments_insert_deny" ON public.task_assignments FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "task_assignments_update_deny" ON public.task_assignments;
CREATE POLICY "task_assignments_update_deny" ON public.task_assignments FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "task_assignments_delete_deny" ON public.task_assignments;
CREATE POLICY "task_assignments_delete_deny" ON public.task_assignments FOR DELETE TO authenticated USING (false);

-- 3. task_progress_reports
DROP POLICY IF EXISTS "task_progress_reports_select_authenticated" ON public.task_progress_reports;
CREATE POLICY "task_progress_reports_select_authenticated" ON public.task_progress_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_progress_reports_insert_deny" ON public.task_progress_reports;
CREATE POLICY "task_progress_reports_insert_deny" ON public.task_progress_reports FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "task_progress_reports_update_deny" ON public.task_progress_reports;
CREATE POLICY "task_progress_reports_update_deny" ON public.task_progress_reports FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "task_progress_reports_delete_deny" ON public.task_progress_reports;
CREATE POLICY "task_progress_reports_delete_deny" ON public.task_progress_reports FOR DELETE TO authenticated USING (false);

-- 4. task_documents
DROP POLICY IF EXISTS "task_documents_select_authenticated" ON public.task_documents;
CREATE POLICY "task_documents_select_authenticated" ON public.task_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_documents_insert_deny" ON public.task_documents;
CREATE POLICY "task_documents_insert_deny" ON public.task_documents FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "task_documents_update_deny" ON public.task_documents;
CREATE POLICY "task_documents_update_deny" ON public.task_documents FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "task_documents_delete_deny" ON public.task_documents;
CREATE POLICY "task_documents_delete_deny" ON public.task_documents FOR DELETE TO authenticated USING (false);

-- 5. task_daily_reports
DROP POLICY IF EXISTS "task_daily_reports_select_authenticated" ON public.task_daily_reports;
CREATE POLICY "task_daily_reports_select_authenticated" ON public.task_daily_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_daily_reports_insert_deny" ON public.task_daily_reports;
CREATE POLICY "task_daily_reports_insert_deny" ON public.task_daily_reports FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "task_daily_reports_update_deny" ON public.task_daily_reports;
CREATE POLICY "task_daily_reports_update_deny" ON public.task_daily_reports FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "task_daily_reports_delete_deny" ON public.task_daily_reports;
CREATE POLICY "task_daily_reports_delete_deny" ON public.task_daily_reports FOR DELETE TO authenticated USING (false);

-- 6. task_evidence_requests
DROP POLICY IF EXISTS "task_evidence_requests_select_authenticated" ON public.task_evidence_requests;
CREATE POLICY "task_evidence_requests_select_authenticated" ON public.task_evidence_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_evidence_requests_insert_deny" ON public.task_evidence_requests;
CREATE POLICY "task_evidence_requests_insert_deny" ON public.task_evidence_requests FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "task_evidence_requests_update_deny" ON public.task_evidence_requests;
CREATE POLICY "task_evidence_requests_update_deny" ON public.task_evidence_requests FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "task_evidence_requests_delete_deny" ON public.task_evidence_requests;
CREATE POLICY "task_evidence_requests_delete_deny" ON public.task_evidence_requests FOR DELETE TO authenticated USING (false);

-- 7. task_follow_ups
DROP POLICY IF EXISTS "task_follow_ups_select_authenticated" ON public.task_follow_ups;
CREATE POLICY "task_follow_ups_select_authenticated" ON public.task_follow_ups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_follow_ups_insert_deny" ON public.task_follow_ups;
CREATE POLICY "task_follow_ups_insert_deny" ON public.task_follow_ups FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "task_follow_ups_update_deny" ON public.task_follow_ups;
CREATE POLICY "task_follow_ups_update_deny" ON public.task_follow_ups FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "task_follow_ups_delete_deny" ON public.task_follow_ups;
CREATE POLICY "task_follow_ups_delete_deny" ON public.task_follow_ups FOR DELETE TO authenticated USING (false);
