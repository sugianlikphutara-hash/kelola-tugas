import {
  getTableBodyCellStyle,
  getTableFrameStyle,
  getTableHeaderCellStyle,
} from "../../lib/controlStyles";

const MONTH_COLUMNS = [
  "jan_amount",
  "feb_amount",
  "mar_amount",
  "apr_amount",
  "may_amount",
  "jun_amount",
  "jul_amount",
  "aug_amount",
  "sep_amount",
  "oct_amount",
  "nov_amount",
  "dec_amount",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function PlanBudgetItemDetailTable({
  rows,
  isLoading,
  errorMessage,
  warningMessages = [],
}) {
  const tableBodyCellStyle = getTableBodyCellStyle({
    padding: "12px 10px",
  });

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!isLoading && !errorMessage && warningMessages.length > 0 ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--alert-warning-bg)",
            border: "1px solid var(--alert-warning-border)",
            color: "var(--alert-warning-color)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {warningMessages.join(" ")}
        </div>
      ) : null}

      <div style={getTableFrameStyle({ borderRadius: 10 })}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1320 }}>
            <thead>
              <tr>
                <th style={getTableHeaderCellStyle({ label: "Belanja Level 5" })}>
                  Belanja Level 5
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Total Tahunan" }),
                    width: 160,
                  }}
                >
                  Total Tahunan
                </th>
                {[
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((label) => (
                  <th
                    key={label}
                    style={{
                      ...getTableHeaderCellStyle({ label }),
                      width: 120,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={14}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 18,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Memuat detail anggaran...
                  </td>
                </tr>
              ) : null}

              {!isLoading && errorMessage ? (
                <tr>
                  <td
                    colSpan={14}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 18,
                      textAlign: "center",
                      color: "var(--alert-error-color)",
                    }}
                  >
                    {errorMessage}
                  </td>
                </tr>
              ) : null}

              {!isLoading && !errorMessage && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 18,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Belum ada item anggaran pada Sub Kegiatan ini.
                  </td>
                </tr>
              ) : null}

              {!isLoading && !errorMessage
                ? rows.map((row) => (
                    <tr key={row.budget_account_id}>
                      <td style={tableBodyCellStyle}>
                        <div style={{ fontWeight: 600, color: "var(--text-h)" }}>
                          {row.budget_account_name}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {row.budget_account_code}
                        </div>
                      </td>
                      <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                        {formatCurrency(row.annual_amount)}
                        {row.has_amount_mismatch ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "var(--alert-warning-color)",
                              fontWeight: 600,
                            }}
                          >
                            Total bulanan tidak cocok
                          </div>
                        ) : null}
                      </td>
                      {MONTH_COLUMNS.map((columnName) => (
                        <td
                          key={`${row.budget_account_id}-${columnName}`}
                          style={{ ...tableBodyCellStyle, textAlign: "right" }}
                        >
                          {formatCurrency(row[columnName])}
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
