import { useMemo, useState } from "react";
import {
  getAlertStyle,
  getDateInputStyle,
  getMetaLabelStyle,
  getModalStyle,
  getOutlinedButtonStyle,
  getOverlayStyle,
  getPrimaryButtonStyle,
  getTableCellLabelTypography,
  getTextInputStyle,
} from "../../lib/controlStyles";

function createInitialForm(version) {
  return {
    title: version?.title || "",
    notes: version?.notes || "",
    rak_date: version?.rak_date || "",
  };
}

export default function EditRakMetadataModal({
  prefersDarkMode,
  isOpen,
  version,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => createInitialForm(version));

  const validationMessage = useMemo(() => {
    if (!String(form.title || "").trim()) {
      return "Nama RAK wajib diisi.";
    }

    if (version?.rak_date !== undefined && version?.rak_date !== null && !form.rak_date) {
      return "Tanggal RAK wajib diisi.";
    }

    return "";
  }, [form, version]);

  if (!isOpen || !version) {
    return null;
  }

  return (
    <div style={getOverlayStyle()}>
      <div style={getModalStyle({ maxWidth: 720 })}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={getMetaLabelStyle(prefersDarkMode)}>Edit Metadata</div>
            <div style={getTableCellLabelTypography()}>
              {version.code || version.title || "Versi RAK"}
            </div>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Nama RAK</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              style={getTextInputStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={isSubmitting}
            />
          </label>

          {version?.rak_date !== undefined ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={getMetaLabelStyle(prefersDarkMode)}>Tanggal RAK</span>
              <input
                type="date"
                value={form.rak_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rak_date: event.target.value,
                  }))
                }
                style={getDateInputStyle(prefersDarkMode, { tone: "panel", height: 42 })}
                disabled={isSubmitting}
              />
            </label>
          ) : null}

          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Catatan</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              style={{
                ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
                minHeight: 120,
                resize: "vertical",
                fontFamily: "inherit",
              }}
              disabled={isSubmitting}
            />
          </label>

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
              onClick={() =>
                onSubmit?.({
                  title: String(form.title || "").trim(),
                  notes: String(form.notes || "").trim(),
                  rak_date: form.rak_date || null,
                })
              }
              style={getPrimaryButtonStyle(prefersDarkMode, {
                isEnabled: !validationMessage && !isSubmitting,
                height: 40,
                size: "sm",
              })}
              disabled={Boolean(validationMessage) || isSubmitting}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
