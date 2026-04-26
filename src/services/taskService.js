import { supabase } from "../lib/supabaseClient";
import {
  AUTH_STORAGE_KEYS,
  LEGACY_EMPLOYEE_STORAGE_KEYS,
  normalizeStoredValue,
  readStoredValue,
} from "../lib/authSessionStorage";

function normalizeEmployeeId(employeeId) {
  return normalizeStoredValue(employeeId);
}

function normalizeRoleCode(roleCode) {
  return String(roleCode || "").trim().toUpperCase();
}

function getCurrentAuthenticatedEmployeeId() {
  const authUserId = readStoredValue(AUTH_STORAGE_KEYS.authUserId);
  const authStatus = readStoredValue(AUTH_STORAGE_KEYS.authStatus);

  if (authUserId && authStatus !== "active") {
    return null;
  }

  if (authStatus !== "active") {
    return null;
  }

  return normalizeEmployeeId(readStoredValue(AUTH_STORAGE_KEYS.employeeId));
}

function getCurrentAuthenticatedRoleCode() {
  const authStatus = readStoredValue(AUTH_STORAGE_KEYS.authStatus);
  if (authStatus !== "active") {
    return null;
  }

  return normalizeRoleCode(readStoredValue(AUTH_STORAGE_KEYS.roleCode));
}

export function getCurrentAuditEmployeeId() {
  const authenticatedEmployeeId = getCurrentAuthenticatedEmployeeId();
  if (authenticatedEmployeeId) {
    return authenticatedEmployeeId;
  }

  for (const storageKey of LEGACY_EMPLOYEE_STORAGE_KEYS) {
    const employeeId = normalizeEmployeeId(readStoredValue(storageKey));
    if (employeeId) {
      return employeeId;
    }
  }

  return null;
}

function resolveAuditEmployeeId(employeeId = null) {
  return normalizeEmployeeId(employeeId) || getCurrentAuditEmployeeId();
}

function isProgressSupervisorRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG"].includes(normalizeRoleCode(roleCode));
}

function canCreateProgressByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(
    normalizeRoleCode(roleCode)
  );
}

function canCreateTaskDailyReportByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(
    normalizeRoleCode(roleCode)
  );
}

function canUploadEvidenceByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(
    normalizeRoleCode(roleCode)
  );
}

function canOpenEvidenceByRole(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(normalizedRoleCode);
}

function canCreateFollowUpByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG"].includes(normalizeRoleCode(roleCode));
}

function canCompleteFollowUpByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(
    normalizeRoleCode(roleCode)
  );
}

function canReviewTaskDailyReportByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG"].includes(normalizeRoleCode(roleCode));
}

function canCreateTaskByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(normalizeRoleCode(roleCode));
}

function canManageTaskByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG"].includes(normalizeRoleCode(roleCode));
}

function canDeleteTaskByRole(roleCode) {
  return normalizeRoleCode(roleCode) === "ADMIN";
}

function normalizeWorkflowCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_");
}

function canMoveTaskKanbanByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG", "STAF"].includes(
    normalizeRoleCode(roleCode)
  );
}

function canMoveTaskKanbanTransitionByRole(roleCode, currentStatusCode, targetStatusCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if (["ADMIN", "KASI", "KASUBAG"].includes(normalizedRoleCode)) {
    return true;
  }

  if (normalizedRoleCode !== "STAF") {
    return false;
  }

  const allowedCodes = new Set(["BELUM_MULAI", "PROSES"]);
  return (
    allowedCodes.has(normalizeWorkflowCode(currentStatusCode)) &&
    allowedCodes.has(normalizeWorkflowCode(targetStatusCode))
  );
}

function canManageTaskApprovalByRole(roleCode) {
  return ["ADMIN", "KASI", "KASUBAG"].includes(normalizeRoleCode(roleCode));
}

function assertCanCreateTask() {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canCreateTaskByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk menambah task.");
  }
}

function assertCanManageTask() {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canManageTaskByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk mengubah task.");
  }
}

function assertCanManageTaskApproval() {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canManageTaskApprovalByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk melakukan approval task.");
  }
}

export async function getTasks() {
  const { data, error } = await supabase
    .from("vw_task_monitoring")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((task) => ({
    ...task,
    assignee_display_name:
      String(task?.assignee_nick_name || "").trim() ||
      String(task?.assignee_name || "").trim() ||
      null,
    assignee_nick_name: String(task?.assignee_nick_name || "").trim() || null,
    assignee_name: String(task?.assignee_name || "").trim() || null,
    sub_activity_name: String(task?.sub_activity_name || "").trim() || null,
    sub_activity_code: String(task?.sub_activity_code || "").trim() || null,
    task_title: String(task?.task_title || "").trim() || null,
    task_status_code: String(task?.task_status_code || "").trim() || null,
    task_status_name: String(task?.task_status_name || "").trim() || null,
    approval_status: String(task?.approval_status || "").trim() || null,
  }));
}

