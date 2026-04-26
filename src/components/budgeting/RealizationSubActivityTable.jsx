import { Fragment, useState } from "react";
import {
  getChipStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
} from "../../lib/controlStyles";
import RealizationBudgetItemDetailTable from "./RealizationBudgetItemDetailTable";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getAmountColor(value) {
  if (Number(value || 0) < 0) {
    return "var(--alert-danger-color, #b42318)";
  }

  return "var(--text-h)";
}

function getAmountCellStyle(tableBodyCellStyle, value) {
  return {
    ...tableBodyCellStyle,
    textAlign: "right",
    color: getAmountColor(value),
  };
}

function getRemarkText(row) {
  const planAmount = Number(row.plan_amount || 0);
  const realizationAmount = Number(row.realization_amount || 0);

  if (planAmount === 0 && realizationAmount > 0) {
    return "Realisasi tanpa plan";
  }

  if (realizationAmount === 0 && planAmount > 0) {
    return "Belum terserap";
  }

  if (realizationAmount > planAmount) {
    return "Overspend";
  }

  return "-";
}

export default function RealizationSubActivityTable({
  prefersDarkMode,
  monthLabel,
  rows,
  expandedRowKey,
  detailStateByKey,
  onToggleExpand,
  draftValuesByDetailKey,
  rowMutationStateByDetailKey,
  isPeriodLocked = false,
  onDraftChange,
  onSaveRow,
  onOpenHistory,
}) {
  const tableBodyCellStyle = getTableBodyCellStyle();
  const [hoveredRowKey, setHoveredRowKey] = useState("");

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
                  }),
                  width: 40,
                  textAlign: "center",
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
                  ...getTableHeaderCellStyle({
                    label: `Plan ${monthLabel}`,
                    alignMode: 3,
                  }),
                  width: 180,
                }}
              >
                Plan {monthLabel}
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({
                    label: `Realisasi ${monthLabel}`,
                    alignMode: 3,
                  }),
                  width: 180,
                }}
              >
                Realisasi {monthLabel}
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({
                    label: "Deviation (Plan - Realisasi)",
                    alignMode: 3,
                  }),
                  width: 220,
                }}
              >
                Deviation (Plan - Realisasi)
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Keterangan", alignMode: 3 }),
                  width: 180,
                  textAlign: "center",
                }}
              >
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const detailKey = `${row.rak_version_id}:${row.rak_sub_activity_id}`;
              const isExpanded = expandedRowKey === detailKey;
              const detailState = detailStateByKey[detailKey] || {
                rows: [],
                isLoading: false,
                errorMessage: "",
                warningMessages: [],
              };
              const remarkText = getRemarkText(row);
              const rowBackground =
                hoveredRowKey === detailKey ? "var(--surface-1)" : "transparent";
              const expandedParentCellStyle = isExpanded
                ? { borderBottom: "1px solid var(--border-strong)" }
                : null;

              return (
                <Fragment key={detailKey}>
                  <tr
                    onMouseEnter={() => setHoveredRowKey(detailKey)}
                    onMouseLeave={() => setHoveredRowKey("")}
                    style={{ background: rowBackground, transition: "background 140ms ease" }}
                  >
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "center",
                        width: 40,
                        ...expandedParentCellStyle,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleExpand(row)}
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
                        {detailState.isLoading ? "..." : isExpanded ? "-" : "+"}
                      </button>
                    </td>
                    <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                      <div style={getTableCellLabelTypography()}>
                        {row.sub_activity_name}
                      </div>
                      <div style={getTableCellSubtitleTypography()}>
                        {row.sub_activity_code}
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
                        ...getAmountCellStyle(tableBodyCellStyle, row.deviation_amount),
                        ...expandedParentCellStyle,
                      }}
                    >
                      {formatCurrency(row.deviation_amount)}
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "center",
                        ...expandedParentCellStyle,
                      }}
                    >
                      {remarkText === "-" ? (
                        <span style={{ color: "var(--text-muted)" }}>-</span>
                      ) : (
                        <span
                          style={getChipStyle(prefersDarkMode, {
                            tone: "muted",
                            size: "sm",
                          })}
                        >
                          {remarkText}
                        </span>
                      )}
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          ...tableBodyCellStyle,
                          padding: "0 18px 18px 66px",
                          background: "var(--surface-1)",
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
                          <RealizationBudgetItemDetailTable
                            prefersDarkMode={prefersDarkMode}
                            monthLabel={monthLabel}
                            rows={detailState.rows}
                            isLoading={detailState.isLoading}
                            errorMessage={detailState.errorMessage}
                            warningMessages={detailState.warningMessages}
                            draftValues={draftValuesByDetailKey?.[detailKey] || {}}
                            rowMutationState={
                              rowMutationStateByDetailKey?.[detailKey] || {}
                            }
                            isPeriodLocked={isPeriodLocked}
                            onDraftChange={(detailRow, value) =>
                              onDraftChange?.(detailKey, detailRow, value)
                            }
                            onSaveRow={(detailRow) =>
                              onSaveRow?.(detailKey, row, detailRow)
                            }
                            onOpenHistory={(detailRow) =>
                              onOpenHistory?.(row, detailRow)
                            }
                          />
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
                  colSpan={6}
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
