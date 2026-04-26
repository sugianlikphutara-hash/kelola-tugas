import {
  getAlertStyle,
  getEmptyStateStyle,
  getLoadingStateStyle,
  getMetaLabelStyle,
  getModalStyle,
  getOutlinedButtonStyle,
  getOverlayStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function RealizationAuditLogModal({
  prefersDarkMode,
  isOpen,
  context,
  rows,
  isLoading,
  errorMessage,
  onClose,
}) {
  if (!isOpen) {
    return null;
  }

  const tableBodyCellStyle = getTableBodyCellStyle({ padding: "12px 10px" });

  return (
    <div style={getOverlayStyle()} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="realization-audit-log-title"
        style={getModalStyle({ maxWidth: 980 })}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={getMetaLabelStyle(prefersDarkMode)}>
                Riwayat Realisasi
              </div>
              <div id="realization-audit-log-title" style={getTableCellLabelTypography()}>
                {context?.budgetAccountName || "-"}
              </div>
              <div style={getTableCellSubtitleTypography()}>
                {context?.budgetAccountCode || "-"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={getOutlinedButtonStyle(prefersDarkMode, {
                isEnabled: true,
                height: 38,
                size: "sm",
              })}
            >
              Tutup
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={getMetaLabelStyle(prefersDarkMode)}>Sub Kegiatan</div>
              <div style={getTableCellLabelTypography()}>
                {context?.subActivityName || "-"}
              </div>
              <div style={getTableCellSubtitleTypography()}>
                {context?.subActivityCode || "-"}
              </div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={getMetaLabelStyle(prefersDarkMode)}>Akun Belanja</div>
              <div style={getTableCellLabelTypography()}>
                {context?.budgetAccountName || "-"}
              </div>
              <div style={getTableCellSubtitleTypography()}>
                {context?.budgetAccountCode || "-"}
              </div>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={getMetaLabelStyle(prefersDarkMode)}>Bulan</div>
              <div style={getTableCellLabelTypography()}>
                {context?.monthLabel || "-"}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={getLoadingStateStyle(prefersDarkMode)}>
              Memuat riwayat perubahan...
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
              {errorMessage}
            </div>
          ) : null}

          {!isLoading && !errorMessage && rows.length === 0 ? (
            <div style={getEmptyStateStyle(prefersDarkMode)}>
              Belum ada riwayat perubahan.
            </div>
          ) : null}

          {!isLoading && !errorMessage && rows.length > 0 ? (
            <div style={getTableFrameStyle()}>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 760,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...getTableHeaderCellStyle({
                            label: "Waktu",
                            alignMode: 3,
                            isFirstColumn: true,
                          }),
                          width: 180,
                        }}
                      >
                        Waktu
                      </th>
                      <th
                        style={{
                          ...getTableHeaderCellStyle({
                            label: "Aksi",
                            alignMode: 3,
                          }),
                          width: 110,
                        }}
                      >
                        Aksi
                      </th>
                      <th
                        style={{
                          ...getTableHeaderCellStyle({
                            label: "Nilai Lama",
                            alignMode: 3,
                          }),
                          width: 150,
                        }}
                      >
                        Nilai Lama
                      </th>
                      <th
                        style={{
                          ...getTableHeaderCellStyle({
                            label: "Nilai Baru",
                            alignMode: 3,
                          }),
                          width: 150,
                        }}
                      >
                        Nilai Baru
                      </th>
                      <th
                        style={getTableHeaderCellStyle({
                          label: "Diubah Oleh",
                          alignMode: 3,
                        })}
                      >
                        Diubah Oleh
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td style={tableBodyCellStyle}>
                          {formatDateTime(row.changed_at)}
                        </td>
                        <td style={tableBodyCellStyle}>{row.action_type || "-"}</td>
                        <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                          {formatCurrency(row.old_amount)}
                        </td>
                        <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                          {formatCurrency(row.new_amount)}
                        </td>
                        <td style={tableBodyCellStyle}>{row.changed_by || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
