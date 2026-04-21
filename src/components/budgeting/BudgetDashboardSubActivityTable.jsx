import {
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

export default function BudgetDashboardSubActivityTable({ rows }) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>
        Breakdown per Sub Kegiatan
      </div>

      <div style={getTableFrameStyle()}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
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
                    ...getTableHeaderCellStyle({ label: "Saldo" }),
                    width: 180,
                  }}
                >
                  Saldo
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Progress %" }),
                    width: 140,
                  }}
                >
                  Progress %
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.rak_version_id}:${row.sub_activity_id}`}>
                  <td style={tableBodyCellStyle}>
                    <div style={{ fontWeight: 600, color: "var(--text-h)" }}>
                      {row.sub_activity_name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {row.sub_activity_code}
                    </div>
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                    {formatCurrency(row.annual_plan)}
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                    {formatCurrency(row.annual_realization)}
                  </td>
                  <td
                    style={{
                      ...tableBodyCellStyle,
                      textAlign: "right",
                      color:
                        Number(row.annual_balance || 0) < 0
                          ? "var(--alert-error-color)"
                          : "var(--text-h)",
                      fontWeight: 700,
                    }}
                  >
                    {formatCurrency(row.annual_balance)}
                  </td>
                  <td
                    style={{
                      ...tableBodyCellStyle,
                      textAlign: "right",
                      fontWeight: 700,
                      color:
                        Number(row.progress_percent || 0) > 100
                          ? "var(--alert-warning-color)"
                          : "var(--text-h)",
                    }}
                  >
                    {Number(row.progress_percent || 0).toFixed(2)}%
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
                    Belum ada breakdown Sub Kegiatan untuk versi yang dipilih.
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
