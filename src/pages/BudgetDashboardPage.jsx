import { useEffect, useMemo, useRef, useState } from "react";
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
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
} from "../lib/controlStyles";
import { getBudgetYears } from "../services/masterDataService";
import { getBudgetTrackingProgress } from "../services/budgetProgressService";
import {
  getPreferredActiveRakVersion,
  getRakVersions,
} from "../services/budgetRakService";

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

function sortVersionsDescending(versions = []) {
  return [...versions].sort((leftVersion, rightVersion) => {
    const leftDate = new Date(leftVersion?.rak_date || 0).getTime();
    const rightDate = new Date(rightVersion?.rak_date || 0).getTime();

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return (
      Number(rightVersion?.version_number || 0) -
      Number(leftVersion?.version_number || 0)
    );
  });
}

function resolveDefaultFiscalYear(fiscalYears = []) {
  if (fiscalYears.length === 0) {
    return null;
  }

  return (
    fiscalYears.find((year) => year.is_active) ||
    [...fiscalYears].sort(
      (leftYear, rightYear) => Number(rightYear.year || 0) - Number(leftYear.year || 0)
    )[0] ||
    null
  );
}

function getHealthMeta(summary) {
  if (!summary) {
    return {
      label: "Belum ada data",
      tone: "muted",
      description: "Pilih tahun anggaran dan versi RAK untuk melihat kesehatan anggaran.",
    };
  }

  if (Number(summary.overspend_count || 0) > 0) {
    return {
      label: "Bermasalah",
      tone: "danger",
      description: "Terdapat Sub Kegiatan yang realisasinya melebihi plan.",
    };
  }

  if (
    Number(summary.warning_count || 0) > 0 ||
    Number(summary.deviation_count || 0) > 0
  ) {
    return {
      label: "Perlu Perhatian",
      tone: "warning",
      description: "Ada sinyal warning atau deviation yang perlu dipantau.",
    };
  }

  return {
    label: "Aman",
    tone: "success",
    description: "Belum ada issue anggaran yang terdeteksi pada versi ini.",
  };
}

function getIssueSortScore(row) {
  const isOverspend =
    Number(row.realization_amount || 0) > Number(row.plan_amount || 0);
  const signalCount =
    Number(row.warning_count || 0) + Number(row.deviation_count || 0);
  const deviationAmount = Math.abs(
    Number(row.deviation_amount || 0) ||
      (Number(row.realization_amount || 0) - Number(row.plan_amount || 0))
  );

  return {
    overspendRank: isOverspend ? 1 : 0,
    signalCount,
    deviationAmount,
  };
}

function getIssueStatusMeta(row) {
  const isOverspend =
    Number(row.realization_amount || 0) > Number(row.plan_amount || 0);

  if (isOverspend) {
    return {
      label: "Bermasalah",
      tone: "danger",
    };
  }

  if (Number(row.warning_count || 0) > 0 || Number(row.deviation_count || 0) > 0) {
    return {
      label: "Perlu Perhatian",
      tone: "warning",
    };
  }

  return {
    label: "Aman",
    tone: "success",
  };
}

