import { Fragment } from "react";
import {
  getChipStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
} from "../../lib/controlStyles";
import BudgetItemTable from "./BudgetItemTable";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getDetailWarningMeta(detailState) {
  const rows = detailState?.rows || [];
  const mismatchCount = rows.filter((row) => row.has_amount_mismatch).length;
  const warningCount = mismatchCount + Number(detailState?.warningMessages?.length || 0);

  return {
    mismatchCount,
    warningCount,
    hasWarning: warningCount > 0,
  };
}

export default function SubActivityTable({
  prefersDarkMode,
  rows,
  expandedRowKey,
  detailStateByKey,
  onToggleExpand,
  isEditable = false,
  pendingRowActionKey = "",
  onSaveRow,
  onDeleteRow,
  onOpenAddBudgetItem,
}) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <div style={getTableFrameStyle({ borderRadius: 12 })}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr>
              <th
                style={{
                  ...getTableHeaderCellStyle({
                    label: "Detail",
                    padding: "14px 10px",
                  }),
                  width: 40,
                }}
              >
                DETAIL
              </th>
              <th style={getTableHeaderCellStyle({ label: "Sub Kegiatan" })}>
                Sub Kegiatan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Status" }),
                  width: 160,
                }}
              >
                Status
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Warnings" }),
                  width: 160,
                }}
              >
                Warning
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Total" }),
                  width: 220,
                  textAlign: "right",
                }}
              >
                Total Anggaran
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
              const warningMeta = getDetailWarningMeta(detailState);
              const expandedParentCellStyle = isExpanded
                ? { borderBottom: "1px solid var(--border-strong)" }
                : null;

              return (
                <Fragment key={detailKey}>
                  <tr>
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
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "-" : "+"}
                      </button>
                    </td>
                    <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={getTableCellLabelTypography()}>
                          {row.sub_activity_name || "-"}
                        </div>
                        <div style={getTableCellSubtitleTypography()}>
                          {row.sub_activity_code || "-"}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: "info",
                          size: "sm",
                        })}
                      >
                        {row.sub_activity_status_name || row.sub_activity_status_code || "-"}
                      </div>
                    </td>
                    <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                      {detailState.isLoading ? (
                        <div style={getTableCellSubtitleTypography()}>
                          Memuat detail...
                        </div>
                      ) : warningMeta.hasWarning ? (
                        <div
                          style={getChipStyle(prefersDarkMode, {
                            tone: "warning",
                            size: "sm",
                          })}
                        >
                          {warningMeta.mismatchCount > 0
                            ? `${warningMeta.mismatchCount} mismatch`
                            : "Ada warning"}
                        </div>
                      ) : (
                        <div style={getTableCellSubtitleTypography()}>-</div>
                      )}
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "right",
                        ...expandedParentCellStyle,
                      }}
                    >
                      {formatCurrency(row.annual_amount)}
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          ...tableBodyCellStyle,
                          padding: "0 18px 18px 62px",
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
                          <div style={{ display: "grid", gap: 12, padding: 12 }}>
                            {isEditable ? (
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                  type="button"
                                  onClick={() => onOpenAddBudgetItem?.(row, detailState.rows)}
                                  style={{
                                    minHeight: 36,
                                    padding: "8px 12px",
                                    borderRadius: 8,
                                    border: "1px solid var(--control-border)",
                                    background: "var(--surface-1)",
                                    color: "var(--text-h)",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Tambah Akun Belanja
                                </button>
                              </div>
                            ) : null}

                            <BudgetItemTable
                              key={[
                                detailKey,
                                ...detailState.rows.map((item) =>
                                  [
                                    item.id || item.budget_account_id,
                                    item.annual_amount,
                                    item.jan_amount,
                                    item.dec_amount,
                                  ].join(":")
                                ),
                              ].join("|")}
                              prefersDarkMode={prefersDarkMode}
                              rows={detailState.rows}
                              isLoading={detailState.isLoading}
                              errorMessage={detailState.errorMessage}
                              warningMessages={detailState.warningMessages}
                              isEditable={isEditable}
                              pendingRowActionKey={pendingRowActionKey}
                              onSaveRow={onSaveRow}
                              onDeleteRow={onDeleteRow}
                            />
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
  );
}