export async function getTrackingTasks() {
  const { data, error } = await supabase
    .from("vw_task_monitoring")
    .select(
      "task_id, task_title, task_status_code, task_status_name, approval_status, due_date, start_date, progress_percent, assignee_name, assignee_nick_name, assignee_employee_id, sub_activity_name, sub_activity_code"
    )
    .eq("approval_status", "approved")
    .neq("task_status_code", "dibatalkan")
    .lt("progress_percent", 100)
    .order("due_date", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((task) => ({
    ...task,
    assignee_display_name:
      String(task?.assignee_nick_name || "").trim() ||
      String(task?.assignee_name || "").trim() ||
      null,
    assignee_nick_name: String(task?.assignee_nick_name || "").trim() || null,
    assignee_name: String(task?.assignee_name || "").trim() || null,
    sub_activity_name: String(task?.sub_activity_name || "").trim() || null,
    sub_activity_code: String(task?.sub_activity_code || "").trim() || null,
    task_title: String(task?.task_title || "").trim() || null,
    task_status_code: String(task?.task_status_code || "").trim() || null,
    task_status_name: String(task?.task_status_name || "").trim() || null,
    approval_status: String(task?.approval_status || "").trim() || null,
  }));
}

export async function getTaskDailyReportTaskOptions() {
  const { data, error } = await supabase
    .from("vw_task_monitoring")
    .select(
      "task_id, task_title, task_status_code, task_status_name, approval_status, progress_percent, start_date, due_date, assignee_name, assignee_nick_name, assignee_employee_id, sub_activity_name, sub_activity_code, action_plan_id, action_plan_title"
    )
    .eq("approval_status", "approved")
    .neq("task_status_code", "dibatalkan")
    .lt("progress_percent", 100)
    .order("due_date", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((task) => ({
    ...task,
    assignee_display_name:
      String(task?.assignee_nick_name || "").trim() ||
      String(task?.assignee_name || "").trim() ||
      null,
    assignee_nick_name: String(task?.assignee_nick_name || "").trim() || null,
    assignee_name: String(task?.assignee_name || "").trim() || null,
    sub_activity_name: String(task?.sub_activity_name || "").trim() || null,
    sub_activity_code: String(task?.sub_activity_code || "").trim() || null,
    action_plan_id: task?.action_plan_id || null,
    action_plan_title: String(task?.action_plan_title || "").trim() || null,
    task_title: String(task?.task_title || "").trim() || null,
    task_status_code: String(task?.task_status_code || "").trim() || null,
    task_status_name: String(task?.task_status_name || "").trim() || null,
    approval_status: String(task?.approval_status || "").trim() || null,
  }));
}

export async function getTaskDailyReports(reportDate) {
  let query = supabase
    .from("vw_task_daily_reports")
    .select("*")
    .order("task_title", { ascending: true });

  if (reportDate) {
    query = query.eq("report_date", reportDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw error;
  }

  const dailyReports = data || [];
  const taskIds = Array.from(
    new Set(dailyReports.map((item) => item?.task_id).filter(Boolean))
  );
  const documentIds = Array.from(
    new Set(dailyReports.map((item) => item?.document_id).filter(Boolean))
  );

  let monitoringRows = [];
  let documentRows = [];

  if (taskIds.length > 0) {
    const { data: monitoringData, error: monitoringError } = await supabase
      .from("vw_task_monitoring")
      .select(
        "task_id, task_title, task_status_code, task_status_name, approval_status, due_date, start_date, progress_percent, assignee_name, assignee_nick_name, assignee_employee_id, sub_activity_name, sub_activity_code, action_plan_id, action_plan_title"
      )
      .in("task_id", taskIds);

    if (monitoringError) {
      console.error(monitoringError);
      throw monitoringError;
    }

    monitoringRows = monitoringData || [];
  }

  if (documentIds.length > 0) {
    const { data: docsData, error: docsError } = await supabase
      .from("documents")
      .select("id, title, file_name, file_url, storage_path")
      .in("id", documentIds);

    if (docsError) {
      console.error(docsError);
      throw docsError;
    }

    documentRows = docsData || [];
  }

  const monitoringMap = monitoringRows.reduce((map, item) => {
    map[String(item.task_id)] = {
      ...item,
      assignee_display_name:
        String(item?.assignee_nick_name || "").trim() ||
        String(item?.assignee_name || "").trim() ||
        null,
      assignee_nick_name: String(item?.assignee_nick_name || "").trim() || null,
      assignee_name: String(item?.assignee_name || "").trim() || null,
      sub_activity_name: String(item?.sub_activity_name || "").trim() || null,
      sub_activity_code: String(item?.sub_activity_code || "").trim() || null,
      action_plan_id: item?.action_plan_id || null,
      action_plan_title: String(item?.action_plan_title || "").trim() || null,
      task_title: String(item?.task_title || "").trim() || null,
      task_status_code: String(item?.task_status_code || "").trim() || null,
      task_status_name: String(item?.task_status_name || "").trim() || null,
      approval_status: String(item?.approval_status || "").trim() || null,
    };
    return map;
  }, {});

  const canOpenEvidence = canOpenEvidenceByRole(getCurrentAuthenticatedRoleCode());
  const documentMap = {};

  for (const document of documentRows) {
    const signedUrl = canOpenEvidence
      ? await createTaskEvidenceSignedUrl(document?.storage_path)
      : null;

    documentMap[String(document.id)] = {
      ...document,
      title: String(document?.title || "").trim() || null,
      file_name: String(document?.file_name || "").trim() || null,
      storage_path: String(document?.storage_path || "").trim() || null,
      file_url: canOpenEvidence
        ? signedUrl || document?.file_url || document?.storage_path || null
        : null,
    };
  }

  return dailyReports.map((item) => {
    const monitoringTask = monitoringMap[String(item?.task_id)] || {};
    const document = item?.document_id
      ? documentMap[String(item.document_id)] || null
      : null;

    return {
      ...monitoringTask,
      ...item,
      task_id: item?.task_id || monitoringTask?.task_id || null,
      task_title:
        String(item?.task_title || "").trim() ||
        String(monitoringTask?.task_title || "").trim() ||
        null,
      assignee_display_name:
        String(item?.assignee_nick_name || "").trim() ||
        String(item?.assignee_name || "").trim() ||
        String(monitoringTask?.assignee_display_name || "").trim() ||
        null,
      assignee_name:
        String(item?.assignee_name || "").trim() ||
        String(monitoringTask?.assignee_name || "").trim() ||
        null,
      assignee_nick_name:
        String(item?.assignee_nick_name || "").trim() ||
        String(monitoringTask?.assignee_nick_name || "").trim() ||
        null,
      sub_activity_name:
        String(item?.sub_activity_name || "").trim() ||
        String(monitoringTask?.sub_activity_name || "").trim() ||
        null,
      sub_activity_code:
        String(item?.sub_activity_code || "").trim() ||
        String(monitoringTask?.sub_activity_code || "").trim() ||
        null,
      action_plan_id: item?.action_plan_id || monitoringTask?.action_plan_id || null,
      action_plan_title:
        String(item?.action_plan_title || "").trim() ||
        String(monitoringTask?.action_plan_title || "").trim() ||
        null,
      task_status_code:
        String(item?.task_status_code || "").trim() ||
        String(monitoringTask?.task_status_code || "").trim() ||
        null,
      task_status_name:
        String(item?.task_status_name || "").trim() ||
        String(monitoringTask?.task_status_name || "").trim() ||
        null,
      approval_status:
        String(item?.approval_status || "").trim() ||
        String(monitoringTask?.approval_status || "").trim() ||
        null,
      progress_percent: Number(
        monitoringTask?.progress_percent ?? item?.task_progress_percent ?? 0
      ),
      created_by_employee_name:
        String(item?.created_by_employee_name || "").trim() || null,
      reviewed_by_employee_name:
        String(item?.reviewed_by_employee_name || "").trim() || null,
      review_status: String(item?.review_status || "").trim().toLowerCase() || "pending",
      work_summary: String(item?.work_summary || "").trim() || "",
      document_link: String(item?.document_link || "").trim() || null,
      daily_document: document,
    };
  });
}

export async function getTaskDailyReportsGroupedByTask() {
  const dailyReports = await getTaskDailyReports();
  const groupedReports = {};

  dailyReports.forEach((report) => {
    const taskId = String(report?.task_id || "").trim();
    if (!taskId) {
      return;
    }

    if (!groupedReports[taskId]) {
      groupedReports[taskId] = {
        task_id: report?.task_id || null,
        task_title: report?.task_title || null,
        assignee_display_name:
          report?.assignee_display_name || report?.assignee_name || null,
        assignee_name: report?.assignee_name || null,
        assignee_nick_name: report?.assignee_nick_name || null,
        sub_activity_name: report?.sub_activity_name || null,
        sub_activity_code: report?.sub_activity_code || null,
        action_plan_id: report?.action_plan_id || null,
        action_plan_title: report?.action_plan_title || null,
        task_status_code: report?.task_status_code || null,
        task_status_name: report?.task_status_name || null,
        approval_status: report?.approval_status || null,
        start_date: report?.start_date || null,
        due_date: report?.due_date || null,
        progress_percent: Number(report?.progress_percent || 0),
        sub_tasks: [],
      };
    }

    groupedReports[taskId].sub_tasks.push(report);
  });

  return Object.values(groupedReports)
    .map((group) => {
      const subTasks = [...group.sub_tasks].sort((firstItem, secondItem) => {
        const firstTime = new Date(firstItem?.report_date || 0).getTime();
        const secondTime = new Date(secondItem?.report_date || 0).getTime();
        return secondTime - firstTime;
      });
      const reviewedCount = subTasks.filter(
        (item) => String(item?.review_status || "").trim().toLowerCase() === "reviewed"
      ).length;

      return {
        ...group,
        sub_tasks: subTasks,
        sub_task_count: subTasks.length,
        reviewed_sub_task_count: reviewedCount,
        pending_sub_task_count: subTasks.length - reviewedCount,
        latest_report_date: subTasks[0]?.report_date || null,
      };
    })
    .sort((firstGroup, secondGroup) => {
      const firstLatestTime = new Date(firstGroup?.latest_report_date || 0).getTime();
      const secondLatestTime = new Date(secondGroup?.latest_report_date || 0).getTime();

      if (firstLatestTime !== secondLatestTime) {
        return secondLatestTime - firstLatestTime;
      }

      return String(firstGroup?.task_title || "").localeCompare(
        String(secondGroup?.task_title || ""),
        "id"
      );
    });
}

export async function getKanbanTasks() {
  const { data, error } = await supabase
    .from("vw_task_monitoring")
    .select(
      "task_id, task_code, task_title, task_status_code, task_status_name, approval_status, due_date, start_date, progress_percent, assignee_name, assignee_nick_name, assignee_employee_id, sub_activity_code, sub_activity_name"
    )
    .eq("approval_status", "approved")
    .neq("task_status_code", "dibatalkan")
    .order("due_date", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((task) => ({
    ...task,
    assignee_display_name:
      String(task?.assignee_nick_name || "").trim() ||
      String(task?.assignee_name || "").trim() ||
      null,
    assignee_employee_id: normalizeEmployeeId(task?.assignee_employee_id),
    assignee_nick_name: String(task?.assignee_nick_name || "").trim() || null,
    assignee_name: String(task?.assignee_name || "").trim() || null,
    sub_activity_name: String(task?.sub_activity_name || "").trim() || null,
    sub_activity_code: String(task?.sub_activity_code || "").trim() || null,
    task_title: String(task?.task_title || "").trim() || null,
    task_status_code: String(task?.task_status_code || "").trim() || null,
    task_status_name: String(task?.task_status_name || "").trim() || null,
    approval_status: String(task?.approval_status || "").trim() || null,
  }));
}

export async function getTimelineTasks() {
  const { data, error } = await supabase
    .from("vw_task_monitoring")
    .select(
      "task_id, task_title, start_date, due_date, progress_percent, task_status_name, task_status_code, approval_status, assignee_name, assignee_nick_name, sub_activity_name, sub_activity_code"
    )
    .eq("approval_status", "approved")
    .neq("task_status_code", "dibatalkan")
    .order("start_date", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((task) => ({
    ...task,
    assignee_display_name:
      String(task?.assignee_nick_name || "").trim() ||
      String(task?.assignee_name || "").trim() ||
      null,
    assignee_nick_name: String(task?.assignee_nick_name || "").trim() || null,
    assignee_name: String(task?.assignee_name || "").trim() || null,
    sub_activity_name: String(task?.sub_activity_name || "").trim() || null,
    sub_activity_code: String(task?.sub_activity_code || "").trim() || null,
  }));
}

export async function getTaskStatuses() {
  const { data, error } = await supabase
    .from("master_statuses")
    .select("id, code, name, sort_order, is_active")
    .eq("category", "task")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function getTaskPriorities() {
  const { data, error } = await supabase
    .from("master_priorities")
    .select("id, code, name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function getActionPlans() {
  const { data, error } = await supabase
    .from("action_plans")
    .select("id, title, employee_id, employees(full_name, nick_name)")
    .order("title", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((item) => ({
    ...item,
    employee_nick_name: Array.isArray(item.employees)
      ? item.employees[0]?.nick_name || null
      : item.employees?.nick_name || null,
    employee_name: Array.isArray(item.employees)
      ? item.employees[0]?.full_name || null
      : item.employees?.full_name || null,
    employee_display_name:
      (Array.isArray(item.employees)
        ? item.employees[0]?.nick_name || item.employees[0]?.full_name
        : item.employees?.nick_name || item.employees?.full_name) || null,
  }));
}

export async function getEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, nick_name, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((employee) => ({
    ...employee,
    full_name: String(employee?.full_name || "").trim() || null,
    nick_name: String(employee?.nick_name || "").trim() || null,
    display_name:
      String(employee?.nick_name || "").trim() ||
      String(employee?.full_name || "").trim() ||
      null,
  }));
}

export async function getTaskEvidenceRequests(taskIds = []) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("task_evidence_requests")
    .select("task_id, request_name");
  query = query.in("task_id", taskIds);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function getTaskEditData(taskId) {
  const [{ data: taskData, error: taskError }, { data: assignmentData, error: assignmentError }, { data: evidenceRequestData, error: evidenceRequestError }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, action_plan_id, title, description, start_date, due_date, status_id, priority_id"
        )
        .eq("id", taskId)
        .single(),
      supabase
        .from("task_assignments")
        .select("employee_id")
        .eq("task_id", taskId)
        .order("is_primary", { ascending: false })
        .limit(1),
      supabase
        .from("task_evidence_requests")
        .select("request_name")
        .eq("task_id", taskId),
    ]);

  if (taskError) {
    console.error(taskError);
    throw taskError;
  }

  if (assignmentError) {
    console.error(assignmentError);
    throw assignmentError;
  }

  if (evidenceRequestError) {
    console.error(evidenceRequestError);
    throw evidenceRequestError;
  }

  return {
    ...taskData,
    assignee_id: assignmentData?.[0]?.employee_id || "",
    evidence_request: (evidenceRequestData || [])
      .map((item) => item.request_name)
      .filter(Boolean)
      .join("\n"),
  };
}

const TASK_EVIDENCE_BUCKET = "task-evidences";
const TASK_EVIDENCE_SIGNED_URL_TTL = 60 * 60;

async function createTaskEvidenceSignedUrl(storagePath) {
  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, TASK_EVIDENCE_SIGNED_URL_TTL);

  if (error) {
    console.error("Gagal membuat signed URL eviden", {
      storagePath,
      error,
    });
    return null;
  }

  return data?.signedUrl || null;
}

async function createDocumentFromUploadedFile({
  title,
  description = null,
  file,
  storagePath,
  uploadedByEmployeeId = null,
}) {
  const actorEmployeeId = resolveAuditEmployeeId(uploadedByEmployeeId);

  const { error: uploadError } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload file dokumen gagal", {
      bucketName: TASK_EVIDENCE_BUCKET,
      storagePath,
      fileName: file?.name,
      uploadError,
    });
    throw new Error(`Upload storage gagal: ${uploadError.message}`);
  }

  const fileName = file?.name || "";
  const fileExtension = fileName.includes(".")
    ? fileName.split(".").pop().toLowerCase()
    : "";
  const fileUrl = await createTaskEvidenceSignedUrl(storagePath);

  try {
    const { data: insertedDocumentData, error: documentError } = await supabase
      .from("documents")
      .insert([
        {
          title,
          description,
          file_name: fileName,
          file_extension: fileExtension,
          mime_type: file?.type || null,
          file_size: file?.size || null,
          storage_path: storagePath,
          file_url: fileUrl,
          uploaded_by_employee_id: actorEmployeeId,
        },
      ])
      .select()
      .single();

    if (documentError) {
      console.error(documentError);
      throw documentError;
    }

    return insertedDocumentData;
  } catch (error) {
    const { error: rollbackStorageError } = await supabase.storage
      .from(TASK_EVIDENCE_BUCKET)
      .remove([storagePath]);

    if (rollbackStorageError) {
      console.error("Rollback storage dokumen gagal", rollbackStorageError);
    }

    throw error;
  }
}

async function deleteDocumentById(documentId) {
  if (!documentId) {
    return;
  }

  const { data: documentData, error: documentError } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    console.error("Gagal mengambil dokumen untuk cleanup", documentError);
    return;
  }

  if (!documentData?.id) {
    return;
  }

  const { error: deleteDocumentError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteDocumentError) {
    console.error("Gagal menghapus metadata dokumen", deleteDocumentError);
    return;
  }

  if (documentData.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(TASK_EVIDENCE_BUCKET)
      .remove([documentData.storage_path]);

    if (storageError) {
      console.error("Gagal menghapus file storage dokumen", storageError);
    }
  }
}

