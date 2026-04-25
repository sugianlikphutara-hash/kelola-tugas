import { usePrefersDarkMode } from "../../hooks/usePrefersDarkMode";
import {
  getModalStyle,
  getOutlinedButtonStyle,
  getOverlayStyle,
  getPrimaryButtonStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
} from "../../lib/controlStyles";

export default function ConfirmActionModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Lanjutkan",
  cancelText = "Batal",
}) {
  const prefersDarkMode = usePrefersDarkMode();

  if (!open) {
    return null;
  }

  return (
    <div style={getOverlayStyle()} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        style={getModalStyle({ maxWidth: 420 })}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div id="confirm-action-title" style={getTableCellLabelTypography()}>
              {title}
            </div>
            <div style={getTableCellSubtitleTypography()}>{message}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              style={getOutlinedButtonStyle(prefersDarkMode, {
                isEnabled: true,
                height: 38,
                size: "sm",
              })}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              style={getPrimaryButtonStyle(prefersDarkMode, {
                isEnabled: true,
                height: 38,
                size: "sm",
              })}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
