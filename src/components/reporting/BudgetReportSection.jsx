import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAlertStyle,
  getChipStyle,
  getEmptyStateStyle,
  getLoadingStateStyle,
  getMetaLabelStyle,
  getPanelStyle,
  getSelectStyle,
  getTableBodyCellStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getSectionTitleTypography,
} from "../../lib/controlStyles";
import { getBudgetYears } from "../../services/masterDataService";
import {
  getPreferredActiveRakVersion,
  getRakVersions,
} from "../../services/budgetRakService";
import { getBudgetTrackingProgress } from "../../services/budgetProgressService";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  const numericValue = Number(value || 0);
  return `${Number.isFinite(numericValue) ? numericValue.toFixed(2) : "0.00"}%`;
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

function getAbsorptionPercent(planAmount, realizationAmount) {
  const plan = Number(planAmount || 0);
  const realization = Number(realizationAmount || 0);

  if (plan <= 0) {
    return 0;
  }

  return (realization / plan) * 100;
}

function getBudgetReportStatus(row) {
  const planAmount = Number(row.plan_amount || 0);
  const realizationAmount = Number(row.realization_amount || 0);

  if (realizationAmount > planAmount) {
    return { label: "Overspend", tone: "danger" };
  }

  if (realizationAmount === 0 && planAmount > 0) {
    return { label: "Belum terserap", tone: "muted" };
  }

  if (planAmount === 0) {
    return { label: "Tanpa anggaran", tone: "muted" };
  }

  return { label: "Aman", tone: "success" };
}

function SummaryCard({ prefersDarkMode, label, value }) {
  return (
    <div
      style={{
        ...getPanelStyle({ padding: 16, borderRadius: 10 }),
        display: "grid",
        gap: 6,
      }}
    >
      <div style={getMetaLabelStyle(prefersDarkMode)}>{label}</div>
      <div style={getTableCellLabelTypography()}>{value}</div>
    </div>
  );
}

