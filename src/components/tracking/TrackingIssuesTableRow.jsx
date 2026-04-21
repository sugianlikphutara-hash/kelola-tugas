import { memo } from "react";
import { getCompactText } from "../../lib/text";
import { 
  getChipStyle, 
  getCircleIconButtonStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
} from "../../lib/controlStyles";

const TABLE_ROW_HOVER_FILTER_DARK = "brightness(1.08)";
const TABLE_ROW_HOVER_FILTER_LIGHT = "brightness(0.985)";

function TrackingIssuesTableRow({
  task,
  prefersDarkMode,
  tableBodyCellStyle,
  taskColumnWidthStyle = null,
  taskTitleClampClassName = "",
  taskTitleCharLimit = null,
  hasFollowUp,
  hasPendingFollowUp,
  setFollowUpTask,
  setSelectedTask,
  setIsDetailOpen,
  onOpenTaskInTimeline,
  formatDate,
  getTrackingRowSurface,
  getStatusBadgeMeta,
  getProgressBadgeMeta,
  getTrackingIssueCategories,
}) {
  const rowSurface = getTrackingRowSurface(task, prefersDarkMode);
  const statusBadgeMeta = getStatusBadgeMeta(task.task_status_name);
  const progressBadgeMeta = getProgressBadgeMeta(task.progress_percent);
  const issueCategories = getTrackingIssueCategories(task);

  return (
    <tr
      onClick={() => setFollowUpTask(task)}
      style={{
        background: rowSurface.background,
        transition: "background-color 0.15s ease, transform 0.15s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.filter = prefersDarkMode
          ? TABLE_ROW_HOVER_FILTER_DARK
          : TABLE_ROW_HOVER_FILTER_LIGHT;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.filter = "none";
      }}
    >
      <td style={{ ...tableBodyCellStyle, ...(taskColumnWidthStyle || {}) }}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedTask(task);
            setIsDetailOpen(true);
          }}
          className={taskTitleClampClassName || undefined}
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          textDecoration: "none",
          ...getTableCellLabelTypography(),
          }}
        >
          {taskTitleCharLimit ? getCompactText(task.task_title, taskTitleCharLimit) : task.task_title || "-"}
        </button>
      <div
        style={{
          marginTop: 6,
          ...getTableCellSubtitleTypography(),
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={`Sub Kegiatan: ${task.sub_activity_name || "-"}`}
      >
        Sub Kegiatan: {task.sub_activity_name || "-"}
      </div>
      </td>
      <td style={{ ...tableBodyCellStyle, textAlign: "center", fontWeight: 500, width: "9%" }}>
        {task.assignee_display_name || task.assignee_name || "-"}
      </td>
      <td style={{ ...tableBodyCellStyle, textAlign: "center", width: "17%" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
          }}
        >
          {issueCategories.map((category) => (
            <span
              key={`${task.task_id}-${category.key}`}
              style={getChipStyle(prefersDarkMode, {
                size: "xs",
                fontWeight: 600,
                background: category.background,
                color: category.color,
              })}
            >
              {category.label}
            </span>
          ))}
        </div>
      </td>
      <td style={{ ...tableBodyCellStyle, textAlign: "center", width: "11%" }}>
        <span
          style={getChipStyle(prefersDarkMode, {
            size: "sm",
            fontWeight: 600,
            background: statusBadgeMeta.background,
            color: statusBadgeMeta.color,
          })}
        >
          {task.task_status_name || "-"}
        </span>
      </td>
      <td style={{ ...tableBodyCellStyle, textAlign: "center", width: "9%" }}>
        <span
          style={getChipStyle(prefersDarkMode, {
            size: "sm",
            minWidth: 50,
            fontWeight: 600,
            background: progressBadgeMeta.background,
            color: progressBadgeMeta.color,
          })}
        >
          {task.progress_percent || 0}%
        </span>
      </td>
      <td
        style={{
          ...tableBodyCellStyle,
          textAlign: "center",
          width: "9%",
          color: task.tracking_flags?.overdue
            ? "var(--alert-error-color)"
            : "var(--text-muted)",
          fontWeight: task.tracking_flags?.overdue ? 600 : 500,
        }}
      >
        {formatDate(task.due_date)}
      </td>
      <td
        style={{
          ...tableBodyCellStyle,
          textAlign: "center",
          width: 136,
          position: "relative",
        }}
      >
        <div
          style={{
            minHeight: 46,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setFollowUpTask(task);
            }}
            title={
              hasFollowUp
                ? hasPendingFollowUp
                  ? "Ada catatan follow-up yang belum ditindaklanjuti"
                  : "Ada catatan follow-up yang sudah ditindaklanjuti"
                : "Buka follow-up monitoring"
            }
            aria-label="Buka follow-up monitoring"
            style={{
              ...getCircleIconButtonStyle(prefersDarkMode, {
                isEnabled: true,
                size: 38,
                tone: hasPendingFollowUp ? "warning" : hasFollowUp ? "neutral" : "neutral",
              }),
            }}
          >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M7 3H14L19 8V21H7V3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 3V8H19"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 12H16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M10 16H15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenTaskInTimeline?.(task);
            }}
            title="Lihat di Timeline"
            aria-label="Lihat di Timeline"
            style={{
              ...getCircleIconButtonStyle(prefersDarkMode, {
                isEnabled: true,
                size: 38,
                tone: "info",
              }),
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 2V5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M16 2V5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M3.5 9H20.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <rect
                x="3.5"
                y="4.5"
                width="17"
                height="16"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M8 13H8.01"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M12 13H12.01"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M16 13H16.01"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default memo(TrackingIssuesTableRow);
