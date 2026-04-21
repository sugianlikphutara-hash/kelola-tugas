import { getChipStyle, getTableBodyCellStyle, getTableFrameStyle, getTableHeaderCellStyle } from "../../lib/controlStyles";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getProgressTone(progressStatus) {
  if (progressStatus === "HIGH") {
    return "warning";
  }

  if (progressStatus === "ON_TRACK") {
    return "success";
  }

  return "muted";
}

export default function BudgetProgressTable({ prefersDarkMode, rows }) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <div style={getTableFrameStyle()}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
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
                  width: 140,
                }}
              >
                Status
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
                    fontWeight: 700,
                    color:
                      Number(row.progress_percent || 0) > 100
                        ? "var(--alert-warning-color)"
                        : "var(--text-h)",
                  }}
                >
                  {Number(row.progress_percent || 0).toFixed(2)}%
                </td>
                <td style={tableBodyCellStyle}>
                  <div
                    style={getChipStyle(prefersDarkMode, {
                      tone: getProgressTone(row.progress_status),
                      size: "sm",
                    })}
                  >
                    {row.progress_status}
                  </div>
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
                  Belum ada progress anggaran untuk versi yang dipilih.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
