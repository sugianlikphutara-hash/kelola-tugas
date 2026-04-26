import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useReducer } from "react";
import { canCreateProgressReport, canEditTask } from "../lib/authorization";
import { useAuth } from "../hooks/useAuth";
import { getCompactText } from "../lib/text";
import {
  getTaskDailyReports,
  updateTaskDailyReportReviewStatus,
  getTaskDailyReportTaskOptions,
  createTaskDailyReport,
  updateTaskDailyReport,
  getExistingTaskDailyReport,
} from "../services/taskService";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import BudgetReportSection from "../components/reporting/BudgetReportSection";
import {
  getAlertStyle,
  getChipStyle,
  getTableBodyCellStyle,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTableCellCompactTypography,
  getTableHeaderTypography,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTableTaskColumnWidthStyle,
  getTableTaskTitleClampClassName,
  getTableTaskTitleCharLimit,
  getOutlinedButtonStyle,
  getPrimaryButtonStyle,
  getNeutralButtonStyle,
  getSelectStyle,
  getDateInputStyle,
  getPageSubtitleStyle,
  getPageTitleStyle,
  getFieldLabelStyle,
  getMetaLabelStyle,
  getTextInputStyle,
  getSectionTitleTypography,
  getFormLabelTypography,
} from "../lib/controlStyles";

const REPORTING_REPORT_DATE_STORAGE_KEY = "kelola_tugas_reporting_report_date";
const REPORTING_MODE_STORAGE_KEY = "kelola_tugas_reporting_mode";
const REPORTING_MODES = [
  { key: "DAILY", label: "Laporan Harian" },
  { key: "JANDIN", label: "Laporan Jandin" },
  { key: "MONTHLY", label: "Laporan Bulanan" },
  { key: "QUARTERLY", label: "Laporan Triwulan" },
  { key: "FINAL", label: "Laporan Akhir" },
  { key: "BUDGET", label: "Laporan Anggaran" },
];
const VALID_REPORTING_MODES = new Set(REPORTING_MODES.map((item) => item.key));
const REPORTING_AUTO_REFRESH_INTERVAL_MS = 15000;

function getTodayDateInputValue() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function formatDateTime(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsedDate);
}

function toDateInputValue(value) {
  if (!value) {
    return getTodayDateInputValue();
  }

  return String(value).slice(0, 10);
}

function isValidDateInputValue(value) {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
}

function getActionPlanLabel(item) {
  return String(item?.action_plan_title || "").trim() || "-";
}

function getDailyReviewBadgeMeta(reviewStatus) {
  const normalizedStatus = String(reviewStatus || "").trim().toLowerCase();

  if (normalizedStatus === "reviewed") {
    return {
      label: "Sudah Diperiksa",
      background: "var(--alert-success-bg)",
      color: "var(--alert-success-color)",
    };
  }

  return {
    label: "Belum Diperiksa",
    background: "var(--alert-warning-bg)",
    color: "var(--alert-warning-color)",
  };
}

function getEmptyReportingForm() {
  return {
    task_id: "",
    work_summary: "",
    document_mode: "none",
    document_link: "",
    file: null,
  };
}

function reportingFormReducer(state, action) {
  switch (action.type) {
    case "setOpen":
      return { ...state, isOpen: action.value };
    case "updateOpen":
      return { ...state, isOpen: action.updater(state.isOpen) };
    case "setSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setForm":
      return { ...state, form: action.value };
    case "updateForm":
      return { ...state, form: action.updater(state.form) };
    case "resetForDateChange":
      return {
        ...state,
        isSubmitting: false,
        form: getEmptyReportingForm(),
      };
    default:
      return state;
  }
}

function toDateOnlyTime(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate.getTime();
}

function isTaskInReportDateRange(task, reportDate) {
  const selectedTime = toDateOnlyTime(reportDate);
  if (selectedTime === null) {
    return true;
  }

  const startTime = toDateOnlyTime(task?.start_date);
  const dueTime = toDateOnlyTime(task?.due_date);

  if (startTime !== null && selectedTime < startTime) {
    return false;
  }

  if (dueTime !== null && selectedTime > dueTime) {
    return false;
  }

  return true;
}