function DashboardIssueTable({ prefersDarkMode, rows }) {
  const tableBodyCellStyle = getTableBodyCellStyle();

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={getTableCellLabelTypography()}>TOP 5 SUB KEGIATAN BERMASALAH</div>

      <div style={getTableFrameStyle()}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr>
                <th style={getTableHeaderCellStyle({ label: "Sub Kegiatan" })}>
                  Sub Kegiatan
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Plan" }),
                    width: 160,
                  }}
                >
                  Plan
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Realisasi" }),
                    width: 160,
                  }}
                >
                  Realisasi
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "%" }),
                    width: 120,
                  }}
                >
                  %
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Warning" }),
                    width: 120,
                  }}
                >
                  Warning
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Deviation" }),
                    width: 120,
                  }}
                >
                  Deviation
                </th>
                <th
                  style={{
                    ...getTableHeaderCellStyle({ label: "Status" }),
                    width: 160,
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const statusMeta = getIssueStatusMeta(row);
                return (
                  <tr key={`${row.rak_version_id}:${row.sub_activity_id}`}>
                    <td style={tableBodyCellStyle}>
                      <div style={getTableCellLabelTypography()}>
                        {row.sub_activity_name || "-"}
                      </div>
                      <div style={getTableCellSubtitleTypography()}>
                        {row.sub_activity_code || "-"}
                      </div>
                    </td>
                    <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                      {formatCurrency(row.plan_amount)}
                    </td>
                    <td
                      style={{
                        ...tableBodyCellStyle,
                        textAlign: "right",
                        color:
                          Number(row.realization_amount || 0) >
                          Number(row.plan_amount || 0)
                            ? "var(--alert-error-color)"
                            : "var(--text-h)",
                        fontWeight:
                          Number(row.realization_amount || 0) >
                          Number(row.plan_amount || 0)
                            ? 700
                            : 400,
                      }}
                    >
                      {formatCurrency(row.realization_amount)}
                    </td>
                    <td style={{ ...tableBodyCellStyle, textAlign: "right", fontWeight: 700 }}>
                      {Number(row.progress_percentage || 0).toFixed(2)}%
                    </td>
                    <td style={tableBodyCellStyle}>
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: Number(row.warning_count || 0) > 0 ? "warning" : "muted",
                          size: "sm",
                        })}
                      >
                        {Number(row.warning_count || 0)}
                      </div>
                    </td>
                    <td style={tableBodyCellStyle}>
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: Number(row.deviation_count || 0) > 0 ? "danger" : "muted",
                          size: "sm",
                        })}
                      >
                        {Number(row.deviation_count || 0)}
                      </div>
                    </td>
                    <td style={tableBodyCellStyle}>
                      <div
                        style={getChipStyle(prefersDarkMode, {
                          tone: statusMeta.tone,
                          size: "sm",
                        })}
                      >
                        {statusMeta.label}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      ...tableBodyCellStyle,
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Tidak ada Sub Kegiatan bermasalah.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function BudgetDashboardPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [fiscalYearOptions, setFiscalYearOptions] = useState([]);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState("");
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [filterErrorMessage, setFilterErrorMessage] = useState("");
  const [dashboardState, setDashboardState] = useState({
    rakVersion: null,
    rows: [],
    summary: null,
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const selectedFiscalYearIdRef = useRef("");
  const selectedRakVersionIdRef = useRef("");
  const dashboardRequestKeyRef = useRef("");

  useEffect(() => {
    selectedFiscalYearIdRef.current = selectedFiscalYearId;
  }, [selectedFiscalYearId]);

  useEffect(() => {
    selectedRakVersionIdRef.current = selectedRakVersionId;
  }, [selectedRakVersionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadFiscalYears() {
      setLoadingFilters(true);
      setFilterErrorMessage("");

      try {
        const fiscalYears = await getBudgetYears();

        if (!isMounted) {
          return;
        }

        const defaultFiscalYear = resolveDefaultFiscalYear(fiscalYears);
        setFiscalYearOptions(fiscalYears);
        setSelectedFiscalYearId((currentValue) =>
          currentValue || defaultFiscalYear?.id || ""
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFilterErrorMessage(
          error?.message || "Gagal memuat daftar fiscal year."
        );
      } finally {
        if (isMounted) {
          setLoadingFilters(false);
        }
      }
    }

    loadFiscalYears();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadVersions() {
      if (!selectedFiscalYearId) {
        setVersionOptions([]);
        setSelectedRakVersionId("");
        return;
      }

      setLoadingFilters(true);
      setFilterErrorMessage("");

      try {
        const [versions, preferredActiveVersion] = await Promise.all([
          getRakVersions({ fiscalYearId: selectedFiscalYearId }),
          getPreferredActiveRakVersion(selectedFiscalYearId),
        ]);

        if (!isMounted) {
          return;
        }

        const sortedVersions = sortVersionsDescending(versions);
        setVersionOptions(sortedVersions);
        setSelectedRakVersionId((currentValue) => {
          const currentExists = sortedVersions.some(
            (version) => version.id === currentValue
          );

          if (currentExists) {
            return currentValue;
          }

          return preferredActiveVersion?.id || sortedVersions[0]?.id || "";
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setVersionOptions([]);
        setSelectedRakVersionId("");
        setFilterErrorMessage(error?.message || "Gagal memuat daftar versi RAK.");
      } finally {
        if (isMounted) {
          setLoadingFilters(false);
        }
      }
    }

    loadVersions();

    return () => {
      isMounted = false;
    };
  }, [selectedFiscalYearId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!selectedFiscalYearId || !selectedRakVersionId) {
        dashboardRequestKeyRef.current = "";
        setDashboardState({
          rakVersion: null,
          rows: [],
          summary: null,
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      const requestKey = `${selectedRakVersionId}:dashboard-v1`;
      dashboardRequestKeyRef.current = requestKey;
      setDashboardState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
        warnings: [],
      }));

      try {
        const result = await getBudgetTrackingProgress(
          selectedRakVersionId,
          selectedFiscalYearId
        );

        if (
          !isMounted ||
          dashboardRequestKeyRef.current !== requestKey ||
          selectedRakVersionIdRef.current !== selectedRakVersionId ||
          selectedFiscalYearIdRef.current !== selectedFiscalYearId
        ) {
          return;
        }

        setDashboardState({
          rakVersion: result.rakVersion,
          rows: result.rows || [],
          summary: result.summary
            ? {
                total_plan: Number(result.summary.total_plan || 0),
                total_realization: Number(result.summary.total_realization || 0),
                absorption_percent: Number(result.summary.overall_percentage || 0),
                warning_count: Number(result.summary.total_warning_count || 0),
                deviation_count: Number(result.summary.total_deviation_count || 0),
                overspend_count: (result.rows || []).filter(
                  (row) =>
                    Number(row.realization_amount || 0) >
                    Number(row.plan_amount || 0)
                ).length,
              }
            : null,
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (
          !isMounted ||
          dashboardRequestKeyRef.current !== requestKey ||
          selectedRakVersionIdRef.current !== selectedRakVersionId ||
          selectedFiscalYearIdRef.current !== selectedFiscalYearId
        ) {
          return;
        }

        setDashboardState({
          rakVersion: null,
          rows: [],
          summary: null,
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
  }, [selectedFiscalYearId, selectedRakVersionId]);

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      dashboardState.rakVersion ||
      null,
    [dashboardState.rakVersion, selectedRakVersionId, versionOptions]
  );

  const selectedFiscalYear = useMemo(
    () =>
      fiscalYearOptions.find((year) => year.id === selectedFiscalYearId) || null,
    [fiscalYearOptions, selectedFiscalYearId]
  );

  const healthMeta = useMemo(
    () => getHealthMeta(dashboardState.summary),
    [dashboardState.summary]
  );

  const topProblematicRows = useMemo(() => {
    return [...(dashboardState.rows || [])]
      .filter((row) => {
        const isOverspend =
          Number(row.realization_amount || 0) > Number(row.plan_amount || 0);
        return (
          isOverspend ||
          Number(row.warning_count || 0) > 0 ||
          Number(row.deviation_count || 0) > 0
        );
      })
      .sort((leftRow, rightRow) => {
        const leftScore = getIssueSortScore(leftRow);
        const rightScore = getIssueSortScore(rightRow);

        if (rightScore.overspendRank !== leftScore.overspendRank) {
          return rightScore.overspendRank - leftScore.overspendRank;
        }

        if (rightScore.signalCount !== leftScore.signalCount) {
          return rightScore.signalCount - leftScore.signalCount;
        }

        if (rightScore.deviationAmount !== leftScore.deviationAmount) {
          return rightScore.deviationAmount - leftScore.deviationAmount;
        }

        return (
          Number(rightRow.progress_percentage || 0) -
          Number(leftRow.progress_percentage || 0)
        );
      })
      .slice(0, 5);
  }, [dashboardState.rows]);

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>DASHBOARD ANGGARAN</h1>
        <div style={getPageSubtitleStyle()}>
          Ringkasan kesehatan anggaran berbasis data tracking existing, tetap
          read-only dan fokus pada issue yang perlu diprioritaskan.
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
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Tahun Anggaran</span>
            <select
              value={selectedFiscalYearId}
              onChange={(event) => setSelectedFiscalYearId(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={loadingFilters || fiscalYearOptions.length === 0}
            >
              <option value="">
                {loadingFilters ? "Memuat tahun anggaran..." : "Pilih tahun anggaran"}
              </option>
              {fiscalYearOptions.map((fiscalYear) => (
                <option key={fiscalYear.id} value={fiscalYear.id}>
                  {fiscalYear.year}
                  {fiscalYear.is_active ? " (Aktif)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Versi RAK</span>
            <select
              value={selectedRakVersionId}
              onChange={(event) => setSelectedRakVersionId(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={
                loadingFilters || !selectedFiscalYearId || versionOptions.length === 0
              }
            >
              <option value="">
                {loadingFilters ? "Memuat versi RAK..." : "Pilih versi RAK"}
              </option>
              {versionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  V{version.version_number} | {version.title || version.code} |{" "}
                  {version.status}
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
              <div style={getMetaLabelStyle(prefersDarkMode)}>Konteks</div>
              <div style={getTableCellLabelTypography()}>
                {selectedVersion?.title || selectedVersion?.code || "Belum ada versi"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Tahun Anggaran: {selectedFiscalYear?.year || "-"}
              </div>
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

        {filterErrorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {filterErrorMessage}
          </div>
        ) : null}

        {dashboardState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {dashboardState.warnings.join(" ")}
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
          Belum ada data.
        </div>
      ) : null}

      {!dashboardState.isLoading &&
      !dashboardState.errorMessage &&
      dashboardState.summary ? (
        <>
          <section
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
              <div style={getMetaLabelStyle(prefersDarkMode)}>Persen Penyerapan</div>
              <div style={getTableCellLabelTypography()}>
                {Number(dashboardState.summary.absorption_percent || 0).toFixed(2)}%
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
              <div style={getMetaLabelStyle(prefersDarkMode)}>Warning Count</div>
              <div style={getTableCellLabelTypography()}>
                {Number(dashboardState.summary.warning_count || 0)}
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
              <div style={getMetaLabelStyle(prefersDarkMode)}>Deviation Count</div>
              <div style={getTableCellLabelTypography()}>
                {Number(dashboardState.summary.deviation_count || 0)}
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
              <div style={getMetaLabelStyle(prefersDarkMode)}>Overspend Count</div>
              <div style={getTableCellLabelTypography()}>
                {Number(dashboardState.summary.overspend_count || 0)}
              </div>
            </div>
          </section>

          <section
            style={{
              ...getPanelStyle({ padding: 16, borderRadius: 12 }),
              display: "grid",
              gap: 10,
            }}
          >
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
                <div style={getMetaLabelStyle(prefersDarkMode)}>Health Summary</div>
                <div style={getTableCellLabelTypography()}>{healthMeta.label}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {healthMeta.description}
                </div>
              </div>
              <div
                style={getChipStyle(prefersDarkMode, {
                  tone: healthMeta.tone,
                  size: "md",
                })}
              >
                {healthMeta.label}
              </div>
            </div>
          </section>

          {topProblematicRows.length > 0 ? (
            <DashboardIssueTable
              prefersDarkMode={prefersDarkMode}
              rows={topProblematicRows}
            />
          ) : (
            <div style={getEmptyStateStyle(prefersDarkMode)}>
              Tidak ada Sub Kegiatan bermasalah.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
