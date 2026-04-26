import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTaskProgressReport,
  deleteTaskProgressReport,
  deleteTaskEvidence,
  getExistingTaskProgressReport,
  getTaskDocuments,
  getTaskFollowUps,
  getTaskProgressReports,
  updateTaskProgressReport,
  uploadTaskEvidence,
} from "../../services/taskService";
import { useAuth } from "../../hooks/useAuth";
import { usePrefersDarkMode } from "../../hooks/usePrefersDarkMode";
import {
  canCreateProgressReport,
  canDeleteProgressReport,
  canDeleteTaskEvidence,
  canOpenTaskEvidence,
  canUploadTaskEvidence,
} from "../../lib/authorization";
import * as controlStyles from "../../lib/controlStyles";

function formatDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatDateTimeLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTaskStatusChipTone(statusCode) {
  const code = (statusCode || "").toUpperCase();
  if (code === "SELESAI") return "success";
  if (code === "PROSES") return "info";
  if (code === "REVIEW" || code === "PENINJAUAN") {
    return "purple";
  }
  if (code === "PERBAIKAN") {
    return "warning";
  }
  if (code === "TERKENDALA") {
    return "danger";
  }
  if (code === "BATAL" || code === "DIBATALKAN") {
    return "canceled";
  }
  return "muted";
}

function formatEvidenceRequests(requests) {
  return (requests || []).flatMap((request) =>
    String(request || "")
      .split(/\r?\n|(?=-\s)/)
      .map((item) => item.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean)
  );
}

function getLatestProgressPercent(progressReports, fallbackProgressPercent = 0) {
  const sortedReports = [...(progressReports || [])].sort((firstItem, secondItem) => {
    const firstReportDate = new Date(firstItem?.report_date || 0).getTime();
    const secondReportDate = new Date(secondItem?.report_date || 0).getTime();

    if (firstReportDate !== secondReportDate) {
      return secondReportDate - firstReportDate;
    }

    const firstCreatedAt = new Date(firstItem?.created_at || 0).getTime();
    const secondCreatedAt = new Date(secondItem?.created_at || 0).getTime();
    return secondCreatedAt - firstCreatedAt;
  });

  return Number(
    sortedReports[0]?.progress_percent ?? fallbackProgressPercent ?? 0
  );
}

function sortNewestFirst(items, dateKey) {
  return [...items].sort((firstItem, secondItem) => {
    const firstTime = new Date(
      firstItem?.[dateKey] || firstItem?.created_at || 0
    ).getTime();
    const secondTime = new Date(
      secondItem?.[dateKey] || secondItem?.created_at || 0
    ).getTime();

    return secondTime - firstTime;
  });
}

function getTaskAssigneeDisplayName(task) {
  return (
    String(task?.assignee_display_name || "").trim() ||
    String(task?.assignee_nick_name || "").trim() ||
    String(task?.assignee_name || "").trim() ||
    "Belum ditentukan"
  );
}

