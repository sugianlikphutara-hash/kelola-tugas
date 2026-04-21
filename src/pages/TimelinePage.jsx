import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTimelineTasks } from "../services/taskService";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import {
  getAlertStyle,
  getDangerOutlinedButtonStyle,
  getCircleIconButtonStyle,
  getTableHeaderCellStyle,
  getTableFrameStyle,
  getSearchInputStyle,
  getPageTitleStyle,
} from "../lib/controlStyles";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 44;
const TASK_INFO_WIDTH = 360;
const UNASSIGNED_LANE_LABEL = "Belum Ada Pelaksana";
const UNASSIGNED_SUB_ACTIVITY_LABEL = "Belum Ada Sub Kegiatan";

function getTimelineLaneHeaderBackground(prefersDarkMode) {
  // Keep lane header close to task-row background, just slightly darker.
  return prefersDarkMode
    ? "linear-gradient(0deg, rgba(0, 0, 0, 0.20), rgba(0, 0, 0, 0.20)), var(--table-bg)"
    : "linear-gradient(0deg, rgba(15, 23, 42, 0.035), rgba(15, 23, 42, 0.035)), var(--table-bg)";
}
const TODAY_LINE_BACKGROUND =
  "repeating-linear-gradient(to bottom, rgba(239, 68, 68, 0.38) 0, rgba(239, 68, 68, 0.38) 6px, transparent 6px, transparent 11px)";

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateLabel(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatHeaderLabel(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatTooltipDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getBarColor(task) {
  const progress = Number(task?.progress_percent || 0);
  const today = startOfDay(new Date());
  const dueDate = task?.due_date ? startOfDay(task.due_date) : null;

  if (progress >= 100 || String(task?.task_status_name || "").toLowerCase() === "selesai") {
    return "#22c55e";
  }

  if (dueDate && dueDate < today && progress < 100) {
    return "#ef4444";
  }

  if (progress > 0) {
    return "#3b82f6";
  }

  return "#94a3b8";
}

function getTooltipPositionStyle(task, totalDays) {
  const centerOffset =
    task.offsetDays * DAY_WIDTH + (task.durationDays * DAY_WIDTH) / 2;

  if (task.offsetDays <= 1) {
    return { left: 8, transform: "none" };
  }

  if (task.offsetDays + task.durationDays >= totalDays - 1) {
    return { right: 8, left: "auto", transform: "none" };
  }

  return {
    left: `${centerOffset}px`,
    transform: "translateX(-50%)",
  };
}

function getTimelineAssigneeName(task) {
  return (
    String(task?.assignee_display_name || "").trim() ||
    String(task?.assignee_nick_name || "").trim() ||
    String(task?.assignee_name || "").trim() ||
    UNASSIGNED_LANE_LABEL
  );
}

function getTimelineSubActivityName(task) {
  return String(task?.sub_activity_name || "").trim() || UNASSIGNED_SUB_ACTIVITY_LABEL;
}

function getTimelineSubActivityCode(task) {
  return String(task?.sub_activity_code || "").trim() || null;
}

function isTimelineTaskOverdue(task) {
  const dueDate = task?.due_date ? startOfDay(task.due_date) : null;
  return Boolean(dueDate) && dueDate < startOfDay(new Date()) && Number(task?.progress_percent || 0) < 100;
}

function isTimelineTaskDone(task) {
  return (
    Number(task?.progress_percent || 0) >= 100 ||
    String(task?.task_status_name || task?.task_status_code || "").toLowerCase() === "selesai"
  );
}

function getLaneIndicatorColor(tasks) {
  if (tasks.some((task) => isTimelineTaskOverdue(task))) {
    return "#f87171";
  }

  if (tasks.length > 0 && tasks.every((task) => isTimelineTaskDone(task))) {
    return "#22c55e";
  }

  return "#60a5fa";
}

function getTaskRowMetaParts(task, groupingMode) {
  const metaParts = [];

  if (groupingMode === "ALL_TASKS" && task?.sub_activity_code) {
    metaParts.push(task.sub_activity_code);
  }

  if (groupingMode === "ALL_TASKS") {
    metaParts.push(getTimelineAssigneeName(task));
    metaParts.push(task.task_status_name || "-");
  }

  if (groupingMode === "SUB_ACTIVITY") {
    metaParts.push(getTimelineAssigneeName(task));
    metaParts.push(task.task_status_name || "-");
  }

  if (groupingMode === "ASSIGNEE" && task?.sub_activity_code) {
    metaParts.push(task.sub_activity_code);
    metaParts.push(task.task_status_name || "-");
  }

  metaParts.push(`${Number(task.progress_percent || 0)}%`);
  metaParts.push(`${formatDateLabel(task.start_date)} - ${formatDateLabel(task.due_date)}`);

  return metaParts;
}

export default function TimelinePage({ navigationContext }) {
  const prefersDarkMode = usePrefersDarkMode();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [groupingMode, setGroupingMode] = useState("SUB_ACTIVITY");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const highlightTimeoutRef = useRef(null);
  const scrollAnimationFrameRef = useRef(null);
  const clearSearchTimeoutRef = useRef(null);

  const loadTimelineTasks = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await getTimelineTasks();
      setTasks(data || []);
    } catch (error) {
      console.error(error);
      setTasks([]);
      setLoadError(error.message || "Gagal memuat timeline task.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      void loadTimelineTasks();
    });

    return () => {
      isCancelled = true;
    };
  }, [loadTimelineTasks]);

  useEffect(() => {
    if (!navigationContext?.search) {
      return;
    }

    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }
      setSearch(navigationContext.search);
    });

    return () => {
      isCancelled = true;
    };
  }, [navigationContext]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
      }

      if (clearSearchTimeoutRef.current) {
        clearTimeout(clearSearchTimeoutRef.current);
      }
    };
  }, []);

  const validTasks = useMemo(() => {
    return tasks.filter((task) => task.start_date && task.due_date);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const today = startOfDay(new Date());

    return validTasks.filter((task) => {
      const progress = Number(task?.progress_percent || 0);
      const normalizedStatus = String(
        task?.task_status_name || task?.task_status_code || ""
      ).toLowerCase();
      const dueDate = task?.due_date ? startOfDay(task.due_date) : null;

      if (activeFilter === "ACTIVE") {
        return progress < 100 && normalizedStatus !== "dibatalkan";
      }

      if (activeFilter === "OVERDUE") {
        return Boolean(dueDate) && dueDate < today && progress < 100;
      }

      if (activeFilter === "DONE") {
        return progress >= 100 || normalizedStatus === "selesai";
      }

      return true;
    });
  }, [activeFilter, validTasks]);

  const searchedTasks = useMemo(() => {
    const normalizedSearchTerm = search.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return filteredTasks;
    }

    return filteredTasks.filter((task) => {
      const title = String(task?.task_title || "").toLowerCase();
      const subActivityName = String(task?.sub_activity_name || "").toLowerCase();
      const assigneeName = getTimelineAssigneeName(task).toLowerCase();

      return (
        title.includes(normalizedSearchTerm) ||
        subActivityName.includes(normalizedSearchTerm) ||
        assigneeName.includes(normalizedSearchTerm)
      );
    });
  }, [filteredTasks, search]);

  const timelineData = useMemo(() => {
    if (searchedTasks.length === 0) {
      return {
        startDate: null,
        endDate: null,
        days: [],
        rows: [],
        todayOffsetDays: null,
      };
    }

    const startDate = searchedTasks.reduce((minDate, task) => {
      const taskStart = startOfDay(task.start_date);
      return taskStart < minDate ? taskStart : minDate;
    }, startOfDay(searchedTasks[0].start_date));

    const endDate = searchedTasks.reduce((maxDate, task) => {
      const taskEnd = startOfDay(task.due_date);
      return taskEnd > maxDate ? taskEnd : maxDate;
    }, startOfDay(searchedTasks[0].due_date));

    const totalDays =
      Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1);

    const days = Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date;
    });

    const rows = searchedTasks.map((task) => {
      const taskStart = startOfDay(task.start_date);
      const taskEnd = startOfDay(task.due_date);
      const offsetDays = Math.max(
        0,
        Math.round((taskStart.getTime() - startDate.getTime()) / DAY_MS)
      );
      const durationDays = Math.max(
        1,
        Math.round((taskEnd.getTime() - taskStart.getTime()) / DAY_MS) + 1
      );

      return {
        ...task,
        assignee_display_name: task?.assignee_display_name ?? null,
        assignee_nick_name: task?.assignee_nick_name ?? null,
        assignee_name: task?.assignee_name ?? null,
        sub_activity_name: task?.sub_activity_name ?? null,
        sub_activity_code: task?.sub_activity_code ?? null,
        offsetDays,
        durationDays,
        barColor: getBarColor(task),
      };
    });

    const today = startOfDay(new Date());
    const todayOffsetDays =
      today >= startDate && today <= endDate
        ? Math.round((today.getTime() - startDate.getTime()) / DAY_MS)
        : null;

    return { startDate, endDate, days, rows, todayOffsetDays };
  }, [searchedTasks]);

  const groupedTimelineRows = useMemo(() => {
    if (groupingMode === "ALL_TASKS") {
      return [];
    }

    const laneMap = timelineData.rows.reduce((acc, task) => {
      const laneName = groupingMode === "SUB_ACTIVITY"
        ? getTimelineSubActivityName(task)
        : getTimelineAssigneeName(task);
      const laneCode = groupingMode === "SUB_ACTIVITY"
        ? getTimelineSubActivityCode(task)
        : null;
      const laneKey = `${groupingMode}:${laneName}`;

      if (!acc.has(laneKey)) {
        acc.set(laneKey, {
          groupKey: laneKey,
          laneName,
          laneCode,
          tasks: [],
        });
      }

      acc.get(laneKey).tasks.push(task);
      return acc;
    }, new Map());

    return Array.from(laneMap.entries())
      .map(([, lane]) => lane)
      .sort((firstLane, secondLane) => {
        const fallbackLabel =
          groupingMode === "SUB_ACTIVITY"
            ? UNASSIGNED_SUB_ACTIVITY_LABEL
            : UNASSIGNED_LANE_LABEL;

        if (firstLane.laneName === fallbackLabel) return 1;
        if (secondLane.laneName === fallbackLabel) return -1;

        if (groupingMode === "SUB_ACTIVITY") {
          const firstCode = String(firstLane.laneCode || "");
          const secondCode = String(secondLane.laneCode || "");

          if (firstCode && secondCode) {
            return firstCode.localeCompare(secondCode, "id", {
              numeric: true,
              sensitivity: "base",
            });
          }

          if (firstCode) return -1;
          if (secondCode) return 1;
        }

        return firstLane.laneName.localeCompare(secondLane.laneName, "id");
      })
      .map((lane) => ({
        ...lane,
        overdueCount: lane.tasks.filter((task) => isTimelineTaskOverdue(task)).length,
        indicatorColor: getLaneIndicatorColor(lane.tasks),
        headerBackground: getTimelineLaneHeaderBackground(prefersDarkMode),
      }));
  }, [groupingMode, prefersDarkMode, timelineData.rows]);

  const ungroupedTimelineRows = useMemo(() => {
    return [...timelineData.rows].sort((firstTask, secondTask) => {
      const firstStartDate = new Date(firstTask.start_date || 0).getTime();
      const secondStartDate = new Date(secondTask.start_date || 0).getTime();

      if (firstStartDate !== secondStartDate) {
        return firstStartDate - secondStartDate;
      }

      const firstDueDate = new Date(firstTask.due_date || 0).getTime();
      const secondDueDate = new Date(secondTask.due_date || 0).getTime();

      return firstDueDate - secondDueDate;
    });
  }, [timelineData.rows]);

  const isGroupedMode = groupingMode !== "ALL_TASKS";

  const overdueHighlightWidth =
    timelineData.todayOffsetDays !== null
      ? timelineData.todayOffsetDays * DAY_WIDTH + DAY_WIDTH / 2
      : timelineData.endDate && startOfDay(new Date()) > timelineData.endDate
        ? timelineData.days.length * DAY_WIDTH
        : 0;

  const emptyStateMessage = search.trim()
    ? "Task tidak ditemukan"
    : activeFilter !== "ALL"
      ? "Tidak ada task pada kategori ini"
      : "Belum ada data timeline task.";

  useEffect(() => {
    if (!navigationContext?.task_id || groupingMode !== "SUB_ACTIVITY") {
      return;
    }

    const targetLane = groupedTimelineRows.find((lane) =>
      lane.tasks.some((task) => task.task_id === navigationContext.task_id)
    );

    if (!targetLane) {
      return;
    }

    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      setCollapsedLanes((prev) => {
        if (prev[targetLane.groupKey] === false) {
          return prev;
        }

        return {
          ...prev,
          [targetLane.groupKey]: false,
        };
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [groupedTimelineRows, groupingMode, navigationContext]);

  useEffect(() => {
    if (!navigationContext?.task_id || timelineData.rows.length === 0) {
      return;
    }

    scrollAnimationFrameRef.current = requestAnimationFrame(() => {
      const targetElement = document.querySelector(
        `[data-timeline-task-id="${navigationContext.task_id}"]`
      );

      if (!targetElement) {
        return;
      }

      setHighlightedTaskId(navigationContext.task_id);
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTaskId((currentValue) =>
          currentValue === navigationContext.task_id ? null : currentValue
        );
      }, 4000);
    });

    return () => {
      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }
    };
  }, [collapsedLanes, navigationContext, timelineData.rows.length]);

  useEffect(() => {
    if (!navigationContext?.search || highlightedTaskId !== navigationContext?.task_id) {
      return;
    }

    clearSearchTimeoutRef.current = setTimeout(() => {
      setSearch((currentValue) =>
        currentValue === navigationContext.search ? "" : currentValue
      );
    }, 500);

    return () => {
      if (clearSearchTimeoutRef.current) {
        clearTimeout(clearSearchTimeoutRef.current);
        clearSearchTimeoutRef.current = null;
      }
    };
  }, [highlightedTaskId, navigationContext]);

  const timelineStickyHeaderCellStyle = getTableHeaderCellStyle({
    background: "var(--table-header-bg)",
    padding: "12px 14px",
    borderColor: "transparent",
    color: "var(--table-header-color)",
    fontSize: 13,
    fontWeight: 400,
    letterSpacing: 0,
  });

  const timelineDayHeaderCellStyle = getTableHeaderCellStyle({
    background: "transparent",
    padding: "12px 6px",
    borderColor: "transparent",
    color: "var(--table-header-color)",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: 0,
  });

  return (
    <div style={{ paddingBottom: 60, width: "100%", boxSizing: "border-box", overflow: "hidden" }}>

      <div style={{ marginBottom: 40 }}>
        <h1 style={getPageTitleStyle()}>TIMELINE TASK</h1>
        {/*
        <div style={getPageSubtitleStyle()}>
          Visualisasi jadwal dan durasi pengerjaan sub-kegiatan dalam rentang waktu.
        </div>
        */}
      </div>

      {isLoading ? (
        <div
          style={{
            marginBottom: 14,
            ...getAlertStyle(prefersDarkMode, {
              tone: "info",
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 14,
            }),
          }}
        >
          Memuat data timeline...
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <div
          style={{
            marginBottom: 14,
            ...getAlertStyle(prefersDarkMode, {
              tone: "error",
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 14,
            }),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadTimelineTasks()}
            style={getDangerOutlinedButtonStyle(prefersDarkMode, {
              isEnabled: true,
              height: 34,
              size: "xs",
            })}
          >
            Coba Lagi
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "flex-start",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              disabled={!isGroupedMode}
              onClick={() =>
                setCollapsedLanes(
                  groupedTimelineRows.reduce((acc, lane) => {
                    acc[lane.groupKey] = false;
                    return acc;
                  }, {})
                )
              }
              className={`btn-specific-action ${isGroupedMode ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
            >
              Expand All
            </button>
            <button
              type="button"
              disabled={!isGroupedMode}
              onClick={() =>
                setCollapsedLanes(
                  groupedTimelineRows.reduce((acc, lane) => {
                    acc[lane.groupKey] = true;
                    return acc;
                  }, {})
                )
              }
              className={`btn-specific-action ${isGroupedMode ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
            >
              Collapse All
            </button>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="filter-select"
              style={{ width: 130, height: 34 }}
            >
              <option value="ALL">Semua</option>
              <option value="ACTIVE">Aktif</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DONE">Selesai</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={groupingMode}
              onChange={(event) => setGroupingMode(event.target.value)}
              className="filter-select"
              style={{ width: 150, height: 34 }}
            >
              <option value="ALL_TASKS">Semua Task</option>
              <option value="SUB_ACTIVITY">Sub Kegiatan</option>
              <option value="ASSIGNEE">Pelaksana</option>
            </select>
          </div>
          <div
            style={{
              position: "relative",
              flex: "1 1 200px",
              maxWidth: 300,
              minWidth: 150,
              overflow: "visible",
            }}
          >
            <span
              aria-hidden="true"
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
            <input
              className="timeline-search-input"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Cari task..."
              style={getSearchInputStyle(prefersDarkMode, {
                hasValue: Boolean(search),
                isFocused: isSearchFocused,
              })}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Hapus pencarian"
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...getCircleIconButtonStyle(prefersDarkMode, {
                    isEnabled: true,
                    tone: "neutral",
                    variant: "ghost",
                    size: 26,
                  }),
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          ...getTableFrameStyle({
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }),
          // Prevent unexpected cross-layer stacking when mixing sticky + absolute bars.
          isolation: "isolate",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: TASK_INFO_WIDTH + Math.max(1, timelineData.days.length) * DAY_WIDTH }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `${TASK_INFO_WIDTH}px 1fr`,
                borderBottom: "1px solid var(--table-header-border)",
                background: "var(--table-header-bg)",
                boxShadow: "none",
              }}
            >
              <div
                style={{
                  ...timelineStickyHeaderCellStyle,
                  borderRight: "1px solid var(--table-header-border)",
                  position: "sticky",
                  left: 0,
                  zIndex: 7,
                }}
              >
                Task
              </div>
              <div
                style={{
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${timelineData.days.length || 1}, ${DAY_WIDTH}px)`,
                    minWidth: "max-content",
                  }}
                >
                  {(timelineData.days.length > 0 ? timelineData.days : [null]).map((day, index) => (
                    <div
                      key={day ? day.toISOString() : `empty-day-${index}`}
                      style={{
                        ...timelineDayHeaderCellStyle,
                        textAlign: "center",
                      }}
                    >
                      {day ? formatHeaderLabel(day) : "-"}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!isLoading && !loadError && timelineData.rows.length === 0 ? (
              <div
                style={{
                  minHeight: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {emptyStateMessage}
              </div>
            ) : isGroupedMode ? (
              groupedTimelineRows.map((lane, laneIndex) => (
                <div
                  key={lane.groupKey}
                  style={{
                    marginTop: laneIndex === 0 ? 0 : 10,
                  }}
                >
                  <div
                    onClick={() =>
                      setCollapsedLanes((prev) => ({
                        ...prev,
                        [lane.groupKey]: !prev[lane.groupKey],
                      }))
                    }
                    style={{
                      display: "grid",
                      gridTemplateColumns: `${TASK_INFO_WIDTH}px 1fr`,
                      minHeight: groupingMode === "SUB_ACTIVITY" ? 52 : 44,
                      cursor: "pointer",
                      borderTop: laneIndex === 0 ? "none" : "1px solid var(--table-row-border)",
                      borderBottom: "1px solid var(--table-row-border)",
                    }}
                  >
                    <div
                      style={{
                        padding: groupingMode === "SUB_ACTIVITY" ? "8px 14px" : "10px 14px",
                        borderRight: "1px solid var(--table-row-border)",
                        borderLeft: "0 solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: groupingMode === "SUB_ACTIVITY" ? 12 : 8,
                        position: "sticky",
                        left: 0,
                        zIndex: 6,
                        background: lane.headerBackground,
                      }}
                    >
                      {groupingMode === "SUB_ACTIVITY" ? (
                        <>
                          <div
                            style={{
                              minWidth: 0,
                              display: "grid",
                              gap: 2,
                              flex: "1 1 auto",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 400,
                                  color: "var(--alert-info-color)",
                                  lineHeight: 1.3,
                                  flex: "1 1 auto",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxHeight: "2.6em",
                                }}
                              >
                                {lane.laneName}
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 400,
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexShrink: 0,
                              whiteSpace: "nowrap",
                              marginLeft: 10,
                            }}
                          >
                            <span>
                              {lane.tasks.length} task{lane.tasks.length > 1 ? "s" : ""}
                            </span>
                            <span style={{ color: "var(--text-subtle)" }}>{"\u2022"}</span>
                            <span
                              style={{
                                color: lane.overdueCount > 0 ? "#c2410c" : "var(--text-subtle)",
                                fontWeight: 400,
                              }}
                            >
                              {lane.overdueCount} overdue
                            </span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 400,
                              color: "var(--alert-info-color)",
                            }}
                          >
                            {lane.laneName}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 400,
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>
                              {lane.tasks.length} task{lane.tasks.length > 1 ? "s" : ""}
                            </span>
                            <span style={{ color: "var(--text-subtle)" }}>{"\u2022"}</span>
                            <span
                              style={{
                                color: lane.overdueCount > 0 ? "#b45309" : "var(--text-subtle)",
                                fontWeight: 400,
                              }}
                            >
                              {lane.overdueCount} overdue
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          position: "relative",
                          display: "grid",
                          gridTemplateColumns: `repeat(${timelineData.days.length || 1}, ${DAY_WIDTH}px)`,
                          minWidth: "max-content",
                          minHeight: groupingMode === "SUB_ACTIVITY" ? 52 : 44,
                          background: lane.headerBackground,
                        }}
                      >
                        {timelineData.todayOffsetDays !== null ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              bottom: 0,
                              left: 0,
                              width: `${overdueHighlightWidth}px`,
                              background: "rgba(239, 68, 68, 0.035)",
                              pointerEvents: "none",
                              zIndex: 0,
                            }}
                          />
                        ) : null}
                        {timelineData.todayOffsetDays !== null ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              bottom: 0,
                              left: `${timelineData.todayOffsetDays * DAY_WIDTH + DAY_WIDTH / 2}px`,
                              width: 2,
                              background: TODAY_LINE_BACKGROUND,
                              pointerEvents: "none",
                              zIndex: 1,
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {!collapsedLanes[lane.groupKey] ? lane.tasks.map((task) => (
                    <div
                      key={task.task_id}
                      data-timeline-task-id={task.task_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: `${TASK_INFO_WIDTH}px 1fr`,
                        borderBottom: "1px solid var(--table-row-border)",
                        minHeight: 46,
                        boxShadow:
                          highlightedTaskId === task.task_id
                            ? "none"
                            : "none",
                        background:
                          highlightedTaskId === task.task_id ? "var(--row-highlight-bg)" : "transparent",
                        transition: "background-color 0.25s ease, box-shadow 0.25s ease",
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 14px",
                          borderRight: "1px solid var(--table-row-border)",
                          display: "grid",
                          gap: 2,
                          alignContent: "center",
                          position: "sticky",
                          left: 0,
                          zIndex: 6,
                          background:
                            highlightedTaskId === task.task_id ? "var(--row-highlight-bg)" : "var(--table-bg)",
                          transition: "background-color 0.25s ease",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: "var(--text-h)",
                            lineHeight: 1.3,
                            cursor: "pointer",
                            minWidth: 0,
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          onClick={() => {
                            setSelectedTask(task);
                            setIsDetailOpen(true);
                          }}
                        >
                          {task.task_title || "-"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            lineHeight: 1.25,
                          }}
                        >
                          {getTaskRowMetaParts(task, groupingMode).map((metaPart, index) => (
                            <span key={`${task.task_id}-grouped-meta-${index}`}>{metaPart}</span>
                          ))}
                        </div>
                      </div>
                      <div
                        style={{
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: `repeat(${timelineData.days.length}, ${DAY_WIDTH}px)`,
                            minWidth: "max-content",
                            minHeight: 46,
                            background:
                              highlightedTaskId === task.task_id ? "#fff8de" : "transparent",
                          }}
                        >
                          {timelineData.todayOffsetDays !== null ? (
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: 0,
                                width: `${overdueHighlightWidth}px`,
                                background: "rgba(239, 68, 68, 0.035)",
                                pointerEvents: "none",
                                zIndex: 0,
                              }}
                            />
                          ) : null}
                          {timelineData.todayOffsetDays !== null ? (
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: `${timelineData.todayOffsetDays * DAY_WIDTH + DAY_WIDTH / 2}px`,
                                width: 2,
                                background: TODAY_LINE_BACKGROUND,
                                pointerEvents: "none",
                                zIndex: 1,
                              }}
                            />
                          ) : null}
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: `${task.offsetDays * DAY_WIDTH + 4}px`,
                              width: `${task.durationDays * DAY_WIDTH - 8}px`,
                              height: 20,
                              transform: "translateY(-50%)",
                              borderRadius: 999,
                              background: `linear-gradient(180deg, ${task.barColor} 0%, ${task.barColor}dd 100%)`,
                              boxShadow:
                                highlightedTaskId === task.task_id
                                  ? "0 0 0 3px rgba(245, 158, 11, 0.3), 0 2px 6px rgba(15, 23, 42, 0.12)"
                                  : "0 2px 4px rgba(15, 23, 42, 0.10)",
                              zIndex: 3,
                              cursor: "pointer",
                              transition: "box-shadow 0.25s ease",
                            }}
                            onClick={() => {
                              setSelectedTask(task);
                              setIsDetailOpen(true);
                            }}
                            onMouseEnter={() => setHoveredTaskId(task.task_id)}
                            onMouseLeave={() => setHoveredTaskId(null)}
                          />
                          {hoveredTaskId === task.task_id ? (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "calc(50% + 22px)",
                                ...getTooltipPositionStyle(task, timelineData.days.length),
                                minWidth: 190,
                                maxWidth: 240,
                                padding: "10px 12px",
                                borderRadius: 10,
                                background: "rgba(176, 175, 171, 0.94)",
                                color: "#f8fafc",
                                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
                                zIndex: 12,
                                pointerEvents: "none",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 400,
                                  lineHeight: 1.35,
                                  marginBottom: 6,
                                }}
                              >
                                {task.task_title || "-"}
                              </div>
                              {task.sub_activity_name ? (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--control-inverse-placeholder)",
                                    lineHeight: 1.35,
                                    marginBottom: 4,
                                  }}
                                >
                                  {task.sub_activity_name}
                                </div>
                              ) : null}
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--control-inverse-placeholder)",
                                  lineHeight: 1.35,
                                  marginBottom: 3,
                                }}
                              >
                                {[getTimelineAssigneeName(task), task.task_status_name || "-", `${Number(task.progress_percent || 0)}%`].join(" \u2022 ")}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-subtle)",
                                  lineHeight: 1.35,
                                }}
                              >
                                {`${formatTooltipDate(task.start_date)} - ${formatTooltipDate(task.due_date)}`}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )) : null}
                </div>
              ))
            ) : (
              ungroupedTimelineRows.map((task) => (
                <div
                  key={task.task_id}
                  data-timeline-task-id={task.task_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${TASK_INFO_WIDTH}px 1fr`,
                    borderBottom: "1px solid var(--table-row-border)",
                    minHeight: 46,
                    boxShadow:
                      highlightedTaskId === task.task_id
                        ? "none"
                        : "none",
                    background:
                      highlightedTaskId === task.task_id ? "var(--row-highlight-bg)" : "transparent",
                    transition: "background-color 0.25s ease, box-shadow 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRight: "1px solid var(--table-row-border)",
                      display: "grid",
                      gap: 2,
                      alignContent: "center",
                      position: "sticky",
                      left: 0,
                      zIndex: 6,
                      background:
                        highlightedTaskId === task.task_id
                          ? "var(--row-highlight-bg)"
                          : "var(--surface-1)",
                      transition: "background-color 0.25s ease",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--text-h)",
                        lineHeight: 1.3,
                        cursor: "pointer",
                        minWidth: 0,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailOpen(true);
                      }}
                    >
                      {task.task_title || "-"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        lineHeight: 1.25,
                      }}
                    >
                      {getTaskRowMetaParts(task, groupingMode).map((metaPart, index) => (
                        <span key={`${task.task_id}-ungrouped-meta-${index}`}>{metaPart}</span>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "grid",
                        gridTemplateColumns: `repeat(${timelineData.days.length}, ${DAY_WIDTH}px)`,
                        minWidth: "max-content",
                        minHeight: 46,
                        background:
                          highlightedTaskId === task.task_id ? "#fff8de" : "transparent",
                      }}
                    >
                      {timelineData.todayOffsetDays !== null ? (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: `${overdueHighlightWidth}px`,
                            background: "rgba(239, 68, 68, 0.035)",
                            pointerEvents: "none",
                            zIndex: 0,
                          }}
                        />
                      ) : null}
                      {timelineData.todayOffsetDays !== null ? (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${timelineData.todayOffsetDays * DAY_WIDTH + DAY_WIDTH / 2}px`,
                            width: 2,
                            background: TODAY_LINE_BACKGROUND,
                            pointerEvents: "none",
                            zIndex: 1,
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: `${task.offsetDays * DAY_WIDTH + 4}px`,
                          width: `${task.durationDays * DAY_WIDTH - 8}px`,
                          height: 20,
                          transform: "translateY(-50%)",
                          borderRadius: 999,
                          background: `linear-gradient(180deg, ${task.barColor} 0%, ${task.barColor}dd 100%)`,
                          boxShadow:
                            highlightedTaskId === task.task_id
                              ? "0 0 0 3px rgba(245, 158, 11, 0.3), 0 2px 6px rgba(15, 23, 42, 0.12)"
                              : "0 2px 4px rgba(15, 23, 42, 0.10)",
                          zIndex: 3,
                          cursor: "pointer",
                          transition: "box-shadow 0.25s ease",
                        }}
                        onClick={() => {
                          setSelectedTask(task);
                          setIsDetailOpen(true);
                        }}
                        onMouseEnter={() => setHoveredTaskId(task.task_id)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                      />
                      {hoveredTaskId === task.task_id ? (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "calc(50% + 22px)",
                            ...getTooltipPositionStyle(task, timelineData.days.length),
                            minWidth: 190,
                            maxWidth: 240,
                            padding: "10px 12px",
                            borderRadius: 6,
                            background: "rgba(15, 23, 42, 0.94)",
                            color: "#f8fafc",
                            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
                            zIndex: 12,
                            pointerEvents: "none",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 400,
                              lineHeight: 1.35,
                              marginBottom: 6,
                            }}
                          >
                            {task.task_title || "-"}
                          </div>
                          {task.sub_activity_name ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--control-inverse-placeholder)",
                                lineHeight: 1.35,
                                marginBottom: 4,
                              }}
                            >
                              {task.sub_activity_name}
                            </div>
                          ) : null}
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--control-inverse-placeholder)",
                              lineHeight: 1.35,
                              marginBottom: 3,
                            }}
                          >
                            {[getTimelineAssigneeName(task), task.task_status_name || "-", `${Number(task.progress_percent || 0)}%`].join(" \u2022 ")}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-subtle)",
                              lineHeight: 1.35,
                            }}
                          >
                            {`${formatTooltipDate(task.start_date)} - ${formatTooltipDate(task.due_date)}`}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {isDetailOpen && selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setIsDetailOpen(false)}
          onTaskUpdated={loadTimelineTasks}
        />
      ) : null}
    </div>
  );
}
