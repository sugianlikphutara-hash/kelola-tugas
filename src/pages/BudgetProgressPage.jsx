import { useEffect, useMemo, useRef, useState } from "react";
import BudgetProgressTable from "../components/budgeting/BudgetProgressTable";
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
import { getBudgetProgress } from "../services/budgetProgressService";
import { getDefaultRakVersion, getRakVersions } from "../services/budgetRakService";

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toNumericAmount(value) {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
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

export default function BudgetProgressPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionErrorMessage, setVersionErrorMessage] = useState("");
  const [progressState, setProgressState] = useState({
    rakVersion: null,
    rows: [],
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const selectedRakVersionIdRef = useRef("");
  const progressRequestKeyRef = useRef("");

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

        setVersionErrorMessage(
          error?.message || "Gagal memuat daftar versi RAK."
        );
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

    async function loadProgress() {
      if (!selectedRakVersionId) {
        progressRequestKeyRef.current = "";
        setProgressState({
          rakVersion: null,
          rows: [],
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      progressRequestKeyRef.current = `${selectedRakVersionId}:progress`;
      setProgressState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
        warnings: [],
      }));

      try {
        const result = await getBudgetProgress(selectedRakVersionId);

        if (
          !isMounted ||
          progressRequestKeyRef.current !== result.requestKey ||
          selectedRakVersionIdRef.current !== result.rakVersion?.id
        ) {
          return;
        }

        setProgressState({
          rakVersion: result.rakVersion,
          rows: result.rows,
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (
          !isMounted ||
          progressRequestKeyRef.current !== `${selectedRakVersionId}:progress` ||
          selectedRakVersionIdRef.current !== selectedRakVersionId
        ) {
          return;
        }

        setProgressState({
          rakVersion: null,
          rows: [],
          warnings: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat progress anggaran.",
        });
      }
    }

    loadProgress();

    return () => {
      isMounted = false;
    };
  }, [selectedRakVersionId]);

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      progressState.rakVersion ||
      null,
    [selectedRakVersionId, versionOptions, progressState.rakVersion]
  );

  const totals = useMemo(
    () =>
      progressState.rows.reduce(
        (accumulator, row) => ({
          annual_plan: accumulator.annual_plan + toNumericAmount(row.annual_plan),
          annual_realization:
            accumulator.annual_realization + toNumericAmount(row.annual_realization),
        }),
        {
          annual_plan: 0,
          annual_realization: 0,
        }
      ),
    [progressState.rows]
  );

  const totalProgressPercent = useMemo(() => {
    if (totals.annual_plan <= 0) {
      return totals.annual_realization > 0 ? 100 : 0;
    }

    return (totals.annual_realization / totals.annual_plan) * 100;
  }, [totals]);

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>TRACKING PROGRESS</h1>
        <div style={getPageSubtitleStyle()}>
          Monitoring persentase serapan anggaran per Sub Kegiatan dalam satu versi
          RAK, dengan perhitungan progress yang aman saat plan bernilai nol.
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

        {progressState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {progressState.warnings.join(" ")}
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
            <div style={getTableCellLabelTypography()}>{progressState.rows.length}</div>
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
              {formatCurrency(totals.annual_plan)}
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
              {formatCurrency(totals.annual_realization)}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Progress Total</div>
            <div style={getTableCellLabelTypography()}>
              {Number(totalProgressPercent || 0).toFixed(2)}%
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          Daftar Progress Serapan Anggaran
        </div>

        {progressState.isLoading ? (
          <div style={getLoadingStateStyle(prefersDarkMode)}>
            Memuat progress anggaran...
          </div>
        ) : null}

        {!progressState.isLoading && progressState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {progressState.errorMessage}
          </div>
        ) : null}

        {!progressState.isLoading &&
        !progressState.errorMessage &&
        progressState.rows.length === 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada progress anggaran yang bisa ditampilkan untuk versi ini.
          </div>
        ) : null}

        {!progressState.isLoading &&
        !progressState.errorMessage &&
        progressState.rows.length > 0 ? (
          <BudgetProgressTable prefersDarkMode={prefersDarkMode} rows={progressState.rows} />
        ) : null}
      </section>
    </div>
  );
}