export default function TaskDetailModal({
  task,
  onClose,
  onTaskUpdated,
  prefersDarkMode: prefersDarkModeProp,
}) {
  const auth = useAuth();
  const systemPrefersDarkMode = usePrefersDarkMode();
  const prefersDarkMode =
    typeof prefersDarkModeProp === "boolean"
      ? prefersDarkModeProp
      : systemPrefersDarkMode;

  const overlayStyle = useMemo(() => controlStyles.getOverlayStyle(), []);
  const modalStyle = useMemo(() => controlStyles.getModalStyle(), []);
  const cardStyle = useMemo(
    () =>
      controlStyles.getPanelStyle({
        borderRadius: 14,
        padding: 18,
        borderColor: "var(--border-strong)",
        boxShadow: "var(--panel-shadow)",
      }),
    []
  );
  const metaLabelStyle = useMemo(
    () => ({ ...controlStyles.getMetaLabelStyle(prefersDarkMode), marginBottom: 8 }),
    [prefersDarkMode]
  );
  const fieldLabelStyle = useMemo(
    () => controlStyles.getFieldLabelStyle(prefersDarkMode),
    [prefersDarkMode]
  );
  const fieldStyle = useMemo(
    () => ({ ...controlStyles.getTextInputStyle(prefersDarkMode, { tone: "panel" }), width: "100%" }),
    [prefersDarkMode]
  );

  const [taskView, setTaskView] = useState(task);
  const [documents, setDocuments] = useState(task?.evidence_files || []);
  const [progressReports, setProgressReports] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [deletingProgressReportId, setDeletingProgressReportId] = useState(null);
  const [detailLoadError, setDetailLoadError] = useState("");
  const [actionSuccessMessage, setActionSuccessMessage] = useState("");
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [progressForm, setProgressForm] = useState({
    report_date: new Date().toISOString().slice(0, 10),
    progress_percent: "",
    result_summary: "",
    issue_summary: "",
    next_step_summary: "",
  });
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    file: null,
  });

  const resetLoadedDetailState = useCallback((nextDocuments = task?.evidence_files || []) => {
    setProgressReports([]);
    setFollowUps([]);
    setDocuments(nextDocuments);
  }, [task]);

  const applyLoadedDetailState = useCallback((progressData = [], followUpData = [], documentData = []) => {
    setProgressReports(progressData || []);
    setFollowUps(followUpData || []);
    setDocuments((documentData || []).map((item) => item.document).filter(Boolean));
    setTaskView((prev) => ({
      ...prev,
      progress_percent: getLatestProgressPercent(
        progressData || [],
        task?.progress_percent ?? prev?.progress_percent
      ),
    }));
  }, [task]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      setTaskView(task);
      setDocuments(task?.evidence_files || []);
      setDetailLoadError("");
      setActionSuccessMessage("");
      setActionErrorMessage("");
      setActiveAction(null);
      setProgressForm({
        report_date: new Date().toISOString().slice(0, 10),
        progress_percent: task?.progress_percent ?? "",
        result_summary: "",
        issue_summary: "",
        next_step_summary: "",
      });
      setUploadForm({
        title: "",
        description: "",
        file: null,
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [task]);

  const loadTaskDetails = useCallback(async () => {
    if (!task?.task_id) {
      resetLoadedDetailState(task?.evidence_files || []);
      setDetailLoadError("");
      return;
    }

    setIsLoadingDetails(true);
    setDetailLoadError("");

    try {
      const [progressData, followUpData, documentData] = await Promise.all([
        getTaskProgressReports(task.task_id),
        getTaskFollowUps(task.task_id),
        getTaskDocuments([task.task_id]),
      ]);

      applyLoadedDetailState(progressData, followUpData, documentData);
    } catch (error) {
      console.error(error);
      resetLoadedDetailState(task?.evidence_files || []);
      setDetailLoadError(error.message || "Sebagian detail task gagal dimuat.");
    } finally {
      setIsLoadingDetails(false);
    }
  }, [applyLoadedDetailState, resetLoadedDetailState, task]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      void loadTaskDetails();
    });

    return () => {
      isCancelled = true;
    };
  }, [loadTaskDetails]);

  const progressValue = Math.max(
    0,
    Math.min(100, Number(taskView?.progress_percent || 0))
  );
  const statusChipTone = getTaskStatusChipTone(taskView?.task_status_code);
  const requestItems = useMemo(
    () => formatEvidenceRequests(taskView?.evidence_requests || []),
    [taskView]
  );
  const sortedProgressReports = useMemo(
    () => sortNewestFirst(progressReports, "report_date"),
    [progressReports]
  );
  const sortedFollowUps = useMemo(
    () => sortNewestFirst(followUps, "created_at"),
    [followUps]
  );
  const progressStatusLabel =
    progressValue <= 0 && sortedProgressReports.length === 0
      ? "Belum Ada Progress"
      : progressValue > 0 && sortedProgressReports.length === 0
        ? "Progress Belum Dilaporkan"
        : "Progress Sudah Dilaporkan";
  const normalizedApprovalStatus = String(taskView?.approval_status || "").toLowerCase();
  const normalizedTaskStatusCode = String(taskView?.task_status_code || "").toLowerCase();
  const isRejected = normalizedApprovalStatus === "rejected";
  const isCanceled = normalizedTaskStatusCode === "dibatalkan";
  const isDetailReadOnly = isRejected || isCanceled;
  const currentEmployeeId = String(auth.employeeId || "").trim() || null;
  const taskAssigneeEmployeeId =
    String(taskView?.assignee_employee_id || task?.assignee_employee_id || "").trim() ||
    null;
  const isStafRole = String(auth.roleCode || "").trim().toUpperCase() === "STAF";
  const canSubmitAnyProgress = canCreateProgressReport(auth.roleCode);
  const canCreateProgressForCurrentTask =
    canSubmitAnyProgress &&
    (!isStafRole || currentEmployeeId === taskAssigneeEmployeeId);
  const canDeleteAnyProgressForCurrentUser = canDeleteProgressReport(auth.roleCode);
  const canUploadAnyEvidence = canUploadTaskEvidence(auth.roleCode);
  const canUploadEvidenceForCurrentTask =
    canUploadAnyEvidence &&
    (!isStafRole || currentEmployeeId === taskAssigneeEmployeeId);
  const canDeleteEvidenceForCurrentUser = canDeleteTaskEvidence(auth.roleCode);
  const canOpenEvidenceForCurrentUser = canOpenTaskEvidence(auth.roleCode);
  const readOnlyMessage = isRejected
    ? "Task ini ditolak dan hanya dapat dilihat."
    : isCanceled
      ? "Task ini dibatalkan. Detail task hanya dapat dilihat, tetapi task masih bisa diedit dari menu aksi."
      : "";
  function canDeleteProgressItem(item) {
    if (canDeleteAnyProgressForCurrentUser) {
      return true;
    }

    return (
      isStafRole &&
      canCreateProgressForCurrentTask &&
      String(item?.reported_by_employee_id || "").trim() === currentEmployeeId
    );
  }
  const actionPlanLabel =
    taskView?.action_plan_title ||
    taskView?.action_plan_name ||
    taskView?.action_plan_code ||
    "-";

  function clearActionMessages() {
    setActionSuccessMessage("");
    setActionErrorMessage("");
  }

  function showActionError(message) {
    setActionSuccessMessage("");
    setActionErrorMessage(message);
  }

  function showActionSuccess(message) {
    setActionErrorMessage("");
    setActionSuccessMessage(message);
  }

  function validateProgressSubmission(nextProgressPercent) {
    if (!canCreateProgressForCurrentTask) {
      return isStafRole
        ? "Anda hanya dapat mengisi atau mengubah progress untuk task yang ditugaskan kepada Anda."
        : "Anda tidak memiliki izin untuk mengisi progress report.";
    }

    if (isRejected) {
      return "Progress tidak dapat diisi karena task ditolak.";
    }

    if (isCanceled) {
      return "Progress tidak dapat diisi karena task dibatalkan.";
    }

    if (!task?.task_id) {
      return "Task belum dipilih.";
    }

    if (
      Number.isNaN(nextProgressPercent) ||
      nextProgressPercent < 0 ||
      nextProgressPercent > 100
    ) {
      return "Progress harus diisi antara 0 sampai 100.";
    }

    if (nextProgressPercent < progressValue) {
      return "Progress baru tidak boleh lebih kecil dari progress saat ini.";
    }

    return "";
  }

  function validateEvidenceSubmission() {
    if (!canUploadEvidenceForCurrentTask) {
      return isStafRole
        ? "Anda hanya dapat upload eviden untuk task yang ditugaskan kepada Anda."
        : "Anda tidak memiliki izin untuk upload eviden.";
    }

    if (isDetailReadOnly) {
      return readOnlyMessage;
    }

    if (!task?.task_id) {
      return "Task belum dipilih.";
    }

    if (!uploadForm.file) {
      return "File eviden wajib dipilih.";
    }

    if (!uploadForm.title.trim()) {
      return "Judul dokumen wajib diisi.";
    }

    return "";
  }

  function handleProgressChange(event) {
    const { name, value } = event.target;
    setProgressForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleUploadChange(event) {
    const { name, value, files } = event.target;
    setUploadForm((prev) => ({
      ...prev,
      [name]: name === "file" ? files?.[0] || null : value,
    }));
  }

  async function refreshDetailsAfterMutation(mutationContext = null) {
    const [progressData, documentData] = await Promise.all([
      getTaskProgressReports(task.task_id),
      getTaskDocuments([task.task_id]),
    ]);

    const latestProgressPercent = getLatestProgressPercent(
      progressData,
      taskView?.progress_percent ?? task?.progress_percent ?? 0
    );

    await onTaskUpdated?.({
      taskId: task?.task_id || null,
      progressPercent: latestProgressPercent,
      mutationContext,
    });

    setDetailLoadError("");
    applyLoadedDetailState(progressData, followUps, documentData);
  }

  async function handleProgressSubmit(event) {
    event.preventDefault();

    const nextProgressPercent = Number(progressForm.progress_percent);
    const validationMessage = validateProgressSubmission(nextProgressPercent);
    if (validationMessage) {
      showActionError(validationMessage);
      return;
    }

    clearActionMessages();
    setIsSubmittingProgress(true);

    try {
      const progressPayload = {
        task_id: task.task_id,
        report_date: progressForm.report_date,
        progress_percent: nextProgressPercent,
        result_summary: progressForm.result_summary.trim() || null,
        issue_summary: progressForm.issue_summary.trim() || null,
        next_step_summary: progressForm.next_step_summary.trim() || null,
      };

      const existingReport = await getExistingTaskProgressReport(
        task.task_id,
        progressForm.report_date
      );

      if (existingReport) {
        await updateTaskProgressReport(existingReport.id, progressPayload);
        showActionSuccess("Progress report berhasil diperbarui.");
      } else {
        await createTaskProgressReport(progressPayload);
        showActionSuccess("Progress report berhasil disimpan.");
      }

      await refreshDetailsAfterMutation({ type: "progress" });
      setActiveAction(null);
      setProgressForm({
        report_date: new Date().toISOString().slice(0, 10),
        progress_percent: nextProgressPercent,
        result_summary: "",
        issue_summary: "",
        next_step_summary: "",
      });
    } catch (error) {
      showActionError(error.message || "Gagal menyimpan progress report.");
    } finally {
      setIsSubmittingProgress(false);
    }
  }

  async function handleDeleteProgressReport(report) {
    if (!canDeleteProgressItem(report)) {
      showActionError("Anda tidak memiliki izin untuk menghapus progress report.");
      return;
    }

    const confirmed = window.confirm(
      "Yakin ingin menghapus progress report ini?"
    );

    if (!confirmed) {
      return;
    }

    clearActionMessages();
    const reportId = report?.id;
    setDeletingProgressReportId(reportId);

    try {
      await deleteTaskProgressReport(reportId);
      await refreshDetailsAfterMutation({ type: "progress-delete" });
      showActionSuccess("Progress report berhasil dihapus.");
    } catch (error) {
      showActionError(error.message || "Gagal menghapus progress report.");
    } finally {
      setDeletingProgressReportId(null);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();

    const validationMessage = validateEvidenceSubmission();
    if (validationMessage) {
      showActionError(validationMessage);
      return;
    }

    clearActionMessages();
    setIsUploadingEvidence(true);

    try {
      await uploadTaskEvidence({
        taskId: task.task_id,
        title: uploadForm.title.trim(),
        description: uploadForm.description.trim() || null,
        file: uploadForm.file,
      });

      await refreshDetailsAfterMutation({ type: "evidence" });
      setActiveAction(null);
      setUploadForm({
        title: "",
        description: "",
        file: null,
      });
      showActionSuccess("Eviden berhasil diupload.");
    } catch (error) {
      showActionError(error.message || "Gagal upload eviden.");
    } finally {
      setIsUploadingEvidence(false);
    }
  }

  async function handleDeleteEvidence(document) {
    if (!canDeleteEvidenceForCurrentUser) {
      showActionError("Anda tidak memiliki izin untuk menghapus eviden.");
      return;
    }

    if (isDetailReadOnly) {
      showActionError(readOnlyMessage);
      return;
    }

    if (!task?.task_id || !document?.id) {
      showActionError("Eviden task tidak valid.");
      return;
    }

    clearActionMessages();
    setDeletingDocumentId(document.id);

    try {
      await deleteTaskEvidence(task.task_id, document.id);
      await refreshDetailsAfterMutation({ type: "evidence-delete" });
      showActionSuccess("Eviden berhasil dihapus.");
    } catch (error) {
      showActionError(error.message || "Gagal menghapus eviden.");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  if (!task) {
    return null;
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              letterSpacing: 1.4,
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            Detail Task
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              ...controlStyles.getNeutralButtonStyle(prefersDarkMode, {
                isEnabled: true,
                size: "xs",
                height: 32,
              }),
              padding: "6px 10px",
              fontSize: 12,
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            Tutup
          </button>
        </div>

        {actionSuccessMessage ? (
          <div
            style={{
              marginBottom: 12,
              ...controlStyles.getAlertStyle(prefersDarkMode, { tone: "success" }),
            }}
          >
            {actionSuccessMessage}
          </div>
        ) : null}
        {actionErrorMessage ? (
          <div
            style={{
              marginBottom: 12,
              ...controlStyles.getAlertStyle(prefersDarkMode, { tone: "error" }),
            }}
          >
            {actionErrorMessage}
          </div>
        ) : null}
        {detailLoadError ? (
          <div
            style={{
              marginBottom: 12,
              ...controlStyles.getAlertStyle(prefersDarkMode, { tone: "warning" }),
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>{detailLoadError}</span>
            <button
              type="button"
              onClick={() => void loadTaskDetails()}
              disabled={isLoadingDetails}
              style={controlStyles.getOutlinedButtonStyle(prefersDarkMode, {
                isEnabled: !isLoadingDetails,
                size: "xs",
                height: 32,
              })}
            >
              {isLoadingDetails ? "Memuat..." : "Muat Ulang Detail"}
            </button>
          </div>
        ) : null}
        {isDetailReadOnly ? (
          <div
            style={{
              marginBottom: 12,
              ...controlStyles.getPanelStyle({
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--surface-2)",
                borderColor: "var(--border-subtle)",
                boxShadow: "none",
              }),
              color: "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {readOnlyMessage}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 16 }}>
          <section
            style={{
              ...cardStyle,
              background:
                prefersDarkMode
                  ? "linear-gradient(135deg, #0f172a 0%, #111827 56%, #172554 100%)"
                  : "linear-gradient(135deg, #f8fafc 0%, #ffffff 56%, #eff6ff 100%)",
              padding: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 23,
                fontWeight: 800,
                color: "var(--text-h)",
                lineHeight: 1.15,
              }}
            >
              {taskView?.task_title || "-"}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>
              Kode Task: {taskView?.task_code || "-"}
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                style={controlStyles.getChipStyle(prefersDarkMode, {
                  tone: statusChipTone,
                  size: "xs",
                  padding: "4px 8px",
                  fontSize: 13,
                })}
              >
                {taskView?.task_status_name || "-"}
              </span>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            <div style={cardStyle}>
              <div style={metaLabelStyle}>Sub Kegiatan</div>
              <div style={{ fontSize: 16, color: "var(--text-h)", fontWeight: 700 }}>
                {taskView?.sub_activity_name || "-"}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={metaLabelStyle}>Rencana Aksi</div>
              <div style={{ fontSize: 16, color: "var(--text-h)", fontWeight: 700 }}>
                {actionPlanLabel}
              </div>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <div style={cardStyle}>
              <div style={metaLabelStyle}>Assignee</div>
              <div style={{ fontSize: 15, color: "var(--text-h)", fontWeight: 700 }}>
                {getTaskAssigneeDisplayName(taskView)}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={metaLabelStyle}>Prioritas</div>
              <div style={{ fontSize: 15, color: "var(--text-h)", fontWeight: 700 }}>
                {taskView?.priority_name || "-"}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={metaLabelStyle}>Tanggal Mulai</div>
              <div style={{ fontSize: 15, color: "var(--text-h)", fontWeight: 700 }}>
                {formatDateLabel(taskView?.start_date)}
              </div>
            </div>
            <div style={cardStyle}>
              <div style={metaLabelStyle}>Tanggal Selesai</div>
              <div style={{ fontSize: 15, color: "var(--text-h)", fontWeight: 700 }}>
                {formatDateLabel(taskView?.due_date)}
              </div>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              alignItems: "stretch",
              width: "100%",
              minWidth: 0,
            }}
          >
            <div
              style={{
                ...cardStyle,
                minHeight: 120,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <div style={metaLabelStyle}>Deskripsi</div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-h)",
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                }}
              >
                {taskView?.task_description || taskView?.description || "-"}
              </div>
            </div>

            <div
              style={{
                ...cardStyle,
                minHeight: 120,
                display: "grid",
                gridTemplateRows: "auto auto auto 1fr",
                alignContent: "start",
                width: "100%",
                minWidth: 0,
                overflow: "hidden",
                gap: 10,
              }}
            >
              <div style={metaLabelStyle}>Progress</div>
              <div
                style={{
                  fontSize: 24,
                  color: "var(--text-h)",
                  fontWeight: 800,
                  lineHeight: 1.1,
                }}
              >
                {progressValue}%
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {progressStatusLabel}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  width: "100%",
                  minHeight: 0,
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    height: 12,
                    borderRadius: 999,
                    background: "var(--border-subtle)",
                    overflow: "hidden",
                    flexShrink: 1,
                  }}
                >
                  <div
                    style={{
                      width: `${progressValue}%`,
                      height: "100%",
                      background: "#2563eb",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <div
              style={{
                ...cardStyle,
                minHeight: requestItems.length === 0 ? "auto" : 220,
              }}
            >
              <div style={metaLabelStyle}>Request Eviden</div>
              {requestItems.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-h)" }}>-</div>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    display: "grid",
                    gap: 8,
                    color: "var(--text-muted)",
                  }}
                >
                  {requestItems.map((item, index) => (
                    <li
                      key={`request-${task.task_id}-${index}`}
                      style={{
                        fontSize: 14,
                        lineHeight: 1.55,
                        whiteSpace: "normal",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              style={{
                ...cardStyle,
                minHeight: documents.length === 0 ? "auto" : 220,
              }}
            >
              <div style={metaLabelStyle}>Eviden Uploaded</div>
              {documents.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-h)" }}>-</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {documents.map((document, index) => {
                    const label =
                      document?.title || document?.file_name || `Dokumen ${index + 1}`;
                    const href = document?.file_url || document?.storage_path || "#";

                    return (
                      <div
                        key={document?.id || `${task.task_id}-document-${index}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid var(--panel-border)",
                          background: "var(--panel-bg)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            lineHeight: 1.55,
                            whiteSpace: "normal",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                            color: "var(--text-h)",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {canOpenEvidenceForCurrentUser ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "7px 10px",
                                borderRadius: 8,
                                background: "var(--alert-info-bg)",
                                color: "var(--alert-info-color)",
                                border: "1px solid var(--alert-info-border)",
                                textDecoration: "none",
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              Lihat
                            </a>
                          ) : null}
                          {!isDetailReadOnly && canDeleteEvidenceForCurrentUser ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvidence(document)}
                              disabled={deletingDocumentId === document?.id}
                              style={{
                                ...controlStyles.getDangerButtonStyle(prefersDarkMode, {
                                  isEnabled: deletingDocumentId !== document?.id,
                                  size: "xs",
                                  height: 32,
                                }),
                                minWidth: 72,
                              }}
                            >
                              {deletingDocumentId === document?.id
                                ? "Menghapus..."
                                : "Hapus"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <div
              style={{
                ...cardStyle,
                minHeight:
                  !isLoadingDetails && sortedFollowUps.length === 0 ? "auto" : 260,
              }}
            >
              <div style={metaLabelStyle}>Follow Up / Catatan Pimpinan</div>
              {isLoadingDetails ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Memuat follow-up...</div>
              ) : sortedFollowUps.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Belum ada follow-up</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {sortedFollowUps.map((followUp) => (
                    <div
                      key={followUp.id}
                      style={{
                        border: "1px solid var(--border-subtle)",
                        borderLeft: followUp.is_followed_up
                          ? "1px solid var(--border-subtle)"
                          : "4px solid var(--alert-warning-border)",
                        borderRadius: 10,
                        padding: 12,
                        background: followUp.is_followed_up
                          ? "var(--panel-bg)"
                          : "var(--alert-warning-bg)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {formatDateTimeLabel(followUp.created_at)}
                        </div>
                        <span
                          style={controlStyles.getChipStyle(prefersDarkMode, {
                            size: "xs",
                            tone: followUp.is_followed_up ? "success" : "warning",
                            padding: "4px 8px",
                          })}
                        >
                          {followUp.is_followed_up ? "Tuntas" : "Belum tuntas"}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--text-h)",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.55,
                        }}
                      >
                        {followUp.note_text || followUp.notes || "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                ...cardStyle,
                minHeight:
                  !isLoadingDetails && sortedProgressReports.length === 0
                    ? "auto"
                    : 260,
              }}
            >
              <div style={metaLabelStyle}>Progress History</div>
              {isLoadingDetails ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Memuat riwayat progress...
                </div>
              ) : sortedProgressReports.length === 0 ? (
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Belum ada riwayat progress
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {sortedProgressReports.map((item, index) => (
                    <div
                      key={item.id || `${task.task_id}-progress-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "16px 1fr",
                        columnGap: 12,
                        alignItems: "start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          paddingTop: 5,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: "var(--text-subtle)",
                            display: "inline-block",
                          }}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 4 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: "var(--text-h)",
                              fontWeight: 700,
                            }}
                          >
                            {formatDateLabel(item.report_date || item.created_at)}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--alert-info-color)",
                              fontWeight: 700,
                            }}
                          >
                            {Number(item.progress_percent || 0)}%
                          </span>
                          {canDeleteProgressItem(item) ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteProgressReport(item)}
                              disabled={deletingProgressReportId === item.id}
                              style={{
                                ...controlStyles.getDangerButtonStyle(prefersDarkMode, {
                                  isEnabled: deletingProgressReportId !== item.id,
                                  size: "xs",
                                  height: 28,
                                }),
                                padding: "4px 8px",
                              }}
                            >
                              {deletingProgressReportId === item.id
                                ? "Menghapus..."
                                : "Hapus"}
                            </button>
                          ) : null}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            color: "var(--text-muted)",
                            lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "break-word",
                          }}
                        >
                          {item.result_summary ||
                            item.issue_summary ||
                            item.next_step_summary ||
                            "Update progress tersedia."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section
            style={{
              ...cardStyle,
              background: "var(--surface-1)",
              display: "grid",
              justifyItems: "center",
              gap: 14,
            }}
          >
            <div style={{ ...metaLabelStyle, marginBottom: 0 }}>Action Area</div>
            {isDetailReadOnly ? (
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                Tidak ada aksi yang tersedia untuk task ini.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveAction((prev) => (prev === "upload" ? null : "upload"))
                  }
                  disabled={!canUploadAnyEvidence}
                  style={{
                    minWidth: 150,
                    ...(activeAction === "upload"
                      ? controlStyles.getPrimaryButtonStyle(prefersDarkMode, {
                        isEnabled: canUploadAnyEvidence,
                        size: "sm",
                        height: 38,
                      })
                      : controlStyles.getNeutralButtonStyle(prefersDarkMode, {
                        isEnabled: canUploadAnyEvidence,
                        size: "sm",
                        height: 38,
                      })),
                  }}
                >
                  Upload Eviden
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveAction((prev) => (prev === "progress" ? null : "progress"))
                  }
                  disabled={!canSubmitAnyProgress}
                  style={{
                    minWidth: 150,
                    ...(activeAction === "progress"
                      ? controlStyles.getPrimaryButtonStyle(prefersDarkMode, {
                        isEnabled: canSubmitAnyProgress,
                        size: "sm",
                        height: 38,
                      })
                      : controlStyles.getNeutralButtonStyle(prefersDarkMode, {
                        isEnabled: canSubmitAnyProgress,
                        size: "sm",
                        height: 38,
                      })),
                  }}
                >
                  Isi Progress
                </button>
              </div>
            )}

            {!isDetailReadOnly &&
              !canUploadEvidenceForCurrentTask &&
              canUploadAnyEvidence ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: 760,
                  ...controlStyles.getAlertStyle(prefersDarkMode, { tone: "warning" }),
                  textAlign: "center",
                }}
              >
                Anda hanya dapat upload eviden untuk task yang ditugaskan kepada Anda.
              </div>
            ) : null}

            {!isDetailReadOnly &&
              !canCreateProgressForCurrentTask &&
              canSubmitAnyProgress ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: 760,
                  ...controlStyles.getAlertStyle(prefersDarkMode, { tone: "warning" }),
                  textAlign: "center",
                }}
              >
                Anda hanya dapat mengisi progress untuk task yang ditugaskan kepada Anda.
              </div>
            ) : null}

            {!isDetailReadOnly &&
              activeAction === "upload" &&
              canUploadEvidenceForCurrentTask ? (
              <form
                onSubmit={handleUploadSubmit}
                style={{
                  width: "100%",
                  maxWidth: 760,
                  display: "grid",
                  gap: 12,
                  ...controlStyles.getPanelStyle({
                    padding: 16,
                    borderRadius: 12,
                    background: "var(--panel-bg)",
                    borderColor: "var(--panel-border)",
                    boxShadow: "none",
                  }),
                }}
              >
                <label style={fieldLabelStyle}>
                  <span>Pilih File</span>
                  <input
                    type="file"
                    name="file"
                    onChange={handleUploadChange}
                    required
                    className="app-file-input"
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                    alignItems: "stretch",
                  }}
                >
                  <label
                    style={{ ...fieldLabelStyle, alignContent: "start" }}
                  >
                    <span>Judul Dokumen</span>
                    <input
                      type="text"
                      name="title"
                      value={uploadForm.title}
                      onChange={handleUploadChange}
                      required
                      style={{ ...fieldStyle, minHeight: 80 }}
                    />
                  </label>

                  <label
                    style={{ ...fieldLabelStyle, alignContent: "start" }}
                  >
                    <span>Deskripsi</span>
                    <textarea
                      name="description"
                      value={uploadForm.description}
                      onChange={handleUploadChange}
                      rows={2}
                      style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <button
                    type="submit"
                    disabled={isUploadingEvidence}
                    style={controlStyles.getPrimaryButtonStyle(prefersDarkMode, {
                      isEnabled: !isUploadingEvidence,
                      size: "sm",
                      height: 38,
                    })}
                  >
                    {isUploadingEvidence ? "Mengupload..." : "Simpan Eviden"}
                  </button>
                  <button
                    type="button"
                    className={`btn-specific-action ${!isUploadingEvidence ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
                    onClick={() => setActiveAction(null)}
                    disabled={isUploadingEvidence}
                    style={{ cursor: isUploadingEvidence ? "wait" : "pointer" }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : null}

            {!isDetailReadOnly &&
              activeAction === "progress" &&
              canCreateProgressForCurrentTask ? (
              <form
                onSubmit={handleProgressSubmit}
                style={{
                  width: "100%",
                  maxWidth: 760,
                  display: "grid",
                  gap: 12,
                  ...controlStyles.getPanelStyle({
                    padding: 16,
                    borderRadius: 12,
                    background: "var(--panel-bg)",
                    borderColor: "var(--panel-border)",
                    boxShadow: "none",
                  }),
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={fieldLabelStyle}>
                    <span>Tanggal</span>
                    <input
                      type="date"
                      name="report_date"
                      value={progressForm.report_date}
                      onChange={handleProgressChange}
                      required
                      style={controlStyles.getDateInputStyle(prefersDarkMode)}
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    <span>Progress (%)</span>
                    <input
                      type="number"
                      name="progress_percent"
                      min="0"
                      max="100"
                      value={progressForm.progress_percent}
                      onChange={handleProgressChange}
                      required
                      style={fieldStyle}
                    />
                  </label>
                </div>

                <label style={fieldLabelStyle}>
                  <span>Ringkasan Hasil</span>
                  <textarea
                    name="result_summary"
                    value={progressForm.result_summary}
                    onChange={handleProgressChange}
                    rows={3}
                    style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={fieldLabelStyle}>
                    <span>Kendala</span>
                    <textarea
                      name="issue_summary"
                      value={progressForm.issue_summary}
                      onChange={handleProgressChange}
                      rows={3}
                      style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    <span>Rencana Lanjut</span>
                    <textarea
                      name="next_step_summary"
                      value={progressForm.next_step_summary}
                      onChange={handleProgressChange}
                      rows={3}
                      style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <button
                    type="submit"
                    disabled={isSubmittingProgress}
                    style={controlStyles.getPrimaryButtonStyle(prefersDarkMode, {
                      isEnabled: !isSubmittingProgress,
                      size: "sm",
                      height: 38,
                    })}
                  >
                    {isSubmittingProgress ? "Menyimpan..." : "Simpan Progress"}
                  </button>
                  <button
                    type="button"
                    className={`btn-specific-action ${!isSubmittingProgress ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
                    onClick={() => setActiveAction(null)}
                    disabled={isSubmittingProgress}
                    style={{ cursor: isSubmittingProgress ? "wait" : "pointer" }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}



