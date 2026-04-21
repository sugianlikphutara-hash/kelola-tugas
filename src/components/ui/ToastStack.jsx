import { getGhostIconButtonStyle, getToastAccentColor } from "../../lib/controlStyles";

export default function ToastStack({ prefersDarkMode, toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  const base = {
    background: "var(--toast-bg)",
    border: "1px solid var(--toast-border)",
    color: "var(--toast-color)",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1200,
        display: "grid",
        gap: 10,
        maxWidth: 420,
        width: "calc(100vw - 32px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            ...base,
            pointerEvents: "auto",
            borderRadius: 12,
            padding: "10px 12px",
            boxShadow: "var(--toast-shadow)",
            display: "grid",
            gridTemplateColumns: "6px 1fr auto",
            alignItems: "center",
            gap: 10,
          }}
          role="status"
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: "100%",
              borderRadius: 999,
              background: getToastAccentColor(toast.type),
            }}
          />
          <div style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 600 }}>
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            style={getGhostIconButtonStyle(prefersDarkMode, {
              isEnabled: true,
              height: 32,
              size: 16,
              radius: 10,
            })}
            aria-label="Tutup notifikasi"
          >
            {"\u00D7"}
          </button>
        </div>
      ))}
    </div>
  );
}
