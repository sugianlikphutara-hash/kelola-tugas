import { useEffect, useState } from "react";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import { getDashboardData } from "../services/dashboardService";
import {
  getMetaLabelStyle,
  getPageTitleStyle,
  getPanelStyle,
  getTableBodyCellStyle,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTableCellLabelTypography
} from "../lib/controlStyles";

export default function DashboardPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [data, setData] = useState({
    subKegiatan: [],
    pegawai: [],
  });

  useEffect(() => {
    async function load() {
      const result = await getDashboardData();
      setData(result);
    }
    load();
  }, []);

  const totalTasks = data.subKegiatan.reduce(
    (sum, item) => sum + (item.total_tasks || 0),
    0
  );

  const avgProgress =
    data.subKegiatan.length > 0
      ? data.subKegiatan.reduce(
          (sum, item) => sum + (item.avg_task_progress_percent || 0),
          0
        ) / data.subKegiatan.length
      : 0;

  const totalTarget = data.subKegiatan.reduce(
    (sum, item) => sum + (item.monthly_target_amount || 0),
    0
  );

  const totalRealization = data.subKegiatan.reduce(
    (sum, item) => sum + (item.monthly_realization_amount || 0),
    0
  );

  const realizationPercent =
    totalTarget > 0 ? (totalRealization / totalTarget) * 100 : 0;

  const summaryCardStyle = {
    ...getPanelStyle({ padding: 16 }),
    background: prefersDarkMode ? "var(--surface-2)" : "var(--surface-1)",
    border: "1px solid var(--border-subtle)",
    boxShadow: "none",
    borderRadius: 8,
    borderLeft: "4px solid var(--pebble)",
  };

  const metaLabelStyle = getMetaLabelStyle(prefersDarkMode);
  const tableFrameStyle = getTableFrameStyle();
  // Mode perataan header: 1 = semua kiri, 2 = center kecuali label tertentu kiri
  const tableHeaderAlignMode = 2;
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={getPageTitleStyle()}>DASHBOARD KPH</h1>
        {/*
        <div style={getPageSubtitleStyle()}>
          Ringkasan eksekutif, rekapitulasi, dan statistik tugas harian secara keseluruhan.
        </div>
        */}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div style={summaryCardStyle}>
          <div style={metaLabelStyle}>Total Task</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-h)", marginTop: 6 }}>
            {totalTasks}
          </div>
        </div>
        <div style={summaryCardStyle}>
          <div style={metaLabelStyle}>Progress</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-h)", marginTop: 6 }}>
            {avgProgress.toFixed(1)}%
          </div>
        </div>
        <div style={summaryCardStyle}>
          <div style={metaLabelStyle}>Serapan Anggaran</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-h)", marginTop: 6 }}>
            {realizationPercent.toFixed(1)}%
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          Monitoring Sub Kegiatan
        </div>
        <div style={tableFrameStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  { label: "Sub Kegiatan", width: undefined },
                  { label: "Task", width: 110 },
                  { label: "Progress", width: 130 },
                  { label: "Anggaran (%)", width: 140 }
                ].map(({ label, width }) => (
                  <th
                    key={label}
                    style={{
                      ...getTableHeaderCellStyle({ alignMode: tableHeaderAlignMode, label }),
                      ...(width ? { width } : {}),
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.subKegiatan.map((item) => (
                <tr key={item.sub_activity_id}>
                  <td style={tableBodyCellStyle}>{item.sub_activity_name}</td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "center" }}>
                    {item.total_tasks ?? "-"}
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "center" }}>
                    {item.avg_task_progress_percent ?? "-"}%
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "center" }}>
                    {item.monthly_realization_percent ?? "-"}%
                  </td>
                </tr>
              ))}

              {data.subKegiatan.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Data sub kegiatan belum tersedia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          Monitoring Pegawai
        </div>
        <div style={tableFrameStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  { label: "Nama", width: undefined },
                  { label: "Total Task", width: 140 },
                  { label: "Progress", width: 130 }
                ].map(({ label, width }) => (
                  <th
                    key={label}
                    style={{
                      ...getTableHeaderCellStyle({ alignMode: tableHeaderAlignMode, label }),
                      ...(width ? { width } : {}),
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pegawai.map((pegawai) => (
                <tr key={pegawai.employee_id}>
                  <td style={tableBodyCellStyle}>{pegawai.employee_name}</td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "center" }}>
                    {pegawai.total_tasks ?? "-"}
                  </td>
                  <td style={{ ...tableBodyCellStyle, textAlign: "center" }}>
                    {pegawai.avg_progress_percent ?? "-"}%
                  </td>
                </tr>
              ))}

              {data.pegawai.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Data pegawai belum tersedia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
