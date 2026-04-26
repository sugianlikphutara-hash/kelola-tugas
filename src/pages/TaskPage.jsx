import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  canCreateTask,
  canDeleteTask,
  canEditTask,
  canManageTaskApproval,
} from "../lib/authorization";
import {
  approveTask,
  createTaskWithRelations,
  deleteTask,
  getActionPlans,
  getEmployees,
  getTaskDocuments,
  getTaskEditData,
  getTaskEvidenceRequests,
  getTaskPriorities,
  getTasks,
  getTaskStatuses,
  rejectTaskWithReason,
  updateTaskWithRelations,
} from "../services/taskService";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import ConfirmActionModal from "../components/ui/ConfirmActionModal";
import { getCompactText } from "../lib/text";
import {
  getAlertStyle,
  getChipStyle,
  getDangerButtonStyle,
  getDangerOutlinedButtonStyle,
  getFieldLabelStyle,
  getOutlinedButtonStyle,
  getOverlayStyle,
  getPanelStyle,
  getNeutralButtonStyle,
  getMenuItemButtonStyle,
  getMenuTriggerButtonStyle,
  getLoadingStateStyle,
  getModalStyle,
  getPopoverStyle,
  getPrimaryButtonStyle,
  getSelectStyle,
  getSuccessButtonStyle,
  getTableBodyCellStyle,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTableCellLabelTypography,
  getTableTaskColumnWidthStyle,
  getTableTaskTitleClampClassName,
  getTableTaskTitleCharLimit,
  getTextInputStyle,
  getDateInputStyle,
  getSectionTitleTypography,
  getFormLabelTypography,
  getPageTitleStyle,
} from "../lib/controlStyles";

function createDefaultForm(actionPlans, employees, statuses, priorities) {
  return {
    action_plan_id: actionPlans[0]?.id || "",
    assignee_id: employees[0]?.id || "",
    title: "",
    description: "",
    start_date: "",
    due_date: "",
    status_id: statuses[0]?.id || "",
    priority_id: priorities[0]?.id || "",
    evidence_request: "",
  };
}

function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatActionPlanLabel(actionPlan) {
  const title = actionPlan?.title || "-";
  const employeeName =
    actionPlan?.employee_display_name ||
    actionPlan?.employee_nick_name ||
    actionPlan?.employee_name ||
    "Tanpa Pelaksana";
  return `${title} — ${employeeName}`;
}

function formatDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getTaskAssigneeDisplayName(task) {
  return (
    String(task?.assignee_display_name || "").trim() ||
    String(task?.assignee_nick_name || "").trim() ||
    String(task?.assignee_name || "").trim() ||
    null
  );
}

function formatDateRange(task) {
  const startDate = formatDateLabel(task.start_date);
  const dueDate = formatDateLabel(task.due_date);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap",
        lineHeight: 1.3,
      }}
    >
      <span>{startDate}</span>
      <span style={{ color: "var(--text-muted)" }}>s.d</span>
      <span>{dueDate}</span>
    </div>
  );
}

function getStatusTextStyle(statusCode) {
  const code = (statusCode || "").toUpperCase();
  if (code === "SELESAI") {
    return { color: "var(--chip-success-color)" };
  }
  if (code === "PROSES") {
    return { color: "var(--chip-info-color)" };
  }
  if (code === "REVIEW" || code === "PENINJAUAN") {
    return { color: "var(--chip-purple-color)" };
  }
  if (code === "PERBAIKAN") {
    return { color: "var(--chip-warning-color)" };
  }
  if (code === "TERKENDALA") {
    return { color: "var(--chip-danger-color)" };
  }
  if (code === "BELUM MULAI" || code === "BELUM_MULAI") {
    return { color: "var(--text-muted)" };
  }
  if (code === "BATAL" || code === "DIBATALKAN") {
    return { color: "hsl(0, 0%, 30%)" };
  }
  return { color: "var(--text-muted)" };
}

const PRIORITY_FILTER_OPTIONS = [
  {
    value: "ALL",
    label: "Semua",
    dotColor: "var(--text-subtle)",
    borderColor: "var(--control-border)",
    background: "var(--surface-2)",
    color: "var(--text-muted)",
  },
  {
    value: "TINGGI",
    label: "Tinggi",
    dotColor: "var(--alert-error-color)",
    borderColor: "var(--alert-error-border)",
    background: "var(--alert-error-bg)",
    color: "var(--alert-error-color)",
  },
  {
    value: "SEDANG",
    label: "Sedang",
    dotColor: "var(--alert-info-color)",
    borderColor: "var(--alert-info-border)",
    background: "var(--alert-info-bg)",
    color: "var(--alert-info-color)",
  },
  {
    value: "RENDAH",
    label: "Rendah",
    dotColor: "var(--alert-success-color)",
    borderColor: "var(--alert-success-border)",
    background: "var(--alert-success-bg)",
    color: "var(--alert-success-color)",
  },
];

const DEFAULT_PRIORITY_META = {
  label: "Belum ada",
  dotColor: "var(--text-muted)",
  borderColor: "var(--border-strong)",
};

