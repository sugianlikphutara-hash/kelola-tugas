import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  canMoveTaskKanban,
  canMoveTaskKanbanTransition,
} from "../lib/authorization";
import {
  getKanbanTasks,
  getTaskKanbanCards,
  getTaskKanbanColumns,
  moveTaskKanbanCard,
} from "../services/taskService";
import TaskDetailModal from "../components/tasks/TaskDetailModal";
import {
  getAlertStyle,
  getDangerOutlinedButtonStyle,
  getEmptyStateStyle,
  getPageTitleStyle,
} from "../lib/controlStyles";

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

function getKanbanColumnStyle(column) {
  const code = String(column?.code || "").toLowerCase();

  if (code === "belum-mulai" || code === "belum_mulai") {
    return { background: "var(--surface-2)", headerBg: "var(--surface-3)", headerColor: "var(--text-muted)" };
  }

  if (code === "proses") {
    return { background: "var(--alert-info-bg)", headerBg: "var(--alert-info-bg)", headerColor: "var(--alert-info-color)" };
  }

  if (code === "review" || code === "peninjauan") {
    return {
      background: "var(--chip-purple-bg)",
      headerBg: "var(--chip-purple-bg)",
      headerColor: "var(--chip-purple-color)",
    };
  }

  if (code === "perbaikan" || code === "revisi" || code === "perbaikan/revisi") {
    return { background: "var(--alert-warning-bg)", headerBg: "var(--alert-warning-bg)", headerColor: "var(--alert-warning-color)" };
  }

  if (code === "terkendala") {
    return { background: "var(--alert-error-bg)", headerBg: "var(--alert-error-bg)", headerColor: "var(--alert-error-color)" };
  }

  if (code === "selesai") {
    return { background: "var(--alert-success-bg)", headerBg: "var(--alert-success-bg)", headerColor: "var(--alert-success-color)" };
  }

  if (code === "dibatalkan") {
    return { background: "var(--chip-disabled-bg)", headerBg: "var(--chip-disabled-bg)", headerColor: "var(--chip-disabled-color)" };
  }

  return { background: "var(--surface-2)", headerBg: "var(--surface-3)", headerColor: "var(--text-muted)" };
}

function getProgressColor(progressPercent) {
  const progress = Number(progressPercent || 0);

  if (progress >= 100) {
    return "#15803d";
  }

  if (progress > 0) {
    return "#1d4ed8";
  }

  return "#374151";
}

function getTaskSubActivityCode(task) {
  return (
    task?.sub_activity_code ||
    task?.sub_activity_name ||
    "-"
  );
}

function getTaskAssigneeDisplayName(task) {
  return (
    String(task?.assignee_display_name || "").trim() ||
    String(task?.assignee_nick_name || "").trim() ||
    String(task?.assignee_name || "").trim() ||
    "-"
  );
}

function getTaskCurrentKanbanCode(task, columnCodeMap) {
  return task?.task_status_code || columnCodeMap[String(task?.kanbanCard?.column_id || "")] || null;
}

