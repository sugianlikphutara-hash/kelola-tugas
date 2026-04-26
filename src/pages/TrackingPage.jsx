import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  canCompleteTaskFollowUp,
  canCreateTaskFollowUp,
} from "../lib/authorization";
import {
  createTaskFollowUp,
  getTaskDailyReports,
  getTaskDailyReportsGroupedByTask,
  getTaskFollowUps,
  getTaskFollowUpIndicatorsByTaskIds,
  getTrackingTasks,
  updateTaskFollowUpStatus,
} from "../services/taskService";
import {
  getAlertStyle,
  getChipStyle,
  getMetaLabelStyle,
  getNeutralButtonStyle,
  getOverlayStyle,
  getModalStyle,
  getPanelStyle,
  getTableBodyCellStyle,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTableTaskColumnWidthStyle,
  getTableTaskTitleClampClassName,
  getTableTaskTitleCharLimit,
  getPrimaryButtonStyle,
  getTextInputStyle,
  getSearchInputStyle,
  getPageTitleStyle,
} from "../lib/controlStyles";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import DailySubTaskFilterBar from "../components/tracking/DailySubTaskFilterBar";
import TrackingIssuesTableRow from "../components/tracking/TrackingIssuesTableRow";
import ToastStack from "../components/ui/ToastStack";
import { useToasts } from "../hooks/useToasts";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import { getCompactText } from "../lib/text";

const TRACKING_MODE_STORAGE_KEY = "kelola_tugas_tracking_mode";
const VALID_TRACKING_MODES = new Set(["ISSUES", "DAILY"]);
const TABLE_ROW_HOVER_FILTER_DARK = "brightness(1.08)";
const TABLE_ROW_HOVER_FILTER_LIGHT = "brightness(0.985)";

function trackingFiltersReducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "toggle": {
      const key = action.key;
      const nextValue = state[key] === action.value ? action.fallback : action.value;
      return { ...state, [key]: nextValue };
    }
    case "resetIssues":
      return {
        ...state,
        subActivityFilter: "ALL",
        assigneeFilter: "ALL",
        statusFilter: "ALL",
      };
    case "resetDaily":
      return {
        ...state,
        dailySubActivityFilter: "ALL",
        dailyActionPlanFilter: "ALL",
        dailyAssigneeFilter: "ALL",
        dailyReviewStatusFilter: "ALL",
      };
    default:
      return state;
  }
}

function detailReducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "update":
      return { ...state, [action.key]: action.updater(state[action.key]) };
    case "resetFollowUpDraft":
      return { ...state, noteValue: "" };
    default:
      return state;
  }
}

