import { Fragment } from "react";
import {
  getTableBodyCellStyle,
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

export default function RealizationSubActivityTable({
  rows,
  expandedRowKey,
  detailStateByKey,
  onToggleExpand,
}) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <div style={getTableFrameStyle()}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr>
              <th style={{ ...getTableHeaderCellStyle({ label: "Detail" }), width: 80 }}>
                Detail
              </th>
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

              return (
                <Fragment key={detailKey}>
                  <tr>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "center",
                        width: 80,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleExpand(row)}
                        style={{
                          minWidth: 36,
                          minHeight: 36,
                          borderRadius: 10,
                          border: "1px solid var(--control-border)",
                          background: "var(--surface-1)",
                          color: "var(--text-h)",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {isExpanded ? "-" : "+"}
                      </button>
                    </td>
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
                        color: getAmountColor(row.annual_balance),
                        fontWeight: 700,
                      }}
                    >
                      {formatCurrency(row.annual_balance)}
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          ...tableBodyCellStyle,
                          padding: 18,
                          background: "var(--surface-1)",
                        }}
                      >
                        <RealizationBudgetItemDetailTable
                          rows={detailState.rows}
                          isLoading={detailState.isLoading}
                          errorMessage={detailState.errorMessage}
                          warningMessages={detailState.warningMessages}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

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
                  Belum ada data realisasi untuk versi yang dipilih.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