async function attachTaskEvidenceUrls(taskDocuments = []) {
  const canOpenEvidence = canOpenEvidenceByRole(getCurrentAuthenticatedRoleCode());

  return Promise.all(
    taskDocuments.map(async (item) => {
      const document = Array.isArray(item.documents) ? item.documents[0] : item.documents;
      const signedUrl = canOpenEvidence
        ? await createTaskEvidenceSignedUrl(document?.storage_path)
        : null;

      return {
        ...item,
        document: {
          ...document,
          file_url: canOpenEvidence
            ? signedUrl || document?.file_url || document?.storage_path || null
            : null,
        },
      };
    })
  );
}

export async function getTaskDocuments(taskIds = []) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("task_documents")
    .select(
      "task_id, created_at, documents(id, title, file_name, file_url, storage_path)"
    )
    .order("created_at", { ascending: false });
  query = query.in("task_id", taskIds);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw error;
  }

  return attachTaskEvidenceUrls(data || []);
}

export async function getExistingTaskDailyReport(taskId, reportDate) {
  const { data, error } = await supabase
    .from("task_daily_reports")
    .select(
      "id, task_id, report_date, work_summary, document_id, document_link, review_status, review_notes, reviewed_at, reviewed_by_employee_id, created_by_employee_id"
    )
    .eq("task_id", taskId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data || null;
}

export async function updateTaskDailyReportReviewStatus(
  reportId,
  { reviewStatus = "reviewed", reviewNotes = null } = {}
) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canReviewTaskDailyReportByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk memeriksa sub task.");
  }

  const normalizedReviewStatus = String(reviewStatus || "").trim().toLowerCase();
  if (!["pending", "reviewed"].includes(normalizedReviewStatus)) {
    throw new Error("Status pemeriksaan sub task tidak valid.");
  }

  const actorEmployeeId = getCurrentAuditEmployeeId();
  const isReviewed = normalizedReviewStatus === "reviewed";

  const payload = {
    review_status: normalizedReviewStatus,
    review_notes: String(reviewNotes || "").trim() || null,
    reviewed_at: isReviewed ? new Date().toISOString() : null,
    reviewed_by_employee_id: isReviewed ? actorEmployeeId : null,
  };

  const { data, error } = await supabase
    .from("task_daily_reports")
    .update(payload)
    .eq("id", reportId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

function mapTaskFollowUpActors(data = []) {
  return (data || []).map((item) => ({
    ...item,
    created_by_employee_name:
      (Array.isArray(item.created_by_employee)
        ? item.created_by_employee[0]?.full_name
        : item.created_by_employee?.full_name) || null,
    followed_up_by_employee_name:
      (Array.isArray(item.followed_up_by_employee)
        ? item.followed_up_by_employee[0]?.full_name
        : item.followed_up_by_employee?.full_name) || null,
  }));
}

export async function getTaskFollowUps(taskId) {
  if (!taskId) {
    return [];
  }

  let query = supabase
    .from("task_follow_ups")
    .select(
      `
        *,
        created_by_employee:employees!task_follow_ups_created_by_employee_id_fkey(full_name),
        followed_up_by_employee:employees!task_follow_ups_followed_up_by_employee_id_fkey(full_name)
      `
    )
    .order("created_at", { ascending: false });

  if (taskId) {
    query = query.eq("task_id", taskId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw error;
  }

  return mapTaskFollowUpActors(data || []);
}

export async function getTaskFollowUpsByTaskIds(taskIds = []) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("task_follow_ups")
    .select(
      `
        *,
        created_by_employee:employees!task_follow_ups_created_by_employee_id_fkey(full_name),
        followed_up_by_employee:employees!task_follow_ups_followed_up_by_employee_id_fkey(full_name)
      `
    )
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw error;
  }

  return mapTaskFollowUpActors(data || []);
}