function getTodayDateInputValue() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isOverdue(task) {
  if (!task?.due_date || task?.task_status_code === "SELESAI") {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(task.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function isNoProgress(task) {
  return Number(task?.progress_percent || 0) <= 0;
}

function isLowProgress(task) {
  const progress = Number(task?.progress_percent || 0);
  return progress > 0 && progress < 50 && task?.task_status_code !== "SELESAI";
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

function getActionPlanLabel(item) {
  return (
    String(item?.action_plan_title || "").trim() ||
    "-"
  );
}

function getTrackingPriorityScore(task, pendingFollowUpMap, followUpMap) {
  let score = 0;

  if (isOverdue(task)) {
    score += 100;
  }

  if (isNoProgress(task)) {
    score += 50;
  }

  if (isLowProgress(task)) {
    score += 30;
  }

  if (pendingFollowUpMap[task.task_id]) {
    score += 20;
  }

  if (!followUpMap[task.task_id]) {
    score += 10;
  }

  return score;
}

function getTrackingDueTime(task) {
  const dueTime = new Date(task?.due_date || 0).getTime();
  return Number.isNaN(dueTime) ? Number.MAX_SAFE_INTEGER : dueTime;
}

function getMetricCardStyle(isActive, accentColor, prefersDarkMode) {
  const baseBackground = prefersDarkMode ? "var(--surface-2)" : "var(--surface-1)";
  const activeBackground = prefersDarkMode ? "var(--surface-3)" : "var(--surface-2)";
  
  return {
    border: "1px solid var(--border-subtle)",
    borderRadius: 8,
    padding: "16px 20px",
    minWidth: 220,
    flex: "1 1 220px",
    background: isActive ? activeBackground : baseBackground,
    boxShadow: isActive ? "var(--shadow-md)" : "none",
    display: "grid",
    gap: 8,
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    outline: "none",
    textAlign: "left",
    transform: isActive ? "translateY(-2px)" : "none",
    borderColor: isActive ? "var(--border-strong)" : "var(--border-subtle)",
    borderLeft: "4px solid var(--pebble)",
  };
}

function getStatusBadgeMeta(statusName) {
  const normalizedStatus = String(statusName || "").trim().toLowerCase();

  if (normalizedStatus === "selesai") {
    return {
      background: "var(--chip-success-bg)",
      color: "var(--chip-success-color)",
    };
  }

  if (normalizedStatus === "proses") {
    return {
      background: "var(--chip-info-bg)",
      color: "var(--chip-info-color)",
    };
  }

  if (normalizedStatus === "peninjauan" || normalizedStatus === "review") {
    return {
      background: "var(--chip-purple-bg)",
      color: "var(--chip-purple-color)",
    };
  }

  if (normalizedStatus === "perbaikan") {
    return {
      background: "var(--chip-warning-bg)",
      color: "var(--chip-warning-color)",
    };
  }

  if (normalizedStatus === "terkendala") {
    return {
      background: "var(--chip-danger-bg)",
      color: "var(--chip-danger-color)",
    };
  }

  if (normalizedStatus === "belum mulai") {
    return {
      background: "var(--surface-3)",
      color: "var(--text-muted)",
    };
  }

  if (normalizedStatus === "batal" || normalizedStatus === "dibatalkan") {
    return {
      background: "var(--chip-canceled-bg)",
      color: "var(--chip-canceled-color)",
    };
  }

  return {
    background: "var(--surface-3)",
    color: "var(--text-muted)",
  };
}

function getProgressBadgeMeta(progressValue) {
  const progress = Number(progressValue || 0);

  if (progress <= 0) {
    return {
      background: "var(--alert-warning-bg)",
      color: "var(--alert-warning-color)",
    };
  }

  if (progress < 50) {
    return {
      background: "var(--alert-info-bg)",
      color: "var(--alert-info-color)",
    };
  }

  return {
    background: "var(--alert-success-bg)",
    color: "var(--alert-success-color)",
  };
}

function getTrackingRowSurface(task, prefersDarkMode) {
  void task;
  void prefersDarkMode;
  return { background: "var(--table-bg)" };
}

function decorateTrackingTask(task) {
  const overdue = isOverdue(task);
  const noProgress = isNoProgress(task);
  const lowProgress = isLowProgress(task);

  return {
    ...task,
    tracking_flags: {
      overdue,
      noProgress,
      lowProgress,
      hasProblem: overdue || noProgress || lowProgress,
    },
  };
}

function getTrackingIssueCategories(task) {
  const categories = [];

  if (task?.tracking_flags?.overdue) {
    categories.push({
      key: "overdue",
      label: "Overdue",
      background: "var(--alert-error-bg)",
      color: "var(--alert-error-color)",
    });
  }

  if (task?.tracking_flags?.noProgress) {
    categories.push({
      key: "no-progress",
      label: "Belum progress",
      background: "var(--alert-warning-bg)",
      color: "var(--alert-warning-color)",
    });
  }

  if (task?.tracking_flags?.lowProgress) {
    categories.push({
      key: "low-progress",
      label: "Progress rendah",
      background: "var(--alert-info-bg)",
      color: "var(--alert-info-color)",
    });
  }

  return categories;
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

function getDailyTaskGroupReviewMeta(group) {
  const pendingCount = Number(group?.pending_sub_task_count || 0);
  const totalCount = Number(group?.sub_task_count || 0);

  if (totalCount > 0 && pendingCount <= 0) {
    return {
      label: "Semua Sudah Diperiksa",
      background: "var(--alert-success-bg)",
      color: "var(--alert-success-color)",
    };
  }

  return {
    label: "Ada yang Belum Diperiksa",
    background: "var(--alert-warning-bg)",
    color: "var(--alert-warning-color)",
  };
}

export default function TrackingPage({ onOpenTaskInTimeline }) {
  const auth = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts({ defaultDurationMs: 6000 });
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [isIssuesFiltersOpen, setIsIssuesFiltersOpen] = useState(() => !isMobile);
  const [isDailyFiltersOpen, setIsDailyFiltersOpen] = useState(() => !isMobile);
  const prefersDarkMode = usePrefersDarkMode();
  const [tasks, setTasks] = useState([]);
  const [issueSearchQuery, setIssueSearchQuery] = useState("");
  const [dailySearchQuery, setDailySearchQuery] = useState("");
  const [trackingMode, setTrackingMode] = useState(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return "DAILY";
    }

    const storedMode = String(
      window.localStorage.getItem(TRACKING_MODE_STORAGE_KEY) || ""
    ).trim().toUpperCase();

    return VALID_TRACKING_MODES.has(storedMode) ? storedMode : "DAILY";
  });
  const [filtersState, dispatchFilters] = useReducer(trackingFiltersReducer, {
    filter: "ALL",
    subActivityFilter: "ALL",
    assigneeFilter: "ALL",
    statusFilter: "ALL",
    dailySubActivityFilter: "ALL",
    dailyActionPlanFilter: "ALL",
    dailyAssigneeFilter: "ALL",
    dailyReviewStatusFilter: "ALL",
  });
  const {
    filter,
    subActivityFilter,
    assigneeFilter,
    statusFilter,
    dailySubActivityFilter,
    dailyActionPlanFilter,
    dailyAssigneeFilter,
    dailyReviewStatusFilter,
  } = filtersState;
  const setSubActivityFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "subActivityFilter", value }),
    []
  );
  const setAssigneeFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "assigneeFilter", value }),
    []
  );
  const setStatusFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "statusFilter", value }),
    []
  );
  const setDailySubActivityFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "dailySubActivityFilter", value }),
    []
  );
  const setDailyActionPlanFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "dailyActionPlanFilter", value }),
    []
  );
  const setDailyAssigneeFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "dailyAssigneeFilter", value }),
    []
  );
  const setDailyReviewStatusFilter = useCallback(
    (value) => dispatchFilters({ type: "set", key: "dailyReviewStatusFilter", value }),
    []
  );
  const [selectedReportDate] = useState(() => {
    return getTodayDateInputValue();
  });
  const [detailState, dispatchDetail] = useReducer(detailReducer, {
    selectedTask: null,
    isDetailOpen: false,
    followUpTask: null,
    noteValue: "",
    isSavingFollowUp: false,
    isLoadingFollowUps: false,
    updatingFollowUpId: null,
  });
  const {
    selectedTask,
    isDetailOpen,
    followUpTask,
    noteValue,
    isSavingFollowUp,
    isLoadingFollowUps,
    updatingFollowUpId,
  } = detailState;
  const setSelectedTask = useCallback((valueOrUpdater) => {
    if (typeof valueOrUpdater === "function") {
      dispatchDetail({ type: "update", key: "selectedTask", updater: valueOrUpdater });
      return;
    }
    dispatchDetail({ type: "set", key: "selectedTask", value: valueOrUpdater });
  }, []);
  const setIsDetailOpen = useCallback(
    (value) => dispatchDetail({ type: "set", key: "isDetailOpen", value }),
    []
  );
  const setFollowUpTask = useCallback(
    (value) => dispatchDetail({ type: "set", key: "followUpTask", value }),
    []
  );
  const setNoteValue = useCallback(
    (value) => dispatchDetail({ type: "set", key: "noteValue", value }),
    []
  );
  const setIsSavingFollowUp = useCallback(
    (value) => dispatchDetail({ type: "set", key: "isSavingFollowUp", value }),
    []
  );
  const setIsLoadingFollowUps = useCallback(
    (value) => dispatchDetail({ type: "set", key: "isLoadingFollowUps", value }),
    []
  );
  const setUpdatingFollowUpId = useCallback(
    (value) => dispatchDetail({ type: "set", key: "updatingFollowUpId", value }),
    []
  );
  const [followUps, setFollowUps] = useState([]);
  const [followUpMap, setFollowUpMap] = useState({});
  const [pendingFollowUpMap, setPendingFollowUpMap] = useState({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskLoadError, setTaskLoadError] = useState("");
  const [_dailyReports, setDailyReports] = useState([]);
  const [expandedDailyReportIds, setExpandedDailyReportIds] = useState([]);
  const [dailyLoadError, setDailyLoadError] = useState("");
  const [dailyTaskGroups, setDailyTaskGroups] = useState([]);
  const [isLoadingDailyTaskGroups, setIsLoadingDailyTaskGroups] = useState(false);
  const [dailyTaskGroupLoadError, setDailyTaskGroupLoadError] = useState("");
  const currentEmployeeId = String(auth.employeeId || "").trim() || null;
  const isStafRole = String(auth.roleCode || "").trim().toUpperCase() === "STAF";
  const canCreateFollowUp = canCreateTaskFollowUp(auth.roleCode);
  const canCompleteFollowUp = canCompleteTaskFollowUp(auth.roleCode);

  const followUpHeadingId = "followup-monitoring-heading";
  const noteInputRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);

  useEffect(() => {
    if (!followUpTask) {
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === "function") {
        previouslyFocusedElementRef.current.focus();
      }
      previouslyFocusedElementRef.current = null;
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement;
    const focusTimer = setTimeout(() => {
      if (noteInputRef.current && typeof noteInputRef.current.focus === "function") {
        noteInputRef.current.focus();
      }
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFollowUpTask(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [followUpTask, setFollowUpTask]);

  useEffect(() => {
    // Keep filters open on desktop; collapse by default on mobile.
    if (isMobile) {
      return undefined;
    }

    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }
      setIsIssuesFiltersOpen(true);
      setIsDailyFiltersOpen(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [isMobile]);

  const tasksRequestIdRef = useRef(0);
  const dailyReportsRequestIdRef = useRef(0);
  const dailyTaskGroupsRequestIdRef = useRef(0);
  const followUpsRequestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const modeToStore = VALID_TRACKING_MODES.has(trackingMode)
      ? trackingMode
      : "DAILY";
    window.localStorage.setItem(TRACKING_MODE_STORAGE_KEY, modeToStore);
  }, [trackingMode]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }
      dispatchDetail({ type: "resetFollowUpDraft" });
    });

    return () => {
      isCancelled = true;
    };
  }, [followUpTask?.task_id]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }
      setExpandedDailyReportIds([]);
      dispatchFilters({ type: "resetDaily" });
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedReportDate]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }
      setDailySearchQuery("");
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedReportDate]);

  useEffect(() => {
    async function loadSelectedTaskFollowUps() {
      const requestId = ++followUpsRequestIdRef.current;
      if (!followUpTask?.task_id) {
        setFollowUps([]);
        return;
      }

      setIsLoadingFollowUps(true);

      try {
        const data = await getTaskFollowUps(followUpTask.task_id);
        if (requestId !== followUpsRequestIdRef.current) {
          return;
        }
        setFollowUps(data || []);
      } catch (error) {
        console.error(error);
        if (requestId !== followUpsRequestIdRef.current) {
          return;
        }
        pushToast({ type: "error", message: error.message || "Gagal memuat riwayat follow-up." });
      } finally {
        if (requestId === followUpsRequestIdRef.current) {
          setIsLoadingFollowUps(false);
        }
      }
    }

    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }
      loadSelectedTaskFollowUps();
    });

    return () => {
      isCancelled = true;
    };
  }, [followUpTask?.task_id, pushToast, setIsLoadingFollowUps]);

  const overdueTasks = useMemo(() => {
    return tasks.filter((task) => task.tracking_flags?.overdue);
  }, [tasks]);

  const noProgressTasks = useMemo(() => {
    return tasks.filter((task) => task.tracking_flags?.noProgress);
  }, [tasks]);

  const lowProgressTasks = useMemo(() => {
    return tasks.filter((task) => task.tracking_flags?.lowProgress);
  }, [tasks]);

  const problemTasks = useMemo(() => {
    return tasks.filter((task) => task.tracking_flags?.hasProblem);
  }, [tasks]);

  const subActivityOptions = useMemo(() => {
    return Array.from(
      new Set(problemTasks.map((task) => String(task?.sub_activity_name || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [problemTasks]);

  const assigneeOptions = useMemo(() => {
    return Array.from(
      new Set(
        problemTasks
          .map((task) =>
            String(task?.assignee_display_name || task?.assignee_name || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [problemTasks]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(problemTasks.map((task) => String(task?.task_status_name || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [problemTasks]);

  const filteredTasks = useMemo(() => {
    let currentTasks = problemTasks;

    if (filter === "PENDING_FOLLOW_UP") {
      currentTasks = problemTasks.filter((task) => Boolean(pendingFollowUpMap[task.task_id]));
    }
    if (filter === "OVERDUE") {
      currentTasks = overdueTasks;
    }
    if (filter === "NO_PROGRESS") {
      currentTasks = noProgressTasks;
    }
    if (filter === "LOW_PROGRESS") {
      currentTasks = lowProgressTasks;
    }
    if (filter === "HAS_NOTE") {
      currentTasks = problemTasks.filter((task) => Boolean(followUpMap[task.task_id]));
    }

    const normalizedSearchQuery = String(issueSearchQuery || "").trim().toLowerCase();

    return currentTasks.filter((task) => {
      if (normalizedSearchQuery) {
        const taskTitle = String(task?.task_title || "").toLowerCase();
        if (!taskTitle.includes(normalizedSearchQuery)) {
          return false;
        }
      }

      if (
        subActivityFilter !== "ALL" &&
        String(task?.sub_activity_name || "").trim() !== subActivityFilter
      ) {
        return false;
      }

      if (
        assigneeFilter !== "ALL" &&
        String(task?.assignee_display_name || task?.assignee_name || "").trim() !== assigneeFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "ALL" &&
        String(task?.task_status_name || "").trim() !== statusFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    assigneeFilter,
    filter,
    followUpMap,
    issueSearchQuery,
    lowProgressTasks,
    noProgressTasks,
    pendingFollowUpMap,
    overdueTasks,
    problemTasks,
    statusFilter,
    subActivityFilter,
  ]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const priorityScoreA = getTrackingPriorityScore(
        a,
        pendingFollowUpMap,
        followUpMap
      );
      const priorityScoreB = getTrackingPriorityScore(
        b,
        pendingFollowUpMap,
        followUpMap
      );

      if (priorityScoreA !== priorityScoreB) {
        return priorityScoreB - priorityScoreA;
      }

      const dueTimeA = getTrackingDueTime(a);
      const dueTimeB = getTrackingDueTime(b);

      if (dueTimeA !== dueTimeB) {
        return dueTimeA - dueTimeB;
      }

      const progressA = Number(a?.progress_percent || 0);
      const progressB = Number(b?.progress_percent || 0);

      if (progressA !== progressB) {
        return progressA - progressB;
      }

      return String(a?.task_title || "").localeCompare(
        String(b?.task_title || ""),
        "id"
      );
    });
  }, [filteredTasks, followUpMap, pendingFollowUpMap]);

  const hasActiveIssueFilters =
    subActivityFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    statusFilter !== "ALL";

  const sortedFollowUps = useMemo(() => {
    return [...followUps].sort((a, b) => {
      const followedUpA = Boolean(a.is_followed_up);
      const followedUpB = Boolean(b.is_followed_up);

      if (followedUpA !== followedUpB) {
        return followedUpA ? 1 : -1;
      }

      const createdAtA = new Date(a.created_at || 0).getTime();
      const createdAtB = new Date(b.created_at || 0).getTime();
      return createdAtB - createdAtA;
    });
  }, [followUps]);

  const canCreateFollowUpForSelectedTask =
    canCreateFollowUp &&
    (!isStafRole ||
      currentEmployeeId ===
      (String(followUpTask?.assignee_employee_id || "").trim() || null));

  const canCompleteFollowUpForSelectedTask =
    canCompleteFollowUp &&
    (!isStafRole ||
      currentEmployeeId ===
      (String(followUpTask?.assignee_employee_id || "").trim() || null));

  const overlayStyle = getOverlayStyle({
    padding: 0,
    zIndex: 1000,
  });

  const modalStyle = getModalStyle({
    width: 640,
    maxWidth: "90%",
    maxHeight: "80vh",
    padding: 20,
    borderRadius: 12,
    background: "var(--panel-bg)",
    borderColor: "var(--panel-border)",
    boxShadow: "none",
  });

  const loadTasks = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = ++tasksRequestIdRef.current;
    if (showLoading) {
      setIsLoadingTasks(true);
    }

    setTaskLoadError("");

    try {
      const taskData = await getTrackingTasks();
      const relevantTasks = (taskData || []).map(decorateTrackingTask);
      const taskIds = relevantTasks.map((task) => task.task_id).filter(Boolean);
      const followUpData =
        taskIds.length > 0 ? await getTaskFollowUpIndicatorsByTaskIds(taskIds) : [];

      if (requestId !== tasksRequestIdRef.current) {
        return;
      }

      setTasks(relevantTasks);

      const map = (followUpData || []).reduce((acc, item) => {
        if (item.task_id) {
          acc[item.task_id] = true;
        }

        return acc;
      }, {});

      setFollowUpMap(map);

      const pendingMap = (followUpData || []).reduce((acc, item) => {
        if (item.task_id && item.is_followed_up === false) {
          acc[item.task_id] = true;
        }

        return acc;
      }, {});

      setPendingFollowUpMap(pendingMap);
    } catch (error) {
      console.error(error);
      if (requestId !== tasksRequestIdRef.current) {
        return;
      }
      setTasks([]);
      setFollowUpMap({});
      setPendingFollowUpMap({});
      setTaskLoadError(error.message || "Gagal memuat data tracking task.");
    } finally {
      if (showLoading && requestId === tasksRequestIdRef.current) {
        setIsLoadingTasks(false);
      }
    }
  }, []);

  const loadDailyReports = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = ++dailyReportsRequestIdRef.current;
    setDailyLoadError("");

    try {
      const data = await getTaskDailyReports(selectedReportDate);
      if (requestId !== dailyReportsRequestIdRef.current) {
        return;
      }
      setDailyReports(data || []);
    } catch (error) {
      console.error(error);
      if (requestId !== dailyReportsRequestIdRef.current) {
        return;
      }
      setDailyReports([]);
      setExpandedDailyReportIds([]);
      setDailyLoadError(error.message || "Gagal memuat data tracking sub task.");
    } finally {
      void showLoading;
    }
  }, [selectedReportDate]);

  const loadDailyTaskGroups = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = ++dailyTaskGroupsRequestIdRef.current;
    if (showLoading) {
      setIsLoadingDailyTaskGroups(true);
    }

    setDailyTaskGroupLoadError("");

    try {
      const data = await getTaskDailyReportsGroupedByTask();
      if (requestId !== dailyTaskGroupsRequestIdRef.current) {
        return;
      }
      setDailyTaskGroups(data || []);
    } catch (error) {
      console.error(error);
      if (requestId !== dailyTaskGroupsRequestIdRef.current) {
        return;
      }
      setDailyTaskGroups([]);
      setExpandedDailyReportIds([]);
      setDailyTaskGroupLoadError(
        error.message || "Gagal memuat riwayat sub task."
      );
    } finally {
      if (showLoading && requestId === dailyTaskGroupsRequestIdRef.current) {
        setIsLoadingDailyTaskGroups(false);
      }
    }
  }, []);

  const handleTaskUpdated = useCallback(async (updateContext = null) => {
    const updatedTaskId = String(updateContext?.taskId || "").trim();
    const nextProgressPercent = Number(updateContext?.progressPercent);
    const hasProgressUpdate =
      Boolean(updatedTaskId) && Number.isFinite(nextProgressPercent);

    if (hasProgressUpdate) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          String(task?.task_id || "").trim() === updatedTaskId
            ? { ...task, progress_percent: nextProgressPercent }
            : task
        )
      );

      setDailyReports((currentReports) =>
        currentReports.map((report) =>
          String(report?.task_id || "").trim() === updatedTaskId
            ? { ...report, progress_percent: nextProgressPercent }
            : report
        )
      );

      setDailyTaskGroups((currentGroups) =>
        currentGroups.map((group) =>
          String(group?.task_id || "").trim() === updatedTaskId
            ? { ...group, progress_percent: nextProgressPercent }
            : group
        )
      );

      setSelectedTask((currentTask) =>
        String(currentTask?.task_id || "").trim() === updatedTaskId
          ? { ...currentTask, progress_percent: nextProgressPercent }
          : currentTask
      );
    }

    await loadTasks({ showLoading: false });

    if (trackingMode === "DAILY") {
      await Promise.all([
        loadDailyReports({ showLoading: false }),
        loadDailyTaskGroups({ showLoading: false }),
      ]);
    }
  }, [loadDailyReports, loadDailyTaskGroups, loadTasks, setSelectedTask, trackingMode]);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      if (auth.isLoading) {
        setIsLoadingTasks(true);
        return;
      }

      void loadTasks();
    });

    return () => {
      isCancelled = true;
    };
  }, [auth.employeeId, auth.isAuthenticated, auth.isLoading, auth.roleCode, auth.status, loadTasks]);

  useEffect(() => {
    if (trackingMode !== "DAILY") {
      return undefined;
    }

    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      if (auth.isLoading) {
        setIsLoadingDailyTaskGroups(true);
        return;
      }

      void loadDailyTaskGroups();
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
    loadDailyTaskGroups,
    trackingMode,
  ]);

  async function reloadSelectedTaskFollowUps() {
    if (!followUpTask?.task_id) {
      setFollowUps([]);
      return;
    }

    const requestId = ++followUpsRequestIdRef.current;
    try {
      const data = await getTaskFollowUps(followUpTask.task_id);
      if (requestId !== followUpsRequestIdRef.current) {
        return;
      }
      setFollowUps(data || []);
    } catch (error) {
      console.error(error);
      if (requestId !== followUpsRequestIdRef.current) {
        return;
      }
      pushToast({ type: "error", message: error.message || "Gagal memuat riwayat follow-up." });
    }
  }

  async function handleSaveFollowUp() {
    if (!followUpTask?.task_id) {
      return;
    }

    if (!canCreateFollowUpForSelectedTask) {
      pushToast({ type: "error", message: "Anda tidak memiliki izin untuk membuat follow-up." });
      return;
    }

    const trimmedNote = noteValue.trim();
    if (!trimmedNote) {
      return;
    }

    setIsSavingFollowUp(true);

    try {
      await createTaskFollowUp({
        task_id: followUpTask.task_id,
        note_text: trimmedNote,
      });

      setNoteValue("");
      await Promise.all([loadTasks({ showLoading: false }), reloadSelectedTaskFollowUps()]);
      pushToast({ type: "success", message: "Catatan follow-up berhasil disimpan." });
    } catch (error) {
      console.error(error);
      pushToast({ type: "error", message: error.message || "Gagal menyimpan catatan follow-up." });
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function handleFollowUpChange(followUpId, checked) {
    if (!followUpId) {
      return;
    }

    if (!canCompleteFollowUpForSelectedTask) {
      pushToast({ type: "error", message: "Anda tidak memiliki izin untuk menindaklanjuti follow-up ini." });
      return;
    }

    setUpdatingFollowUpId(followUpId);

    try {
      await updateTaskFollowUpStatus(followUpId, checked);
      await Promise.all([loadTasks({ showLoading: false }), reloadSelectedTaskFollowUps()]);
      pushToast({ type: "success", message: "Status follow-up berhasil diperbarui." });
    } catch (error) {
      console.error(error);
      pushToast({ type: "error", message: error.message || "Gagal memperbarui status follow-up." });
    } finally {
      setUpdatingFollowUpId(null);
    }
  }

  const pendingFollowUpTasks = useMemo(() => {
    return tasks.filter((task) => Boolean(pendingFollowUpMap[task.task_id]));
  }, [tasks, pendingFollowUpMap]);

  const dailySummary = useMemo(() => {
    const totalSubTasks = dailyTaskGroups.reduce(
      (totalValue, group) => totalValue + Number(group?.sub_task_count || 0),
      0
    );
    const reviewedCount = dailyTaskGroups.reduce(
      (totalValue, group) =>
        totalValue + Number(group?.reviewed_sub_task_count || 0),
      0
    );
    const pendingTaskCount = dailyTaskGroups.filter(
      (group) => Number(group?.pending_sub_task_count || 0) > 0
    ).length;

    return {
      total: dailyTaskGroups.length,
      totalSubTasks,
      pendingTaskCount,
      reviewed: reviewedCount,
      pending: totalSubTasks - reviewedCount,
    };
  }, [dailyTaskGroups]);

  const dailySubActivityOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyTaskGroups
          .map((group) => String(group?.sub_activity_name || "").trim())
          .filter(Boolean)
      )
    ).sort((firstValue, secondValue) => firstValue.localeCompare(secondValue, "id"));
  }, [dailyTaskGroups]);

  const dailyActionPlanOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyTaskGroups
          .map((group) => getActionPlanLabel(group))
          .filter((value) => value && value !== "-")
      )
    ).sort((firstValue, secondValue) => firstValue.localeCompare(secondValue, "id"));
  }, [dailyTaskGroups]);

  const dailyAssigneeOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyTaskGroups
          .map((group) =>
            String(group?.assignee_display_name || group?.assignee_name || "").trim()
          )
          .filter(Boolean)
      )
    ).sort((firstValue, secondValue) => firstValue.localeCompare(secondValue, "id"));
  }, [dailyTaskGroups]);

  const dailyReviewStatusOptions = useMemo(() => {
    return Array.from(
      new Set(
        dailyTaskGroups
          .map((group) => getDailyTaskGroupReviewMeta(group).label)
          .filter(Boolean)
      )
    );
  }, [dailyTaskGroups]);

  const filteredDailyReports = useMemo(() => {
    return dailyTaskGroups.filter((group) => {
      if (
        dailySubActivityFilter !== "ALL" &&
        String(group?.sub_activity_name || "").trim() !== dailySubActivityFilter
      ) {
        return false;
      }

      if (
        dailyActionPlanFilter !== "ALL" &&
        getActionPlanLabel(group) !== dailyActionPlanFilter
      ) {
        return false;
      }

      if (
        dailyAssigneeFilter !== "ALL" &&
        String(group?.assignee_display_name || group?.assignee_name || "").trim() !==
        dailyAssigneeFilter
      ) {
        return false;
      }

      if (
        dailyReviewStatusFilter !== "ALL" &&
        getDailyTaskGroupReviewMeta(group).label !== dailyReviewStatusFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    dailyActionPlanFilter,
    dailyAssigneeFilter,
    dailyTaskGroups,
    dailyReviewStatusFilter,
    dailySubActivityFilter,
  ]);

  const filteredDailyTaskGroups = useMemo(() => {
    const normalizedSearchQuery = String(dailySearchQuery || "").trim().toLowerCase();

    return filteredDailyReports.filter((group) => {
      if (normalizedSearchQuery) {
        const taskTitle = String(group?.task_title || "").toLowerCase();
        if (!taskTitle.includes(normalizedSearchQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [dailySearchQuery, filteredDailyReports]);

  const hasActiveDailyFilters =
    dailySubActivityFilter !== "ALL" ||
    dailyActionPlanFilter !== "ALL" ||
    dailyAssigneeFilter !== "ALL" ||
    dailyReviewStatusFilter !== "ALL" ||
    dailySearchQuery.trim() !== "";

  const hasExpandableDailyRows = filteredDailyTaskGroups.length > 0;
  const isAllDailyRowsExpanded =
    hasExpandableDailyRows &&
    filteredDailyTaskGroups.every((group) =>
      expandedDailyReportIds.includes(String(group?.task_id || ""))
    );

  const metricCards = [
    {
      key: "OVERDUE",
      label: "Overdue",
      helper: "Task melewati due date dan belum selesai.",
      value: overdueTasks.length,
      accentColor: "#dc2626",
      chipBackground: "#fee2e2",
      chipColor: "#b91c1c",
    },
    {
      key: "NO_PROGRESS",
      label: "Belum Ada Progress",
      helper: "Task aktif yang belum punya progres berjalan.",
      value: noProgressTasks.length,
      accentColor: "#ca8a04",
      chipBackground: "#fef3c7",
      chipColor: "#92400e",
    },
    {
      key: "LOW_PROGRESS",
      label: "Progress Rendah",
      helper: "Progress masih di bawah 50% dan perlu perhatian.",
      value: lowProgressTasks.length,
      accentColor: "#2563eb",
      chipBackground: "#dbeafe",
      chipColor: "#1d4ed8",
    },
    {
      key: "PENDING_FOLLOW_UP",
      label: "Follow-Up Blm Ditindaklanjuti",
      helper: "Sudah ada catatan, tetapi belum ditindaklanjuti.",
      value: pendingFollowUpTasks.length,
      accentColor: "#7c3aed",
      chipBackground: "#ede9fe",
      chipColor: "#6d28d9",
    },
  ];

  const tableFrameStyle = useMemo(() => {
    return {
      marginTop: 6,
      ...getTableFrameStyle(),
    };
  }, []);

  // Mode perataan header: 1 = semua kiri, 2 = center kecuali label tertentu kiri
  const tableHeaderAlignMode = 2;

  const tableBodyCellStyle = useMemo(() => {
    return getTableBodyCellStyle();
  }, []);

  // Column width + trunc modes for the "Task" column.
  // - Issues table has more columns -> use dense mode 3.
  // - Daily table has fewer columns -> use mode 2.
  const issuesTaskColumnWidthStyle = useMemo(() => {
    return getTableTaskColumnWidthStyle({ mode: 3 });
  }, []);
  const issuesTaskTitleClampClassName = useMemo(() => {
    return getTableTaskTitleClampClassName({ mode: 3 });
  }, []);
  const issuesTaskTitleCharLimit = useMemo(() => {
    return getTableTaskTitleCharLimit({ mode: 3 });
  }, []);

  const dailyTaskColumnWidthStyle = useMemo(() => {
    return getTableTaskColumnWidthStyle({ mode: 2 });
  }, []);
  const dailyTaskTitleClampClassName = useMemo(() => {
    return getTableTaskTitleClampClassName({ mode: 2 });
  }, []);
  const dailyTaskTitleCharLimit = useMemo(() => {
    return getTableTaskTitleCharLimit({ mode: 2 });
  }, []);

  return (
    <div style={{ paddingBottom: 60 }}>
      <ToastStack prefersDarkMode={prefersDarkMode} toasts={toasts} onDismiss={dismissToast} />
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 20, 
          marginBottom: 24,
          flexWrap: "wrap"
        }}
      >
        <h1 style={{ ...getPageTitleStyle(), margin: 0 }}>MONITORING TUGAS</h1>
        
        {/* Garis Vertikal Pemisah */}
        <div 
          style={{ 
            width: "1.5px", 
            height: "28px", 
            backgroundColor: "var(--border-strong)",
            display: isMobile ? "none" : "block" 
          }} 
        />

        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center"
          }}
        >
          {[
            { key: "DAILY", label: "Tracking Sub Task" },
            { key: "ISSUES", label: "Tracking Masalah" },
          ].map((mode) => {
            const isActive = trackingMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => setTrackingMode(mode.key)}
                className={`sub-page-button ${isActive ? "sub-page-button--active" : "sub-page-button--inactive"}`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {trackingMode === "ISSUES" && taskLoadError ? (
        <div
          style={{
            marginBottom: 16,
            ...getAlertStyle(prefersDarkMode, { tone: "error" }),
          }}
        >
          {taskLoadError}
        </div>
      ) : null}

      {trackingMode === "ISSUES" ? (
        <Fragment>
          {isMobile ? (
            <details
              open={isIssuesFiltersOpen}
              onToggle={(event) => setIsIssuesFiltersOpen(event.currentTarget.open)}
              style={{
                display: "grid",
                gap: 10,
                marginBottom: 18,
                ...getPanelStyle({
                  padding: 10,
                  borderRadius: 14,
                  background: "var(--panel-bg)",
                  borderColor: "var(--panel-border)",
                  boxShadow: "none",
                }),
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "var(--text-h)",
                  listStyle: "none",
                  outline: "none",
                }}
              >
                Filter Tracking Masalah
              </summary>
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  {/*}<div>
                    
                    <div style={{ fontSize: 15, color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)" }}>
                      Klik kartu untuk memfokuskan tabel ke kategori masalah tertentu.
                    </div> 
                    
                  </div>*/}
                  <div style={{ fontSize: 13, color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)" }}>
                    {isLoadingTasks ? "Memuat ringkasan..." : `${problemTasks.length} task bermasalah terpantau`}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {metricCards.map((card) => {
                    const isActive = filter === card.key;
                    const isAllMode = filter === "ALL";

                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() =>
                          dispatchFilters({
                            type: "toggle",
                            key: "filter",
                            value: card.key,
                            fallback: "ALL",
                          })
                        }
                        aria-pressed={isActive}
                        aria-label={`Filter: ${card.label}`}
                        style={{
                          ...getMetricCardStyle(isActive, card.accentColor, prefersDarkMode),
                          textAlign: "left",
                          font: "inherit",
                        }}
                        title={isActive ? "Klik untuk kembali ke semua kategori" : `Fokus ke ${card.label}`}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text-h)",
                                letterSpacing: 0.2,
                              }}
                            >
                              {card.label}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                lineHeight: 1.45,
                              }}
                            >
                              {card.helper}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "center",
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 30,
                              lineHeight: 1,
                              fontWeight: 800,
                              color: "var(--text-h)",
                            }}
                          >
                            {card.value}
                          </div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              color: isActive ? "var(--text-h)" : "var(--text-muted)",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: isActive ? "var(--text-h)" : "var(--control-border)",
                                display: "inline-block",
                              }}
                            />
                            {isActive ? "Filter aktif" : isAllMode ? "Siap dipilih" : "Klik untuk fokus"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          ) : (
            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  {/*}
                  <div style={{ fontSize: 15, color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)" }}>
                    Klik kartu untuk memfokuskan tabel ke kategori masalah tertentu.
                  </div>
                  */}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    minWidth: 220,
                  }}
                >
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Cari Task..."
                      value={issueSearchQuery}
                      onChange={(event) => setIssueSearchQuery(event.target.value)}
                      style={getSearchInputStyle(prefersDarkMode, { hasValue: Boolean(issueSearchQuery) })}
                      aria-label="Search tasks"
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        fontSize: 16,
                        pointerEvents: "none",
                      }}
                    >
                      🔍
                    </span>
                    {issueSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setIssueSearchQuery("")}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          fontSize: 16,
                          cursor: "pointer",
                          padding: "4px 4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        aria-label="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)" }}>
                {isLoadingTasks ? "Memuat ringkasan..." : `${problemTasks.length} task bermasalah terpantau`}
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {metricCards.map((card) => {
                  const isActive = filter === card.key;
                  const isAllMode = filter === "ALL";

                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() =>
                        dispatchFilters({
                          type: "toggle",
                          key: "filter",
                          value: card.key,
                          fallback: "ALL",
                        })
                      }
                      aria-pressed={isActive}
                      aria-label={`Filter: ${card.label}`}
                      style={{
                        ...getMetricCardStyle(isActive, card.accentColor, prefersDarkMode),
                        textAlign: "left",
                        font: "inherit",
                      }}
                      title={isActive ? "Klik untuk kembali ke semua kategori" : `Fokus ke ${card.label}`}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "var(--text-h)",
                              letterSpacing: 0.2,
                            }}
                          >
                            {card.label}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              lineHeight: 1.45,
                            }}
                          >
                            {card.helper}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 30,
                            lineHeight: 1,
                            fontWeight: 800,
                            color: "var(--text-h)",
                          }}
                        >
                          {card.value}
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: isActive ? "var(--text-h)" : "var(--text-muted)",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: isActive ? "var(--text-h)" : "var(--control-border)",
                              display: "inline-block",
                            }}
                          />
                          {isActive ? "Filter aktif" : isAllMode ? "Siap dipilih" : "Klik untuk fokus"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 14,
              alignItems: "stretch",
            }}
          >
            <select
              value={subActivityFilter}
              onChange={(event) => setSubActivityFilter(event.target.value)}
              className="filter-select"
              aria-label="Filter Sub Kegiatan"
            >
              <option value="ALL">Semua Sub Kegiatan</option>
              {subActivityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className="filter-select"
              aria-label="Filter Pelaksana"
            >
              <option value="ALL">Semua Pelaksana</option>
              {assigneeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="filter-select"
              aria-label="Filter Status"
            >
              <option value="ALL">Semua Status</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div style={{ display: "flex" }}>
              <button
                type="button"
                className={`btn-specific-action ${hasActiveIssueFilters ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
                onClick={() => {
                  dispatchFilters({ type: "resetIssues" });
                }}
                disabled={!hasActiveIssueFilters}
                style={{ width: "100%" }}
              >
                Reset Filter
              </button>
            </div>
          </div>

          <div style={tableFrameStyle}>
            <table
              style={{
                width: "100%",
                tableLayout: "fixed",
                borderCollapse: "separate",
                borderSpacing: 0,
                background: "var(--table-bg)",
              }}
            >
              <thead>
                <tr>
                  {[
                    { label: "Task", width: undefined },
                    { label: "Pelaksana", width: "9%" },
                    { label: "Kategori Masalah", width: "17%" },
                    { label: "Status", width: "11%" },
                    { label: "Progress", width: "9%" },
                    { label: "Due Date", width: "9%" },
                    { label: "Aksi", width: 136 }
                  ].map(({ label, width }) => (
                    <th
                      key={label}
                      style={{
                        ...getTableHeaderCellStyle({ alignMode: tableHeaderAlignMode, label }),
                        textAlign: label === "Task" ? "left" : "center",
                        ...(label === "Task" ? issuesTaskColumnWidthStyle : {}),
                        ...(width ? { width } : {}),
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingTasks ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      Memuat data tracking task...
                    </td>
                  </tr>
                ) : null}

                {sortedTasks.map((task) => (
                  <TrackingIssuesTableRow
                    key={task.task_id}
                    task={task}
                    prefersDarkMode={prefersDarkMode}
                    tableBodyCellStyle={tableBodyCellStyle}
                    taskColumnWidthStyle={issuesTaskColumnWidthStyle}
                    taskTitleClampClassName={issuesTaskTitleClampClassName}
                    taskTitleCharLimit={issuesTaskTitleCharLimit}
                    hasFollowUp={Boolean(followUpMap[task.task_id])}
                    hasPendingFollowUp={Boolean(pendingFollowUpMap[task.task_id])}
                    setFollowUpTask={setFollowUpTask}
                    setSelectedTask={setSelectedTask}
                    setIsDetailOpen={setIsDetailOpen}
                    onOpenTaskInTimeline={onOpenTaskInTimeline}
                    formatDate={formatDate}
                    getTrackingRowSurface={getTrackingRowSurface}
                    getStatusBadgeMeta={getStatusBadgeMeta}
                    getProgressBadgeMeta={getProgressBadgeMeta}
                    getTrackingIssueCategories={getTrackingIssueCategories}
                  />
                ))}

                {!isLoadingTasks && sortedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      {taskLoadError
                        ? "Data tracking belum dapat ditampilkan."
                        : "Belum ada task bermasalah yang sesuai dengan filter."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Fragment>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "grid", gap: 4, minHeight: 40 }}>
              {/*}
              <div style={{ fontSize: 15, color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)" }}>
                Fokus pada tanggal. Klik task untuk membuka rincian sub task secara inline.
              </div>
              */}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                minWidth: 220,
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  placeholder="Cari Task..."
                  value={dailySearchQuery}
                  onChange={(event) => setDailySearchQuery(event.target.value)}
                  style={getSearchInputStyle(prefersDarkMode, { hasValue: Boolean(dailySearchQuery) })}
                  aria-label="Search tasks"
                />
                <span
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontSize: 16,
                    pointerEvents: "none",
                  }}
                >
                  🔍
                </span>
                {dailySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDailySearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: "4px 4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            {[
              {
                key: "reviewed",
                label: "Total Task",
                value: dailySummary.total,
              },
              {
                key: "total",
                label: "Total Sub Task",
                value: dailySummary.totalSubTasks,
              },
              {
                key: "pending",
                label: "Task Pending Review",
                value: dailySummary.pendingTaskCount,
              },
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  flex: "1 1 180px",
                  minWidth: 180,
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                  background: prefersDarkMode ? "var(--surface-2)" : "var(--surface-1)",
                  padding: "16px 18px",
                  display: "grid",
                  gap: 8,
                  boxShadow: "none",
                  borderLeft: "4px solid var(--pebble)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 32, lineHeight: 1, fontWeight: 900, color: "var(--text-h)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {dailyLoadError || dailyTaskGroupLoadError ? (
            <div
              style={{
                ...getAlertStyle(prefersDarkMode, { tone: "error" }),
                borderRadius: 8,
              }}
            >
              {dailyLoadError || dailyTaskGroupLoadError}
            </div>
          ) : null}

          {isMobile ? (
            <details
              open={isDailyFiltersOpen}
              onToggle={(event) => setIsDailyFiltersOpen(event.currentTarget.open)}
              style={{
                display: "grid",
                gap: 10,
                marginBottom: 12,
                borderRadius: 14,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg)",
                padding: 10,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 13,
                  color: "var(--text-h)",
                  listStyle: "none",
                  outline: "none",
                }}
              >
                Filter Tracking Sub Task
              </summary>
              <DailySubTaskFilterBar
                prefersDarkMode={prefersDarkMode}
                dailySubActivityFilter={dailySubActivityFilter}
                setDailySubActivityFilter={setDailySubActivityFilter}
                dailySubActivityOptions={dailySubActivityOptions}
                dailyActionPlanFilter={dailyActionPlanFilter}
                setDailyActionPlanFilter={setDailyActionPlanFilter}
                dailyActionPlanOptions={dailyActionPlanOptions}
                dailyAssigneeFilter={dailyAssigneeFilter}
                setDailyAssigneeFilter={setDailyAssigneeFilter}
                dailyAssigneeOptions={dailyAssigneeOptions}
                dailyReviewStatusFilter={dailyReviewStatusFilter}
                setDailyReviewStatusFilter={setDailyReviewStatusFilter}
                dailyReviewStatusOptions={dailyReviewStatusOptions}
                onResetFilters={() => dispatchFilters({ type: "resetDaily" })}
                isResetEnabled={hasActiveDailyFilters}
                onExpandAll={() =>
                  setExpandedDailyReportIds(
                    filteredDailyTaskGroups
                      .map((group) => String(group?.task_id || "").trim())
                      .filter(Boolean)
                  )
                }
                isExpandEnabled={hasExpandableDailyRows && !isAllDailyRowsExpanded}
                onCollapseAll={() => setExpandedDailyReportIds([])}
                isCollapseEnabled={expandedDailyReportIds.length > 0}
              />
            </details>
          ) : (
            <DailySubTaskFilterBar
              prefersDarkMode={prefersDarkMode}
              dailySubActivityFilter={dailySubActivityFilter}
              setDailySubActivityFilter={setDailySubActivityFilter}
              dailySubActivityOptions={dailySubActivityOptions}
              dailyActionPlanFilter={dailyActionPlanFilter}
              setDailyActionPlanFilter={setDailyActionPlanFilter}
              dailyActionPlanOptions={dailyActionPlanOptions}
              dailyAssigneeFilter={dailyAssigneeFilter}
              setDailyAssigneeFilter={setDailyAssigneeFilter}
              dailyAssigneeOptions={dailyAssigneeOptions}
              dailyReviewStatusFilter={dailyReviewStatusFilter}
              setDailyReviewStatusFilter={setDailyReviewStatusFilter}
              dailyReviewStatusOptions={dailyReviewStatusOptions}
              onResetFilters={() => dispatchFilters({ type: "resetDaily" })}
              isResetEnabled={hasActiveDailyFilters}
              onExpandAll={() =>
                setExpandedDailyReportIds(
                  filteredDailyReports
                    .map((group) => String(group?.task_id || "").trim())
                    .filter(Boolean)
                )
              }
              isExpandEnabled={hasExpandableDailyRows && !isAllDailyRowsExpanded}
              onCollapseAll={() => setExpandedDailyReportIds([])}
              isCollapseEnabled={expandedDailyReportIds.length > 0}
            />
          )}

          <div style={tableFrameStyle}>
            <table
              style={{
                width: "100%",
                tableLayout: "fixed",
                borderCollapse: "separate",
                borderSpacing: 0,
                background: "var(--table-bg)",
              }}
            >
              <thead>
                <tr>
                  {[
                    { label: "Task", width: undefined },
                    { label: "Pelaksana", width: "11%" },
                    { label: "Progress", width: "10%" },
                    { label: "Pemeriksaan", width: "14%" },
                    { label: "Aksi", width: 180 }
                  ].map(({ label, width }) => (
                    <th
                      key={label}
                      style={{
                        ...getTableHeaderCellStyle({ alignMode: tableHeaderAlignMode, label }),
                        textAlign: label === "Task" ? "left" : "center",
                        ...(label === "Task" ? dailyTaskColumnWidthStyle : {}),
                        ...(width ? { width } : {}),
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingDailyTaskGroups ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      Memuat riwayat sub task...
                    </td>
                  </tr>
                ) : null}

                {!isLoadingDailyTaskGroups && filteredDailyTaskGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                      {dailyTaskGroups.length === 0
                        ? "Belum ada riwayat sub task."
                        : "Belum ada task yang sesuai dengan filter."}
                    </td>
                  </tr>
                ) : null}

                {filteredDailyTaskGroups.map((group) => {
                  const taskGroupId = String(group?.task_id || "").trim();
                  const isExpanded = expandedDailyReportIds.includes(taskGroupId);
                  // Light mode: use a medium gray stroke (avoid near-black borders).
                  const expandedBorderColor = prefersDarkMode
                    ? "var(--border-strong)"
                    : "var(--pebble)";
                  // Expanded state should be indicated by stroke only (no background highlight).
                  const expandedRowBackground = "var(--table-bg)";

                  return (
                    <Fragment key={group.task_id}>
                      <tr
                        onMouseEnter={(event) => {
                          if (isExpanded) return;
                          event.currentTarget.style.filter = prefersDarkMode
                            ? TABLE_ROW_HOVER_FILTER_DARK
                            : TABLE_ROW_HOVER_FILTER_LIGHT;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.filter = "none";
                        }}
                        onClick={() =>
                          setExpandedDailyReportIds((currentIds) => {
                            if (currentIds.includes(taskGroupId)) {
                              return currentIds.filter((currentId) => currentId !== taskGroupId);
                            }

                            return [...currentIds, taskGroupId];
                          })
                        }
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }
                          event.preventDefault();
                          setExpandedDailyReportIds((currentIds) => {
                            if (currentIds.includes(taskGroupId)) {
                              return currentIds.filter((currentId) => currentId !== taskGroupId);
                            }
                            return [...currentIds, taskGroupId];
                          });
                        }}
                        style={{
                          background: isExpanded
                            ? expandedRowBackground
                            : "var(--table-bg)",
                          cursor: "pointer",
                          transition: "filter 0.15s ease",
                          boxShadow: isExpanded
                            ? `inset 0 0 0 2px ${expandedBorderColor}`
                            : "none",
                        }}
                      >
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            ...dailyTaskColumnWidthStyle,
                            textAlign: "left",
                            borderTop: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : tableBodyCellStyle.borderBottom,
                            borderBottom: isExpanded ? "none" : tableBodyCellStyle.borderBottom,
                            borderLeft: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : "2px solid transparent",
                          }}
                        >
                          <div
                            className={dailyTaskTitleClampClassName || undefined}
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              lineHeight: 1.3,
                              width: "100%",
                            }}
                          >
                            {dailyTaskTitleCharLimit
                              ? getCompactText(group.task_title, dailyTaskTitleCharLimit)
                              : group.task_title || "-"}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: "var(--text-muted)",
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`Sub Kegiatan: ${group.sub_activity_name || "-"}`}
                          >
                            Sub Kegiatan: {group.sub_activity_name || "-"}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: "var(--text-muted)",
                              lineHeight: 1.5,
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`Rencana Aksi: ${getActionPlanLabel(group)}`}
                          >
                            Rencana Aksi: {getActionPlanLabel(group)}
                          </div>
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "center",
                            width: "11%",
                            borderTop: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : tableBodyCellStyle.borderBottom,
                            borderBottom: isExpanded ? "none" : tableBodyCellStyle.borderBottom,
                          }}
                        >
                          {group.assignee_display_name || group.assignee_name || "-"}
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "center",
                            width: "10%",
                            borderTop: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : tableBodyCellStyle.borderBottom,
                            borderBottom: isExpanded ? "none" : tableBodyCellStyle.borderBottom,
                          }}
                        >
                          <span
                            style={getChipStyle(prefersDarkMode, {
                              size: "sm",
                              minWidth: 54,
                              fontWeight: 800,
                              background: getProgressBadgeMeta(group.progress_percent).background,
                              color: getProgressBadgeMeta(group.progress_percent).color,
                            })}
                          >
                            {group.progress_percent || 0}%
                          </span>
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "center",
                            width: "14%",
                            borderTop: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : tableBodyCellStyle.borderBottom,
                            borderBottom: isExpanded ? "none" : tableBodyCellStyle.borderBottom,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text-muted)",
                            }}
                          >
                            {group.reviewed_sub_task_count || 0}/{group.sub_task_count || 0} sub task
                          </div>
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "center",
                            width: 180,
                            borderTop: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : tableBodyCellStyle.borderBottom,
                            borderBottom: isExpanded ? "none" : tableBodyCellStyle.borderBottom,
                            borderRight: isExpanded
                              ? `2px solid ${expandedBorderColor}`
                              : "none",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                            }}
                          >
                            Klik baris
                          </span>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              padding: 18,
                              background: "var(--table-bg)",
                              borderLeft: `2px solid ${expandedBorderColor}`,
                              borderRight: `2px solid ${expandedBorderColor}`,
                              borderBottom: `0px solid ${expandedBorderColor}`,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gap: 14,
                              }}
                            >
                              <div
                                style={{
                                  padding: 14,
                                  borderRadius: 12,
                                  background: "var(--panel-bg)",
                                  border: "1px solid var(--panel-border)",
                                  display: "grid",
                                  gap: 8,
                                }}
                              >
                                <div style={getMetaLabelStyle(prefersDarkMode)}>
                                  Riwayat Sub Task
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    color: "var(--text-muted)",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  Menampilkan seluruh sub task untuk task ini. Pemeriksaan aktif
                                  dipusatkan di halaman <strong>Pelaporan</strong>.
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gap: 10,
                                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                    alignItems: "start",
                                  }}
                                >
                                  {group.sub_tasks.map((subTask) => {
                                    const subTaskReviewMeta = getDailyReviewBadgeMeta(
                                      subTask.review_status
                                    );
                                    const documentLabel =
                                      subTask?.daily_document?.title ||
                                      subTask?.daily_document?.file_name ||
                                      (subTask?.document_link
                                        ? "Buka Link Dokumen"
                                        : "Belum ada dokumen");
                                    const documentHref =
                                      subTask?.daily_document?.file_url ||
                                      subTask?.document_link ||
                                      null;

                                    return (
                                      <div
                                        key={subTask.id}
                                        style={{
                                          padding: 12,
                                          borderRadius: 0,
                                          border: "none",
                                          borderLeft: "2px solid #9ca3af",
                                          background: "transparent",
                                          display: "grid",
                                          gap: 6,
                                          paddingLeft: 14,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 10,
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: 13,
                                              fontWeight: 700,
                                              color: "var(--text-h)",
                                            }}
                                          >
                                            {formatDate(subTask.report_date)}
                                          </div>
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 13,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.45,
                                            overflowWrap: "anywhere",
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          <strong>Sub Task:</strong> {subTask.work_summary || "-"}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 13,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.45,
                                          }}
                                        >
                                          <strong>Dibuat oleh:</strong> {subTask.created_by_employee_name || "-"}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 13,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.45,
                                          }}
                                        >
                                          <strong>Eviden:</strong>{" "}
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
                                        <div
                                          style={{
                                            fontSize: 13,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.45,
                                            overflowWrap: "anywhere",
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          <strong>Catatan Pemeriksaan:</strong>{" "}
                                          {String(subTask.review_notes || "").trim() ||
                                            "Belum ada catatan pemeriksaan."}
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            flexWrap: "wrap",
                                            fontSize: 13,
                                            color: "var(--text-muted)",
                                            lineHeight: 1.45,
                                          }}
                                        >
                                          <strong>Status Pemeriksaan:</strong>
                                          <span
                                            style={getChipStyle(prefersDarkMode, {
                                              size: "xs",
                                              background: subTaskReviewMeta.background,
                                              color: subTaskReviewMeta.color,
                                            })}
                                          >
                                            {subTaskReviewMeta.label}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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
      )}

      {followUpTask && (
        <div style={overlayStyle} onClick={() => setFollowUpTask(null)} role="presentation">
          <div
            style={modalStyle}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={followUpHeadingId}
          >
            <h3 id={followUpHeadingId} style={{ marginTop: 0, marginBottom: 10 }}>
              Follow-up Monitoring
            </h3>

            <div
              style={{
                ...getPanelStyle({
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface-2)",
                  borderColor: "var(--panel-border)",
                  boxShadow: "none",
                }),
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: "var(--text-h)",
                  fontWeight: 800,
                  fontSize: 18,
                  lineHeight: 1.3,
                  marginBottom: 4,
                }}
              >
                {followUpTask.task_title || "-"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                {followUpTask.sub_activity_name || "-"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                <span>
                  <strong>Pelaksana:</strong> {followUpTask.assignee_name || "-"}
                </span>
                <span style={{ color: "var(--text-subtle)" }}>|</span>
                <span>
                  <strong>Status:</strong> {followUpTask.task_status_name || "-"}
                </span>
                <span style={{ color: "var(--text-subtle)" }}>|</span>
                <span
                  style={{
                    color: isOverdue(followUpTask)
                      ? "var(--alert-error-color)"
                      : "var(--text-muted)",
                    fontWeight: isOverdue(followUpTask) ? 700 : 400,
                  }}
                >
                  <strong>Due:</strong> {formatDate(followUpTask.due_date)}
                </span>
                <span style={{ color: "var(--text-subtle)" }}>|</span>
                <span>
                  <strong>Progress:</strong> {followUpTask.progress_percent || 0}%
                </span>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Riwayat Catatan
              </div>
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 8,
                  padding: 12,
                  whiteSpace: "pre-wrap",
                  textAlign: "left",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {isLoadingFollowUps ? (
                  "Memuat riwayat..."
                ) : followUps.length === 0 ? (
                  "Belum ada catatan tindak lanjut."
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {sortedFollowUps.map((followUp) => (
                      <div
                        key={followUp.id}
                        style={{
                          border: "1px solid var(--panel-border)",
                          borderLeft: followUp.is_followed_up
                            ? "1px solid var(--panel-border)"
                            : "4px solid var(--alert-error-border)",
                          borderRadius: 8,
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
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {formatDateTime(followUp.created_at)}
                          </div>
                          <span
                            style={getChipStyle(prefersDarkMode, {
                              size: "xs",
                              tone: followUp.is_followed_up ? "success" : "danger",
                            })}
                          >
                            {followUp.is_followed_up
                              ? "Sudah ditindaklanjuti"
                              : "Belum ditindaklanjuti"}
                          </span>
                        </div>
                        <div style={{ whiteSpace: "pre-wrap", color: "var(--text-h)" }}>
                          {followUp.note_text || "-"}
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            display: "grid",
                            gap: 4,
                            fontSize: 12,
                            color: "var(--text-muted)",
                          }}
                        >
                          <div>
                            Dibuat oleh:{" "}
                            {followUp.created_by_employee_name ||
                              followUp.created_by_employee_id ||
                              "-"}
                          </div>
                          {followUp.followed_up_at ? (
                            <div>
                              Ditindaklanjuti pada:{" "}
                              {formatDateTime(followUp.followed_up_at)}
                            </div>
                          ) : null}
                          {followUp.followed_up_by_employee_id ? (
                            <div>
                              Ditindaklanjuti oleh:{" "}
                              {followUp.followed_up_by_employee_name ||
                                followUp.followed_up_by_employee_id}
                            </div>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          {!followUp.is_followed_up &&
                            canCompleteFollowUpForSelectedTask ? (
                            <button
                              type="button"
                              onClick={() => handleFollowUpChange(followUp.id, true)}
                              disabled={updatingFollowUpId === followUp.id}
                              style={{
                                ...getPrimaryButtonStyle(prefersDarkMode, {
                                  isEnabled: updatingFollowUpId !== followUp.id,
                                  size: "sm",
                                  height: 36,
                                }),
                                cursor: updatingFollowUpId === followUp.id ? "wait" : "pointer",
                              }}
                            >
                              {updatingFollowUpId === followUp.id
                                ? "Menyimpan..."
                                : "Tandai Selesai"}
                            </button>
                          ) : followUp.is_followed_up ? (
                            <span
                              style={getChipStyle(prefersDarkMode, {
                                size: "xs",
                                tone: "success",
                              })}
                            >
                              Selesai
                            </span>
                          ) : (
                            <span
                              style={getChipStyle(prefersDarkMode, {
                                size: "xs",
                                tone: "muted",
                              })}
                            >
                              Menunggu tindak lanjut
                            </span>
                          )}
                          {followUp.followed_up_at ? (
                            null
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Catatan / Follow-up Monitoring
              </div>
              {canCreateFollowUpForSelectedTask ? (
                <textarea
                  ref={noteInputRef}
                  value={noteValue}
                  onChange={(event) => setNoteValue(event.target.value)}
                  placeholder="Tuliskan catatan tindak lanjut..."
                  aria-label="Catatan follow-up"
                  style={{
                    ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
                    width: "100%",
                    minHeight: 90,
                    padding: 8,
                    borderRadius: 6,
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 90,
                    padding: 10,
                    border: "1px solid var(--panel-border)",
                    borderRadius: 6,
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    boxSizing: "border-box",
                  }}
                >
                  Anda dapat melihat riwayat follow-up, tetapi tidak memiliki izin untuk menambah catatan pada task ini.
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {canCreateFollowUpForSelectedTask ? (
                <button
                  type="button"
                  onClick={handleSaveFollowUp}
                  disabled={isSavingFollowUp}
                  style={{
                    ...getPrimaryButtonStyle(prefersDarkMode, {
                      isEnabled: !isSavingFollowUp,
                      size: "sm",
                      height: 36,
                    }),
                    cursor: isSavingFollowUp ? "wait" : "pointer",
                  }}
                >
                  {isSavingFollowUp ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setFollowUpTask(null)}
                aria-label="Tutup dialog follow-up monitoring"
                style={getNeutralButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  size: "sm",
                  height: 36,
                })}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
