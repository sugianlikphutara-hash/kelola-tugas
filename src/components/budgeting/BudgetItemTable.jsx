import { useState } from "react";
import {
  getAlertStyle,
  getDangerOutlinedButtonStyle,
  getNeutralButtonStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSecondaryLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTextInputStyle,
} from "../../lib/controlStyles";

const MONTH_COLUMNS = [
  { key: "jan_amount", label: "Jan" },
  { key: "feb_amount", label: "Feb" },
  { key: "mar_amount", label: "Mar" },
  { key: "apr_amount", label: "Apr" },
  { key: "may_amount", label: "May" },
  { key: "jun_amount", label: "Jun" },
  { key: "jul_amount", label: "Jul" },
  { key: "aug_amount", label: "Aug" },
  { key: "sep_amount", label: "Sep" },
  { key: "oct_amount", label: "Oct" },
  { key: "nov_amount", label: "Nov" },
  { key: "dec_amount", label: "Dec" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getStickyCellStyle({
  left = 0,
  minWidth,
  background = "var(--table-bg)",
  zIndex = 2,
}) {
  return {
    position: "sticky",
    left,
    minWidth,
    background,
    zIndex,
  };
}

export default function BudgetItemTable({
  prefersDarkMode,
  rows,
  isLoading,
  errorMessage,
  warningMessages = [],
  isEditable = false,
  pendingRowActionKey = "",
  onSaveRow,
  onDeleteRow,
}) {
  const [draftValuesById, setDraftValuesById] = useState({});
  const tableBodyCellStyle = getTableBodyCellStyle({
    padding: "12px 10px",
  });

  function createDraftValuesFromRow(row) {
    return {
      jan_amount: String(row?.jan_amount ?? 0),
      feb_amount: String(row?.feb_amount ?? 0),
      mar_amount: String(row?.mar_amount ?? 0),
      apr_amount: String(row?.apr_amount ?? 0),
      may_amount: String(row?.may_amount ?? 0),
      jun_amount: String(row?.jun_amount ?? 0),
      jul_amount: String(row?.jul_amount ?? 0),
      aug_amount: String(row?.aug_amount ?? 0),
      sep_amount: String(row?.sep_amount ?? 0),
      oct_amount: String(row?.oct_amount ?? 0),
      nov_amount: String(row?.nov_amount ?? 0),
      dec_amount: String(row?.dec_amount ?? 0),
    };
  }

  function normalizeNumberInput(value) {
    const rawValue = String(value ?? "").trim();

    if (!rawValue) {
      return 0;
    }

    const nextValue = Number(rawValue);
    return Number.isFinite(nextValue) ? nextValue : NaN;
  }

  function getAnnualTotalFromDraft(draftRow) {
    return MONTH_COLUMNS.reduce(
      (sum, column) => sum + (normalizeNumberInput(draftRow?.[column.key]) || 0),
      0
    );
  }

  function hasDirtyValues(row, draftRow) {
    if (!row?.id || !draftRow) {
      return false;
    }

    return MONTH_COLUMNS.some(
      (column) =>
        normalizeNumberInput(draftRow[column.key]) !==
        normalizeNumberInput(row[column.key])
    );
  }

  function getValidationMessage(row, draftRow) {
    if (!isEditable || !row?.id) {
      return "";
    }

    for (const column of MONTH_COLUMNS) {
      const nextValue = normalizeNumberInput(draftRow?.[column.key]);

      if (Number.isNaN(nextValue)) {
        return `Nilai ${column.label} harus angka yang valid.`;
      }

      if (nextValue < 0) {
        return `Nilai ${column.label} tidak boleh negatif.`;
      }
    }

    return "";
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!isLoading && !errorMessage && warningMessages.length > 0 ? (
        <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
          {warningMessages.join(" ")}
        </div>
      ) : null}

      <div style={getTableFrameStyle({ borderRadius: 10 })}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1750 }}>
            <thead>
              <tr>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Nama Akun Belanja" }),
                    ...getStickyCellStyle({
                      left: 0,
                      minWidth: 360,
                      background: "var(--table-header-bg)",
                      zIndex: 4,
                    }),
                  }}
                >
                  Nama Akun Belanja
                </th>
                {MONTH_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    style={{
                      ...getTableHeaderCellStyle({ label: column.label }),
                      width: 110,
                      textAlign: "right",
                    }}
                  >
                    {column.label}
                  </th>
                ))}
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Total" }),
                    width: 140,
                    textAlign: "right",
                  }}
                >
                  Total
                </th>
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
                ? rows.map((row) => {
                    const rowBackground = row.has_amount_mismatch
                      ? "var(--alert-warning-bg)"
                      : "var(--table-bg)";
                    const draftRow = draftValuesById[row.id] || createDraftValuesFromRow(row);
                    const annualTotal = getAnnualTotalFromDraft(draftRow);
                    const validationMessage = getValidationMessage(row, draftRow);
                    const isDirty = hasDirtyValues(row, draftRow);
                    const isSavePending = pendingRowActionKey === `save:${row.id}`;
                    const isDeletePending = pendingRowActionKey === `delete:${row.id}`;
                    const isRowPending = isSavePending || isDeletePending;

                    return (
                      <tr key={row.budget_account_id}>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            ...getStickyCellStyle({
                              left: 0,
                              minWidth: 360,
                              background: rowBackground,
                              zIndex: 3,
                            }),
                          }}
                        >
                          <div style={getTableCellSecondaryLabelTypography()}>
                            {row.budget_account_name || "-"}
                          </div>
                          <div style={getTableCellSubtitleTypography()}>
                            {row.budget_account_code || "-"}
                          </div>
                          {row.has_amount_mismatch ? (
                            <div
                              style={getTableCellSubtitleTypography({
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--alert-warning-color)",
                              })}
                            >
                              Warning: total Jan-Des tidak sama
                            </div>
                          ) : null}
                        </td>
                        {MONTH_COLUMNS.map((column) => (
                          <td
                            key={`${row.budget_account_id}-${column.key}`}
                            style={{
                              ...tableBodyCellStyle,
                              textAlign: "right",
                              background: rowBackground,
                            }}
                          >
                            {isEditable && row.id ? (
                              <input
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={draftRow[column.key] ?? ""}
                                onChange={(event) =>
                                  setDraftValuesById((current) => ({
                                    ...current,
                                    [row.id]: {
                                      ...current[row.id],
                                      [column.key]: event.target.value,
                                    },
                                  }))
                                }
                                style={{
                                  ...getTextInputStyle(prefersDarkMode, {
                                    tone: "panel",
                                    height: 36,
                                  }),
                                  width: 110,
                                  textAlign: "right",
                                }}
                                disabled={isRowPending}
                              />
                            ) : (
                              formatCurrency(row[column.key])
                            )}
                          </td>
                        ))}
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "right",
                            background: rowBackground,
                          }}
                        >
                          <div style={getTableCellLabelTypography({ fontSize: 13 })}>
                            {formatCurrency(isEditable && row.id ? annualTotal : row.annual_amount)}
                          </div>
                          {isEditable && row.id ? (
                            <div
                              style={{
                                marginTop: 8,
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              {validationMessage ? (
                                <div
                                  style={getTableCellSubtitleTypography({
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--alert-warning-color)",
                                  })}
                                >
                                  {validationMessage}
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  onSaveRow?.(row, {
                                    jan_amount: normalizeNumberInput(draftRow.jan_amount),
                                    feb_amount: normalizeNumberInput(draftRow.feb_amount),
                                    mar_amount: normalizeNumberInput(draftRow.mar_amount),
                                    apr_amount: normalizeNumberInput(draftRow.apr_amount),
                                    may_amount: normalizeNumberInput(draftRow.may_amount),
                                    jun_amount: normalizeNumberInput(draftRow.jun_amount),
                                    jul_amount: normalizeNumberInput(draftRow.jul_amount),
                                    aug_amount: normalizeNumberInput(draftRow.aug_amount),
                                    sep_amount: normalizeNumberInput(draftRow.sep_amount),
                                    oct_amount: normalizeNumberInput(draftRow.oct_amount),
                                    nov_amount: normalizeNumberInput(draftRow.nov_amount),
                                    dec_amount: normalizeNumberInput(draftRow.dec_amount),
                                  })
                                }
                                style={getNeutralButtonStyle(prefersDarkMode, {
                                  isEnabled: isDirty && !validationMessage && !isRowPending,
                                  size: "sm",
                                  height: 34,
                                })}
                                disabled={!isDirty || Boolean(validationMessage) || isRowPending}
                              >
                                {isSavePending ? "Menyimpan..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteRow?.(row)}
                                style={getDangerOutlinedButtonStyle(prefersDarkMode, {
                                  isEnabled: !isRowPending,
                                  height: 34,
                                  size: "sm",
                                })}
                                disabled={isRowPending}
                              >
                                {isDeletePending ? "Menghapus..." : "Delete"}
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
