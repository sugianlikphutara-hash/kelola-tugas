import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  getAlertStyle,
  getChipStyle,
  getEmptyStateStyle,
  getInlineActionButtonStyle,
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

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "Semua" },
  { value: "AMAN", label: "Aman" },
  { value: "BELUM_TERSERAP", label: "Belum terserap" },
  { value: "OVERSPEND", label: "Overspend" },
  { value: "TANPA_ANGGARAN", label: "Tanpa anggaran" },
];

const SORT_OPTIONS = [
  { value: "PLAN_DESC", label: "Plan terbesar" },
  { value: "REALIZATION_DESC", label: "Realisasi terbesar" },
  { value: "ABSORPTION_DESC", label: "Serapan tertinggi" },
  { value: "ABSORPTION_ASC", label: "Serapan terendah" },
  { value: "OVERSPEND_FIRST", label: "Overspend dulu" },
];

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

function getRowPlanAmount(row) {
  return Number(row?.plan_amount ?? row?.annual_plan ?? 0);
}

function getRowRealizationAmount(row) {
  return Number(row?.realization_amount ?? row?.annual_realization ?? 0);
}

function getBudgetReportStatus(row) {
  const planAmount = getRowPlanAmount(row);
  const realizationAmount = getRowRealizationAmount(row);

  if (realizationAmount > planAmount) {
    return { key: "OVERSPEND", label: "Overspend", tone: "danger" };
  }

  if (realizationAmount === 0 && planAmount > 0) {
    return { key: "BELUM_TERSERAP", label: "Belum terserap", tone: "muted" };
  }

  if (planAmount === 0) {
    return { key: "TANPA_ANGGARAN", label: "Tanpa anggaran", tone: "muted" };
  }

  return { key: "AMAN", label: "Aman", tone: "success" };
}

