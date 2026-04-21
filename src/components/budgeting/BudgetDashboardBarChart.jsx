import {
  getEmptyStateStyle,
  getMetaLabelStyle,
  getPanelStyle,
  getTableCellLabelTypography,
} from "../../lib/controlStyles";

function formatCurrencyCompact(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export default function BudgetDashboardBarChart({
  prefersDarkMode,
  title,
  rows,
  labelKey,
  valueKey,
}) {
  const maxValue = rows.reduce(
    (currentMax, row) => Math.max(currentMax, Number(row?.[valueKey] || 0)),
    0
  );

  return (
    <section
      style={{
        ...getPanelStyle({ padding: 16, borderRadius: 12 }),
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={getMetaLabelStyle(prefersDarkMode)}>Distribusi</div>
        <div style={getTableCellLabelTypography()}>{title}</div>
      </div>

      {rows.length === 0 ? (
        <div style={getEmptyStateStyle(prefersDarkMode, { minHeight: 140 })}>
          Belum ada data yang bisa divisualisasikan untuk versi ini.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => {
            const value = Number(row?.[valueKey] || 0);
            const widthPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

            return (
              <div
                key={`${row?.rak_version_id || "chart"}:${row?.[labelKey]}:${row?.period_month || ""}`}
                style={{ display: "grid", gap: 6 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>
                    {row?.[labelKey] || "-"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatCurrencyCompact(value)}
                  </div>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: "var(--surface-2)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(widthPercent, value > 0 ? 2 : 0)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "var(--btn-primary-bg)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