function normalizeEmployeeId(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function getKanbanColumnTitle(column) {
  const rawTitle = String(column?.title || column?.name || column?.code || "-");

  if (rawTitle.toLowerCase() === "perbaikan/revisi") {
    return "Perbaikan";
  }

  return rawTitle.replace("/Revisi", "").replace("/revisi", "");
}

function KanbanCardSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--panel-border)",
        borderRadius: 6,
        padding: "10px 11px",
        marginBottom: 6,
        background: "var(--panel-bg)",
      }}
    >
      <div
        style={{
          width: 72,
          height: 10,
          borderRadius: 999,
          background: "var(--border-subtle)",
          marginBottom: 8,
        }}
      />
      <div
        style={{
          width: "78%",
          height: 14,
          borderRadius: 6,
          background: "var(--border-subtle)",
          marginBottom: 5,
        }}
      />
      <div
        style={{
          width: "62%",
          height: 14,
          borderRadius: 6,
          background: "var(--surface-3)",
          marginBottom: 8,
        }}
      />
      <div style={{ display: "grid", gap: 4 }}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={`skeleton-row-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 70,
                height: 10,
                borderRadius: 6,
                background: "var(--surface-3)",
              }}
            />
            <div
              style={{
                width: 84,
                height: 10,
                borderRadius: 6,
                background: "var(--border-subtle)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, onClick, isSelected, onDragStart, onDragEnd }) {
  const progressColor = getProgressColor(task?.progress_percent);
  const dueDateColor = isOverdue(task) ? "var(--alert-error-color)" : "var(--text-muted)";
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const detailLabelStyle = {
    fontSize: 11,
    color: "var(--text-subtle)",
    fontWeight: 600,
    minWidth: 74,
    flexShrink: 0,
  };
  const detailValueStyle = {
    fontSize: 11,
    color: "var(--text-h)",
    fontWeight: 600,
    lineHeight: 1.35,
    minWidth: 0,
  };

  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={(event) => {
        setIsPressed(false);
        onDragStart(event);
      }}
      onDragEnd={(event) => {
        setIsPressed(false);
        onDragEnd(event);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        setIsPressed(false);
      }}
      tabIndex={0}
      style={{
        border: isSelected ? "1px solid #60a5fa" : "1px solid var(--control-border)",
        borderRadius: 6,
        padding: "10px 11px",
        marginBottom: 6,
        background: isSelected
          ? "var(--alert-info-bg)"
          : isHovered
            ? "var(--surface-2)"
            : "var(--panel-bg)",
        cursor: "pointer",
        boxShadow: isSelected
          ? "0 8px 18px rgba(37, 99, 235, 0.12)"
          : isPressed
            ? "0 2px 6px rgba(15, 23, 42, 0.10)"
            : isHovered
              ? "0 6px 14px rgba(15, 23, 42, 0.10)"
          : "0 1px 3px rgba(15, 23, 42, 0.06)",
        transform: isPressed ? "scale(0.995)" : isHovered ? "translateY(-1px)" : "none",
        transition:
          "background-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease, border-color 0.16s ease",
        borderColor: isSelected
          ? "#60a5fa"
          : isFocused || isHovered
            ? "var(--text-subtle)"
            : "var(--control-border)",
        outline: "none",
        position: "relative",
      }}
    >
      {isFocused ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 8,
            border: "2px solid rgba(96, 165, 250, 0.35)",
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 4,
          lineHeight: 1.25,
        }}
      >
        {getTaskSubActivityCode(task)}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 15,
          color: "var(--text-h)",
          lineHeight: 1.3,
          marginBottom: 7,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {task.task_title || "-"}
      </div>
      <div
        style={{
          display: "grid",
          gap: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
            lineHeight: 1.25,
          }}
        >
          <span style={detailLabelStyle}>Pelaksana</span>
          <span
            style={{
              ...detailValueStyle,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "right",
            }}
          >
            {getTaskAssigneeDisplayName(task)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
            lineHeight: 1.25,
          }}
        >
          <span style={detailLabelStyle}>Status</span>
          <span
            style={{
              ...detailValueStyle,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "right",
            }}
          >
            {task.task_status_name || task.task_status_code || "-"}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
            lineHeight: 1.25,
          }}
        >
          <span style={detailLabelStyle}>Progress</span>
          <span
            style={{
              ...detailValueStyle,
              color: progressColor,
              fontWeight: 700,
              textAlign: "right",
            }}
          >
            {task.progress_percent || 0}%
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
            lineHeight: 1.25,
          }}
        >
          <span style={detailLabelStyle}>Due date</span>
          <span
            style={{
              ...detailValueStyle,
              color: dueDateColor,
              fontWeight: isOverdue(task) ? 700 : 600,
              textAlign: "right",
            }}
          >
            {formatDate(task.due_date)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const auth = useAuth();
  const prefersDarkMode = usePrefersDarkMode();
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [kanbanCards, setKanbanCards] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showProblemOnly, _setShowProblemOnly] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropColumnId, setDropColumnId] = useState(null);
  const [movingCardId, setMovingCardId] = useState(null);
  const boardContainerRef = useRef(null);
  const dragScrollFrameRef = useRef(null);
  const dragScrollVelocityRef = useRef({ x: 0, y: 0 });
  const canManageKanban = canMoveTaskKanban(auth.roleCode);
  const currentEmployeeId = normalizeEmployeeId(auth.employeeId);

  const loadTasks = useCallback(async () => {
    setErrorMessage("");

    try {
      const [columnData, taskData, cardData] = await Promise.all([
        getTaskKanbanColumns(),
        getKanbanTasks(),
        getTaskKanbanCards(),
      ]);

      setColumns(columnData || []);
      setTasks(taskData || []);
      setKanbanCards(cardData || []);
    } catch (error) {
      console.error(error);
      setColumns([]);
      setTasks([]);
      setKanbanCards([]);
      setSelectedTask(null);
      setIsDetailOpen(false);
      setErrorMessage(error.message || "Gagal memuat data kanban task.");
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      void loadTasks();
    });

    return () => {
      isCancelled = true;
    };
  }, [loadTasks]);

  useEffect(() => {
    return () => {
      if (dragScrollFrameRef.current) {
        cancelAnimationFrame(dragScrollFrameRef.current);
      }
    };
  }, []);

  const filteredTasks = useMemo(() => {
    if (!showProblemOnly) {
      return tasks;
    }

    return tasks.filter((task) => isOverdue(task) || isNoProgress(task));
  }, [tasks, showProblemOnly]);

  useEffect(() => {
    if (
      selectedTask &&
      !filteredTasks.some((task) => task.task_id === selectedTask.task_id)
    ) {
      let isCancelled = false;

      Promise.resolve().then(() => {
        if (isCancelled) {
          return;
        }

        setSelectedTask(null);
        setIsDetailOpen(false);
      });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [filteredTasks, selectedTask]);

  const groupedTasks = useMemo(() => {
    const taskMap = new Map(
      filteredTasks.map((task) => [String(task.task_id), task])
    );

    return columns.reduce((acc, column) => {
      const columnId = column.id;

      acc[columnId] = kanbanCards
        .filter((card) => {
          const cardTaskId = String(
            card.entity_id ?? card.record_id ?? card.task_id ?? ""
          );

          return card.column_id === columnId && taskMap.has(cardTaskId);
        })
        .sort(
          (firstCard, secondCard) =>
            Number(firstCard.sort_order ?? 0) - Number(secondCard.sort_order ?? 0)
        )
        .map((card) => {
          const cardTaskId = String(
            card.entity_id ?? card.record_id ?? card.task_id ?? ""
          );
          const task = taskMap.get(cardTaskId);

          return {
            ...task,
            kanbanCard: card,
          };
        })
        .filter(Boolean);

      return acc;
    }, {});
  }, [columns, filteredTasks, kanbanCards]);

  const columnCodeMap = useMemo(
    () =>
      columns.reduce((map, column) => {
        map[String(column.id)] = column.code || null;
        return map;
      }, {}),
    [columns]
  );

  function canMoveTaskToColumn(task, targetColumnId) {
    if (!canManageKanban) {
      return false;
    }

    if (
      String(auth.roleCode || "").trim().toUpperCase() === "STAF" &&
      normalizeEmployeeId(task?.assignee_employee_id) !== currentEmployeeId
    ) {
      return false;
    }

    const currentCode = getTaskCurrentKanbanCode(task, columnCodeMap);
    const targetCode = columnCodeMap[String(targetColumnId)] || null;
    return canMoveTaskKanbanTransition(auth.roleCode, currentCode, targetCode);
  }

  async function handleColumnDrop(targetColumnId) {
    if (!canManageKanban) {
      setDraggedTask(null);
      setDropColumnId(null);
      setErrorMessage("Anda tidak memiliki izin untuk memindahkan task di kanban.");
      return;
    }

    if (!draggedTask?.kanbanCard?.id || !draggedTask?.task_id) {
      setDropColumnId(null);
      return;
    }

    const currentColumnId = draggedTask.kanbanCard.column_id;
    if (currentColumnId === targetColumnId) {
      setDraggedTask(null);
      setDropColumnId(null);
      return;
    }

    if (!canMoveTaskToColumn(draggedTask, targetColumnId)) {
      setDraggedTask(null);
      setDropColumnId(null);
      setErrorMessage(
        "Role Anda hanya boleh memindahkan task pada area Belum Mulai dan Proses."
      );
      return;
    }

    const nextSortOrder = (groupedTasks[targetColumnId]?.length || 0) + 1;
    setMovingCardId(draggedTask.kanbanCard.id);

    try {
      await moveTaskKanbanCard({
        taskId: draggedTask.task_id,
        cardId: draggedTask.kanbanCard.id,
        targetColumnId,
        targetSortOrder: nextSortOrder,
      });

      await loadTasks();
    } catch (error) {
      console.error(error);
    } finally {
      setDraggedTask(null);
      setDropColumnId(null);
      setMovingCardId(null);
    }
  }

  function stopAutoScroll() {
    dragScrollVelocityRef.current = { x: 0, y: 0 };

    if (dragScrollFrameRef.current) {
      cancelAnimationFrame(dragScrollFrameRef.current);
      dragScrollFrameRef.current = null;
    }
  }

  function startAutoScroll() {
    if (dragScrollFrameRef.current) {
      return;
    }

    const tick = () => {
      const container = boardContainerRef.current;
      const { x, y } = dragScrollVelocityRef.current;

      if (!container || (!x && !y)) {
        dragScrollFrameRef.current = null;
        return;
      }

      if (x) {
        container.scrollLeft += x;
      }

      if (y) {
        window.scrollBy({ top: y, behavior: "auto" });
      }

      dragScrollFrameRef.current = requestAnimationFrame(tick);
    };

    dragScrollFrameRef.current = requestAnimationFrame(tick);
  }

  function handleBoardDragOver(event) {
    if (!canManageKanban || !draggedTask || !boardContainerRef.current) {
      stopAutoScroll();
      return;
    }

    event.preventDefault();

    const container = boardContainerRef.current;
    const rect = container.getBoundingClientRect();
    const horizontalThreshold = 120;
    const verticalThreshold = 120;
    const maxHorizontalStep = 26;
    const maxVerticalStep = 18;
    let nextHorizontalVelocity = 0;
    let nextVerticalVelocity = 0;

    if (event.clientX <= rect.left + horizontalThreshold) {
      const distanceFromLeft = Math.max(event.clientX - rect.left, 0);
      const intensity =
        (horizontalThreshold - distanceFromLeft) / horizontalThreshold;

      nextHorizontalVelocity = -Math.max(8, Math.round(maxHorizontalStep * intensity));
    } else if (event.clientX >= rect.right - horizontalThreshold) {
      const distanceFromRight = Math.max(rect.right - event.clientX, 0);
      const intensity =
        (horizontalThreshold - distanceFromRight) / horizontalThreshold;

      nextHorizontalVelocity = Math.max(8, Math.round(maxHorizontalStep * intensity));
    }

    if (event.clientY <= verticalThreshold) {
      const intensity = (verticalThreshold - event.clientY) / verticalThreshold;
      nextVerticalVelocity = -Math.max(6, Math.round(maxVerticalStep * intensity));
    } else if (event.clientY >= window.innerHeight - verticalThreshold) {
      const distanceFromBottom = Math.max(window.innerHeight - event.clientY, 0);
      const intensity =
        (verticalThreshold - distanceFromBottom) / verticalThreshold;

      nextVerticalVelocity = Math.max(6, Math.round(maxVerticalStep * intensity));
    }

    dragScrollVelocityRef.current = {
      x: nextHorizontalVelocity,
      y: nextVerticalVelocity,
    };

    if (nextHorizontalVelocity || nextVerticalVelocity) {
      startAutoScroll();
      return;
    }

    stopAutoScroll();
  }

  return (
    <div className="kanban-legacy-theme" style={{ paddingBottom: 60 }}>
      <style>
        {`
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
        `}
      </style>
      <div style={{ marginBottom: 50 }}>
        <h1 style={getPageTitleStyle()}>KANBAN TASK</h1>
        {/*
        <div style={getPageSubtitleStyle()}>
          Visualisasi alur kerja task berdasarkan status progres secara interaktif.
        </div>
        */}
      </div>
      {/*
      <button
        type="button"
        onClick={() => setShowProblemOnly((prev) => !prev)}
        style={{
          ...getPillToggleButtonStyle(prefersDarkMode, {
            isActive: showProblemOnly,
            activeBorderColor: "#fca5a5",
            inactiveBorderColor: "var(--control-border)",
            activeBackground: "var(--alert-error-bg)",
            inactiveBackground: "var(--panel-bg)",
            activeColor: "#991b1b",
            inactiveColor: "var(--text-h)",
            borderRadius: 10,
            fontWeight: 700,
            padding: "8px 12px",
          }),
          marginBottom: 12,
        }}
      >
        {showProblemOnly ? "Tampilkan Semua Task" : "Tampilkan Task Bermasalah"}
      </button>
        */}
      {!canManageKanban ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, { tone: "info" }),
          }}
        >
          Kanban saat ini bersifat baca-saja untuk role Anda. Perpindahan task hanya tersedia untuk pengelola task sesuai kewenangan role.
        </div>
      ) : auth.roleCode === "STAF" ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, { tone: "info" }),
          }}
        >
          STAF hanya dapat memindahkan task miliknya sendiri pada area Belum Mulai dan Proses.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, { tone: "error" }),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              setIsInitialLoading(true);
              void loadTasks();
            }}
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
        ref={boardContainerRef}
        onDragOver={handleBoardDragOver}
        onDragLeave={() => {
          if (draggedTask) {
            stopAutoScroll();
          }
        }}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          overflowX: "auto",
          width: "100%",
          paddingBottom: 6,
        }}
      >
        {!isInitialLoading && !errorMessage && columns.length === 0 ? (
          <div
            style={{
              ...getEmptyStateStyle(prefersDarkMode, {
                minHeight: 180,
                padding: 24,
                borderRadius: 12,
                background: "var(--surface-2)",
                borderColor: "var(--text-subtle)",
                color: "var(--text-muted)",
                fontSize: 14,
                lineHeight: 1.5,
              }),
              width: "100%",
            }}
          >
            Belum ada konfigurasi kolom kanban task.
          </div>
        ) : null}
        {columns.map((col) => {
          const columnStyle = getKanbanColumnStyle(col);

          return (
            <div
              key={col.id ?? col.code ?? col.name}
              onDragOver={(event) => {
                if (!canManageKanban) {
                  return;
                }

                if (draggedTask && !canMoveTaskToColumn(draggedTask, col.id)) {
                  return;
                }

                event.preventDefault();
                if (dropColumnId !== col.id) {
                  setDropColumnId(col.id);
                }
              }}
              onDragLeave={() => {
                if (dropColumnId === col.id) {
                  setDropColumnId(null);
                }
              }}
              onDrop={(event) => {
                if (!canManageKanban) {
                  return;
                }

                event.preventDefault();
                stopAutoScroll();
                handleColumnDrop(col.id);
              }}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                background:
                  dropColumnId === col.id ? "var(--surface-3)" : columnStyle.background,
                borderRadius: 12,
                padding: 10,
                transition: "background-color 0.15s ease",
              }}
            >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: columnStyle.headerBg,
                color: columnStyle.headerColor,
                fontSize: 15,
                lineHeight: 1.25,
                textAlign: "center",
                borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              {getKanbanColumnTitle(col)} ({groupedTasks[col.id]?.length || 0})
            </div>
            <div
              style={{
                paddingTop: 2,
              }}
            >
              {isInitialLoading ? (
                <>
                  <KanbanCardSkeleton />
                  <KanbanCardSkeleton />
                  <KanbanCardSkeleton />
                </>
              ) : (
                <>
                  {(groupedTasks[col.id] || []).map((task) => (
                    <TaskCard
                      key={task.task_id}
                      task={task}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailOpen(true);
                      }}
                      isSelected={isDetailOpen && task.task_id === selectedTask?.task_id}
                      onDragStart={(event) => {
                        if (!canManageKanban) {
                          event.preventDefault();
                          return;
                        }

                        const currentCode = getTaskCurrentKanbanCode(task, columnCodeMap);
                        if (
                          !canMoveTaskKanbanTransition(
                            auth.roleCode,
                            currentCode,
                            currentCode
                          )
                        ) {
                          event.preventDefault();
                          setErrorMessage(
                            "Role Anda hanya boleh memindahkan task pada area Belum Mulai dan Proses."
                          );
                          return;
                        }

                        if (
                          String(auth.roleCode || "").trim().toUpperCase() === "STAF" &&
                          normalizeEmployeeId(task?.assignee_employee_id) !== currentEmployeeId
                        ) {
                          event.preventDefault();
                          setErrorMessage(
                            "Anda hanya dapat memindahkan task yang ditugaskan kepada Anda."
                          );
                          return;
                        }

                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/plain",
                          String(task.kanbanCard?.id || task.task_id)
                        );
                        setDraggedTask(task);
                      }}
                      onDragEnd={() => {
                        stopAutoScroll();
                        setDraggedTask(null);
                        setDropColumnId(null);
                      }}
                    />
                  ))}
                  {(groupedTasks[col.id] || []).length === 0 ? (
                    <div
                      style={getEmptyStateStyle(prefersDarkMode, {
                        minHeight: 120,
                        padding: "14px 10px",
                        borderRadius: 10,
                        background: "var(--surface-glass)",
                        borderColor: "var(--border-strong)",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        lineHeight: 1.4,
                      })}
                    >
                      Belum ada task
                    </div>
                  ) : null}
                  {movingCardId && dropColumnId === col.id ? (
                    <div style={{ fontSize: 12, color: "var(--alert-info-color)", marginTop: 8 }}>
                      Memindahkan task...
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
          );
        })}
      </div>
      {isDetailOpen && selectedTask ? (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setIsDetailOpen(false)}
          onTaskUpdated={loadTasks}
        />
      ) : null}
    </div>
  );
}