function getSafeFileSegment(value) {
  return String(value || "-")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
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
    detailRows: [],
    summary: null,
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState("PLAN_DESC");
  const [expandedSubActivityIds, setExpandedSubActivityIds] = useState({});
  const [detailStateBySubActivity, setDetailStateBySubActivity] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");
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
          detailRows: [],
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
          detailRows: result.detailRows || [],
          summary: result.summary || null,
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
        setExpandedSubActivityIds({});
        setDetailStateBySubActivity({});
      } catch (error) {
        if (!isMounted || requestKeyRef.current !== requestKey) {
          return;
        }

        setReportState({
          rows: [],
          detailRows: [],
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

  const filteredRows = useMemo(() => {
    const rows = [...(reportState.rows || [])];
    const filtered =
      statusFilter === "ALL"
        ? rows
        : rows.filter((row) => getBudgetReportStatus(row).key === statusFilter);

    return filtered.sort((leftRow, rightRow) => {
      const leftPlan = getRowPlanAmount(leftRow);
      const rightPlan = getRowPlanAmount(rightRow);
      const leftRealization = getRowRealizationAmount(leftRow);
      const rightRealization = getRowRealizationAmount(rightRow);
      const leftAbsorption = getAbsorptionPercent(leftPlan, leftRealization);
      const rightAbsorption = getAbsorptionPercent(rightPlan, rightRealization);
      const leftOverspend = leftRealization > leftPlan ? 1 : 0;
      const rightOverspend = rightRealization > rightPlan ? 1 : 0;

      if (sortMode === "REALIZATION_DESC") {
        return rightRealization - leftRealization;
      }

      if (sortMode === "ABSORPTION_DESC") {
        return rightAbsorption - leftAbsorption;
      }

      if (sortMode === "ABSORPTION_ASC") {
        return leftAbsorption - rightAbsorption;
      }

      if (sortMode === "OVERSPEND_FIRST") {
        if (rightOverspend !== leftOverspend) {
          return rightOverspend - leftOverspend;
        }

        return rightRealization - leftRealization;
      }

      return rightPlan - leftPlan;
    });
  }, [reportState.rows, sortMode, statusFilter]);

  const summary = useMemo(() => {
    const rows = filteredRows || [];
    const totalPlan = rows.reduce(
      (total, row) => total + getRowPlanAmount(row),
      0
    );
    const totalRealization = rows.reduce(
      (total, row) => total + getRowRealizationAmount(row),
      0
    );
    const totalWarning = rows.reduce(
      (total, row) => total + Number(row.warning_count || 0),
      0
    );
    const overspendCount = rows.filter(
      (row) => getRowRealizationAmount(row) > getRowPlanAmount(row)
    ).length;

    return {
      totalPlan,
      totalRealization,
      absorptionPercent: getAbsorptionPercent(totalPlan, totalRealization),
      subActivityCount: rows.length,
      warningCount: totalWarning,
      overspendCount,
    };
  }, [filteredRows]);

  const tableBodyCellStyle = getTableBodyCellStyle({ padding: "12px 14px" });

  function getDetailRowsForSubActivity(subActivityId) {
    return (reportState.detailRows || []).filter(
      (row) => String(row.sub_activity_id || "") === String(subActivityId || "")
    );
  }

  function handleToggleExpand(row) {
    const subActivityId = row.sub_activity_id;

    if (!subActivityId) {
      return;
    }

    if (expandedSubActivityIds[subActivityId]) {
      setExpandedSubActivityIds((currentState) => ({
        ...currentState,
        [subActivityId]: false,
      }));
      return;
    }

    setExpandedSubActivityIds((currentState) => ({
      ...currentState,
      [subActivityId]: true,
    }));
    setDetailStateBySubActivity((currentState) => ({
      ...currentState,
      [subActivityId]: {
        rows: [],
        isLoading: true,
        errorMessage: "",
      },
    }));

    window.setTimeout(() => {
      try {
        setDetailStateBySubActivity((currentState) => ({
          ...currentState,
          [subActivityId]: {
            rows: getDetailRowsForSubActivity(subActivityId),
            isLoading: false,
            errorMessage: "",
          },
        }));
      } catch (error) {
        setDetailStateBySubActivity((currentState) => ({
          ...currentState,
          [subActivityId]: {
            rows: [],
            isLoading: false,
            errorMessage:
              error?.message || "Gagal memuat detail akun belanja.",
          },
        }));
      }
    }, 0);
  }

  async function handleExportExcel() {
    if (!selectedVersion?.id) {
      return;
    }

    setIsExporting(true);
    setExportErrorMessage("");

    try {
      const XLSX = await import("xlsx");
      const filteredSubActivityIds = new Set(
        filteredRows.map((row) => String(row.sub_activity_id || ""))
      );
      const detailRows = (reportState.detailRows || []).filter((row) =>
        filteredSubActivityIds.has(String(row.sub_activity_id || ""))
      );
      const rowsToExport = detailRows.length > 0 ? detailRows : filteredRows;
      const worksheetRows = rowsToExport.map((row) => {
        const planAmount = getRowPlanAmount(row);
        const realizationAmount = getRowRealizationAmount(row);
        const balanceAmount = planAmount - realizationAmount;
        const status = getBudgetReportStatus(row);
        const isDetailRow = Boolean(row.budget_account_id || row.budget_account_code);

        return {
          "Tahun Anggaran": selectedFiscalYear?.year || "",
          "Versi RAK": selectedVersion?.code || "",
          "Kode Sub Kegiatan": row.sub_activity_code || "",
          "Nama Sub Kegiatan": row.sub_activity_name || "",
          "Level": isDetailRow ? "Akun Belanja" : "Sub Kegiatan",
          "Kode Akun": isDetailRow ? row.budget_account_code || "" : "",
          "Nama Akun": isDetailRow ? row.budget_account_name || "" : "",
          "Total Plan": planAmount,
          "Total Realisasi": realizationAmount,
          "Sisa Anggaran": balanceAmount,
          "Persentase Serapan": getAbsorptionPercent(
            planAmount,
            realizationAmount
          ),
          Status: status.label,
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      worksheet["!cols"] = [
        { wch: 16 },
        { wch: 24 },
        { wch: 20 },
        { wch: 34 },
        { wch: 16 },
        { wch: 18 },
        { wch: 34 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Anggaran");
      XLSX.writeFile(
        workbook,
        `laporan-anggaran-${getSafeFileSegment(
          selectedFiscalYear?.year
        )}-${getSafeFileSegment(selectedVersion?.code)}.xlsx`
      );
    } catch (error) {
      setExportErrorMessage(error?.message || "Gagal export laporan anggaran.");
    } finally {
      setIsExporting(false);
    }
  }

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

        {exportErrorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {exportErrorMessage}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Urutkan</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleExportExcel}
              style={getInlineActionButtonStyle(prefersDarkMode, {
                isEnabled:
                  !isExporting &&
                  !reportState.isLoading &&
                  Boolean(selectedRakVersionId),
                tone: "accent",
                height: 42,
              })}
              disabled={
                isExporting ||
                reportState.isLoading ||
                !selectedRakVersionId
              }
            >
              {isExporting ? "Mengekspor..." : "Export Excel"}
            </button>
          </div>
        </div>

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
      filteredRows.length === 0 ? (
        <div style={getEmptyStateStyle(prefersDarkMode)}>
          Belum ada data laporan anggaran untuk filter ini.
        </div>
      ) : null}

      {!reportState.isLoading &&
      !reportState.errorMessage &&
      filteredRows.length > 0 ? (
        <div style={getTableFrameStyle()}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1160 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...getTableHeaderCellStyle({
                        label: "Detail",
                        alignMode: 3,
                      }),
                      width: 64,
                      textAlign: "center",
                    }}
                  >
                    Detail
                  </th>
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
                {filteredRows.map((row) => {
                  const planAmount = Number(row.plan_amount || 0);
                  const realizationAmount = Number(row.realization_amount || 0);
                  const balanceAmount = planAmount - realizationAmount;
                  const status = getBudgetReportStatus(row);
                  const isExpanded = Boolean(
                    expandedSubActivityIds[row.sub_activity_id]
                  );
                  const detailState = detailStateBySubActivity[
                    row.sub_activity_id
                  ] || {
                    rows: [],
                    isLoading: false,
                    errorMessage: "",
                  };
                  const expandedParentCellStyle = isExpanded
                    ? { borderBottom: "1px solid var(--border-strong)" }
                    : null;

                  return (
                    <Fragment key={`${row.rak_version_id}:${row.sub_activity_id}`}>
                      <tr>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "center",
                            ...expandedParentCellStyle,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(row)}
                            title="Lihat detail akun"
                            aria-label="Lihat detail akun"
                            style={{
                              minWidth: 34,
                              minHeight: 34,
                              fontSize: 18,
                              lineHeight: 1,
                              borderRadius: 8,
                              border: "1px solid var(--control-border)",
                              background: "var(--surface-1)",
                              color: "var(--text-h)",
                              cursor: "pointer",
                            }}
                          >
                            {isExpanded ? "-" : "+"}
                          </button>
                        </td>
                        <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                          {row.sub_activity_code || "-"}
                        </td>
                        <td style={{ ...tableBodyCellStyle, ...expandedParentCellStyle }}>
                          {row.sub_activity_name || "-"}
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "right",
                            ...expandedParentCellStyle,
                          }}
                        >
                          {formatCurrency(planAmount)}
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "right",
                            ...expandedParentCellStyle,
                          }}
                        >
                          {formatCurrency(realizationAmount)}
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "right",
                            ...expandedParentCellStyle,
                          }}
                        >
                          {formatCurrency(balanceAmount)}
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "right",
                            ...expandedParentCellStyle,
                          }}
                        >
                          {formatPercent(
                            getAbsorptionPercent(planAmount, realizationAmount)
                          )}
                        </td>
                        <td
                          style={{
                            ...tableBodyCellStyle,
                            textAlign: "center",
                            ...expandedParentCellStyle,
                          }}
                        >
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

                      {isExpanded ? (
                        <tr>
                          <td
                            colSpan={8}
                            style={{
                              ...tableBodyCellStyle,
                              padding: "0 18px 18px 78px",
                              background: "var(--surface-1)",
                            }}
                          >
                            {detailState.isLoading ? (
                              <div style={getLoadingStateStyle(prefersDarkMode)}>
                                Memuat detail akun belanja...
                              </div>
                            ) : null}

                            {!detailState.isLoading && detailState.errorMessage ? (
                              <div
                                style={getAlertStyle(prefersDarkMode, {
                                  tone: "error",
                                })}
                              >
                                {detailState.errorMessage}
                              </div>
                            ) : null}

                            {!detailState.isLoading &&
                            !detailState.errorMessage &&
                            detailState.rows.length === 0 ? (
                              <div style={getEmptyStateStyle(prefersDarkMode)}>
                                Belum ada detail akun belanja.
                              </div>
                            ) : null}

                            {!detailState.isLoading &&
                            !detailState.errorMessage &&
                            detailState.rows.length > 0 ? (
                              <div style={getTableFrameStyle({ borderRadius: 0 })}>
                                <div style={{ overflowX: "auto" }}>
                                  <table
                                    style={{
                                      width: "100%",
                                      borderCollapse: "collapse",
                                      minWidth: 920,
                                    }}
                                  >
                                    <thead>
                                      <tr>
                                        <th
                                          style={getTableHeaderCellStyle({
                                            label: "Kode Akun",
                                            alignMode: 3,
                                            isFirstColumn: true,
                                          })}
                                        >
                                          Kode Akun
                                        </th>
                                        <th
                                          style={getTableHeaderCellStyle({
                                            label: "Nama Akun",
                                            alignMode: 3,
                                          })}
                                        >
                                          Nama Akun
                                        </th>
                                        <th
                                          style={getTableHeaderCellStyle({
                                            label: "Total Plan",
                                            alignMode: 3,
                                          })}
                                        >
                                          Total Plan
                                        </th>
                                        <th
                                          style={getTableHeaderCellStyle({
                                            label: "Total Realisasi",
                                            alignMode: 3,
                                          })}
                                        >
                                          Total Realisasi
                                        </th>
                                        <th
                                          style={getTableHeaderCellStyle({
                                            label: "Sisa Anggaran",
                                            alignMode: 3,
                                          })}
                                        >
                                          Sisa Anggaran
                                        </th>
                                        <th
                                          style={getTableHeaderCellStyle({
                                            label: "Persentase Serapan",
                                            alignMode: 3,
                                          })}
                                        >
                                          Persentase Serapan
                                        </th>
                                        <th
                                          style={{
                                            ...getTableHeaderCellStyle({
                                              label: "Status",
                                              alignMode: 3,
                                            }),
                                            textAlign: "center",
                                          }}
                                        >
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailState.rows.map((detailRow) => {
                                        const detailPlanAmount =
                                          getRowPlanAmount(detailRow);
                                        const detailRealizationAmount =
                                          getRowRealizationAmount(detailRow);
                                        const detailStatus =
                                          getBudgetReportStatus(detailRow);

                                        return (
                                          <tr
                                            key={`${detailRow.sub_activity_id}:${detailRow.budget_account_id}`}
                                          >
                                            <td style={tableBodyCellStyle}>
                                              {detailRow.budget_account_code || "-"}
                                            </td>
                                            <td style={tableBodyCellStyle}>
                                              {detailRow.budget_account_name || "-"}
                                            </td>
                                            <td
                                              style={{
                                                ...tableBodyCellStyle,
                                                textAlign: "right",
                                              }}
                                            >
                                              {formatCurrency(detailPlanAmount)}
                                            </td>
                                            <td
                                              style={{
                                                ...tableBodyCellStyle,
                                                textAlign: "right",
                                              }}
                                            >
                                              {formatCurrency(
                                                detailRealizationAmount
                                              )}
                                            </td>
                                            <td
                                              style={{
                                                ...tableBodyCellStyle,
                                                textAlign: "right",
                                              }}
                                            >
                                              {formatCurrency(
                                                detailPlanAmount -
                                                  detailRealizationAmount
                                              )}
                                            </td>
                                            <td
                                              style={{
                                                ...tableBodyCellStyle,
                                                textAlign: "right",
                                              }}
                                            >
                                              {formatPercent(
                                                getAbsorptionPercent(
                                                  detailPlanAmount,
                                                  detailRealizationAmount
                                                )
                                              )}
                                            </td>
                                            <td
                                              style={{
                                                ...tableBodyCellStyle,
                                                textAlign: "center",
                                              }}
                                            >
                                              <span
                                                style={getChipStyle(prefersDarkMode, {
                                                  tone: detailStatus.tone,
                                                  size: "sm",
                                                })}
                                              >
                                                {detailStatus.label}
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
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
