import {
  getAlertStyle,
  getChipStyle,
  getLoadingStateStyle,
  getMetaLabelStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTextInputStyle,
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
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
          <thead>
            <tr>
              <th style={getTableHeaderCellStyle({ label: "Sub Kegiatan" })}>
                Sub Kegiatan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Plan" }),
                  width: 180,
                }}
              >
                Plan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Realisasi" }),
                  width: 180,
                }}
              >
                Realisasi
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Progress %" }),
                  width: 140,
                }}
              >
                Progress %
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
                  ...getTableHeaderCellStyle({ label: "Warning" }),
                  width: 120,
                }}
              >
                Warning
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Deviation" }),
                  width: 120,
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

              return (
                <>
                  <tr key={`${row.rak_version_id}:${row.sub_activity_id}`}>
                    <td style={tableBodyCellStyle}>
                      <button
                        type="button"
                        onClick={() => onToggleExpand?.(row)}
                        style={{
                          ...getTextInputStyle(prefersDarkMode, {
                            tone: "muted",
                            height: 34,
                            isDisabled: false,
                          }),
                          display: "grid",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer",
                          gap: 4,
                        }}
                      >
                        <div style={getTableCellLabelTypography()}>
                          {isExpanded ? "▾" : "▸"} {row.sub_activity_name || "-"}
                        </div>
                        <div style={getTableCellSubtitleTypography()}>
                          {row.sub_activity_code || "-"}
                        </div>
                      </button>
                    </td>
                    <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                      {formatCurrency(row.plan_amount)}
                    </td>
                    <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
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
                      }}
                    >
                      {Number(row.progress_percentage || 0).toFixed(2)}%
                    </td>
                    <td style={tableBodyCellStyle}>
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: row.tracking_indicator?.tone || "muted",
                          size: "sm",
                        })}
                      >
                        {row.tracking_indicator?.label || "-"}
                      </div>
                    </td>
                    <td style={tableBodyCellStyle}>
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: getCountTone(row.warning_count, "warning"),
                          size: "sm",
                        })}
                      >
                        {Number(row.warning_count || 0)}
                      </div>
                    </td>
                    <td style={tableBodyCellStyle}>
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
                        colSpan={7}
                        style={{
                          ...tableBodyCellStyle,
                          background: "var(--surface-1)",
                          padding: 16,
                        }}
                      >
                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={getMetaLabelStyle(prefersDarkMode)}>
                            Detail Tracking Akun Belanja
                          </div>

                          {detailState.isLoading ? (
                            <div style={getLoadingStateStyle(prefersDarkMode)}>
                              Memuat detail tracking sub kegiatan...
                            </div>
                          ) : null}

                          {!detailState.isLoading && detailState.errorMessage ? (
                            <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
                              {detailState.errorMessage}
                            </div>
                          ) : null}

                          {!detailState.isLoading &&
                          !detailState.errorMessage &&
                          detailState.rows.length === 0 ? (
                            <div style={getAlertStyle(prefersDarkMode, { tone: "info" })}>
                              Belum ada detail tracking akun untuk sub kegiatan ini.
                            </div>
                          ) : null}

                          {!detailState.isLoading &&
                          !detailState.errorMessage &&
                          detailState.rows.length > 0 ? (
                            <div style={getTableFrameStyle({ borderRadius: 10 })}>
                              <div style={{ overflowX: "auto" }}>
                                <table
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    minWidth: 980,
                                  }}
                                >
                                  <thead>
                                    <tr>
                                      <th
                                        style={getTableHeaderCellStyle({
                                          label: "Kode Akun",
                                        })}
                                      >
                                        Kode Akun
                                      </th>
                                      <th
                                        style={getTableHeaderCellStyle({
                                          label: "Nama Akun",
                                        })}
                                      >
                                        Nama Akun
                                      </th>
                                      <th
                                        style={{
                                          ...getTableHeaderCellStyle({
                                            label: "Plan",
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
                                          }),
                                          width: 260,
                                        }}
                                      >
                                        Warning
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detailState.rows.map((detailRow) => (
                                      <tr
                                        key={`${row.sub_activity_id}:${detailRow.budget_account_id || detailRow.budget_account_code}`}
                                      >
                                        <td style={tableBodyCellStyle}>
                                          {detailRow.budget_account_code || "-"}
                                        </td>
                                        <td style={tableBodyCellStyle}>
                                          {detailRow.budget_account_name || "-"}
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
                                        <td style={tableBodyCellStyle}>
                                          <div
                                            style={{
                                              display: "grid",
                                              gap: 6,
                                              justifyItems: "start",
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
                                            ) : null}
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
                </>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    ...tableBodyCellStyle,
                    padding: 24,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Belum ada data tracking anggaran untuk versi RAK yang dipilih.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
