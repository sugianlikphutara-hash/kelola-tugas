import { useEffect, useMemo, useRef, useState } from "react";
import BudgetDashboardBarChart from "../components/budgeting/BudgetDashboardBarChart";
import BudgetDashboardHighlightTable from "../components/budgeting/BudgetDashboardHighlightTable";
import BudgetDashboardSubActivityTable from "../components/budgeting/BudgetDashboardSubActivityTable";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  getAlertStyle,
  getChipStyle,
  getEmptyStateStyle,
  getLoadingStateStyle,
  getMetaLabelStyle,
  getPageSubtitleStyle,
  getPageTitleStyle,
  getPanelStyle,
  getSelectStyle,
  getTableCellLabelTypography,
} from "../lib/controlStyles";
import {
  getDashboardMonthlyBreakdown,
  getDashboardSubActivityBreakdown,
  getDashboardSummary,
  getTopOverspend,
  getTopWarnings,
} from "../services/budgetDashboardService";
import { getDefaultRakVersion, getRakVersions } from "../services/budgetRakService";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getVersionStatusTone(status) {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "DRAFT") {
    return "warning";
  }

  if (status === "ARCHIVED") {
    return "muted";
  }

  return "neutral";
}

export default function BudgetDashboardPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionErrorMessage, setVersionErrorMessage] = useState("");
  const [dashboardState, setDashboardState] = useState({
    rakVersion: null,
    summary: null,
    subActivityBreakdown: [],
    monthlyBreakdown: [],
    topOverspend: [],
    topWarnings: [],
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const selectedRakVersionIdRef = useRef("");
  const dashboardRequestKeyRef = useRef("");

  useEffect(() => {
    selectedRakVersionIdRef.current = selectedRakVersionId;
  }, [selectedRakVersionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadVersions() {
      setLoadingVersions(true);
      setVersionErrorMessage("");

      try {
        const [allVersions, defaultVersion] = await Promise.all([
          getRakVersions(),
          getDefaultRakVersion(),
        ]);

        if (!isMounted) {
          return;
        }

        const sortedVersions = [...allVersions].sort((leftVersion, rightVersion) => {
          const leftDate = new Date(leftVersion.rak_date || 0).getTime();
          const rightDate = new Date(rightVersion.rak_date || 0).getTime();

          if (rightDate !== leftDate) {
            return rightDate - leftDate;
          }

          return Number(rightVersion.version_number || 0) - Number(leftVersion.version_number || 0);
        });

        setVersionOptions(sortedVersions);
        setSelectedRakVersionId((currentValue) =>
          currentValue || defaultVersion?.id || sortedVersions[0]?.id || ""
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setVersionErrorMessage(error?.message || "Gagal memuat daftar versi RAK.");
      } finally {
        if (isMounted) {
          setLoadingVersions(false);
        }
      }
    }

    loadVersions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!selectedRakVersionId) {
        dashboardRequestKeyRef.current = "";
        setDashboardState({
          rakVersion: null,
          summary: null,
          subActivityBreakdown: [],
          monthlyBreakdown: [],
          topOverspend: [],
          topWarnings: [],
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      const requestKey = `${selectedRakVersionId}:dashboard`;
      dashboardRequestKeyRef.current = requestKey;
      setDashboardState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
        warnings: [],
      }));

      try {
        const [
          summaryResult,
          subActivityResult,
          monthlyResult,
          topOverspendResult,
          topWarningsResult,
        ] = await Promise.all([
          getDashboardSummary(selectedRakVersionId),
          getDashboardSubActivityBreakdown(selectedRakVersionId),
          getDashboardMonthlyBreakdown(selectedRakVersionId),
          getTopOverspend(selectedRakVersionId),
          getTopWarnings(selectedRakVersionId),
        ]);

        if (
          !isMounted ||
          dashboardRequestKeyRef.current !== requestKey ||
          selectedRakVersionIdRef.current !== selectedRakVersionId
        ) {
          return;
        }

        setDashboardState({
          rakVersion: summaryResult.rakVersion,
          summary: summaryResult.data,
          subActivityBreakdown: subActivityResult.rows || [],
          monthlyBreakdown: monthlyResult.rows || [],
          topOverspend: topOverspendResult.rows || [],
          topWarnings: topWarningsResult.rows || [],
          warnings: [
            ...new Set([
              ...(summaryResult.warnings || []),
              ...(subActivityResult.warnings || []),
              ...(monthlyResult.warnings || []),
              ...(topOverspendResult.warnings || []),
              ...(topWarningsResult.warnings || []),
            ]),
          ],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (
          !isMounted ||
          dashboardRequestKeyRef.current !== requestKey ||
          selectedRakVersionIdRef.current !== selectedRakVersionId
        ) {
          return;
        }

        setDashboardState({
          rakVersion: null,
          summary: null,
          subActivityBreakdown: [],
          monthlyBreakdown: [],
          topOverspend: [],
          topWarnings: [],
          warnings: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat dashboard anggaran.",
        });
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [selectedRakVersionId]);

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      dashboardState.rakVersion ||
      null,
    [dashboardState.rakVersion, selectedRakVersionId, versionOptions]
  );

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>DASHBOARD ANGGARAN</h1>
        <div style={getPageSubtitleStyle()}>
          Ringkasan cepat kondisi anggaran dalam satu versi RAK, dengan angka yang
          tetap ditelusuri ke source yang sama seperti halaman Realisasi dan Tracking.
        </div>
      </div>

      <section
        style={{
          ...getPanelStyle({ padding: 16, borderRadius: 12 }),
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(260px, 360px) 1fr",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Versi RAK</span>
            <select
              value={selectedRakVersionId}
              onChange={(event) => setSelectedRakVersionId(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={loadingVersions || versionOptions.length === 0}
            >
              <option value="">
                {loadingVersions ? "Memuat versi RAK..." : "Pilih versi RAK"}
              </option>
              {versionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.code} | V{version.version_number} | {version.status}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={getMetaLabelStyle(prefersDarkMode)}>Versi Terpilih</div>
              <div style={getTableCellLabelTypography()}>
                {selectedVersion?.title || selectedVersion?.code || "Belum ada versi"}
              </div>
              {selectedVersion?.fiscal_year_id ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Fiscal Year: {selectedVersion.fiscal_year_id}
                </div>
              ) : null}
            </div>

            {selectedVersion ? (
              <div
                style={getChipStyle(prefersDarkMode, {
                  tone: getVersionStatusTone(selectedVersion.status),
                  size: "sm",
                })}
              >
                {selectedVersion.status}
              </div>
            ) : null}
          </div>
        </div>

        {versionErrorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {versionErrorMessage}
          </div>
        ) : null}

        {dashboardState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {dashboardState.warnings.join(" ")}
          </div>
        ) : null}

        {dashboardState.summary ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                ...getPanelStyle({
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface-1)",
                  boxShadow: "none",
                }),
                display: "grid",
                gap: 6,
              }}
            >
              <div style={getMetaLabelStyle(prefersDarkMode)}>Total Plan</div>
              <div style={getTableCellLabelTypography()}>
                {formatCurrency(dashboardState.summary.total_plan)}
              </div>
            </div>
            <div
              style={{
                ...getPanelStyle({
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface-1)",
                  boxShadow: "none",
                }),
                display: "grid",
                gap: 6,
              }}
            >
              <div style={getMetaLabelStyle(prefersDarkMode)}>Total Realisasi</div>
              <div style={getTableCellLabelTypography()}>
                {formatCurrency(dashboardState.summary.total_realization)}
              </div>
            </div>
            <div
              style={{
                ...getPanelStyle({
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface-1)",
                  boxShadow: "none",
                }),
                display: "grid",
                gap: 6,
              }}
            >
              <div style={getMetaLabelStyle(prefersDarkMode)}>Total Saldo</div>
              <div style={getTableCellLabelTypography()}>
                {formatCurrency(dashboardState.summary.total_balance)}
              </div>
            </div>
            <div
              style={{
                ...getPanelStyle({
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--surface-1)",
                  boxShadow: "none",
                }),
                display: "grid",
                gap: 6,
              }}
            >
              <div style={getMetaLabelStyle(prefersDarkMode)}>Progress</div>
              <div style={getTableCellLabelTypography()}>
                {Number(dashboardState.summary.progress_percent || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {dashboardState.isLoading ? (
        <div style={getLoadingStateStyle(prefersDarkMode)}>
          Memuat dashboard anggaran...
        </div>
      ) : null}

      {!dashboardState.isLoading && dashboardState.errorMessage ? (
        <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
          {dashboardState.errorMessage}
        </div>
      ) : null}

      {!dashboardState.isLoading &&
      !dashboardState.errorMessage &&
      !dashboardState.summary ? (
        <div style={getEmptyStateStyle(prefersDarkMode)}>
          Belum ada ringkasan dashboard yang bisa ditampilkan untuk versi ini.
        </div>
      ) : null}

      {!dashboardState.isLoading &&
      !dashboardState.errorMessage &&
      dashboardState.summary ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            <BudgetDashboardBarChart
              prefersDarkMode={prefersDarkMode}
              title="Distribusi Realisasi per Sub Kegiatan"
              rows={dashboardState.subActivityBreakdown.slice(0, 6)}
              labelKey="sub_activity_code"
              valueKey="annual_realization"
            />
            <BudgetDashboardBarChart
              prefersDarkMode={prefersDarkMode}
              title="Distribusi Realisasi per Bulan"
              rows={dashboardState.monthlyBreakdown}
              labelKey="month"
              valueKey="realization"
            />
          </section>

          <BudgetDashboardSubActivityTable
            rows={dashboardState.subActivityBreakdown}
          />

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 16,
            }}
          >
            <BudgetDashboardHighlightTable
              prefersDarkMode={prefersDarkMode}
              title="Top Overspend"
              rows={dashboardState.topOverspend}
              type="overspend"
            />
            <BudgetDashboardHighlightTable
              prefersDarkMode={prefersDarkMode}
              title="Top No Realization"
              rows={dashboardState.topWarnings}
              type="warning"
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