export default function ReportingPage() {
  const auth = useAuth();
  const [prefersDarkMode, setPrefersDarkMode] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [reportingMode, setReportingMode] = useState(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return "DAILY";
    }

    const storedMode = String(
      window.localStorage.getItem(REPORTING_MODE_STORAGE_KEY) || ""
    ).trim().toUpperCase();

    return VALID_REPORTING_MODES.has(storedMode) ? storedMode : "DAILY";
  });
  const [selectedReportDate, setSelectedReportDate] = useState(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return getTodayDateInputValue();
    }

    const storedDate = String(
      window.localStorage.getItem(REPORTING_REPORT_DATE_STORAGE_KEY) || ""
    ).trim();

    return isValidDateInputValue(storedDate)
      ? storedDate
      : getTodayDateInputValue();
  });
  const [dailySubActivityFilter, setDailySubActivityFilter] = useState("ALL");
  const [dailyActionPlanFilter, setDailyActionPlanFilter] = useState("ALL");
  const [dailyAssigneeFilter, setDailyAssigneeFilter] = useState("ALL");
  const [dailyReviewStatusFilter, setDailyReviewStatusFilter] = useState("ALL");
  const [dailyReports, setDailyReports] = useState([]);
  const [expandedDailyReportId, setExpandedDailyReportId] = useState(null);
  const [hoveredDailyReportId, setHoveredDailyReportId] = useState(null);
  const [isLoadingDailyReports, setIsLoadingDailyReports] = useState(false);
  const [dailyLoadError, setDailyLoadError] = useState("");
  const [dailyMessage, setDailyMessage] = useState("");
  const [dailyErrorMessage, setDailyErrorMessage] = useState("");
  const [reviewingDailyReportId, setReviewingDailyReportId] = useState(null);
  const [dailyReviewNotes, setDailyReviewNotes] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isRefreshingDailyReportsRef = useRef(false);
  const [reportingTaskOptions, setReportingTaskOptions] = useState([]);
  const [isLoadingReportingTaskOptions, setIsLoadingReportingTaskOptions] = useState(false);
  const [reportingFormState, dispatchReportingForm] = useReducer(reportingFormReducer, {
    isOpen: false,
    isSubmitting: false,
    form: getEmptyReportingForm(),
  });
  const reportingTaskOptionsRequestIdRef = useRef(0);

  const canReviewDailyReports = canEditTask(auth.roleCode);
  const canOpenProgressModal = canCreateProgressReport(auth.roleCode);

  const isReportingFormOpen = reportingFormState.isOpen;
  const isSubmittingReportingForm = reportingFormState.isSubmitting;
  const reportingForm = reportingFormState.form;
  
  const setIsReportingFormOpen = useCallback((valueOrUpdater) => {
    if (typeof valueOrUpdater === "function") {
      dispatchReportingForm({ type: "updateOpen", updater: valueOrUpdater });
      return;
    }
    dispatchReportingForm({ type: "setOpen", value: valueOrUpdater });
  }, []);
  
  const setIsSubmittingReportingForm = useCallback(
    (value) => dispatchReportingForm({ type: "setSubmitting", value }),
    []
  );
  
  const setReportingForm = useCallback((valueOrUpdater) => {
    if (typeof valueOrUpdater === "function") {
      dispatchReportingForm({ type: "updateForm", updater: valueOrUpdater });
      return;
    }
    dispatchReportingForm({ type: "setForm", value: valueOrUpdater });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setPrefersDarkMode(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const loadDailyReports = useCallback(async ({ showLoading = true } = {}) => {
    if (isRefreshingDailyReportsRef.current) {
      return;
    }

    isRefreshingDailyReportsRef.current = true;

    if (showLoading) {
      setIsLoadingDailyReports(true);
    }

    setDailyLoadError("");

    try {
      const data = await getTaskDailyReports(selectedReportDate);
      setDailyReports(data || []);
    } catch (error) {
      console.error(error);
      setDailyReports([]);
      setExpandedDailyReportId(null);
      setDailyLoadError(error.message || "Gagal memuat data laporan harian.");
    } finally {
      isRefreshingDailyReportsRef.current = false;
      if (showLoading) {
        setIsLoadingDailyReports(false);
      }
    }
  }, [selectedReportDate]);

  useEffect(() => {
    if (auth.isLoading) {
      return undefined;
    }

    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      void loadDailyReports();
    });

    return () => {
      isCancelled = true;
    };
  }, [
    auth.employeeId,
    auth.isAuthenticated,
    auth.isLoading,
    auth.roleCode,
    auth.status,
    loadDailyReports,
    selectedReportDate,
  ]);

  useEffect(() => {
    if (reportingMode !== "DAILY" || auth.isLoading) {
      return undefined;
    }

    const refreshDailyReports = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      void loadDailyReports({ showLoading: false });
    };

    const intervalId = window.setInterval(
      refreshDailyReports,
      REPORTING_AUTO_REFRESH_INTERVAL_MS
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDailyReports();
      }
    };

    const handleWindowFocus = () => {
      refreshDailyReports();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [auth.isLoading, loadDailyReports, reportingMode, selectedReportDate]);

  const handleTaskUpdated = useCallback(async (updateContext = null) => {
    const updatedTaskId = String(updateContext?.taskId || "").trim();
    const nextProgressPercent = Number(updateContext?.progressPercent);
    const mutationType = String(updateContext?.mutationContext?.type || "").trim().toLowerCase();
    const hasProgressUpdate =
      Boolean(updatedTaskId) && Number.isFinite(nextProgressPercent);

    if (hasProgressUpdate) {
      setDailyReports((currentReports) =>
        currentReports.map((report) =>
          String(report?.task_id || "").trim() === updatedTaskId
            ? { ...report, progress_percent: nextProgressPercent }
            : report
        )
      );

      setSelectedTask((currentTask) =>
        String(currentTask?.task_id || "").trim() === updatedTaskId
          ? { ...currentTask, progress_percent: nextProgressPercent }
          : currentTask
      );
    }

    if (mutationType === "progress") {
      return;
    }

    await loadDailyReports({ showLoading: false });
  }, [loadDailyReports]);

  async function handleDailyReviewStatusChange(report, nextReviewStatus) {
    if (!report?.id) {
      return;
    }

    if (!canReviewDailyReports) {
      setDailyMessage("");
      setDailyErrorMessage("Anda tidak memiliki izin untuk memeriksa laporan harian.");
      return;
    }

    setReviewingDailyReportId(report.id);
    setDailyMessage("");
    setDailyErrorMessage("");

    try {
      const reviewNotes = String(dailyReviewNotes[report.id] ?? report.review_notes ?? "").trim();
      await updateTaskDailyReportReviewStatus(report.id, {
        reviewStatus: nextReviewStatus,
        reviewNotes,
      });
      await loadDailyReports({ showLoading: false });
      setDailyReviewNotes((prev) => ({
        ...prev,
        [report.id]: reviewNotes,
      }));
      setDailyMessage(
        nextReviewStatus === "reviewed"
          ? "Laporan harian ditandai sudah diperiksa."
          : "Status pemeriksaan laporan harian dikembalikan ke pending."
      );
    } catch (error) {
      console.error(error);
      setDailyErrorMessage(error.message || "Gagal memperbarui status laporan harian.");
    } finally {
      setReviewingDailyReportId(null);
    }
  }

  const loadReportingTaskOptions = useCallback(async () => {
    const requestId = ++reportingTaskOptionsRequestIdRef.current;
    setIsLoadingReportingTaskOptions(true);

    try {
      const data = await getTaskDailyReportTaskOptions();
      if (requestId !== reportingTaskOptionsRequestIdRef.current) {
        return;
      }
      setReportingTaskOptions(data || []);
    } catch (error) {
      console.error(error);
      if (requestId !== reportingTaskOptionsRequestIdRef.current) {
        return;
      }
      setReportingTaskOptions([]);
    } finally {
      if (requestId === reportingTaskOptionsRequestIdRef.current) {
        setIsLoadingReportingTaskOptions(false);
      }
    }
  }, []);

  function persistReportingMode(nextMode) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const modeToStore = VALID_REPORTING_MODES.has(nextMode) ? nextMode : "DAILY";
    window.localStorage.setItem(REPORTING_MODE_STORAGE_KEY, modeToStore);
  }

  function handleReportingModeChange(nextMode) {
    setReportingMode(nextMode);
    persistReportingMode(nextMode);
  }

  function persistSelectedReportDate(nextDate) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const normalizedDate = String(nextDate ?? "").trim();
    if (!normalizedDate) {
      window.localStorage.removeItem(REPORTING_REPORT_DATE_STORAGE_KEY);
      return;
    }

    if (!isValidDateInputValue(normalizedDate)) {
      return;
    }

    window.localStorage.setItem(REPORTING_REPORT_DATE_STORAGE_KEY, normalizedDate);
  }

  function resetDailyStateForReportDateChange() {
    setDailyMessage("");
    setDailyErrorMessage("");
    setExpandedDailyReportId(null);
    setDailySubActivityFilter("ALL");
    setDailyActionPlanFilter("ALL");
    setDailyAssigneeFilter("ALL");
    setDailyReviewStatusFilter("ALL");
    dispatchReportingForm({ type: "resetForDateChange" });
  }

  function handleSelectedReportDateChange(nextDate) {
    const normalizedDate = String(nextDate ?? "");
    setSelectedReportDate(normalizedDate);
    persistSelectedReportDate(normalizedDate);
    resetDailyStateForReportDateChange();

    if (isReportingFormOpen) {
      void loadReportingTaskOptions();
    }
  }

  function handleToggleReportingFormOpen() {
    const nextValue = !isReportingFormOpen;
    setIsReportingFormOpen(nextValue);

    if (nextValue) {
      void loadReportingTaskOptions();
    }
  }

  const availableReportingTaskOptions = useMemo(() => {
    const options = (reportingTaskOptions || []).filter((task) =>
      isTaskInReportDateRange(task, selectedReportDate)
    );
    return options;
  }, [reportingTaskOptions, selectedReportDate]);

  const selectedReportingTaskOption = useMemo(() => {
    if (!reportingForm.task_id) {
      return null;
    }

    return (
      reportingTaskOptions.find(
        (task) => String(task?.task_id || "") === String(reportingForm.task_id || "")
      ) || null
    );
  }, [reportingForm.task_id, reportingTaskOptions]);

  const selectedExistingReportingReport = useMemo(() => {
    if (!reportingForm.task_id) {
      return null;
    }

    return (
      dailyReports.find(
        (report) =>
          String(report?.task_id || "") === String(reportingForm.task_id || "") &&
          String(report?.report_date || "").slice(0, 10) === String(selectedReportDate || "")
      ) || null
    );
  }, [reportingForm.task_id, dailyReports, selectedReportDate]);

  function handleReportingFormChange(event) {
    const { name, value, files } = event.target;
    setReportingForm((prev) => ({
      ...prev,
      [name]: name === "file" ? files?.[0] || null : value,
    }));
  }

  async function handleReportingFormSubmit(event) {
    event.preventDefault();

    if (!canCreateProgressReport(auth.roleCode)) {
      setDailyErrorMessage("Anda tidak memiliki izin untuk mengisi laporan harian (Sub Task).");
      return;
    }

    if (!reportingForm.task_id) {
      setDailyErrorMessage("Task untuk laporan harian wajib dipilih.");
      return;
    }

    if (
      !availableReportingTaskOptions.some(
        (task) => String(task?.task_id || "") === String(reportingForm.task_id || "")
      )
    ) {
      setDailyErrorMessage("Task yang dipilih tidak sesuai dengan range tanggal laporan.");
      return;
    }

    const trimmedWorkSummary = String(reportingForm.work_summary || "").trim();
    if (!trimmedWorkSummary) {
      setDailyErrorMessage("Ringkasan pekerjaan wajib diisi.");
      return;
    }

    if (
      reportingForm.document_mode === "file" &&
      !reportingForm.file
    ) {
      setDailyErrorMessage("File laporan wajib dipilih.");
      return;
    }

    if (
      reportingForm.document_mode === "link" &&
      !String(reportingForm.document_link || "").trim()
    ) {
      setDailyErrorMessage("Link dokumen laporan wajib diisi.");
      return;
    }

    setIsSubmittingReportingForm(true);
    setDailyErrorMessage("");

    try {
      const existingReport = await getExistingTaskDailyReport(
        reportingForm.task_id,
        selectedReportDate
      );

      const payload = {
        taskId: reportingForm.task_id,
        reportDate: selectedReportDate,
        workSummary: trimmedWorkSummary,
        documentLink:
          reportingForm.document_mode === "link"
            ? reportingForm.document_link
            : null,
        file:
          reportingForm.document_mode === "file"
            ? reportingForm.file
            : null,
        keepExistingDocument: reportingForm.document_mode === "keep",
      };

      if (existingReport?.id) {
        await updateTaskDailyReport(existingReport.id, payload);
      } else {
        await createTaskDailyReport(payload);
      }

      await loadDailyReports({ showLoading: false });
      setReportingForm(getEmptyReportingForm());
      setIsReportingFormOpen(false);
      setDailyMessage(
        existingReport?.id
          ? "Laporan harian (Sub Task) berhasil diperbarui."
          : "Laporan harian berhasil disimpan."
      );
    } catch (error) {
      console.error(error);
      setDailyErrorMessage(error.message || "Gagal menyimpan laporan harian (Sub Task).");
    } finally {
      setIsSubmittingReportingForm(false);
    }
  }

  const dailySummary = useMemo(() => {
    const reviewedCount = dailyReports.filter(
      (report) => String(report?.review_status || "").trim().toLowerCase() === "reviewed"
    ).length;

    return {
      total: dailyReports.length,
      reviewed: reviewedCount,
      pending: dailyReports.length - reviewedCount,
    };
  }, [dailyReports]);

  const dailySubActivityOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyReports
          .map((report) => String(report?.sub_activity_name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [dailyReports]);

  const dailyActionPlanOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyReports
          .map((report) => getActionPlanLabel(report))
          .filter((value) => value && value !== "-")
      )
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [dailyReports]);

  const dailyAssigneeOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyReports
          .map((report) =>
            String(report?.assignee_display_name || report?.assignee_name || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [dailyReports]);

  const dailyReviewStatusOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyReports
          .map((report) => getDailyReviewBadgeMeta(report?.review_status).label)
          .filter(Boolean)
      )
    );
  }, [dailyReports]);

  const filteredDailyReports = useMemo(() => {
    return dailyReports.filter((report) => {
      if (
        dailySubActivityFilter !== "ALL" &&
        String(report?.sub_activity_name || "").trim() !== dailySubActivityFilter
      ) {
        return false;
      }

      if (
        dailyActionPlanFilter !== "ALL" &&
        getActionPlanLabel(report) !== dailyActionPlanFilter
      ) {
        return false;
      }

      if (
        dailyAssigneeFilter !== "ALL" &&
        String(report?.assignee_display_name || report?.assignee_name || "").trim() !==
        dailyAssigneeFilter
      ) {
        return false;
      }

      if (
        dailyReviewStatusFilter !== "ALL" &&
        getDailyReviewBadgeMeta(report?.review_status).label !== dailyReviewStatusFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    dailyActionPlanFilter,
    dailyAssigneeFilter,
    dailyReports,
    dailyReviewStatusFilter,
    dailySubActivityFilter,
  ]);

  const hasActiveDailyFilters =
    dailySubActivityFilter !== "ALL" ||
    dailyActionPlanFilter !== "ALL" ||
    dailyAssigneeFilter !== "ALL" ||
    dailyReviewStatusFilter !== "ALL";

  const tableFrameStyle = useMemo(() => {
    return getTableFrameStyle({
      borderColor: prefersDarkMode ? "var(--border-strong)" : "var(--border-subtle)",
      background: prefersDarkMode
        ? "linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 100%)"
        : "linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%)",
      boxShadow: prefersDarkMode
        ? "0 18px 40px rgba(0, 0, 0, 0.28)"
        : "0 18px 38px rgba(15, 23, 42, 0.08)",
    });
  }, [prefersDarkMode]);

  const tableBodyCellStyle = useMemo(() => {
    return getTableBodyCellStyle({
      padding: "16px 14px",
      fontSize: 13,
      borderColor: "var(--table-row-border)",
    });
  }, []);

  const taskColumnMode = 2;
  const taskColumnWidthStyle = useMemo(() => {
    return getTableTaskColumnWidthStyle({ mode: taskColumnMode });
  }, [taskColumnMode]);
  const taskTitleClampClassName = useMemo(() => {
    return getTableTaskTitleClampClassName({ mode: taskColumnMode });
  }, [taskColumnMode]);
  const taskTitleCharLimit = useMemo(() => {
    return getTableTaskTitleCharLimit({ mode: taskColumnMode });
  }, [taskColumnMode]);

  const getTableBodyTextAlign = useCallback((columnIndex) => {
    return columnIndex === 0 || columnIndex === 1 || columnIndex === 2 ? "left" : "center";
  }, []);

  return (
    <div style={{ paddingBottom: 60 }}>
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 20, 
          marginBottom: 50,
          flexWrap: "wrap"
        }}
      >
        <h1 style={{ ...getPageTitleStyle(), margin: 0 }}>PELAPORAN</h1>
        
        {/* Garis Vertikal Pemisah */}
        <div 
          style={{ 
            width: "1.5px", 
            height: "28px", 
            backgroundColor: "var(--border-strong)",
            display: "block" 
          }} 
        />

        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center"
          }}
        >
          {REPORTING_MODES.map((mode) => {
            const isActive = reportingMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => handleReportingModeChange(mode.key)}
                className={`sub-page-button ${isActive ? "sub-page-button--active" : "sub-page-button--inactive"}`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 20 }}>

        {reportingMode !== "DAILY" && reportingMode !== "BUDGET" ? (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <div style={getPageSubtitleStyle()}>
              {REPORTING_MODES.find((item) => item.key === reportingMode)?.label || "Mode Pelaporan"}
            </div>
            <div style={getFormLabelTypography()}>
              Mode ini belum dibangun. Untuk tahap sekarang, fokus implementasi masih di
              {" "}
              <strong>Laporan Harian</strong>.
            </div>
          </div>
        ) : null}

        {reportingMode === "BUDGET" ? (
          <BudgetReportSection prefersDarkMode={prefersDarkMode} />
        ) : null}

        {reportingMode !== "DAILY" ? null : (
          <>
            <div style={{ display: "grid", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={getPageSubtitleStyle()}>Laporan Harian</div>
                  <div style={getFormLabelTypography()}>
                    Fokus pada tanggal pelaporan. Klik task untuk membuka rincian laporan secara inline.
                  </div>
                  </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      ...getTableCellCompactTypography({ fontWeight: 600 }),
      whiteSpace: "nowrap",
    }}
  >
    <span>Tanggal Laporan</span>
    <input
      type="date"
      value={toDateInputValue(selectedReportDate)}
      onChange={(event) => handleSelectedReportDateChange(event.target.value)}
      style={{
        ...getDateInputStyle(prefersDarkMode),
        minWidth: 150,
      }}
    />
  </label>
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <div
      style={{
        display: "flex",
        gap: 0,
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid var(--control-border)`,
        background: "var(--panel-bg)",
      }}
    >
      <button
        type="button"
        className={`btn-toggle-filter ${selectedReportDate !== "" ? "btn-toggle-filter-active" : "btn-toggle-filter-inactive"}`}
        onClick={() => {
          handleSelectedReportDateChange(getTodayDateInputValue());
        }}
        style={{
          flex: 1,
          minWidth: 120,
          borderRight: `1px solid var(--control-border)`,
          cursor: "pointer",
          borderRadius: 0,
        }}
      >
        Hari Ini
      </button>
      <button
        type="button"
        className={`btn-toggle-filter ${selectedReportDate === "" ? "btn-toggle-filter-active" : "btn-toggle-filter-inactive"}`}
        onClick={() => {
          handleSelectedReportDateChange("");
        }}
        style={{
          flex: 1,
          minWidth: 160,
          cursor: "pointer",
          borderRadius: 0,
        }}
      >
        Semua Laporan
      </button>
    </div>
    
    {/* NEW BUTTON: Tambah / Ubah Laporan Harian */}
    <button
      type="button"
      onClick={() => {
        handleToggleReportingFormOpen();
      }}
      style={{
        ...(isReportingFormOpen
          ? getNeutralButtonStyle(prefersDarkMode, {
            isEnabled: true,
            size: "sm",
            height: 38,
          })
          : getPrimaryButtonStyle(prefersDarkMode, {
            isEnabled: true,
            size: "sm",
            height: 38,
          })),
        minWidth: 200,
      }}
    >
      {isReportingFormOpen ? "Tutup Form" : "+ Tambah / Ubah Sub Task"}
    </button>
  </div>
</div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  {
                    key: "total",
                    label: "Task Dilaporkan",
                    value: dailySummary.total,
                  },
                  {
                    key: "pending",
                    label: "Belum Diperiksa",
                    value: dailySummary.pending,
                  },
                  {
                    key: "reviewed",
                    label: "Sudah Diperiksa",
                    value: dailySummary.reviewed,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    style={{
                      flex: "1 1 220px",
                      minWidth: 220,
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                      background: prefersDarkMode ? "var(--surface-2)" : "var(--surface-1)",
                      padding: "16px 20px",
                      display: "grid",
                      gap: 8,
                      boxShadow: "none",
                      borderLeft: "4px solid var(--pebble)",
                    }}
                  >
                    <div style={getTableHeaderTypography()}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 32, lineHeight: 1, fontWeight: 900, color: "var(--text-h)" }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FORM SECTION */}
{canCreateProgressReport(auth.roleCode) ? (
  <div
    style={{
      ...tableFrameStyle,
      padding: 16,
      borderRadius: 8,
      display: isReportingFormOpen ? "grid" : "none",
      gap: 14,
    }}
  >
    <div>
      <div style={{ ...getSectionTitleTypography({ fontSize: 16 }) }}>
        Input Sub Task
      </div>
      <div style={getFormLabelTypography()}>
        Satu task hanya boleh memiliki satu sub task pada tanggal yang sama.
      </div>
    </div>

    {isReportingFormOpen ? (
      <form
        onSubmit={handleReportingFormSubmit}
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            <label style={getFieldLabelStyle(prefersDarkMode)}>
              <span>Task</span>
              <select
                name="task_id"
                value={reportingForm.task_id}
                onChange={handleReportingFormChange}
                disabled={isLoadingReportingTaskOptions}
                style={{
                  ...getSelectStyle(prefersDarkMode, { tone: "panel" }),
                }}
              >
                <option value="">Pilih Task</option>
                {availableReportingTaskOptions.map((task) => (
                  <option key={task.task_id} value={task.task_id}>
                    {task.task_title} - {task.assignee_display_name || task.assignee_name || "-"}
                  </option>
                ))}
              </select>
            </label>

            <label style={getFieldLabelStyle(prefersDarkMode)}>
              <span>Tanggal Laporan</span>
              <input
                type="date"
                value={toDateInputValue(selectedReportDate)}
                disabled
                style={getDateInputStyle(prefersDarkMode, {
                  tone: "muted",
                  isDisabled: true,
                })}
              />
            </label>
          </div>

          {selectedExistingReportingReport ? (
            <div
              style={{
                ...getAlertStyle(prefersDarkMode, { tone: "warning" }),
                lineHeight: 1.5,
              }}
            >
              TASK terpilih punya LAPORAN dengan tanggal sama. Jika lanjut
              {' '}
              "Perbarui Laporan", LAPORAN sebelumnya akan TERHAPUS dan DIPERBAHARUI
            </div>
          ) : null}
        </div>

        {selectedReportingTaskOption ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              background: prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={getMetaLabelStyle(prefersDarkMode)}>
              Konteks Task
            </div>
            <div style={getFormLabelTypography()}>
              <strong>Rencana Aksi:</strong> {getActionPlanLabel(selectedReportingTaskOption)}
            </div>
            <div style={getFormLabelTypography()}>
              <strong>Periode Task:</strong> {formatDate(selectedReportingTaskOption.start_date)} - {formatDate(selectedReportingTaskOption.due_date)}
            </div>
          </div>
        ) : null}

        <div className="reporting-daily-form__summary-row">
          <label style={{ display: "grid", gap: 6, ...getFormLabelTypography() }}>
            <span>Sub Task</span>
            <textarea
              name="work_summary"
              value={reportingForm.work_summary}
              onChange={handleReportingFormChange}
              rows={4}
              placeholder="Tuliskan sub task / pekerjaan yang dilakukan hari ini..."
              style={{
                ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
                width: 734,
                maxWidth: "100%",
                height: 99,
                minHeight: 99,
                maxHeight: 99,
                resize: "none",
              }}
            />
          </label>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <div style={getFormLabelTypography()}>
              Dokumen Laporan Harian ( Eviden Sub Task )
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div
                className="reporting-daily-form__doc-mode-row"
                style={{ flex: "1 1 auto", minWidth: 0 }}
              >
                {[
                  { value: "none", label: "Tanpa Dokumen" },
                  ...(selectedExistingReportingReport?.daily_document || selectedExistingReportingReport?.document_link
                    ? [{ value: "keep", label: "Pertahankan Dokumen Saat Ini" }]
                    : []),
                  { value: "file", label: "Upload File" },
                  { value: "link", label: "Gunakan Link" },
                ].map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--control-border)",
                      background:
                        reportingForm.document_mode === option.value
                          ? "var(--surface-2)"
                          : "var(--panel-bg)",
                      color: "var(--text-h)",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="document_mode"
                      value={option.value}
                      checked={reportingForm.document_mode === option.value}
                      onChange={handleReportingFormChange}
                      style={{ accentColor: "var(--text-muted)" }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                <button
                  type="submit"
                  disabled={isSubmittingReportingForm}
                  style={{
                    ...getPrimaryButtonStyle(prefersDarkMode, {
                      isEnabled: !isSubmittingReportingForm,
                      height: 40,
                    }),
                    cursor: isSubmittingReportingForm ? "wait" : "pointer",
                  }}
                >
                  {selectedExistingReportingReport?.id ? "Perbarui Laporan" : "Simpan Sub Task"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReportingFormOpen(false);
                    setReportingForm(getEmptyReportingForm());
                  }}
                  style={getNeutralButtonStyle(prefersDarkMode, {
                    isEnabled: !isSubmittingReportingForm,
                    height: 40,
                  })}
                >
                  Batal
                </button>
              </div>
            </div>

            {selectedExistingReportingReport?.daily_document || selectedExistingReportingReport?.document_link ? (
              <div style={getTableCellCompactTypography()}>
                Dokumen saat ini:{" "}
                {selectedExistingReportingReport?.daily_document?.title ||
                  selectedExistingReportingReport?.daily_document?.file_name ||
                  selectedExistingReportingReport?.document_link ||
                  "-"}
              </div>
            ) : null}

            {reportingForm.document_mode === "file" ? (
              <div style={{ display: "grid", gap: 6 }}>
                <input
                  type="file"
                  name="file"
                  onChange={handleReportingFormChange}
                  className="app-file-input"
                />
              </div>
            ) : null}

            {reportingForm.document_mode === "link" ? (
              <div style={{ display: "grid", gap: 6 }}>
                <input
                  type="url"
                  name="document_link"
                  value={reportingForm.document_link}
                  onChange={handleReportingFormChange}
                  placeholder="https://..."
                  style={getTextInputStyle(prefersDarkMode, { tone: "panel" })}
                />
              </div>
            ) : null}
          </div>
        </div>
      </form>
    ) : null}
  </div>
) : null}

            {dailyMessage ? (
              <div style={getAlertStyle(prefersDarkMode, { tone: "success" })}>
                {dailyMessage}
              </div>
            ) : null}

            {dailyErrorMessage ? (
              <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
                {dailyErrorMessage}
              </div>
            ) : null}

            {dailyLoadError ? (
              <div
                style={{
                  ...getAlertStyle(prefersDarkMode, { tone: "error", padding: "12px 14px", borderRadius: 8 }),
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>{dailyLoadError}</span>
                <button
                  type="button"
                  onClick={() => void loadDailyReports()}
                  style={getOutlinedButtonStyle(prefersDarkMode, {
                    isEnabled: true,
                    height: 34,
                    size: "xs",
                  })}
                >
                  Coba Lagi
                </button>
              </div>
            ) : null}

            <div style={{ paddingBottom: 4 }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "end",
                }}
              >
                <select
                  value={dailySubActivityFilter}
                  onChange={(event) => setDailySubActivityFilter(event.target.value)}
                  className="filter-select"
                  style={{ flex: "1 1 200px", maxWidth: 260 }}
                >
                  <option value="ALL">Semua Sub Kegiatan</option>
                  {dailySubActivityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  value={dailyActionPlanFilter}
                  onChange={(event) => setDailyActionPlanFilter(event.target.value)}
                  className="filter-select"
                  style={{ flex: "1 1 200px", maxWidth: 260 }}
                >
                  <option value="ALL">Semua Rencana Aksi</option>
                  {dailyActionPlanOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  value={dailyAssigneeFilter}
                  onChange={(event) => setDailyAssigneeFilter(event.target.value)}
                  className="filter-select"
                  style={{ flex: "1 1 200px", maxWidth: 260 }}
                >
                  <option value="ALL">Semua Pelaksana</option>
                  {dailyAssigneeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  value={dailyReviewStatusFilter}
                  onChange={(event) => setDailyReviewStatusFilter(event.target.value)}
                  className="filter-select"
                  style={{ flex: "1 1 200px", maxWidth: 260 }}
                >
                  <option value="ALL">Semua Status Pemeriksaan</option>
                  {dailyReviewStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`btn-specific-action ${hasActiveDailyFilters ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
                  onClick={() => {
                    setDailySubActivityFilter("ALL");
                    setDailyActionPlanFilter("ALL");
                    setDailyAssigneeFilter("ALL");
                    setDailyReviewStatusFilter("ALL");
                  }}
                  disabled={!hasActiveDailyFilters}
                  style={{ flex: "0 0 auto" }}
                >
                  Reset Filter
                </button>
              </div>
            </div>

            <div style={tableFrameStyle}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      {["Sub Task / Task", "Pelaksana", "Sub Kegiatan", "Status Pemeriksaan", "Progress", "Aksi"].map((label, index) => (
                        <th
                          key={label}
                          style={{
                            ...getTableHeaderCellStyle({
                              alignMode: 1,
                              label: label,
                            }),
                            ...(index === 0 ? taskColumnWidthStyle : {}),
                            textAlign: index === 0 || index === 1 ||index === 2 ? "left" : "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!isLoadingDailyReports && filteredDailyReports.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            ...tableBodyCellStyle,
                            padding: 18,
                            textAlign: "center",
                            color: "var(--text-muted)",
                          }}
                        >
                          {dailyReports.length === 0
                            ? "Belum ada laporan harian (Sub Task) pada tanggal ini."
                            : "Belum ada laporan harian (Sub Task)yang sesuai dengan filter."}
                        </td>
                      </tr>
                    ) : null}

                    {isLoadingDailyReports ? (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            ...tableBodyCellStyle,
                            padding: 18,
                            textAlign: "center",
                            color: "var(--text-muted)",
                          }}
                        >
                          Memuat laporan harian (Sub Task)...
                        </td>
                      </tr>
                    ) : null}

                    {filteredDailyReports.map((report) => {
                      const isExpanded = expandedDailyReportId === report.id;
                      const isHovered = hoveredDailyReportId === report.id;
                      const reviewBadge = getDailyReviewBadgeMeta(report.review_status);
                      const isReviewedReport =
                        String(report?.review_status || "").trim().toLowerCase() === "reviewed";
                      const documentHref =
                        report?.daily_document?.file_url ||
                        report?.daily_document?.signed_url ||
                        report?.document_link ||
                        null;
                      const documentLabel =
                        report?.daily_document?.title ||
                        report?.daily_document?.file_name ||
                        report?.document_link ||
                        "Belum ada eviden";
                      const reviewNoteText = String(report?.review_notes || "").trim();
                      const borderColor = isExpanded
                        ? prefersDarkMode
                          ? "var(--border-strong)"
                          : "var(--border-strong)"
                        : "var(--border-subtle)";

                      return (
                        <Fragment key={report.id}>
                          <tr
                            onMouseEnter={() => setHoveredDailyReportId(report.id)}
                            onMouseLeave={() => setHoveredDailyReportId(null)}
                            onClick={() =>
                              setExpandedDailyReportId((currentValue) =>
                                currentValue === report.id ? null : report.id
                              )
                            }
                            style={{
                              cursor: "pointer",
                              background: isExpanded
                                ? prefersDarkMode
                                  ? "var(--row-active-bg)"
                                  : "var(--row-active-bg)"
                                : isHovered
                                  ? prefersDarkMode
                                    ? "var(--row-hover-bg)"
                                    : "var(--row-hover-bg)"
                                  : "transparent",
                            }}
                          >
                            <td
                              style={{
                                ...tableBodyCellStyle,
                                ...taskColumnWidthStyle,
                                borderBottom: `1px solid ${borderColor}`,
                                textAlign: getTableBodyTextAlign(0),
                              }}
                            >
                              <div
                                className={taskTitleClampClassName || undefined}
                                style={getTableCellLabelTypography()}
                              >
                                {taskTitleCharLimit
                                  ? getCompactText(report.work_summary, taskTitleCharLimit)
                                  : String(report.work_summary || "").trim() || "-"}
                              </div>
                              <div style={{ ...getTableCellSubtitleTypography(), marginTop: 4 }}>
                                {report.task_title || "-"}
                              </div>
                            </td>
                            <td
                              style={{
                                ...tableBodyCellStyle,
                                borderBottom: `1px solid ${borderColor}`,
                                textAlign: getTableBodyTextAlign(1),
                              }}
                            >
                              {report.assignee_display_name || report.assignee_name || "-"}
                            </td>
                            <td
                              style={{
                                ...tableBodyCellStyle,
                                borderBottom: `1px solid ${borderColor}`,
                                textAlign: getTableBodyTextAlign(2),
                              }}
                            >
                              {report.sub_activity_name || "-"}
                            </td>
                            <td style={{ ...tableBodyCellStyle, borderBottom: `1px solid ${borderColor}`, textAlign: "center" }}>
                              <span
                                style={getChipStyle(prefersDarkMode, {
                                  size: "xs",
                                  background: reviewBadge.background,
                                  color: reviewBadge.color,
                                })}
                              >
                                {reviewBadge.label}
                              </span>
                            </td>
                            <td
                              style={{
                                ...tableBodyCellStyle,
                                borderBottom: `1px solid ${borderColor}`,
                                textAlign: getTableBodyTextAlign(4),
                              }}
                            >
                              {Number(report.progress_percent || 0)}%
                            </td>
                            <td
                              style={{
                                ...tableBodyCellStyle,
                                borderBottom: `1px solid ${borderColor}`,
                                textAlign: getTableBodyTextAlign(5),
                              }}
                            >
                              {isExpanded ? "Tutup" : "Lihat"}
                            </td>
                          </tr>

                          {isExpanded ? (
                            <tr>
                              <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid var(--border-strong)" }}>
                                <div
                                  style={{
                                    padding: 16,
                                    background: "var(--surface-1)",
                                    border: "1px solid var(--border-strong)",
                                    borderTop: "none",
                                    margin: "0 10px 10px 10px",
                                    borderRadius: "0 0 12px 12px",
                                    display: "grid",
                                    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
                                    gap: 16,
                                    alignItems: "stretch",
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: "12px 14px",
                                      borderRadius: 12,
                                      border: "1px solid var(--panel-border)",
                                      background: "var(--panel-bg)",
                                      display: "grid",
                                      gap: 8,
                                      alignContent: "start",
                                    }}
                                  >
                                    <div style={getTableHeaderTypography()}>
                                      Ringkasan
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Tanggal:</strong> {formatDate(report.report_date)}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Laporan Harian:</strong> {getCompactText(report.work_summary)}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Periode Task:</strong> {formatDate(report.start_date)} - {formatDate(report.due_date)}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Progress Task:</strong> {Number(report.progress_percent || 0)}%
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Dibuat oleh:</strong> {report.created_by_employee_name || "-"}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedTask(report);
                                        setIsDetailOpen(true);
                                      }}
                                      disabled={!canOpenProgressModal}
                                      style={{
                                        justifySelf: "start",
                                        marginTop: 4,
                                        ...getPrimaryButtonStyle(prefersDarkMode, {
                                          isEnabled: canOpenProgressModal,
                                          size: "sm",
                                          height: 38,
                                        }),
                                      }}
                                    >
                                      Isi Progress
                                    </button>
                                  </div>

                                  <div
                                    style={{
                                      padding: "12px 14px",
                                      borderRadius: 12,
                                      border: "1px solid var(--panel-border)",
                                      background: "var(--panel-bg)",
                                      display: "grid",
                                      gap: 8,
                                      alignContent: "start",
                                    }}
                                  >
                                    <div style={getTableHeaderTypography()}>
                                      Pemeriksaan
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Status:</strong> {reviewBadge.label}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Diperiksa oleh:</strong> {report.reviewed_by_employee_name || "-"}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Waktu Pemeriksaan:</strong> {formatDateTime(report.reviewed_at)}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Eviden Laporan Harian:</strong>{" "}
                                      {documentHref ? (
                                        <a
                                          href={documentHref}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(event) => event.stopPropagation()}
                                          style={{
                                            color: "var(--alert-info-color)",
                                            textDecoration: "none",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {documentLabel}
                                        </a>
                                      ) : (
                                        <span style={{ color: "var(--text-subtle)" }}>
                                          {documentLabel}
                                        </span>
                                      )}
                                    </div>
                                    <div style={getFormLabelTypography()}>
                                      <strong>Catatan Pemeriksaan:</strong>
                                    </div>
                                    <div
                                      style={{
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: "1px solid var(--panel-border)",
                                        background: "var(--surface-2)",
                                        ...getFormLabelTypography(),
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      {reviewNoteText || "Belum ada catatan pemeriksaan."}
                                    </div>

                                    {canReviewDailyReports && !isReviewedReport ? (
                                      <textarea
                                        value={dailyReviewNotes[report.id] ?? String(report?.review_notes || "")}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) =>
                                          setDailyReviewNotes((prev) => ({
                                            ...prev,
                                            [report.id]: event.target.value,
                                          }))
                                        }
                                        rows={4}
                                        placeholder="Tulis catatan pemeriksaan singkat bila diperlukan..."
                                        style={{
                                          padding: "10px 12px",
                                          borderRadius: 10,
                                          border: "1px solid var(--control-border)",
                                          background: "var(--panel-bg)",
                                          color: "var(--text-h)",
                                          resize: "vertical",
                                          ...getFormLabelTypography(),
                                        }}
                                      />
                                    ) : null}

                                    {canReviewDailyReports ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDailyReviewStatusChange(
                                            report,
                                            report.review_status === "reviewed" ? "pending" : "reviewed"
                                          );
                                        }}
                                        disabled={reviewingDailyReportId === report.id}
                                        style={{
                                          border: "none",
                                          borderRadius: 10,
                                          padding: "9px 12px",
                                          ...getTableCellCompactTypography({ fontWeight: 600 }),
                                          cursor: reviewingDailyReportId === report.id ? "wait" : "pointer",
                                          background:
                                            report.review_status === "reviewed"
                                              ? "var(--alert-error-bg)"
                                              : "var(--alert-success-bg)",
                                          color:
                                            report.review_status === "reviewed"
                                              ? "var(--alert-error-color)"
                                              : "var(--alert-success-color)",
                                        }}
                                      >
                                        {reviewingDailyReportId === report.id
                                          ? "Menyimpan..."
                                          : report.review_status === "reviewed"
                                            ? "Batalkan Pemeriksaan"
                                            : "Tandai Sudah Diperiksa"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {isDetailOpen && selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setIsDetailOpen(false)}
          onTaskUpdated={handleTaskUpdated}
        />
      ) : null}
    </div>
  );
}