export default function BudgetReportSection({ prefersDarkMode }) {
  const [fiscalYearOptions, setFiscalYearOptions] = useState([]);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState("");
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [filterState, setFilterState] = useState({
    isLoading: true,
    errorMessage: "",
  });
  const [reportState, setReportState] = useState({
    rows: [],
    summary: null,
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const requestKeyRef = useRef("");

  useEffect(() => {
    let isMounted = true;

    async function loadFiscalYears() {
      setFilterState({ isLoading: true, errorMessage: "" });

      try {
        const fiscalYears = await getBudgetYears();

        if (!isMounted) {
          return;
        }

        const defaultFiscalYear = resolveDefaultFiscalYear(fiscalYears);
        setFiscalYearOptions(fiscalYears);
        setSelectedFiscalYearId(defaultFiscalYear?.id || "");
        setFilterState({ isLoading: false, errorMessage: "" });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFiscalYearOptions([]);
        setSelectedFiscalYearId("");
        setFilterState({
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat tahun anggaran.",
        });
      }
    }

    loadFiscalYears();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRakVersions() {
      if (!selectedFiscalYearId) {
        setVersionOptions([]);
        setSelectedRakVersionId("");
        return;
      }

      setFilterState({ isLoading: true, errorMessage: "" });

      try {
        const [versions, activeVersion] = await Promise.all([
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

          return activeVersion?.id || sortedVersions[0]?.id || "";
        });
        setFilterState({ isLoading: false, errorMessage: "" });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setVersionOptions([]);
        setSelectedRakVersionId("");
        setFilterState({
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat versi RAK.",
        });
      }
    }

    loadRakVersions();

    return () => {
      isMounted = false;
    };
  }, [selectedFiscalYearId]);

  useEffect(() => {
    let isMounted = true;

    async function loadBudgetReport() {
      if (!selectedFiscalYearId || !selectedRakVersionId) {
        requestKeyRef.current = "";
        setReportState({
          rows: [],
          summary: null,
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      const requestKey = `${selectedFiscalYearId}:${selectedRakVersionId}`;
      requestKeyRef.current = requestKey;
      setReportState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
      }));

      try {
        const result = await getBudgetTrackingProgress(
          selectedRakVersionId,
          selectedFiscalYearId
        );

        if (!isMounted || requestKeyRef.current !== requestKey) {
          return;
        }

        setReportState({
          rows: result.rows || [],
          summary: result.summary || null,
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (!isMounted || requestKeyRef.current !== requestKey) {
          return;
        }

        setReportState({
          rows: [],
          summary: null,
          warnings: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat laporan anggaran.",
        });
      }
    }

    loadBudgetReport();

    return () => {
      isMounted = false;
    };
  }, [selectedFiscalYearId, selectedRakVersionId]);

  const selectedFiscalYear = useMemo(
    () =>
      fiscalYearOptions.find((fiscalYear) => fiscalYear.id === selectedFiscalYearId) ||
      null,
    [fiscalYearOptions, selectedFiscalYearId]
  );

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) || null,
    [selectedRakVersionId, versionOptions]
  );

  const summary = useMemo(() => {
    const rows = reportState.rows || [];
    const totalPlan =
      reportState.summary?.total_plan ??
      rows.reduce((total, row) => total + Number(row.plan_amount || 0), 0);
    const totalRealization =
      reportState.summary?.total_realization ??
      rows.reduce((total, row) => total + Number(row.realization_amount || 0), 0);
    const totalWarning =
      reportState.summary?.total_warning_count ??
      rows.reduce((total, row) => total + Number(row.warning_count || 0), 0);
    const overspendCount = rows.filter(
      (row) => Number(row.realization_amount || 0) > Number(row.plan_amount || 0)
    ).length;

    return {
      totalPlan,
      totalRealization,
      absorptionPercent: getAbsorptionPercent(totalPlan, totalRealization),
      subActivityCount: rows.length,
      warningCount: totalWarning,
      overspendCount,
    };
  }, [reportState.rows, reportState.summary]);

  const tableBodyCellStyle = getTableBodyCellStyle({ padding: "12px 14px" });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={getSectionTitleTypography()}>Laporan Anggaran</div>
        <div style={getTableCellSubtitleTypography()}>
          Rekap tahunan Sub Kegiatan berdasarkan plan dan realisasi pada versi RAK
          terpilih.
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
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Tahun Anggaran</span>
            <select
              value={selectedFiscalYearId}
              onChange={(event) => setSelectedFiscalYearId(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={filterState.isLoading || fiscalYearOptions.length === 0}
            >
              <option value="">
                {filterState.isLoading ? "Memuat tahun..." : "Pilih tahun"}
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
                filterState.isLoading ||
                !selectedFiscalYearId ||
                versionOptions.length === 0
              }
            >
              <option value="">
                {filterState.isLoading ? "Memuat versi..." : "Pilih versi RAK"}
              </option>
              {versionOptions.map((version) => (
                <option key={version.id} value={version.id}>
                  V{version.version_number} | {version.title || version.code} |{" "}
                  {version.status}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={getMetaLabelStyle(prefersDarkMode)}>Konteks</div>
            <div style={getTableCellLabelTypography()}>
              Tahun {selectedFiscalYear?.year || "-"}
            </div>
            <div style={getTableCellSubtitleTypography()}>
              {selectedVersion
                ? `V${selectedVersion.version_number} - ${
                    selectedVersion.title || selectedVersion.code
                  }`
                : "Belum ada versi RAK"}
            </div>
          </div>
        </div>

        {filterState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {filterState.errorMessage}
          </div>
        ) : null}

        {reportState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {reportState.warnings.join(" ")}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <SummaryCard
            prefersDarkMode={prefersDarkMode}
            label="Total Plan"
            value={formatCurrency(summary.totalPlan)}
          />
          <SummaryCard
            prefersDarkMode={prefersDarkMode}
            label="Total Realisasi"
            value={formatCurrency(summary.totalRealization)}
          />
          <SummaryCard
            prefersDarkMode={prefersDarkMode}
            label="Persentase Serapan"
            value={formatPercent(summary.absorptionPercent)}
          />
          <SummaryCard
            prefersDarkMode={prefersDarkMode}
            label="Sub Kegiatan"
            value={summary.subActivityCount}
          />
          <SummaryCard
            prefersDarkMode={prefersDarkMode}
            label="Warning"
            value={summary.warningCount}
          />
          <SummaryCard
            prefersDarkMode={prefersDarkMode}
            label="Overspend"
            value={summary.overspendCount}
          />
        </div>
      </section>

      {reportState.isLoading ? (
        <div style={getLoadingStateStyle(prefersDarkMode)}>
          Memuat laporan anggaran...
        </div>
      ) : null}

      {!reportState.isLoading && reportState.errorMessage ? (
        <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
          {reportState.errorMessage}
        </div>
      ) : null}

      {!reportState.isLoading &&
      !reportState.errorMessage &&
      reportState.rows.length === 0 ? (
        <div style={getEmptyStateStyle(prefersDarkMode)}>
          Belum ada data laporan anggaran untuk konteks ini.
        </div>
      ) : null}

      {!reportState.isLoading &&
      !reportState.errorMessage &&
      reportState.rows.length > 0 ? (
        <div style={getTableFrameStyle()}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({
                        label: "Kode Sub Kegiatan",
                        alignMode: 3,
                        isFirstColumn: true,
                      }),
                      width: 180,
                    }}
                  >
                    Kode Sub Kegiatan
                  </th>
                  <th
                    style={getTableHeaderCellStyle({
                      label: "Nama Sub Kegiatan",
                      alignMode: 3,
                    })}
                  >
                    Nama Sub Kegiatan
                  </th>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({ label: "Total Plan", alignMode: 3 }),
                      width: 170,
                    }}
                  >
                    Total Plan
                  </th>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({
                        label: "Total Realisasi",
                        alignMode: 3,
                      }),
                      width: 170,
                    }}
                  >
                    Total Realisasi
                  </th>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({
                        label: "Sisa Anggaran",
                        alignMode: 3,
                      }),
                      width: 170,
                    }}
                  >
                    Sisa Anggaran
                  </th>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({
                        label: "Persentase Serapan",
                        alignMode: 3,
                      }),
                      width: 170,
                    }}
                  >
                    Persentase Serapan
                  </th>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({ label: "Status", alignMode: 3 }),
                      width: 150,
                      textAlign: "center",
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportState.rows.map((row) => {
                  const planAmount = Number(row.plan_amount || 0);
                  const realizationAmount = Number(row.realization_amount || 0);
                  const balanceAmount = planAmount - realizationAmount;
                  const status = getBudgetReportStatus(row);

                  return (
                    <tr key={`${row.rak_version_id}:${row.sub_activity_id}`}>
                      <td style={tableBodyCellStyle}>
                        {row.sub_activity_code || "-"}
                      </td>
                      <td style={tableBodyCellStyle}>
                        {row.sub_activity_name || "-"}
                      </td>
                      <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                        {formatCurrency(planAmount)}
                      </td>
                      <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                        {formatCurrency(realizationAmount)}
                      </td>
                      <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                        {formatCurrency(balanceAmount)}
                      </td>
                      <td style={{ ...tableBodyCellStyle, textAlign: "right" }}>
                        {formatPercent(
                          getAbsorptionPercent(planAmount, realizationAmount)
                        )}
                      </td>
                      <td style={{ ...tableBodyCellStyle, textAlign: "center" }}>
                        <span
                          style={getChipStyle(prefersDarkMode, {
                            tone: status.tone,
                            size: "sm",
                          })}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
