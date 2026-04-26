import { useEffect, useMemo, useRef, useState } from "react";
import BudgetTrackingTable from "../components/budgeting/BudgetTrackingTable";
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
  getSubPageButtonStyle,
  getTableCellLabelTypography,
} from "../lib/controlStyles";
import { getBudgetYears } from "../services/masterDataService";
import { getBudgetTrackingProgress } from "../services/budgetProgressService";
import {
  getPreferredActiveRakVersion,
  getRakVersions,
} from "../services/budgetRakService";
import { getBudgetTrackingDetailBySubActivity } from "../services/budgetProgressService";

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

const TRACKING_FILTER_OPTIONS = [
  { key: "ALL", label: "Semua" },
  { key: "WARNING", label: "Warning" },
  { key: "DEVIATION", label: "Deviation" },
  { key: "OVERSPEND", label: "Overspend" },
];

const TRACKING_SORT_OPTIONS = [
  { key: "PROGRESS_DESC", label: "Progress tertinggi" },
  { key: "PROGRESS_ASC", label: "Progress terendah" },
  { key: "DEVIATION_DESC", label: "Deviation terbesar" },
  { key: "WARNING_DESC", label: "Warning terbanyak" },
];

function getRowDeviationAmount(row) {
  if (row?.deviation_amount !== undefined && row?.deviation_amount !== null) {
    return Math.abs(Number(row.deviation_amount || 0));
  }

  return Math.abs(
    Number(row?.realization_amount || 0) - Number(row?.plan_amount || 0)
  );
}

