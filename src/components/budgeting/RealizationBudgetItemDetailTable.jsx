import { useState } from "react";
import {
  getAlertStyle,
  getChipStyle,
  getInlineActionButtonStyle,
  getTableBodyCellStyle,
  getTableCellSecondaryLabelTypography,
  getTableCellSubtitleTypography,
  getTextInputStyle,
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

function getAmountCellStyle(tableBodyCellStyle, value) {
  return {
    ...tableBodyCellStyle,
    textAlign: "right",
    color:
      Number(value || 0) < 0
        ? "var(--alert-danger-color, #b42318)"
        : "var(--text-h)",
  };
}

function getRemarkText({ planAmount, realizationAmount }) {
  if (planAmount === 0 && realizationAmount > 0) {
    return "Realisasi tanpa plan";
  }

  if (realizationAmount === 0 && planAmount > 0) {
    return "Belum terealisasi";
  }

  if (realizationAmount > planAmount) {
    return "Overspending";
  }

  return "-";
}

export default function RealizationBudgetItemDetailTable({
  prefersDarkMode,
  monthLabel,
  rows,
  isLoading,
  errorMessage,
  warningMessages = [],
  draftValues = {},
  rowMutationState = {},
  onDraftChange,
  onSaveRow,
}) {
  const tableBodyCellStyle = getTableBodyCellStyle({
    padding: "12px 10px",
  });
  const [hoveredRowKey, setHoveredRowKey] = useState("");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!isLoading && !errorMessage && warningMessages.length > 0 ? (
        <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
          {warningMessages.join(" ")}
        </div>
      ) : null}

      <div style={getTableFrameStyle({ borderRadius: 0 })}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1160 }}>
            <thead>
              <tr>
                <th
                  style={{
                    ...getTableHeaderCellStyle({
                      label: "Belanja Level 5",
                      color: "var(--text-muted)",
                    }),
                    minWidth: 260,
                    paddingLeft: 13,
                  }}
                >
                  Belanja Level 5
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: `Plan ${monthLabel}` }),
                    width: 150,
                  }}
                >
                  Plan {monthLabel}
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: `Realisasi ${monthLabel}` }),
                    width: 160,
                  }}
                >
                  Realisasi {monthLabel}
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({
                      label: "Deviation (Plan - Realisasi)",
                    }),
                    width: 220,
                  }}
                >
                  Deviation (Plan - Realisasi)
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Input Realisasi" }),
                    width: 180,
                  }}
                >
                  Input Realisasi
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Keterangan" }),
                    width: 220,
                  }}
                >
                  Keterangan
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Aksi" }),
                    width: 120,
                  }}
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
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
                    colSpan={7}
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
                    colSpan={7}
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
                ? rows.map((row) => {
                    const planAmount = Number(row.plan_amount || 0);
                    const realizationAmount = Number(row.realization_amount || 0);
                    const remarkText = getRemarkText({
                      planAmount,
                      realizationAmount,
                    });
                    const rowBackground =
                      hoveredRowKey === row.budget_account_id
                        ? "var(--surface-1)"
                        : "transparent";

                    return (
                      <tr
                        key={row.budget_account_id}
                        onMouseEnter={() => setHoveredRowKey(row.budget_account_id)}
                        onMouseLeave={() => setHoveredRowKey("")}
                        style={{
                          background: rowBackground,
                          transition: "background 140ms ease",
                        }}
                      >
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            paddingLeft: 13,
                          }}
                        >
                          <div style={getTableCellSecondaryLabelTypography()}>
                            {row.budget_account_name}
                          </div>
                          <div style={getTableCellSubtitleTypography()}>
                            {row.budget_account_code}
                          </div>
                        </td>
                        <td style={getAmountCellStyle(tableBodyCellStyle, row.plan_amount)}>
                          {formatCurrency(row.plan_amount)}
                        </td>
                        <td
                          style={getAmountCellStyle(
                            tableBodyCellStyle,
                            row.realization_amount
                          )}
                        >
                          {formatCurrency(row.realization_amount)}
                        </td>
                        <td
                          style={getAmountCellStyle(
                            tableBodyCellStyle,
                            row.deviation_amount
                          )}
                        >
                          {formatCurrency(row.deviation_amount)}
                        </td>
                        {(() => {
                          const currentDraft = draftValues[row.budget_account_id] ?? String(
                            Number(row.realization_amount || 0)
                          );
                          const mutationState = rowMutationState[row.budget_account_id] || {
                            isSaving: false,
                            errorMessage: "",
                            savedMessage: "",
                          };
                          const normalizedInput = Number(currentDraft === "" ? 0 : currentDraft);
                          const hasChanges =
                            Number.isFinite(normalizedInput) &&
                            normalizedInput !== Number(row.realization_amount || 0);
                          const hasNegativeValue =
                            currentDraft !== "" && Number(currentDraft) < 0;
                          const hasZeroPlanWarning =
                            Number(row.plan_amount || 0) <= 0 && normalizedInput > 0;
                          const hasOverspendWarning =
                            Number(row.plan_amount || 0) > 0 &&
                            normalizedInput > Number(row.plan_amount || 0);

                          return (
                            <>
                              <td style={tableBodyCellStyle}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={currentDraft}
                                  onChange={(event) =>
                                    onDraftChange?.(row, event.target.value)
                                  }
                                  style={{
                                    ...getTextInputStyle(prefersDarkMode, {
                                      tone: "panel",
                                      height: 38,
                                      isDisabled: mutationState.isSaving,
                                    }),
                                    width: "100%",
                                    textAlign: "right",
                                    borderColor: hasChanges
                                      ? "var(--alert-warning-color, #b54708)"
                                      : undefined,
                                  }}
                                  disabled={mutationState.isSaving}
                                />
                                {hasChanges || mutationState.savedMessage ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      flexWrap: "wrap",
                                      marginTop: 6,
                                    }}
                                  >
                                    {hasChanges ? (
                                      <span
                                        style={getChipStyle(prefersDarkMode, {
                                          tone: "warning",
                                          size: "sm",
                                        })}
                                      >
                                        Diubah
                                      </span>
                                    ) : null}
                                    {mutationState.savedMessage ? (
                                      <span
                                        style={getChipStyle(prefersDarkMode, {
                                          tone: "success",
                                          size: "sm",
                                        })}
                                      >
                                        {mutationState.savedMessage}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {mutationState.errorMessage ? (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      ...getTableCellSubtitleTypography(),
                                      color: "var(--alert-error-color)",
                                    }}
                                  >
                                    {mutationState.errorMessage}
                                  </div>
                                ) : null}
                              </td>
                              <td style={tableBodyCellStyle}>
                                {hasNegativeValue ? (
                                  <span
                                    style={getChipStyle(prefersDarkMode, {
                                      tone: "muted",
                                      size: "sm",
                                    })}
                                  >
                                    Nilai negatif tidak valid
                                  </span>
                                ) : hasZeroPlanWarning ? (
                                  <span
                                    style={getChipStyle(prefersDarkMode, {
                                      tone: "muted",
                                      size: "sm",
                                    })}
                                  >
                                    Realisasi tanpa plan
                                  </span>
                                ) : hasOverspendWarning ? (
                                  <span
                                    style={getChipStyle(prefersDarkMode, {
                                      tone: "muted",
                                      size: "sm",
                                    })}
                                  >
                                    Overspending
                                  </span>
                                ) : remarkText === "-" ? (
                                  <span style={{ color: "var(--text-muted)" }}>-</span>
                                ) : (
                                  <span
                                    style={getChipStyle(prefersDarkMode, {
                                      tone: "muted",
                                      size: "sm",
                                    })}
                                  >
                                    {remarkText}
                                  </span>
                                )}
                              </td>
                              <td style={tableBodyCellStyle}>
                                <button
                                  type="button"
                                  onClick={() => onSaveRow?.(row)}
                                  style={getInlineActionButtonStyle(prefersDarkMode, {
                                    isEnabled:
                                      !mutationState.isSaving &&
                                      !hasNegativeValue &&
                                      hasChanges,
                                    tone: "accent",
                                    height: 36,
                                  })}
                                  disabled={
                                    mutationState.isSaving ||
                                    hasNegativeValue ||
                                    !hasChanges
                                  }
                                >
                                  {mutationState.isSaving ? "Menyimpan..." : "Save"}
                                </button>
                              </td>
                            </>
                          );
                        })()}
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
