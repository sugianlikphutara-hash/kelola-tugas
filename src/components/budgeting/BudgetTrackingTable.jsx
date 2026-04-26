import { Fragment } from "react";
import {
  getAlertStyle,
  getChipStyle,
  getLoadingStateStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSecondaryLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
} from "../../lib/controlStyles";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function BudgetTrackingTable({
  prefersDarkMode,
  rows,
  expandedSubActivityIds = {},
  detailStateBySubActivity = {},
  onToggleExpand,
}) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  function getCountTone(count, positiveTone) {
    return Number(count || 0) > 0 ? positiveTone : "muted";
  }

  return (
    <div style={getTableFrameStyle()}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
          <thead>
            <tr>
              <th
                style={{
                  ...getTableHeaderCellStyle({
                    label: "Detail",
                    padding: "14px 10px",
                    alignMode: 3,
                  }),
                  width: 40,
                }}
              >
                Detail
              </th>
              <th
                style={getTableHeaderCellStyle({
                  label: "Sub Kegiatan",
                  alignMode: 3,
                  isFirstColumn: true,
                })}
              >
                Sub Kegiatan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Plan", alignMode: 3 }),
                  width: 180,
                }}
              >
                Plan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Realisasi", alignMode: 3 }),
                  width: 180,
                }}
              >
                Realisasi
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Progress %", alignMode: 3 }),
                  width: 140,
                }}
              >
                Progress %
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Status", alignMode: 3 }),
                  width: 160,
                  textAlign: "center",
                }}
              >
                Status
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Warning", alignMode: 3 }),
                  width: 120,
                  textAlign: "center",
                }}
              >
                Warning
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Deviation", alignMode: 3 }),
                  width: 120,
                  textAlign: "center",
                }}
              >
                Deviation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = Boolean(expandedSubActivityIds[row.sub_activity_id]);
              const detailState = detailStateBySubActivity[row.sub_activity_id] || {
                rows: [],
                isLoading: false,
                errorMessage: "",
              };
              const expandedParentCellStyle = isExpanded
                ? { borderBottom: "1px solid var(--border-strong)" }
                : null;

              return (
                <Fragment key={`${row.rak_version_id}:${row.sub_activity_id}`}>
                  <tr>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "right",
                        width: 40,
                        ...expandedParentCellStyle,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleExpand?.(row)}
                        title="Lihat detail akun"
                        aria-label="Lihat detail akun"
                        style={{
                          minWidth: 36,
                          minHeight: 36,
                          fontSize: 18,
                          lineHeight: 1,
                          borderRadius: 10,
                          border: "1px solid var(--control-border)",
                          background: "var(--surface-1)",
                          color: "var(--text-h)",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "-" : "+"}{/*
                          {isExpanded ? "▾" : "▸"} {row.sub_activity_name || "-"}
                        */}
                      </button>
                    </td>
                    <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                      <div style={getTableCellLabelTypography()}>
                        {row.sub_activity_name || "-"}
                      </div>
                      <div style={getTableCellSubtitleTypography()}>
                        {row.sub_activity_code || "-"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "right",
                        ...expandedParentCellStyle,
                      }}
                    >
                      {formatCurrency(row.plan_amount)}
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "right",
                        ...expandedParentCellStyle,
                      }}
                    >
                      {formatCurrency(row.realization_amount)}
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "right",
                        fontWeight: 700,
                        color:
                          Number(row.progress_percentage || 0) > 100
                            ? "var(--alert-error-color)"
                            : "var(--text-h)",
                        ...expandedParentCellStyle,
                      }}
                    >
                      {Number(row.progress_percentage || 0).toFixed(2)}%
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "center",
                        ...expandedParentCellStyle,
                      }}
                    >
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: row.tracking_indicator?.tone || "muted",
                          size: "sm",
                        })}
                      >
                        {row.tracking_indicator?.label || "-"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "center",
                        ...expandedParentCellStyle,
                      }}
                    >
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: getCountTone(row.warning_count, "warning"),
                          size: "sm",
                        })}
                      >
                        {Number(row.warning_count || 0)}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "center",
                        ...expandedParentCellStyle,
                      }}
                    >
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: getCountTone(row.deviation_count, "danger"),
                          size: "sm",
                        })}
                      >
                        {Number(row.deviation_count || 0)}
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr key={`${row.rak_version_id}:${row.sub_activity_id}:detail`}>
                      <td
                        colSpan={8}
                        style={{
                          ...tableBodyCellStyle,
                          background: "var(--surface-1)",
                          padding: "0 18px 18px 66px",
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid var(--border-strong)",
                            borderTop: "none",
                            borderRadius: "0 0 10px 10px",
                            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                            overflow: "hidden",
                          }}
                        >
                          {detailState.isLoading ? (
                            <div style={{ padding: 12 }}>
                              <div style={getLoadingStateStyle(prefersDarkMode)}>
                                Memuat detail tracking sub kegiatan...
                              </div>
                            </div>
                          ) : null}

                          {!detailState.isLoading && detailState.errorMessage ? (
                            <div style={{ padding: 12 }}>
                              <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
                                {detailState.errorMessage}
                              </div>
                            </div>
                          ) : null}

                          {!detailState.isLoading &&
                          !detailState.errorMessage &&
                          detailState.rows.length === 0 ? (
                            <div style={{ padding: 12 }}>
                              <div style={getAlertStyle(prefersDarkMode, { tone: "info" })}>
                                Belum ada data.
                              </div>
                            </div>
                          ) : null}

                          {!detailState.isLoading &&
                          !detailState.errorMessage &&
                          detailState.rows.length > 0 ? (
                            <div style={getTableFrameStyle({ borderRadius: 0 })}>
                              <div style={{ overflowX: "auto" }}>
                                <table
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    minWidth: 1100,
                                  }}
                                >
                                  <thead>
                                    <tr>
                                      <th
                                        style={getTableHeaderCellStyle({
                                          label: "Nama Akun Belanja",
                                          alignMode: 3,
                                          isFirstColumn: true,
                                        })}
                                      >
                                        Nama Akun Belanja
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "Plan",
                                            alignMode: 3,
                                          }),
                                          width: 160,
                                        }}
                                      >
                                        Plan
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "Realisasi",
                                            alignMode: 3,
                                          }),
                                          width: 160,
                                        }}
                                      >
                                        Realisasi
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "Deviation",
                                            alignMode: 3,
                                          }),
                                          width: 160,
                                        }}
                                      >
                                        Deviation
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "Deviation %",
                                            alignMode: 3,
                                          }),
                                          width: 140,
                                        }}
                                      >
                                        Deviation %
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "Warning",
                                            alignMode: 3,
                                          }),
                                          width: 120,
                                          textAlign: "right",
                                        }}
                                      >
                                        Warning
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "KETERANGAN",
                                            alignMode: 3,
                                          }),
                                          width: 260,
                                          textAlign: "center",
                                        }}
                                      >
                                        KETERANGAN
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detailState.rows.map((detailRow) => (
                                      <tr
                                        key={`${row.sub_activity_id}:${detailRow.budget_account_id || detailRow.budget_account_code}`}
                                      >
                                        <td style={tableBodyCellStyle}>
                                          <div style={getTableCellSecondaryLabelTypography()}>
                                            {detailRow.budget_account_name || "-"}
                                          </div>
                                          <div style={getTableCellSubtitleTypography()}>
                                            {detailRow.budget_account_code || "-"}
                                          </div>
                                        </td>
                                        <td
                                          style={{
                                            ...tableBodyCellStyle,
                                            textAlign: "right",
                                          }}
                                        >
                                          {formatCurrency(detailRow.plan_amount)}
                                        </td>
                                        <td
                                          style={{
                                            ...tableBodyCellStyle,
                                            textAlign: "right",
                                            color: detailRow.is_overspend
                                              ? "var(--alert-error-color)"
                                              : "var(--text-h)",
                                            fontWeight: detailRow.is_overspend ? 700 : 400,
                                          }}
                                        >
                                          {formatCurrency(detailRow.realization_amount)}
                                        </td>
                                        <td
                                          style={{
                                            ...tableBodyCellStyle,
                                            textAlign: "right",
                                            color: detailRow.has_deviation
                                              ? "var(--alert-warning-color)"
                                              : "var(--text-h)",
                                            fontWeight: detailRow.has_deviation ? 700 : 400,
                                          }}
                                        >
                                          {formatCurrency(detailRow.deviation_amount)}
                                        </td>
                                        <td
                                          style={{
                                            ...tableBodyCellStyle,
                                            textAlign: "right",
                                            color: detailRow.has_deviation
                                              ? "var(--alert-warning-color)"
                                              : "var(--text-h)",
                                            fontWeight: detailRow.has_deviation ? 700 : 400,
                                          }}
                                        >
                                          {Number(detailRow.deviation_percent || 0).toFixed(2)}%
                                        </td>
                                        <td
                                          style={{
                                            ...tableBodyCellStyle,
                                            textAlign: "right",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "grid",
                                              gap: 6,
                                              justifyItems: "end",
                                            }}
                                          >
                                            <div
                                              style={getChipStyle(prefersDarkMode, {
                                                tone: getCountTone(
                                                  detailRow.warning_count,
                                                  "warning"
                                                ),
                                                size: "sm",
                                              })}
                                            >
                                              {Number(detailRow.warning_count || 0)}
                                            </div>
                                          </div>
                                        </td>
                                        <td
                                          style={{
                                            ...tableBodyCellStyle,
                                            textAlign: "center",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "grid",
                                              gap: 4,
                                              justifyItems: "center",
                                            }}
                                          >
                                            {detailRow.warning_messages?.length ? (
                                              <div
                                                style={{
                                                  display: "grid",
                                                  gap: 4,
                                                  fontSize: 12,
                                                  color: "var(--text-muted)",
                                                }}
                                              >
                                                {detailRow.warning_messages.map(
                                                  (message, index) => (
                                                    <div
                                                      key={`${detailRow.budget_account_code || "warning"}:${index}`}
                                                    >
                                                      {message}
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            ) : (
                                              <span style={{ color: "var(--text-muted)" }}>
                                                -
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    ...tableBodyCellStyle,
                    padding: 24,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Belum ada data.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