function normalizePriorityCategory(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (!normalizedValue) return "BELUM_ADA";
  if (normalizedValue.includes("tinggi") || normalizedValue === "high") {
    return "TINGGI";
  }
  if (
    normalizedValue.includes("sedang") ||
    normalizedValue.includes("medium") ||
    normalizedValue === "normal"
  ) {
    return "SEDANG";
  }
  if (normalizedValue.includes("rendah") || normalizedValue === "low") {
    return "RENDAH";
  }
  return "BELUM_ADA";
}

function getPriorityMeta(task, priorityMap) {
  const priorityRecord = priorityMap[String(task.priority_id || "")];
  const category = normalizePriorityCategory(
    task.priority_name || task.priority_code || priorityRecord?.name || priorityRecord?.code
  );

  const option =
    PRIORITY_FILTER_OPTIONS.find((item) => item.value === category) ||
    DEFAULT_PRIORITY_META;

  return {
    category,
    label: option.label,
    dotColor: option.dotColor,
    borderColor: option.borderColor,
  };
}

export default function TaskPage() {
  const auth = useAuth();
  const prefersDarkMode = usePrefersDarkMode();

  const panelStyle = getPanelStyle({ borderRadius: 8 });
  const labelStyle = getFieldLabelStyle(prefersDarkMode);
  const fieldStyle = {
    ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };
  const selectStyle = {
    ...getSelectStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };
  const dateFieldStyle = getDateInputStyle(prefersDarkMode, { height: 42 });
  const modalOverlayStyle = getOverlayStyle({
    padding: 24,
    zIndex: 120,
  });
  const modalPanelStyle = getModalStyle({
    maxWidth: 920,
    maxHeight: "calc(100vh - 48px)",
    padding: 20,
    borderRadius: 8,
  });

  const [tasks, setTasks] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isEditFormLoading, setIsEditFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingTaskId, setProcessingTaskId] = useState(null);
  const [openActionMenuTaskId, setOpenActionMenuTaskId] = useState(null);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [hoveredRowTaskId, setHoveredRowTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [newestTaskId, setNewestTaskId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
    taskId: null,
    message: "",
    reason: "",
  });
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [subActivityFilter, setSubActivityFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const isAnyFilterActive =
    approvalFilter !== "all" ||
    statusFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    subActivityFilter !== "ALL" ||
    priorityFilter !== "ALL";
  const [message, setMessage] = useState("");
  const [pageLoadError, setPageLoadError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const actionMenuRef = useRef(null);
  const [form, setForm] = useState(
    createDefaultForm([], [], [], [])
  );
  const canAddTask = canCreateTask(auth.roleCode);
  const canUpdateTask = canEditTask(auth.roleCode);
  const canRemoveTask = canDeleteTask(auth.roleCode);
  const canApproveOrRejectTask = canManageTaskApproval(auth.roleCode);

  const loadTasks = useCallback(async () => {
    try {
      const taskData = await getTasks();
      const taskIds = (taskData || []).map((task) => task.task_id).filter(Boolean);
      let evidenceRequests = [];
      let evidenceDocuments = [];

      if (taskIds.length > 0) {
        [evidenceRequests, evidenceDocuments] = await Promise.all([
          getTaskEvidenceRequests(taskIds),
          getTaskDocuments(taskIds),
        ]);
      }

      const evidenceRequestMap = evidenceRequests.reduce((map, item) => {
        if (!map[item.task_id]) map[item.task_id] = [];
        map[item.task_id].push(item.request_name);
        return map;
      }, {});

      const evidenceDocumentMap = evidenceDocuments.reduce((map, item) => {
        if (!map[item.task_id]) map[item.task_id] = [];
        if (item.document) map[item.task_id].push(item.document);
        return map;
      }, {});

      setTasks(
        (taskData || []).map((task) => ({
          ...task,
          evidence_requests: evidenceRequestMap[task.task_id] || [],
          evidence_files: evidenceDocumentMap[task.task_id] || [],
        }))
      );
    } catch (error) {
      console.error(error);
      throw new Error(error.message || "Gagal memuat data task.");
    }
  }, []);

  const loadPageData = useCallback(async () => {
    setIsPageLoading(true);
    setPageLoadError("");

    try {
      await loadTasks();
      const [statusData, priorityData, actionPlanData, employeeData] =
        await Promise.all([
          getTaskStatuses(),
          getTaskPriorities(),
          getActionPlans(),
          getEmployees(),
        ]);

      setStatuses(statusData || []);
      setPriorities(priorityData || []);
      setActionPlans(actionPlanData || []);
      setEmployees(employeeData || []);
      setForm((prev) => ({
        ...prev,
        action_plan_id: prev.action_plan_id || actionPlanData?.[0]?.id || "",
        assignee_id: prev.assignee_id || employeeData?.[0]?.id || "",
        status_id: prev.status_id || statusData?.[0]?.id || "",
        priority_id: prev.priority_id || priorityData?.[0]?.id || "",
      }));
    } catch (error) {
      console.error(error);
      setTasks([]);
      setPageLoadError(error.message || "Gagal memuat halaman task.");
    } finally {
      setIsPageLoading(false);
    }
  }, [loadTasks]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      void loadPageData();
    });

    return () => {
      isCancelled = true;
    };
  }, [loadPageData]);

  useEffect(() => {
    if (!openActionMenuTaskId) {
      return undefined;
    }

    function handleDocumentPointerDown(event) {
      if (!actionMenuRef.current?.contains(event.target)) {
        setOpenActionMenuTaskId(null);
      }
    }

    document.addEventListener("mousedown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
    };
  }, [openActionMenuTaskId]);

  const subActivityOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => task.sub_activity_name).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => getTaskAssigneeDisplayName(task)).filter(Boolean))
      ).sort(
        (a, b) => a.localeCompare(b)
      ),
    [tasks]
  );

  const priorityMap = useMemo(
    () =>
      priorities.reduce((map, priority) => {
        map[String(priority.id)] = priority;
        return map;
      }, {}),
    [priorities]
  );

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (
        statusFilter !== "ALL" &&
        (task.task_status_code || "") !== statusFilter
      ) {
        return false;
      }
      if (
        approvalFilter !== "all" &&
        (task.approval_status || "") !== approvalFilter
      ) {
        return false;
      }
      if (
        assigneeFilter !== "ALL" &&
        getTaskAssigneeDisplayName(task) !== assigneeFilter
      ) {
        return false;
      }
      if (
        subActivityFilter !== "ALL" &&
        task.sub_activity_name !== subActivityFilter
      ) {
        return false;
      }
      if (
        priorityFilter !== "ALL" &&
        getPriorityMeta(task, priorityMap).category !== priorityFilter
      ) {
        return false;
      }
      return true;
    });

    return filtered.sort((firstTask, secondTask) => {
      if (firstTask.task_id === newestTaskId) return -1;
      if (secondTask.task_id === newestTaskId) return 1;
      return 0;
    });
  }, [
    approvalFilter,
    assigneeFilter,
    newestTaskId,
    priorityFilter,
    priorityMap,
    statusFilter,
    subActivityFilter,
    tasks,
  ]);

  function handleChange(event) {
    const { name, value } = event.target;
    if (name === "action_plan_id") {
      const selectedActionPlan = actionPlans.find(
        (actionPlan) => String(actionPlan.id) === String(value)
      );

      setForm((prev) => ({
        ...prev,
        action_plan_id: value,
        assignee_id: selectedActionPlan?.employee_id
          ? String(selectedActionPlan.employee_id)
          : prev.assignee_id,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function clearAllFilters() {
    setApprovalFilter("all");
    setStatusFilter("ALL");
    setAssigneeFilter("ALL");
    setSubActivityFilter("ALL");
    setPriorityFilter("ALL");
  }

  function formatEvidenceRequests(requests) {
    return requests
      .flatMap((request) =>
        request
          .split(/\r?\n|(?=-\s)/)
          .map((item) => item.replace(/^\s*-\s*/, "").trim())
          .filter(Boolean)
      );
  }

  function resetCreateForm() {
    setForm(createDefaultForm(actionPlans, employees, statuses, priorities));
  }

  function closeEditForm() {
    setIsEditFormOpen(false);
    setIsEditFormLoading(false);
    setEditingTaskId(null);
    resetCreateForm();
  }

  async function handleEditTask(taskId) {
    if (!canUpdateTask) {
      setMessage("");
      setErrorMessage("Anda tidak memiliki izin untuk mengedit task.");
      setOpenActionMenuTaskId(null);
      return;
    }

    setMessage("");
    setErrorMessage("");
    setOpenActionMenuTaskId(null);
    setIsCreateFormOpen(false);
    setIsEditFormLoading(true);
    setIsEditFormOpen(true);

    try {
      const taskData = await getTaskEditData(taskId);

      setEditingTaskId(taskId);
      setForm({
        action_plan_id: taskData.action_plan_id || actionPlans[0]?.id || "",
        assignee_id: taskData.assignee_id || employees[0]?.id || "",
        title: taskData.title || "",
        description: taskData.description || "",
        start_date: toDateInputValue(taskData.start_date),
        due_date: toDateInputValue(taskData.due_date),
        status_id: taskData.status_id || statuses[0]?.id || "",
        priority_id: taskData.priority_id || priorities[0]?.id || "",
        evidence_request: taskData.evidence_request || "",
      });
    } catch (error) {
      closeEditForm();
      setErrorMessage(error.message || "Gagal memuat data task.");
    } finally {
      setIsEditFormLoading(false);
    }
  }

  function requestDeleteTask(taskId) {
    if (!canRemoveTask) {
      setMessage("");
      setErrorMessage("Anda tidak memiliki izin untuk menghapus task.");
      setOpenActionMenuTaskId(null);
      return;
    }

    setOpenActionMenuTaskId(null);
    setDeleteConfirmTaskId(taskId);
  }

  async function handleConfirmDeleteTask() {
    if (!deleteConfirmTaskId) {
      return;
    }

    const taskId = deleteConfirmTaskId;
    setMessage("");
    setErrorMessage("");
    setProcessingTaskId(taskId);

    try {
      await deleteTask(taskId);
      await loadTasks();

      if (selectedTask?.task_id === taskId || selectedTask?.id === taskId) {
        setSelectedTask(null);
      }

      setMessage("Task berhasil dihapus.");
    } catch (error) {
      setErrorMessage(error.message || "Gagal menghapus task.");
    } finally {
      setProcessingTaskId(null);
      setDeleteConfirmTaskId(null);
    }
  }

  function validateTaskForm() {
    if (!form.title.trim()) {
      return "Judul task wajib diisi.";
    }

    if (!form.assignee_id) {
      return "Assignee wajib dipilih.";
    }

    if (!form.start_date || !form.due_date) {
      return "Tanggal mulai dan tanggal selesai wajib diisi.";
    }

    if (form.due_date < form.start_date) {
      return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    const validationMessage = validateTaskForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingTaskId) {
        if (!canUpdateTask) {
          throw new Error("Anda tidak memiliki izin untuk mengedit task.");
        }

        await updateTaskWithRelations(editingTaskId, {
          action_plan_id: form.action_plan_id,
          assignee_id: form.assignee_id,
          title: form.title.trim(),
          description: form.description.trim(),
          start_date: form.start_date,
          due_date: form.due_date,
          status_id: form.status_id,
          priority_id: form.priority_id,
          evidence_request: form.evidence_request,
        });

        await loadTasks();
        closeEditForm();
        setMessage("Task berhasil diperbarui.");
      } else {
        if (!canAddTask) {
          throw new Error("Anda tidak memiliki izin untuk menambah task.");
        }

        const createdTask = await createTaskWithRelations({
          action_plan_id: form.action_plan_id,
          assignee_id: form.assignee_id,
          title: form.title.trim(),
          description: form.description.trim(),
          start_date: form.start_date,
          due_date: form.due_date,
          status_id: form.status_id,
          priority_id: form.priority_id,
          evidence_request: form.evidence_request,
        });

        setNewestTaskId(createdTask.id);
        resetCreateForm();
        await loadTasks();
        setIsCreateFormOpen(false);
        setMessage("Task berhasil disimpan.");
      }
    } catch (error) {
      setErrorMessage(
        error.message ||
          (editingTaskId ? "Gagal memperbarui task." : "Gagal menyimpan task.")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderTaskForm(mode) {
    const isEditMode = mode === "edit";

    return (
      <form
        onSubmit={handleSubmit}
        style={{
          ...(isEditMode
            ? { display: "grid", gap: 16 }
            : { ...panelStyle, marginBottom: 20, padding: 20, display: "grid", gap: 16 }),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, ...getSectionTitleTypography({ fontSize: 20 }) }}>
            {isEditMode ? "Edit Task" : "Tambah Task"}
          </h2>
          <div style={getFormLabelTypography()}>
            {isEditMode
              ? "Perubahan akan langsung tersimpan setelah update berhasil."
              : "Form akan tertutup otomatis setelah task berhasil disimpan."}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <label style={labelStyle}>
            <span>Action Plan</span>
              <select name="action_plan_id" value={form.action_plan_id} onChange={handleChange} required style={selectStyle}>
                <option value="">Pilih action plan</option>
                {actionPlans.map((actionPlan) => (
                  <option key={actionPlan.id} value={actionPlan.id}>
                    {formatActionPlanLabel(actionPlan)}
                  </option>
                ))}
              </select>
          </label>

          <label style={labelStyle}>
            <span>Assignee</span>
            <select name="assignee_id" value={form.assignee_id} onChange={handleChange} required style={selectStyle}>
              <option value="">Pilih assignee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.display_name || employee.nick_name || employee.full_name || "-"}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Status</span>
            <select name="status_id" value={form.status_id} onChange={handleChange} required style={selectStyle}>
              <option value="">Pilih status</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span>Prioritas</span>
            <select name="priority_id" value={form.priority_id} onChange={handleChange} required style={selectStyle}>
              <option value="">Pilih prioritas</option>
              {priorities.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={labelStyle}>
          <span>Judul Task</span>
          <input type="text" name="title" value={form.title} onChange={handleChange} required style={fieldStyle} />
        </label>

        <label style={labelStyle}>
          <span>Deskripsi</span>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
          />
        </label>

        <label style={labelStyle}>
          <span>Request Eviden</span>
          <textarea
            name="evidence_request"
            value={form.evidence_request}
            onChange={handleChange}
            rows={3}
            style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label style={labelStyle}>
            <span>Tanggal Mulai</span>
            <input
              type="date"
              name="start_date"
              value={form.start_date}
              onChange={handleChange}
              required
              style={dateFieldStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Tanggal Selesai</span>
            <input
              type="date"
              name="due_date"
              value={form.due_date}
              onChange={handleChange}
              required
              style={dateFieldStyle}
            />
          </label>
        </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {isEditMode ? (
              <button
                type="button"
                className={`btn-specific-action ${!isSubmitting ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
                onClick={closeEditForm}
                disabled={isSubmitting}
                style={{ cursor: isSubmitting ? "wait" : "pointer" }}
              >
                Batal
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: !isSubmitting,
                  height: 40,
                }),
                minWidth: 140,
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting
                ? isEditMode
                  ? "Mengupdate..."
                : "Menyimpan..."
              : isEditMode
                ? "Update"
                : "Simpan Task"}
          </button>
        </div>
      </form>
    );
  }

  async function handleApproval(taskId, action) {
    setMessage("");
    setErrorMessage("");
    setProcessingTaskId(taskId);

    try {
      if (!canApproveOrRejectTask) {
        throw new Error("Anda tidak memiliki izin untuk melakukan approval task.");
      }

      if (action === "approve") {
        await approveTask(taskId, {
          notes: String(confirmDialog.reason || "").trim() || null,
        });
        setMessage("Task berhasil di-approve.");
      }
      await loadTasks();
      setOpenActionMenuTaskId(null);
      return true;
    } catch (error) {
      setErrorMessage(error.message || "Gagal memperbarui approval task.");
      return false;
    } finally {
      setProcessingTaskId(null);
    }
  }

  function openApprovalConfirmation(taskId, action) {
    setConfirmDialog({
      open: true,
      action,
      taskId,
      message:
        action === "approve"
          ? "Anda yakin akan menyetujui tugas ini?"
          : "Anda yakin akan menolak tugas ini?",
      reason: "",
    });
  }

  function openRejectDialog(taskId) {
    setConfirmDialog({
      open: true,
      action: "reject",
      taskId,
      message: "Masukkan alasan penolakan tugas ini",
      reason: "",
    });
  }

  function closeApprovalConfirmation() {
    setConfirmDialog({
      open: false,
      action: null,
      taskId: null,
      message: "",
      reason: "",
    });
  }

  async function handleConfirmApproval() {
    if (!confirmDialog.taskId || confirmDialog.action !== "approve") {
      closeApprovalConfirmation();
      return;
    }

    const isSuccess = await handleApproval(
      confirmDialog.taskId,
      confirmDialog.action
    );

    if (isSuccess) {
      closeApprovalConfirmation();
    }
  }

  async function handleSubmitReject() {
    const reason = String(confirmDialog.reason || "").trim();

    if (!confirmDialog.taskId || confirmDialog.action !== "reject" || !reason) {
      return;
    }

    setMessage("");
    setErrorMessage("");
    setProcessingTaskId(confirmDialog.taskId);

    try {
      if (!canApproveOrRejectTask) {
        throw new Error("Anda tidak memiliki izin untuk melakukan approval task.");
      }

      await rejectTaskWithReason(confirmDialog.taskId, reason);
      await loadTasks();
      setOpenActionMenuTaskId(null);
      setMessage("Task berhasil ditolak beserta alasan penolakannya.");
      closeApprovalConfirmation();
    } catch (error) {
      setErrorMessage(error.message || "Gagal menolak task.");
    } finally {
      setProcessingTaskId(null);
    }
  }

  const taskTableFrameStyle = useMemo(() => {
    return getTableFrameStyle();
  }, []);

  // Mode perataan header: 1 = semua kiri, 2 = center kecuali TASK kiri
  const tableHeaderAlignMode = 2; // Ganti ke 1 jika ingin mode default semua kiri

  // Keep Task column (1st column) styling untouched (it has its own typography hierarchy).
  const taskTableTaskCellBaseStyle = useMemo(() => {
    return getTableBodyCellStyle({
      padding: "14px",
      borderColor: "var(--table-row-border)",
      includeTypography: false,
      includeColor: true,
    });
  }, []);

  // Other columns follow global table body typography (13px).
  const taskTableBodyCellBaseStyle = useMemo(() => {
    return getTableBodyCellStyle({
      padding: "14px",
      borderColor: "var(--table-row-border)",
      includeTypography: true,
      includeColor: true,
    });
  }, []);

  // TaskPage table has many columns, so use the "dense" task-column mode.
  const taskColumnMode = 3;
  const taskColumnWidthStyle = useMemo(() => {
    return getTableTaskColumnWidthStyle({ mode: taskColumnMode });
  }, [taskColumnMode]);
  const taskTitleClampClassName = useMemo(() => {
    return getTableTaskTitleClampClassName({ mode: taskColumnMode });
  }, [taskColumnMode]);
  const taskTitleCharLimit = useMemo(() => {
    return getTableTaskTitleCharLimit({ mode: taskColumnMode });
  }, [taskColumnMode]);

  const taskTableColumnWidthStyles = useMemo(() => {
    return {
      // index 0 (TASK) handled separately with taskColumnWidthStyle
      1: { minWidth: 120 }, // STATUS
      2: { width: 96, minWidth: 96, maxWidth: 96 }, // PROGRESS
      3: { minWidth: 220 }, // TANGGAL
      4: { width: 120, minWidth: 120, maxWidth: 120 }, // REQUEST EVIDEN
      5: { width: 100, minWidth: 100, maxWidth: 100 }, // EVIDEN
      6: { width: 124, minWidth: 124, maxWidth: 124 }, // PERSETUJUAN (fit "Menunggu")
      7: { width: 72, minWidth: 72, maxWidth: 72 }, // AKSI (menu button)
    };
  }, []);

  return (
    <div style={{ paddingBottom: 60 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={getPageTitleStyle()}>KELOLA TUGAS</h1>
          {/*
          <div style={getPageSubtitleStyle()}>
            Pantau progress, kelola permohonan eviden, dan proses approval untuk setiap task.
          </div>
          */}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          {canAddTask ? (
            <button
              type="button"
              onClick={() => {
                if (isCreateFormOpen) {
                  setIsCreateFormOpen(false);
                  resetCreateForm();
                  return;
                }

                closeEditForm();
                resetCreateForm();
                setIsCreateFormOpen(true);
              }}
              style={{
                ...(isCreateFormOpen
                  ? getNeutralButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      size: "md",
                      height: 40,
                    })
                  : getPrimaryButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      size: "md",
                      height: 40,
                    })),
                minWidth: 160,
              }}
            >
              {isCreateFormOpen ? "Tutup Form" : "+ Tambah Task"}
            </button>
          ) : (
            <span
              style={getChipStyle(prefersDarkMode, {
                size: "md",
                tone: "muted",
                fontWeight: 600,
              })}
            >
              Role ini tidak dapat menambah task
            </span>
          )}

          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
            Menampilkan {filteredTasks.length} dari {tasks.length}
          </div>
        </div>
      </div>

      {message ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, {
              tone: "success",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
            }),
          }}
        >
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, {
              tone: "error",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
            }),
          }}
        >
          {errorMessage}
        </div>
      ) : null}
      {!isPageLoading && pageLoadError ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, {
              tone: "error",
              padding: "12px 14px",
              borderRadius: 10,
              fontSize: 13,
            }),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>{pageLoadError}</span>
          <button
            type="button"
            onClick={() => void loadPageData()}
            style={getDangerOutlinedButtonStyle(prefersDarkMode, {
              isEnabled: true,
              height: 34,
              size: "sm",
            })}
          >
            Coba Lagi
          </button>
        </div>
      ) : null}

      {isPageLoading ? (
        <div
          style={{
            ...getLoadingStateStyle(prefersDarkMode, {
              padding: "14px 18px",
              borderRadius: 8,
            }),
            marginBottom: 16,
          }}
        >
          Memuat data task...
        </div>
      ) : null}

      {isCreateFormOpen ? (
        renderTaskForm("create")
      ) : null}



        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "end",
            marginBottom: 24,
          }}
        >
          <select
            value={approvalFilter}
            onChange={(event) => setApprovalFilter(event.target.value)}
            className="filter-select"
            style={{ height: 40, flex: "1 1 200px", maxWidth: 260 }}
            aria-label="Filter status approval"
          >
            <option value="all">Approval Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="filter-select"
            style={{ height: 40, flex: "1 1 200px", maxWidth: 260 }}
            aria-label="Filter status task"
          >
            <option value="ALL">Status</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.code || ""}>
                {status.name}
              </option>
            ))}
          </select>

          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="filter-select"
            style={{ height: 40, flex: "1 1 200px", maxWidth: 260 }}
            aria-label="Filter assignee"
          >
            <option value="ALL">Assignee</option>
            {assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>

          <select
            value={subActivityFilter}
            onChange={(event) => setSubActivityFilter(event.target.value)}
            className="filter-select"
            style={{ height: 40, flex: "1 1 200px", maxWidth: 260 }}
            aria-label="Filter sub kegiatan"
          >
            <option value="ALL">Sub Kegiatan</option>
            {subActivityOptions.map((subActivity) => (
              <option key={subActivity} value={subActivity}>
                {subActivity}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="filter-select"
            style={{ height: 40, flex: "1 1 200px", maxWidth: 260 }}
            aria-label="Filter prioritas"
          >
            <option value="ALL">Prioritas</option>
            <option value="TINGGI">Tinggi - Merah</option>
            <option value="SEDANG">Sedang - Biru</option>
            <option value="RENDAH">Rendah - Hijau</option>
          </select>

          <button
            type="button"
            onClick={clearAllFilters}
            disabled={!isAnyFilterActive}
            className={`btn-specific-action ${isAnyFilterActive ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
            title={isAnyFilterActive ? "Reset semua filter" : "Tidak ada filter aktif"}
            style={{ flex: "0 0 auto" }}
          >
            Reset Filter
          </button>
        </div>


      <div style={taskTableFrameStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["TASK", "STATUS", "PROGRESS", "TANGGAL", "REQUEST EVIDEN", "EVIDEN", "PERSETUJUAN", "AKSI"].map((header, index) => (
                  <th
                    key={header}
                    style={{
                      ...getTableHeaderCellStyle({
                        padding: "12px 14px",
                        letterSpacing: 0,
                        alignMode: tableHeaderAlignMode,
                        label: header
                      }),
                      ...(index === 0 ? taskColumnWidthStyle : null),
                      ...(index !== 0 ? taskTableColumnWidthStyles[index] : null),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredTasks.map((task) => {
                const requestItems = formatEvidenceRequests(task.evidence_requests);
                const statusTextStyle = getStatusTextStyle(
                  task.task_status_code || task.task_status_name
                );
                const priorityMeta = getPriorityMeta(task, priorityMap);
                const subActivityName = String(task.sub_activity_name || "").trim();
                const assigneeName = getTaskAssigneeDisplayName(task);
                const isActionMenuOpen = openActionMenuTaskId === task.task_id;
                const isRejectedTask =
                  String(task.approval_status || "").toLowerCase() === "rejected";
                const canShowActionMenu = !isRejectedTask;
                const hasTaskActions = canUpdateTask || canRemoveTask;

                return (
                  <Fragment key={task.task_id}>
                    <tr
                      onMouseEnter={() => setHoveredRowTaskId(task.task_id)}
                      onMouseLeave={() => setHoveredRowTaskId((currentValue) => (
                        currentValue === task.task_id ? null : currentValue
                      ))}
                      style={{
                        verticalAlign: "top",
                        background:
                          newestTaskId === task.task_id
                            ? "var(--alert-info-bg)"
                            : hoveredRowTaskId === task.task_id
                              ? "var(--row-hover-bg)"
                              : "var(--table-bg)",
                      }}
                    >
                      <td style={{ ...taskTableTaskCellBaseStyle, ...taskColumnWidthStyle }}>
                        <div
                          style={{
                            display: "grid",
                            gap: 4,
                            minWidth: 260,
                            borderLeft: `4px solid ${priorityMeta.borderColor}`,
                            paddingLeft: 12,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedTask(task)}
                            onMouseEnter={() => setHoveredTaskId(task.task_id)}
                            onMouseLeave={() => setHoveredTaskId(null)}
                            className={taskTitleClampClassName || undefined}
                            style={{
                              appearance: "none",
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              margin: 0,
                              width: "100%",
                              textAlign: "left",
                              cursor: "pointer",
                              textDecoration: "none",
                              ...getTableCellLabelTypography({
                                color: hoveredTaskId === task.task_id
                                  ? "var(--alert-info-color)"
                                  : "var(--text-h)",
                              }),
                            }}
                          >
                            {taskTitleCharLimit ? getCompactText(task.task_title, taskTitleCharLimit) : task.task_title}
                          </button>
                          {subActivityName || assigneeName ? (
                            <div
                              style={{
                                marginTop: 2,
                                fontSize: 12,
                                lineHeight: 1.35,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {subActivityName ? (
                                <span style={{ color: "var(--text-muted)" }}>{subActivityName}</span>
                              ) : null}
                              {subActivityName && assigneeName ? (
                                <span style={{ color: "var(--text-subtle)" }}> {" • "} </span>
                              ) : null}
                              {assigneeName ? (
                                <span style={{ color: "var(--alert-info-color)" }}>{assigneeName}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[1],
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            lineHeight: 1.2,
                            ...statusTextStyle,
                          }}
                        >
                          {task.task_status_name || "-"}
                        </div>
                      </td>
                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[2],
                          color: "var(--text-muted)",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <div style={{ fontWeight: 500, whiteSpace: "nowrap", lineHeight: 1.2 }}>
                          {Number(task.progress_percent || 0)}%
                        </div>
                      </td>
                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[3],
                          color: "var(--text-h)",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDateRange(task)}
                      </td>
                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[4],
                          textAlign: "center",
                        }}
                      >
                        {requestItems.length === 0 ? (
                          <span style={{ color: "var(--text-subtle)" }}>-</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {requestItems.length} file
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[5],
                          textAlign: "center",
                        }}
                      >
                        {task.evidence_files.length === 0 ? (
                          <span style={{ color: "var(--text-subtle)" }}>-</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {task.evidence_files.length} file
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[6],
                          padding: "12px 10px",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gap: 4,
                            justifyItems: "center",
                            alignItems: "center",
                          }}
                        >
                          {task.approval_status === "pending" && canApproveOrRejectTask ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openApprovalConfirmation(task.task_id, "approve")
                                }
                                disabled={processingTaskId === task.task_id}
                                style={{
                                  ...getSuccessButtonStyle(prefersDarkMode, {
                                    isEnabled: processingTaskId !== task.task_id,
                                    fullWidth: true,
                                    height: 28,
                                    size: "xs",
                                  }),
                                  cursor:
                                    processingTaskId === task.task_id ? "wait" : "pointer",
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openRejectDialog(task.task_id)
                                }
                                disabled={processingTaskId === task.task_id}
                                style={{
                                  ...getDangerButtonStyle(prefersDarkMode, {
                                    isEnabled: processingTaskId !== task.task_id,
                                    fullWidth: true,
                                    height: 28,
                                    size: "xs",
                                  }),
                                  cursor:
                                    processingTaskId === task.task_id ? "wait" : "pointer",
                                }}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}

                          {task.approval_status === "approved" ? (
                            <span
                              style={{
                                ...getChipStyle(prefersDarkMode, {
                                  size: "xs",
                                  tone: "success",
                                }),
                                fontWeight: 500,
                              }}
                            >
                              Approved
                            </span>
                          ) : null}

                          {task.approval_status === "rejected" ? (
                            <span
                              style={{
                                ...getChipStyle(prefersDarkMode, {
                                  size: "xs",
                                  tone: "danger",
                                }),
                                fontWeight: 500,
                              }}
                            >
                              Rejected
                            </span>
                          ) : null}
                          {task.approval_status === "pending" &&
                          !canApproveOrRejectTask ? (
                            <span
                              title="Menunggu Reviewer"
                              style={{
                                ...getChipStyle(prefersDarkMode, {
                                  size: "xs",
                                  tone: "warning",
                                }),
                                fontWeight: 500,
                              }}
                            >
                              Menunggu
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td
                        style={{
                          ...taskTableBodyCellBaseStyle,
                          ...taskTableColumnWidthStyles[7],
                          padding: "12px 10px",
                          textAlign: "center",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          {canShowActionMenu ? (
                            <div
                              ref={isActionMenuOpen ? actionMenuRef : null}
                              style={{ position: "relative" }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionMenuTaskId((prev) =>
                                    prev === task.task_id ? null : task.task_id
                                  )
                                }
                                style={getMenuTriggerButtonStyle(prefersDarkMode, {
                                  isEnabled: true,
                                })}
                                aria-label="Aksi lainnya"
                                title="Aksi lainnya"
                              >
                                ⋮
                              </button>

                              {isActionMenuOpen ? (
                                <div
                                  style={getPopoverStyle({ borderRadius: 10 })}
                                >
                                  {hasTaskActions ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleEditTask(task.task_id)}
                                        style={getMenuItemButtonStyle(prefersDarkMode, {
                                          isEnabled: true,
                                          tone: "accent",
                                        })}
                                      >
                                        Edit Task
                                      </button>
                                      {canRemoveTask ? (
                                        <button
                                          type="button"
                                          onClick={() => requestDeleteTask(task.task_id)}
                                          disabled={processingTaskId === task.task_id}
                                          style={{
                                            ...getMenuItemButtonStyle(prefersDarkMode, {
                                              isEnabled: processingTaskId !== task.task_id,
                                              tone: "danger",
                                            }),
                                            cursor:
                                              processingTaskId === task.task_id
                                                ? "wait"
                                                : "pointer",
                                          }}
                                        >
                                          {processingTaskId === task.task_id
                                            ? "Menghapus..."
                                            : "Hapus Task"}
                                        </button>
                                      ) : null}
                                    </>
                                  ) : (
                                      <div
                                        style={{
                                          padding: "6px 10px",
                                          borderRadius: 8,
                                          background: "var(--surface-2)",
                                          border: "1px solid var(--panel-border)",
                                          color: "var(--text-muted)",
                                          textAlign: "left",
                                        }}
                                      >
                                        Tidak ada aksi
                                      </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-subtle)" }}>-</span>
                          )}
                        </div>
                      </td>
                    </tr>

                  </Fragment>
                );
              })}

              {!isPageLoading && !pageLoadError && filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      ...taskTableBodyCellBaseStyle,
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Tidak ada task yang sesuai dengan filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={loadTasks}
        />
      ) : null}

      <ConfirmActionModal
        open={Boolean(deleteConfirmTaskId)}
        title="Hapus Task"
        message="Task ini akan dihapus jika belum memiliki riwayat kerja. Lanjutkan?"
        confirmText="Hapus"
        cancelText="Batal"
        onCancel={() => {
          if (!processingTaskId) {
            setDeleteConfirmTaskId(null);
          }
        }}
        onConfirm={handleConfirmDeleteTask}
      />

      {confirmDialog.open ? (
        <div style={modalOverlayStyle}>
          <div
            style={{
              ...panelStyle,
              width: "min(360px, 100%)",
              padding: 20,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-h)" }}>
              {confirmDialog.action === "reject" ? "Tolak Tugas" : "Konfirmasi"}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-muted)" }}>
              {confirmDialog.action === "reject"
                ? "Masukkan alasan penolakan tugas ini"
                : "Tambahkan catatan approval jika perlu. Catatan ini bersifat opsional."}
            </div>
            {confirmDialog.action === "approve" ? (
              <textarea
                value={confirmDialog.reason}
                onChange={(event) =>
                  setConfirmDialog((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
                placeholder="Contoh: Disetujui, silakan lanjutkan pelaksanaan"
                autoFocus
                rows={4}
                style={{
                  ...fieldStyle,
                  minHeight: 96,
                  resize: "vertical",
                }}
              />
            ) : null}
            {confirmDialog.action === "reject" ? (
              <textarea
                value={confirmDialog.reason}
                onChange={(event) =>
                  setConfirmDialog((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
                placeholder="Contoh: Dokumen eviden belum lengkap"
                autoFocus
                rows={4}
                style={{
                  ...fieldStyle,
                  minHeight: 96,
                  resize: "vertical",
                }}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={closeApprovalConfirmation}
                disabled={processingTaskId === confirmDialog.taskId}
                style={{
                  ...getOutlinedButtonStyle(prefersDarkMode, {
                    isEnabled: processingTaskId !== confirmDialog.taskId,
                    height: 40,
                  }),
                  minWidth: 88,
                  cursor:
                    processingTaskId === confirmDialog.taskId ? "wait" : "pointer",
                }}
              >
                {confirmDialog.action === "approve" ? "Tidak" : "Batal"}
              </button>
              <button
                type="button"
                onClick={
                  confirmDialog.action === "approve"
                    ? handleConfirmApproval
                    : handleSubmitReject
                }
                disabled={
                  processingTaskId === confirmDialog.taskId ||
                  (confirmDialog.action === "reject" &&
                    !String(confirmDialog.reason || "").trim())
                }
                style={{
                  ...(confirmDialog.action === "approve"
                    ? getSuccessButtonStyle(prefersDarkMode, {
                        isEnabled:
                          processingTaskId !== confirmDialog.taskId &&
                          !(
                            confirmDialog.action === "reject" &&
                            !String(confirmDialog.reason || "").trim()
                          ),
                        height: 40,
                        size: "sm",
                      })
                    : getDangerButtonStyle(prefersDarkMode, {
                        isEnabled:
                          processingTaskId !== confirmDialog.taskId &&
                          String(confirmDialog.reason || "").trim().length > 0,
                        height: 40,
                        size: "sm",
                      })),
                  minWidth: 88,
                  cursor:
                    processingTaskId === confirmDialog.taskId ? "wait" : "pointer",
                }}
              >
                {confirmDialog.action === "approve" ? "Setuju" : "Tolak"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditFormOpen ? (
        <div style={modalOverlayStyle}>
          <div style={modalPanelStyle}>
            {isEditFormLoading ? (
              <div style={{ padding: "24px 4px", color: "var(--text-muted)" }}>
                Memuat data task...
              </div>
            ) : (
              renderTaskForm("edit")
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
