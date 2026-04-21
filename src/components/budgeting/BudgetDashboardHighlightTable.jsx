import {
  getChipStyle,
  getTableBodyCellStyle,
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

export default function BudgetDashboardHighlightTable({
  prefersDarkMode,
  title,
  rows,
  type,
}) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>{title}</div>

      <div style={getTableFrameStyle()}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={getTableHeaderCellStyle({ label: "Sub Kegiatan" })}>Sub Kegiatan</th>
                <th style={getTableHeaderCellStyle({ label: "Belanja" })}>Belanja</th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Plan" }),
                    width: 150,
                  }}
                >
                  Plan
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Realisasi" }),
                    width: 150,
                  }}
                >
                  Realisasi
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({
                      label: type === "overspend" ? "Saldo" : "Warning",
                    }),
                    width: 160,
                  }}
                >
                  {type === "overspend" ? "Saldo" : "Warning"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.rak_version_id}:${row.sub_activity_id}:${row.budget_account_id}:${row.highlight_period_month || ""}:${type}`}
                >
                  <td style={tableBodyCellStyle}>
                    <div style={{ fontWeight: 600, color: "var(--text-h)" }}>
                      {row.sub_activity_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {row.sub_activity_code}
                    </div>
                  </td>
                  <td style={tableBodyCellStyle}>
                    <div style={{ fontWeight: 600, color: "var(--text-h)" }}>
                      {row.budget_account_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {row.budget_account_code}
                      {type === "overspend" && row.highlight_month
                        ? ` | ${row.highlight_month}`
                        : ""}
                    </div>
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                    {formatCurrency(row.annual_plan)}
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                    {formatCurrency(row.annual_realization)}
                  </td>
                  <td style={tableBodyCellStyle}>
                    {type === "overspend" ? (
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--alert-error-color)",
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(row.annual_balance)}
                      </div>
                    ) : (
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: "warning",
                          size: "sm",
                        })}
                      >
                        {row.warning_type}
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Belum ada highlight untuk versi yang dipilih.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