export default function BudgetTrackingPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [fiscalYearOptions, setFiscalYearOptions] = useState([]);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState("");
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [activeFilterKey, setActiveFilterKey] = useState("ALL");
  const [activeSortKey, setActiveSortKey] = useState("PROGRESS_DESC");
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [filterErrorMessage, setFilterErrorMessage] = useState("");
  const [trackingState, setTrackingState] = useState({
    rakVersion: null,
    rows: [],
    summary: {
      total_plan: 0,
      total_realization: 0,
      overall_percentage: 0,
      total_warning_count: 0,
      total_deviation_count: 0,
    },
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const [expandedSubActivityIds, setExpandedSubActivityIds] = useState({});
  const [detailStateBySubActivity, setDetailStateBySubActivity] = useState({});
  const selectedFiscalYearIdRef = useRef("");
  const selectedRakVersionIdRef = useRef("");
  const trackingRequestKeyRef = useRef("");
  const detailRequestKeyRef = useRef({});

  useEffect(() => {
    selectedFiscalYearIdRef.current = selectedFiscalYearId;
  }, [selectedFiscalYearId]);

  useEffect(() => {
    selectedRakVersionIdRef.current = selectedRakVersionId;
  }, [selectedRakVersionId]);

  useEffect(() => {
    setExpandedSubActivityIds({});
    setDetailStateBySubActivity({});
    detailRequestKeyRef.current = {};
  }, [selectedFiscalYearId, selectedRakVersionId]);

  useEffect(() => {
    setExpandedSubActivityIds({});
  }, [activeFilterKey, activeSortKey]);

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

    async function loadTracking() {
      if (!selectedFiscalYearId || !selectedRakVersionId) {
        trackingRequestKeyRef.current = "";
        setTrackingState({
          rakVersion: null,
          rows: [],
          summary: {
            total_plan: 0,
            total_realization: 0,
            overall_percentage: 0,
            total_warning_count: 0,
            total_deviation_count: 0,
          },
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      const requestKey = `${selectedRakVersionId}:tracking`;
      trackingRequestKeyRef.current = requestKey;
      setTrackingState((currentState) => ({
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
          trackingRequestKeyRef.current !== result.requestKey ||
          selectedRakVersionIdRef.current !== selectedRakVersionId ||
          selectedFiscalYearIdRef.current !== selectedFiscalYearId
        ) {
          return;
        }

        setTrackingState({
          rakVersion: result.rakVersion,
          rows: result.rows || [],
          summary: result.summary || {
            total_plan: 0,
            total_realization: 0,
            overall_percentage: 0,
            total_warning_count: 0,
            total_deviation_count: 0,
          },
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (
          !isMounted ||
          trackingRequestKeyRef.current !== requestKey ||
          selectedRakVersionIdRef.current !== selectedRakVersionId ||
          selectedFiscalYearIdRef.current !== selectedFiscalYearId
        ) {
          return;
        }

        setTrackingState({
          rakVersion: null,
          rows: [],
          summary: {
            total_plan: 0,
            total_realization: 0,
            overall_percentage: 0,
            total_warning_count: 0,
            total_deviation_count: 0,
          },
          warnings: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat tracking anggaran.",
        });
      }
    }

    loadTracking();

    return () => {
      isMounted = false;
    };
  }, [selectedFiscalYearId, selectedRakVersionId]);

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      trackingState.rakVersion ||
      null,
    [selectedRakVersionId, trackingState.rakVersion, versionOptions]
  );

  const selectedFiscalYear = useMemo(
    () =>
      fiscalYearOptions.find((year) => year.id === selectedFiscalYearId) || null,
    [fiscalYearOptions, selectedFiscalYearId]
  );

  const derivedTrackingSummary = useMemo(() => {
    return trackingState.rows.reduce(
      (accumulator, row) => {
        const isOverspend =
          Number(row.realization_amount || 0) > Number(row.plan_amount || 0);
        const isProblematic =
          Number(row.warning_count || 0) > 0 ||
          Number(row.deviation_count || 0) > 0 ||
          isOverspend;

        return {
          problematic_sub_activity_count:
            accumulator.problematic_sub_activity_count + (isProblematic ? 1 : 0),
          overspend_count: accumulator.overspend_count + (isOverspend ? 1 : 0),
        };
      },
      {
        problematic_sub_activity_count: 0,
        overspend_count: 0,
      }
    );
  }, [trackingState.rows]);

  const displayedRows = useMemo(() => {
    const filteredRows = trackingState.rows.filter((row) => {
      const isOverspend =
        Number(row.realization_amount || 0) > Number(row.plan_amount || 0);

      if (activeFilterKey === "WARNING") {
        return Number(row.warning_count || 0) > 0;
      }

      if (activeFilterKey === "DEVIATION") {
        return Number(row.deviation_count || 0) > 0;
      }

      if (activeFilterKey === "OVERSPEND") {
        return isOverspend;
      }

      return true;
    });

    return [...filteredRows].sort((leftRow, rightRow) => {
      if (activeSortKey === "PROGRESS_ASC") {
        return (
          Number(leftRow.progress_percentage || 0) -
          Number(rightRow.progress_percentage || 0)
        );
      }

      if (activeSortKey === "DEVIATION_DESC") {
        return getRowDeviationAmount(rightRow) - getRowDeviationAmount(leftRow);
      }

      if (activeSortKey === "WARNING_DESC") {
        return Number(rightRow.warning_count || 0) - Number(leftRow.warning_count || 0);
      }

      return (
        Number(rightRow.progress_percentage || 0) -
        Number(leftRow.progress_percentage || 0)
      );
    });
  }, [activeFilterKey, activeSortKey, trackingState.rows]);

  async function handleToggleExpand(row) {
    const subActivityId = row?.sub_activity_id;

    if (!subActivityId) {
      return;
    }

    const nextExpanded = !expandedSubActivityIds[subActivityId];

    setExpandedSubActivityIds((currentState) => ({
      ...currentState,
      [subActivityId]: nextExpanded,
    }));

    if (!nextExpanded) {
      return;
    }

    const existingDetailState = detailStateBySubActivity[subActivityId];

    if (existingDetailState?.rows?.length || existingDetailState?.isLoading) {
      return;
    }

    const requestKey = `${selectedRakVersionId}:${subActivityId}:tracking-detail`;
    detailRequestKeyRef.current[subActivityId] = requestKey;

    setDetailStateBySubActivity((currentState) => ({
      ...currentState,
      [subActivityId]: {
        rows: [],
        isLoading: true,
        errorMessage: "",
      },
    }));

    try {
      const result = await getBudgetTrackingDetailBySubActivity(
        selectedRakVersionId,
        subActivityId
      );

      if (
        selectedRakVersionIdRef.current !== selectedRakVersionId ||
        detailRequestKeyRef.current[subActivityId] !== result.requestKey
      ) {
        return;
      }

      setDetailStateBySubActivity((currentState) => ({
        ...currentState,
        [subActivityId]: {
          rows: result.rows || [],
          isLoading: false,
          errorMessage: "",
        },
      }));
    } catch (error) {
      if (
        selectedRakVersionIdRef.current !== selectedRakVersionId ||
        detailRequestKeyRef.current[subActivityId] !== requestKey
      ) {
        return;
      }

      setDetailStateBySubActivity((currentState) => ({
        ...currentState,
        [subActivityId]: {
          rows: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat detail tracking sub kegiatan.",
        },
      }));
    }
  }

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>BUDGET TRACKING</h1>
        <div style={getPageSubtitleStyle()}>
          Monitoring plan versus realisasi per Sub Kegiatan untuk versi RAK yang
          dipilih, tetap read-only dan memakai data progress summary existing.
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

        {trackingState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {trackingState.warnings.join(" ")}
          </div>
        ) : null}

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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Sub Kegiatan</div>
            <div style={getTableCellLabelTypography()}>{trackingState.rows.length}</div>
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Plan</div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(trackingState.summary.total_plan)}
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
              {formatCurrency(trackingState.summary.total_realization)}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Overall Percentage</div>
            <div style={getTableCellLabelTypography()}>
              {Number(trackingState.summary.overall_percentage || 0).toFixed(2)}%
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Warning</div>
            <div style={getTableCellLabelTypography()}>
              {Number(trackingState.summary.total_warning_count || 0)}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Deviation</div>
            <div style={getTableCellLabelTypography()}>
              {Number(trackingState.summary.total_deviation_count || 0)}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>
              Sub Kegiatan Bermasalah
            </div>
            <div style={getTableCellLabelTypography()}>
              {Number(derivedTrackingSummary.problematic_sub_activity_count || 0)}
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
              {Number(derivedTrackingSummary.overspend_count || 0)}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
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
            <div style={getTableCellLabelTypography()}>
              TRACKING PENYERAPAN PER SUB KEGIATAN
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Menampilkan {displayedRows.length} dari {trackingState.rows.length} Sub
              Kegiatan.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {TRACKING_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilterKey(option.key)}
                style={getSubPageButtonStyle(prefersDarkMode, {
                  isActive: activeFilterKey === option.key,
                  padding: "8px 10px",
                })}
              >
                {option.label}
              </button>
            ))}

            <select
              value={activeSortKey}
              onChange={(event) => setActiveSortKey(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 38 })}
            >
              {TRACKING_SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {trackingState.isLoading ? (
          <div style={getLoadingStateStyle(prefersDarkMode)}>
            Memuat tracking anggaran...
          </div>
        ) : null}

        {!trackingState.isLoading && trackingState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {trackingState.errorMessage}
          </div>
        ) : null}

        {!trackingState.isLoading &&
        !trackingState.errorMessage &&
        !selectedFiscalYearId ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Pilih tahun anggaran untuk melihat tracking anggaran.
          </div>
        ) : null}

        {!trackingState.isLoading &&
        !trackingState.errorMessage &&
        selectedFiscalYearId &&
        versionOptions.length === 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada versi RAK pada tahun anggaran ini.
          </div>
        ) : null}

        {!trackingState.isLoading &&
        !trackingState.errorMessage &&
        selectedRakVersionId &&
        trackingState.rows.length === 0 &&
        versionOptions.length > 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada data tracking anggaran untuk versi RAK yang dipilih.
          </div>
        ) : null}

        {!trackingState.isLoading &&
        !trackingState.errorMessage &&
        trackingState.rows.length > 0 &&
        displayedRows.length === 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Tidak ada Sub Kegiatan yang sesuai filter.
          </div>
        ) : null}

        {!trackingState.isLoading &&
        !trackingState.errorMessage &&
        displayedRows.length > 0 ? (
          <BudgetTrackingTable
            prefersDarkMode={prefersDarkMode}
            rows={displayedRows}
            expandedSubActivityIds={expandedSubActivityIds}
            detailStateBySubActivity={detailStateBySubActivity}
            onToggleExpand={handleToggleExpand}
          />
        ) : null}
      </section>
    </div>
  );
}
