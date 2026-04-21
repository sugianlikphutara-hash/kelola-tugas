import {
  getTableBodyCellStyle,
  getTableFrameStyle,
  getTableHeaderCellStyle,
} from "../../lib/controlStyles";

const MONTHS = [
  { key: "jan", label: "Jan" },
  { key: "feb", label: "Feb" },
  { key: "mar", label: "Mar" },
  { key: "apr", label: "Apr" },
  { key: "may", label: "May" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "aug", label: "Aug" },
  { key: "sep", label: "Sep" },
  { key: "oct", label: "Oct" },
  { key: "nov", label: "Nov" },
  { key: "dec", label: "Dec" },
];

const TOTAL_COLUMN_COUNT = 4 + MONTHS.length * 3;

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getAmountCellStyle(tableBodyCellStyle, value, isStrong = false) {
  return {
    ...tableBodyCellStyle,
    textAlign: "right",
    color:
      Number(value || 0) < 0
        ? "var(--alert-danger-color, #b42318)"
        : "var(--text-h)",
    fontWeight: isStrong ? 700 : 500,
  };
}

export default function RealizationBudgetItemDetailTable({
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 3120 }}>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  style={{
                    ...getTableHeaderCellStyle({ label: "Belanja Level 5" }),
                    minWidth: 260,
                  }}
                >
                  Belanja Level 5
                </th>
                <th
                  rowSpan={2}
                  style={{
                    ...getTableHeaderCellStyle({ label: "Plan Tahunan" }),
                    width: 150,
                  }}
                >
                  Plan Tahunan
                </th>
                <th
                  rowSpan={2}
                  style={{
                    ...getTableHeaderCellStyle({ label: "Realisasi Tahunan" }),
                    width: 170,
                  }}
                >
                  Realisasi Tahunan
                </th>
                <th
                  rowSpan={2}
                  style={{
                    ...getTableHeaderCellStyle({ label: "Saldo Tahunan" }),
                    width: 150,
                  }}
                >
                  Saldo Tahunan
                </th>
                {MONTHS.map((month) => (
                  <th
                    key={month.key}
                    colSpan={3}
                    style={getTableHeaderCellStyle({ label: month.label })}
                  >
                    {month.label}
                  </th>
                ))}
              </tr>
              <tr>
                {MONTHS.flatMap((month) => [
                  <th
                    key={`${month.key}-plan`}
                    style={{
                      ...getTableHeaderCellStyle({ label: `${month.label} Plan` }),
                      width: 120,
                    }}
                  >
                    Plan
                  </th>,
                  <th
                    key={`${month.key}-realization`}
                    style={{
                      ...getTableHeaderCellStyle({
                        label: `${month.label} Realisasi`,
                      }),
                      width: 120,
                    }}
                  >
                    Realisasi
                  </th>,
                  <th
                    key={`${month.key}-balance`}
                    style={{
                      ...getTableHeaderCellStyle({ label: `${month.label} Saldo` }),
                      width: 120,
                    }}
                  >
                    Saldo
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={TOTAL_COLUMN_COUNT}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 18,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Memuat detail realisasi anggaran...
                  </td>
                </tr>
              ) : null}

              {!isLoading && errorMessage ? (
                <tr>
                  <td
                    colSpan={TOTAL_COLUMN_COUNT}
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
                    colSpan={TOTAL_COLUMN_COUNT}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 18,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Belum ada item realisasi pada Sub Kegiatan ini.
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
                      <td style={getAmountCellStyle(tableBodyCellStyle, row.annual_plan)}>
                        {formatCurrency(row.annual_plan)}
                        {row.has_plan_mismatch ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "var(--alert-warning-color)",
                              fontWeight: 600,
                            }}
                          >
                            Akumulasi bulanan plan tidak cocok
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={getAmountCellStyle(
                          tableBodyCellStyle,
                          row.annual_realization
                        )}
                      >
                        {formatCurrency(row.annual_realization)}
                        {row.has_realization_mismatch ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "var(--alert-warning-color)",
                              fontWeight: 600,
                            }}
                          >
                            Akumulasi bulanan realisasi tidak cocok
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={getAmountCellStyle(
                          tableBodyCellStyle,
                          row.annual_balance,
                          true
                        )}
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
                            Akumulasi bulanan saldo tidak cocok
                          </div>
                        ) : null}
                      </td>
                      {MONTHS.flatMap((month) => [
                        <td
                          key={`${row.budget_account_id}-${month.key}-plan`}
                          style={getAmountCellStyle(
                            tableBodyCellStyle,
                            row[`${month.key}_plan`]
                          )}
                        >
                          {formatCurrency(row[`${month.key}_plan`])}
                        </td>,
                        <td
                          key={`${row.budget_account_id}-${month.key}-realization`}
                          style={getAmountCellStyle(
                            tableBodyCellStyle,
                            row[`${month.key}_realization`]
                          )}
                        >
                          {formatCurrency(row[`${month.key}_realization`])}
                        </td>,
                        <td
                          key={`${row.budget_account_id}-${month.key}-balance`}
                          style={getAmountCellStyle(
                            tableBodyCellStyle,
                            row[`${month.key}_balance`],
                            true
                          )}
                        >
                          {formatCurrency(row[`${month.key}_balance`])}
                        </td>,
                      ])}
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
