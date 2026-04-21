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

function getWarningTone(warningType) {
  if (warningType === "NO_REALIZATION") {
    return "warning";
  }

  return "neutral";
}

export default function BudgetWarningTable({ prefersDarkMode, rows }) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <div style={getTableFrameStyle()}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
          <thead>
            <tr>
              <th style={getTableHeaderCellStyle({ label: "Sub Kegiatan" })}>
                Sub Kegiatan
              </th>
              <th style={getTableHeaderCellStyle({ label: "Belanja" })}>
                Belanja
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Plan" }),
                  width: 170,
                }}
              >
                Plan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Realisasi" }),
                  width: 170,
                }}
              >
                Realisasi
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Saldo" }),
                  width: 170,
                }}
              >
                Saldo
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Serapan" }),
                  width: 120,
                }}
              >
                Serapan
              </th>
              <th
                style={{
                  ...getTableHeaderCellStyle({ label: "Warning" }),
                  width: 150,
                }}
              >
                Warning
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.rak_version_id}:${row.sub_activity_id}:${row.budget_account_id}:${row.warning_type}`}>
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
                    color: row.annual_balance < 0 ? "var(--alert-error-color)" : "var(--text-h)",
                    fontWeight: 700,
                  }}
                >
                  {formatCurrency(row.annual_balance)}
                  {row.has_balance_mismatch ? (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: "var(--alert-warning-color)",
                        fontWeight: 600,
                      }}
                    >
                      Saldo tidak konsisten
                    </div>
                  ) : null}
                </td>
                <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                  {Number(row.absorption_percent || 0).toFixed(2)}%
                </td>
                <td style={tableBodyCellStyle}>
                  <div
                    style={getChipStyle(prefersDarkMode, {
                      tone: getWarningTone(row.warning_type),
                      size: "sm",
                    })}
                  >
                    {row.warning_type}
                  </div>
                </td>
              </tr>
            ))}

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
                  Belum ada warning anggaran untuk versi yang dipilih.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