export async function getTaskFollowUpIndicatorsByTaskIds(taskIds = []) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("task_follow_ups")
    .select("task_id, is_followed_up")
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function getTaskKanbanColumns() {
  const { data, error } = await supabase
    .from("kanban_columns")
    .select("*")
    .eq("module_name", "task")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function getTaskKanbanCards() {
  const { data, error } = await supabase
    .from("kanban_cards")
    .select("*")
    .eq("entity_type", "task")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

async function updateTaskKanbanCardPosition(cardId, columnId, sortOrder) {
  const { data, error } = await supabase
    .from("kanban_cards")
    .update({
      column_id: columnId,
      sort_order: sortOrder,
    })
    .eq("id", cardId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

async function syncTaskStatusWithKanbanColumn(taskId, columnId) {
  const { data: columnData, error: columnError } = await supabase
    .from("kanban_columns")
    .select("id, code")
    .eq("id", columnId)
    .maybeSingle();

  if (columnError) {
    console.error(columnError);
    throw columnError;
  }

  const columnCode = columnData?.code;
  if (!columnCode) {
    return null;
  }

  const { data: statusData, error: statusError } = await supabase
    .from("master_statuses")
    .select("id, code")
    .eq("category", "task")
    .eq("code", columnCode)
    .maybeSingle();

  if (statusError) {
    console.error(statusError);
    throw statusError;
  }

  if (!statusData?.id) {
    return null;
  }

  const { data, error } = await supabase.rpc("move_task_kanban", {
    p_task_id: taskId,
    p_status_id: statusData.id,
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function moveTaskKanbanCard({
  taskId,
  cardId,
  targetColumnId,
  targetSortOrder,
}) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  const actorEmployeeId = getCurrentAuthenticatedEmployeeId();
  if (!canMoveTaskKanbanByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk memindahkan task di kanban.");
  }

  const [
    { data: currentCard, error: currentCardError },
    { data: currentTask, error: currentTaskError },
    { data: targetColumn, error: targetColumnError },
    { data: taskContext, error: taskContextError },
  ] =
    await Promise.all([
      supabase
        .from("kanban_cards")
        .select("id, column_id, sort_order")
        .eq("id", cardId)
        .single(),
      supabase.from("tasks").select("id, status_id").eq("id", taskId).single(),
      supabase.from("kanban_columns").select("id, code").eq("id", targetColumnId).single(),
      supabase
        .from("vw_task_monitoring")
        .select("task_id, assignee_employee_id")
        .eq("task_id", taskId)
        .maybeSingle(),
    ]);

  if (currentCardError) {
    console.error(currentCardError);
    throw currentCardError;
  }

  if (currentTaskError) {
    console.error(currentTaskError);
    throw currentTaskError;
  }

  if (targetColumnError) {
    console.error(targetColumnError);
    throw targetColumnError;
  }

  if (taskContextError) {
    console.error(taskContextError);
    throw taskContextError;
  }

  const currentStatusCode = await getTaskStatusCode(currentTask?.status_id);
  const targetColumnCode = targetColumn?.code || null;

  if (!canMoveTaskKanbanTransitionByRole(roleCode, currentStatusCode, targetColumnCode)) {
    throw new Error(
      "Role Anda hanya boleh memindahkan task pada area Belum Mulai dan Proses."
    );
  }

  if (
    normalizeRoleCode(roleCode) === "STAF" &&
    normalizeEmployeeId(taskContext?.assignee_employee_id) !==
      normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error("Anda hanya dapat memindahkan task yang ditugaskan kepada Anda.");
  }

  const updatedCard = await updateTaskKanbanCardPosition(
    cardId,
    targetColumnId,
    targetSortOrder
  );

  try {
    await syncTaskStatusWithKanbanColumn(taskId, targetColumnId);
    return updatedCard;
  } catch (error) {
    try {
      await updateTaskKanbanCardPosition(
        cardId,
        currentCard.column_id,
        currentCard.sort_order
      );
    } catch (rollbackError) {
      console.error("Rollback move task kanban gagal", rollbackError);
    }

    throw error;
  }
}

async function getTaskStatusCode(statusId) {
  if (!statusId) {
    return null;
  }

  const { data, error } = await supabase
    .from("master_statuses")
    .select("id, code")
    .eq("id", statusId)
    .eq("category", "task")
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data?.code || null;
}

async function getTaskKanbanColumnByCode(statusCode) {
  if (!statusCode) {
    return null;
  }

  const { data, error } = await supabase
    .from("kanban_columns")
    .select("id, code, module_name")
    .eq("module_name", "task")
    .eq("code", statusCode)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data || null;
}

async function getLastTaskKanbanSortOrder(columnId) {
  const { data, error } = await supabase
    .from("kanban_cards")
    .select("sort_order")
    .eq("entity_type", "task")
    .eq("column_id", columnId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    throw error;
  }

  return Number(data?.[0]?.sort_order || 0);
}

async function getCurrentTaskKanbanCard(taskId) {
  const { data: currentCard, error: currentCardError } = await supabase
    .from("kanban_cards")
    .select("id, column_id, sort_order")
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .maybeSingle();

  if (currentCardError) {
    console.error(currentCardError);
    throw currentCardError;
  }

  return currentCard || null;
}

async function removeTaskKanbanCard(taskId) {
  const currentCard = await getCurrentTaskKanbanCard(taskId);
  if (!currentCard?.id) {
    return null;
  }

  const { error } = await supabase
    .from("kanban_cards")
    .delete()
    .eq("id", currentCard.id);

  if (error) {
    console.error(error);
    throw error;
  }

  return currentCard;
}

async function syncTaskKanbanCard(taskId, statusId, approvalStatus) {
  if (!taskId || !statusId) {
    return null;
  }

  const statusCode = await getTaskStatusCode(statusId);
  if (!statusCode) {
    return null;
  }

  const normalizedApprovalStatus = String(approvalStatus || "").toLowerCase();
  const normalizedStatusCode = String(statusCode || "").toLowerCase();

  if (
    normalizedApprovalStatus !== "approved" ||
    normalizedStatusCode === "dibatalkan"
  ) {
    return removeTaskKanbanCard(taskId);
  }

  const targetColumn = await getTaskKanbanColumnByCode(statusCode);
  if (!targetColumn?.id) {
    return null;
  }

  const currentCard = await getCurrentTaskKanbanCard(taskId);
  if (currentCard?.column_id === targetColumn.id) {
    return currentCard;
  }

  const nextSortOrder = (await getLastTaskKanbanSortOrder(targetColumn.id)) + 1;

  if (currentCard?.id) {
    const { data, error } = await supabase
      .from("kanban_cards")
      .update({
        column_id: targetColumn.id,
        sort_order: nextSortOrder,
      })
      .eq("id", currentCard.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("kanban_cards")
    .insert([
      {
        entity_type: "task",
        entity_id: taskId,
        column_id: targetColumn.id,
        sort_order: nextSortOrder,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}
export async function deleteTask(taskId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canDeleteTaskByRole(roleCode)) {
    throw new Error("Hanya ADMIN yang boleh menghapus task.");
  }

  const { error } = await supabase.rpc("delete_task_safe", {
    p_task_id: taskId,
  });

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function createTaskWithRelations(payload) {
  assertCanCreateTask();

  const { data: createdTask, error } = await supabase.rpc(
    "create_task_with_relations",
    { p_payload: payload }
  );

  if (error) {
    console.error("RPC create_task_with_relations gagal:", error);
    throw error;
  }

  if (createdTask?.id) {
    try {
      await syncTaskKanbanCard(
        createdTask.id,
        createdTask.status_id,
        createdTask.approval_status
      );
    } catch (kanbanError) {
      console.error("Failed to sync kanban card after RPC creation", kanbanError);
    }
  }

  return createdTask;
}

export async function updateTaskWithRelations(taskId, payload) {
  assertCanManageTask();
  const { data: currentTask, error: currentTaskError } = await supabase
    .from("tasks")
    .select("status_id, approval_status")
    .eq("id", taskId)
    .single();

  if (currentTaskError) {
    console.error(currentTaskError);
    throw currentTaskError;
  }


  const { data: updatedTask, error: taskError } = await supabase.rpc(
    "update_task_with_relations",
    {
      p_task_id: taskId,
      p_payload: payload,
    }
  );

  if (taskError) {
    console.error("RPC update_task_with_relations gagal:", taskError);
    throw taskError;
  }

  // sync kanban card only if needed
  if (
    currentTask.status_id !== payload.status_id ||
    currentTask.approval_status === "approved"
  ) {
    await syncTaskKanbanCard(
      taskId,
      updatedTask.status_id,
      updatedTask.approval_status
    );
  }

  return updatedTask;
}

export async function createTaskFollowUp(payload) {
  const createdByEmployeeId = resolveAuditEmployeeId(
    payload.created_by_employee_id
  );
  await assertCanCreateTaskFollowUp(payload.task_id, createdByEmployeeId);

  const { data, error } = await supabase.rpc("manage_task_follow_up", {
    p_action: "create",
    p_task_id: payload.task_id,
    p_follow_up_id: null,
    p_payload: {
      note_text: payload.note_text,
      notes: payload.notes ?? null,
    },
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function rejectTaskWithReason(taskId, reason, actedByEmployeeId = null) {
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) {
    throw new Error("Alasan penolakan wajib diisi.");
  }

  return rejectTask(taskId, {
    actedByEmployeeId,
    notes: trimmedReason,
  });
}

function sanitizeFileName(fileName) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function uploadTaskEvidence({
  taskId,
  title,
  description,
  file,
  uploadedByEmployeeId = null,
}) {
  const actorEmployeeId = resolveAuditEmployeeId(uploadedByEmployeeId);
  await assertCanUploadTaskEvidence(taskId, actorEmployeeId);
  const timestamp = Date.now();
  const originalFileName = sanitizeFileName(file.name || "evidence-file");
  const storagePath = `tasks/${taskId}/${timestamp}-${originalFileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload eviden failed", {
      bucketName: TASK_EVIDENCE_BUCKET,
      storagePath,
      fileName: file.name,
      uploadError,
    });
    throw new Error(`Upload storage gagal: ${uploadError.message}`);
  }

  const fileName = file.name;
  const fileExtension = fileName.includes(".")
    ? fileName.split(".").pop().toLowerCase()
    : "";
  const fileUrl = await createTaskEvidenceSignedUrl(storagePath);

  let documentData = null;

  try {
    const { data: insertedDocumentData, error: documentError } = await supabase
      .from("documents")
      .insert([
        {
          title,
          description,
          file_name: fileName,
          file_extension: fileExtension,
          mime_type: file.type || null,
          file_size: file.size,
          storage_path: storagePath,
          file_url: null,
          uploaded_at: new Date().toISOString(),
          uploaded_by_employee_id: actorEmployeeId,
        },
      ])
      .select()
      .single();

    if (documentError) {
      console.error(documentError);
      throw documentError;
    }

    documentData = insertedDocumentData;

    const { data: rpcData, error: taskDocumentError } = await supabase.rpc(
      "create_task_progress_with_evidence",
      {
        p_task_id: taskId,
        p_payload: { document_id: documentData.id },
      }
    );

    if (taskDocumentError) {
      console.error(taskDocumentError);
      throw taskDocumentError;
    }

    const taskDocumentData = { id: rpcData?.task_document_id, task_id: taskId, document_id: documentData.id };

    return {
      document: {
        ...documentData,
        file_url: fileUrl || documentData.storage_path || null,
      },
      taskDocument: taskDocumentData,
      storagePath,
      fileUrl,
      uploadData,
    };
  } catch (error) {
    if (documentData?.id) {
      const { error: rollbackDocumentError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentData.id);

      if (rollbackDocumentError) {
        console.error("Rollback metadata eviden gagal", rollbackDocumentError);
      }
    }

    const { error: rollbackStorageError } = await supabase.storage
      .from(TASK_EVIDENCE_BUCKET)
      .remove([storagePath]);

    if (rollbackStorageError) {
      console.error("Rollback file eviden gagal", rollbackStorageError);
    }

    throw error;
  }
}

export async function deleteTaskEvidence(taskId, documentId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!isProgressSupervisorRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk menghapus eviden.");
  }

  const { data, error } = await supabase.rpc("delete_task_evidence_safe", {
    p_task_id: taskId,
    p_document_id: documentId,
  });

  if (error) {
    console.error(error);
    throw error;
  }

  if (data?.document_deleted && data?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(TASK_EVIDENCE_BUCKET)
      .remove([data.storage_path]);

    if (storageError) {
      console.error(storageError);
      throw new Error(`Gagal menghapus file eviden: ${storageError.message}`);
    }
  }

  return {
    taskDocumentId: data?.task_document_id || null,
    documentId: data?.document_id || documentId,
  };
}

export async function getExistingTaskProgressReport(taskId, reportDate) {
  const { data, error } = await supabase
    .from("task_progress_reports")
    .select(
      "id, task_id, report_date, progress_percent, result_summary, issue_summary, next_step_summary, reported_by_employee_id"
    )
    .eq("task_id", taskId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function getTaskProgressReports(taskId) {
  let query = supabase
    .from("task_progress_reports")
    .select(
      "id, task_id, report_date, created_at, progress_percent, result_summary, issue_summary, next_step_summary, reported_by_employee_id"
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (taskId) {
    query = query.eq("task_id", taskId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

async function getLatestTaskProgressReport(taskId) {
  const { data, error } = await supabase
    .from("task_progress_reports")
    .select("id, task_id, report_date, created_at, progress_percent")
    .eq("task_id", taskId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data || null;
}

async function validateTaskProgressSubmission(taskId, nextProgressPercent) {
  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select("id, approval_status, status_id, progress_percent")
    .eq("id", taskId)
    .single();

  if (taskError) {
    console.error(taskError);
    throw taskError;
  }

  const normalizedApprovalStatus = String(
    taskData?.approval_status || ""
  ).toLowerCase();

  if (normalizedApprovalStatus === "rejected") {
    throw new Error("Progress tidak dapat diisi karena task ditolak.");
  }

  const statusCode = await getTaskStatusCode(taskData?.status_id);
  if (String(statusCode || "").toLowerCase() === "dibatalkan") {
    throw new Error("Progress tidak dapat diisi karena task dibatalkan.");
  }

  const currentProgress = Number(taskData?.progress_percent || 0);
  if (Number(nextProgressPercent) < currentProgress) {
    throw new Error(
      "Progress baru tidak boleh lebih kecil dari progress saat ini."
    );
  }

  return taskData;
}

async function getTaskProgressAuthorizationContext(taskId) {
  const { data, error } = await supabase
    .from("vw_task_monitoring")
    .select("task_id, assignee_employee_id, approval_status, task_status_code")
    .eq("task_id", taskId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw error;
  }

  return data || null;
}

async function assertCanCreateTaskProgress(taskId, actorEmployeeId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canCreateProgressByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk menambah progress report.");
  }

  if (normalizeRoleCode(roleCode) !== "STAF") {
    return;
  }

  const taskContext = await getTaskProgressAuthorizationContext(taskId);
  if (!taskContext?.task_id) {
    throw new Error("Task tidak ditemukan untuk validasi progress.");
  }

  if (
    normalizeEmployeeId(taskContext.assignee_employee_id) !==
    normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error(
      "Anda hanya dapat mengisi progress untuk task yang ditugaskan kepada Anda."
    );
  }
}

function assertCanEditTaskProgressReport(currentReport, actorEmployeeId) {
  const roleCode = getCurrentAuthenticatedRoleCode();

  if (isProgressSupervisorRole(roleCode)) {
    return;
  }

  if (normalizeRoleCode(roleCode) !== "STAF") {
    throw new Error("Anda tidak memiliki izin untuk mengubah progress report.");
  }

  if (
    normalizeEmployeeId(currentReport?.reported_by_employee_id) !==
    normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error(
      "Anda hanya dapat mengubah progress report yang Anda buat sendiri."
    );
  }
}

async function assertCanUploadTaskEvidence(taskId, actorEmployeeId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canUploadEvidenceByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk upload eviden.");
  }

  if (normalizeRoleCode(roleCode) !== "STAF") {
    return;
  }

  const taskContext = await getTaskProgressAuthorizationContext(taskId);
  if (!taskContext?.task_id) {
    throw new Error("Task tidak ditemukan untuk validasi eviden.");
  }

  if (
    normalizeEmployeeId(taskContext.assignee_employee_id) !==
    normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error(
      "Anda hanya dapat upload eviden untuk task yang ditugaskan kepada Anda."
    );
  }
}

async function assertCanCreateTaskFollowUp(taskId, actorEmployeeId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canCreateFollowUpByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk membuat follow-up.");
  }

  if (normalizeRoleCode(roleCode) !== "STAF") {
    return;
  }

  const taskContext = await getTaskProgressAuthorizationContext(taskId);
  if (!taskContext?.task_id) {
    throw new Error("Task tidak ditemukan untuk validasi follow-up.");
  }

  if (
    normalizeEmployeeId(taskContext.assignee_employee_id) !==
    normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error(
      "Anda hanya dapat membuat follow-up untuk task yang ditugaskan kepada Anda."
    );
  }
}

async function assertCanCreateTaskDailyReport(taskId, actorEmployeeId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canCreateTaskDailyReportByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk membuat sub task.");
  }

  if (normalizeRoleCode(roleCode) !== "STAF") {
    return;
  }

  const taskContext = await getTaskProgressAuthorizationContext(taskId);
  if (!taskContext?.task_id) {
    throw new Error("Task tidak ditemukan untuk validasi sub task.");
  }

  if (
    normalizeEmployeeId(taskContext.assignee_employee_id) !==
    normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error(
      "Anda hanya dapat membuat sub task untuk task yang ditugaskan kepada Anda."
    );
  }
}

async function assertCanCompleteTaskFollowUp(followUpId, actorEmployeeId) {
  const roleCode = getCurrentAuthenticatedRoleCode();
  if (!canCompleteFollowUpByRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk menindaklanjuti follow-up.");
  }

  if (normalizeRoleCode(roleCode) !== "STAF") {
    return;
  }

  const { data, error } = await supabase
    .from("task_follow_ups")
    .select("id, task_id")
    .eq("id", followUpId)
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  const taskContext = await getTaskProgressAuthorizationContext(data.task_id);
  if (!taskContext?.task_id) {
    throw new Error("Task follow-up tidak ditemukan untuk validasi.");
  }

  if (
    normalizeEmployeeId(taskContext.assignee_employee_id) !==
    normalizeEmployeeId(actorEmployeeId)
  ) {
    throw new Error(
      "Anda hanya dapat menindaklanjuti follow-up pada task yang ditugaskan kepada Anda."
    );
  }
}

async function syncTaskProgress(taskId, progressPercent) {
  const { error } = await supabase
    .from("tasks")
    .update({ progress_percent: progressPercent })
    .eq("id", taskId);

  if (error) {
    console.error(error);
    throw error;
  }
}



export async function createTaskProgressReport(payload) {
  await validateTaskProgressSubmission(
    payload.task_id,
    payload.progress_percent
  );
  const reportedByEmployeeId = resolveAuditEmployeeId(
    payload.reported_by_employee_id
  );
  await assertCanCreateTaskProgress(payload.task_id, reportedByEmployeeId);

  const progressPayload = {
    progress_percent: payload.progress_percent,
    report_date: payload.report_date,
    result_summary: payload.result_summary,
    issue_summary: payload.issue_summary,
    next_step_summary: payload.next_step_summary,
    reported_by_employee_id: reportedByEmployeeId,
  };

  const { data: rpcData, error } = await supabase.rpc(
    "create_task_progress_with_evidence",
    {
      p_task_id: payload.task_id,
      p_payload: progressPayload,
    }
  );

  if (error) {
    console.error(error);
    throw error;
  }

  return { id: rpcData?.progress_report_id, task_id: payload.task_id, ...progressPayload };
}

export async function createTaskDailyReport({
  taskId,
  reportDate,
  workSummary,
  documentLink = null,
  file = null,
  createdByEmployeeId = null,
}) {
  const actorEmployeeId = resolveAuditEmployeeId(createdByEmployeeId);
  await assertCanCreateTaskDailyReport(taskId, actorEmployeeId);

  const existingReport = await getExistingTaskDailyReport(taskId, reportDate);
  if (existingReport?.id) {
    throw new Error("Sub task untuk task dan tanggal tersebut sudah ada.");
  }

  const trimmedWorkSummary = String(workSummary || "").trim();
  if (!trimmedWorkSummary) {
    throw new Error("Ringkasan pekerjaan harian wajib diisi.");
  }

  const trimmedDocumentLink = String(documentLink || "").trim() || null;
  let documentData = null;

  if (file) {
    const timestamp = Date.now();
    const originalFileName = sanitizeFileName(file.name || "daily-report-file");
    const storagePath = `task-daily-reports/${taskId}/${reportDate}/${timestamp}-${originalFileName}`;

    documentData = await createDocumentFromUploadedFile({
      title: `Sub Task ${reportDate} - ${taskId}`,
      description: trimmedWorkSummary,
      file,
      storagePath,
      uploadedByEmployeeId: actorEmployeeId,
    });
  }

  try {
    const { data, error } = await supabase
      .from("task_daily_reports")
      .insert([
        {
          task_id: taskId,
          report_date: reportDate,
          work_summary: trimmedWorkSummary,
          document_id: documentData?.id || null,
          document_link: documentData?.id ? null : trimmedDocumentLink,
          created_by_employee_id: actorEmployeeId,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      throw error;
    }

    return data;
  } catch (error) {
    if (documentData?.id) {
      await deleteDocumentById(documentData.id);
    }
    throw error;
  }
}

export async function updateTaskDailyReport(
  reportId,
  {
    taskId,
    reportDate,
    workSummary,
    documentLink = null,
    file = null,
    createdByEmployeeId = null,
    keepExistingDocument = false,
  }
) {
  const actorEmployeeId = resolveAuditEmployeeId(createdByEmployeeId);
  await assertCanCreateTaskDailyReport(taskId, actorEmployeeId);

  const { data: currentReport, error: currentReportError } = await supabase
    .from("task_daily_reports")
    .select(
      "id, task_id, report_date, work_summary, document_id, document_link, created_by_employee_id"
    )
    .eq("id", reportId)
    .single();

  if (currentReportError) {
    console.error(currentReportError);
    throw currentReportError;
  }

  const trimmedWorkSummary = String(workSummary || "").trim();
  if (!trimmedWorkSummary) {
    throw new Error("Ringkasan pekerjaan harian wajib diisi.");
  }

  if (
    currentReport.task_id !== taskId ||
    String(currentReport.report_date || "") !== String(reportDate || "")
  ) {
    const duplicateReport = await getExistingTaskDailyReport(taskId, reportDate);
    if (duplicateReport?.id && duplicateReport.id !== reportId) {
      throw new Error("Sub task untuk task dan tanggal tersebut sudah ada.");
    }
  }

  let nextDocumentId = currentReport.document_id || null;
  let nextDocumentLink = currentReport.document_link || null;
  let newDocumentData = null;

  if (file) {
    const timestamp = Date.now();
    const originalFileName = sanitizeFileName(file.name || "daily-report-file");
    const storagePath = `task-daily-reports/${taskId}/${reportDate}/${timestamp}-${originalFileName}`;

    newDocumentData = await createDocumentFromUploadedFile({
      title: `Sub Task ${reportDate} - ${taskId}`,
      description: trimmedWorkSummary,
      file,
      storagePath,
      uploadedByEmployeeId: actorEmployeeId,
    });

    nextDocumentId = newDocumentData.id;
    nextDocumentLink = null;
  } else {
    const trimmedDocumentLink = String(documentLink || "").trim() || null;

    if (trimmedDocumentLink) {
      nextDocumentId = null;
      nextDocumentLink = trimmedDocumentLink;
    } else if (!keepExistingDocument) {
      nextDocumentId = null;
      nextDocumentLink = null;
    }
  }

  try {
    const { data, error } = await supabase
      .from("task_daily_reports")
      .update({
        task_id: taskId,
        report_date: reportDate,
        work_summary: trimmedWorkSummary,
        document_id: nextDocumentId,
        document_link: nextDocumentLink,
      })
      .eq("id", reportId)
      .select()
      .single();

    if (error) {
      console.error(error);
      throw error;
    }

    if (
      currentReport.document_id &&
      currentReport.document_id !== nextDocumentId
    ) {
      await deleteDocumentById(currentReport.document_id);
    }

    return data;
  } catch (error) {
    if (newDocumentData?.id) {
      await deleteDocumentById(newDocumentData.id);
    }
    throw error;
  }
}

export async function updateTaskProgressReport(reportId, payload) {
  const currentTask = await validateTaskProgressSubmission(
    payload.task_id,
    payload.progress_percent
  );
  const reportedByEmployeeId = resolveAuditEmployeeId(
    payload.reported_by_employee_id
  );
  const { data: currentReport, error: currentReportError } = await supabase
    .from("task_progress_reports")
    .select(
      "id, task_id, report_date, progress_percent, result_summary, issue_summary, next_step_summary, reported_by_employee_id"
    )
    .eq("id", reportId)
    .single();

  if (currentReportError) {
    console.error(currentReportError);
    throw currentReportError;
  }

  assertCanEditTaskProgressReport(currentReport, reportedByEmployeeId);

  const { data, error } = await supabase
    .from("task_progress_reports")
    .update({
      progress_percent: payload.progress_percent,
      result_summary: payload.result_summary,
      issue_summary: payload.issue_summary,
      next_step_summary: payload.next_step_summary,
      reported_by_employee_id: reportedByEmployeeId,
    })
    .eq("id", reportId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  try {
    const latestReport = await getLatestTaskProgressReport(payload.task_id);
    await syncTaskProgress(
      payload.task_id,
      Number(latestReport?.progress_percent ?? currentTask?.progress_percent ?? 0)
    );
  } catch (syncError) {
    try {
      await supabase
        .from("task_progress_reports")
        .update({
          progress_percent: currentReport.progress_percent,
          result_summary: currentReport.result_summary,
          issue_summary: currentReport.issue_summary,
          next_step_summary: currentReport.next_step_summary,
          reported_by_employee_id: currentReport.reported_by_employee_id,
        })
        .eq("id", reportId);

      await syncTaskProgress(
        payload.task_id,
        Number(currentTask?.progress_percent || 0)
      );
    } catch (rollbackError) {
      console.error("Rollback update progress report gagal", rollbackError);
    }

    throw syncError;
  }

  return data;
}

export async function deleteTaskProgressReport(reportId) {
  const actorEmployeeId = getCurrentAuditEmployeeId();
  const roleCode = getCurrentAuthenticatedRoleCode();

  if (!isProgressSupervisorRole(roleCode)) {
    throw new Error("Anda tidak memiliki izin untuk menghapus progress report.");
  }

  const { data: currentReport, error: currentReportError } = await supabase
    .from("task_progress_reports")
    .select(
      "id, task_id, report_date, progress_percent, result_summary, issue_summary, next_step_summary, reported_by_employee_id, created_at"
    )
    .eq("id", reportId)
    .single();

  if (currentReportError) {
    console.error(currentReportError);
    throw currentReportError;
  }

  const { data: currentTask, error: currentTaskError } = await supabase
    .from("tasks")
    .select("id, progress_percent")
    .eq("id", currentReport.task_id)
    .single();

  if (currentTaskError) {
    console.error(currentTaskError);
    throw currentTaskError;
  }

  const { error: deleteError } = await supabase
    .from("task_progress_reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) {
    console.error(deleteError);
    throw deleteError;
  }

  try {
    const latestReport = await getLatestTaskProgressReport(currentReport.task_id);
    await syncTaskProgress(
      currentReport.task_id,
      Number(latestReport?.progress_percent ?? 0)
    );
  } catch (syncError) {
    try {
      await supabase.from("task_progress_reports").insert([
        {
          ...currentReport,
          reported_by_employee_id:
            currentReport.reported_by_employee_id || actorEmployeeId || null,
        },
      ]);

      await syncTaskProgress(
        currentReport.task_id,
        Number(currentTask?.progress_percent || 0)
      );
    } catch (rollbackError) {
      console.error("Rollback delete progress report gagal", rollbackError);
    }

    throw syncError;
  }

  return {
    id: currentReport.id,
    task_id: currentReport.task_id,
  };
}

export async function updateTaskFollowUpStatus(
  followUpId,
  isFollowedUp,
  followedUpByEmployeeId = null
) {
  const actorEmployeeId = resolveAuditEmployeeId(followedUpByEmployeeId);

  if (isFollowedUp) {
    await assertCanCompleteTaskFollowUp(followUpId, actorEmployeeId);
  } else {
    const roleCode = getCurrentAuthenticatedRoleCode();
    if (!["ADMIN", "KASI", "KASUBAG"].includes(normalizeRoleCode(roleCode))) {
      throw new Error(
        "Anda tidak memiliki izin untuk membatalkan status follow-up selesai."
      );
    }
  }

  const { data, error } = await supabase.rpc("manage_task_follow_up", {
    p_action: "update_status",
    p_task_id: null,
    p_follow_up_id: followUpId,
    p_payload: {
      is_followed_up: isFollowedUp,
    },
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function approveTask(
  taskId,
  { notes = null } = {}
) {
  assertCanManageTaskApproval();

  const { data: updatedTask, error } = await supabase.rpc(
    "set_task_approval_status",
    {
      p_task_id: taskId,
      p_approval_status: "approved",
      p_notes: String(notes || "").trim() || null,
    }
  );

  if (error) {
    console.error(error);
    throw error;
  }

  try {
    await syncTaskKanbanCard(
      updatedTask.id,
      updatedTask.status_id,
      updatedTask.approval_status
    );
  } catch (syncError) {
    console.error("Gagal sinkronisasi Kanban paska approve", syncError);
  }

  return updatedTask;
}

export async function rejectTask(
  taskId,
  { notes = null } = {}
) {
  assertCanManageTaskApproval();

  const { data: updatedTask, error } = await supabase.rpc(
    "set_task_approval_status",
    {
      p_task_id: taskId,
      p_approval_status: "rejected",
      p_notes: String(notes || "").trim() || null,
    }
  );

  if (error) {
    console.error(error);
    throw error;
  }

  try {
    await syncTaskKanbanCard(
      updatedTask.id,
      updatedTask.status_id,
      updatedTask.approval_status
    );
  } catch (syncError) {
    console.error("Gagal sinkronisasi Kanban paska reject", syncError);
  }

  return updatedTask;
}
