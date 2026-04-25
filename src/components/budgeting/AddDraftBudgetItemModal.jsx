import { useMemo, useState } from "react";
import {
  getAlertStyle,
  getMetaLabelStyle,
  getModalStyle,
  getOverlayStyle,
  getPrimaryButtonStyle,
  getSelectStyle,
  getTableCellLabelTypography,
  getTextInputStyle,
  getOutlinedButtonStyle,
} from "../../lib/controlStyles";

const MONTH_FIELDS = [
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

function createInitialForm() {
  return {
    budget_account_id: "",
    jan_amount: "",
    feb_amount: "",
    mar_amount: "",
    apr_amount: "",
    may_amount: "",
    jun_amount: "",
    jul_amount: "",
    aug_amount: "",
    sep_amount: "",
    oct_amount: "",
    nov_amount: "",
    dec_amount: "",
  };
}

function normalizeAmountInput(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return 0;
  }

  const nextValue = Number(rawValue);

  if (!Number.isFinite(nextValue)) {
    return NaN;
  }

  return nextValue;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function AddDraftBudgetItemModal({
  prefersDarkMode,
  isOpen,
  subActivityRow,
  budgetAccountOptions,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(createInitialForm());

  const annualAmount = useMemo(
    () =>
      MONTH_FIELDS.reduce(
        (sum, field) => sum + (normalizeAmountInput(form[field.key]) || 0),
        0
      ),
    [form]
  );

  const validationMessage = useMemo(() => {
    if (!form.budget_account_id) {
      return "Akun belanja wajib dipilih.";
    }

    for (const field of MONTH_FIELDS) {
      const nextValue = normalizeAmountInput(form[field.key]);

      if (Number.isNaN(nextValue)) {
        return `Nilai ${field.label} harus berupa angka yang valid.`;
      }

      if (nextValue < 0) {
        return `Nilai ${field.label} tidak boleh negatif.`;
      }
    }

    return "";
  }, [form]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={getOverlayStyle()}>
      <div style={getModalStyle({ maxWidth: 820 })}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={getMetaLabelStyle(prefersDarkMode)}>Tambah Akun Belanja</div>
            <div style={getTableCellLabelTypography()}>
              {subActivityRow?.sub_activity_name || "-"}
            </div>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Akun Belanja Level 5</span>
            <select
              value={form.budget_account_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  budget_account_id: event.target.value,
                }))
              }
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={isSubmitting}
            >
              <option value="">Pilih akun belanja</option>
              {budgetAccountOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {MONTH_FIELDS.map((field) => (
              <label key={field.key} style={{ display: "grid", gap: 6 }}>
                <span style={getMetaLabelStyle(prefersDarkMode)}>{field.label}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form[field.key]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  style={getTextInputStyle(prefersDarkMode, { tone: "panel", height: 42 })}
                  disabled={isSubmitting}
                />
              </label>
            ))}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Tahunan</div>
            <div style={getTableCellLabelTypography()}>{formatCurrency(annualAmount)}</div>
          </div>

          {errorMessage ? (
            <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
              {errorMessage}
            </div>
          ) : null}

          {validationMessage ? (
            <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
              {validationMessage}
            </div>
          ) : null}

          {!validationMessage && budgetAccountOptions.length === 0 ? (
            <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
              Semua akun belanja level 5 yang tersedia sudah dipakai pada Sub Kegiatan ini.
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={getOutlinedButtonStyle(prefersDarkMode, {
                isEnabled: !isSubmitting,
                height: 40,
                size: "sm",
              })}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onSubmit?.(form)}
              style={getPrimaryButtonStyle(prefersDarkMode, {
                isEnabled: !validationMessage && !isSubmitting && budgetAccountOptions.length > 0,
                height: 40,
                size: "sm",
              })}
              disabled={Boolean(validationMessage) || isSubmitting || budgetAccountOptions.length === 0}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
