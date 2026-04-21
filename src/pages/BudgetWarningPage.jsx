import { useEffect, useMemo, useRef, useState } from "react";
import BudgetWarningTable from "../components/budgeting/BudgetWarningTable";
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
import { getBudgetWarningRows } from "../services/budgetWarningService";
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

export default function BudgetWarningPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionErrorMessage, setVersionErrorMessage] = useState("");
  const [warningState, setWarningState] = useState({
    rakVersion: null,
    rows: [],
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const selectedRakVersionIdRef = useRef("");
  const warningRequestKeyRef = useRef("");

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

    async function loadWarnings() {
      if (!selectedRakVersionId) {
        warningRequestKeyRef.current = "";
        setWarningState({
          rakVersion: null,
          rows: [],
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      warningRequestKeyRef.current = `${selectedRakVersionId}:warnings`;
      setWarningState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
        warnings: [],
      }));

      try {
        const result = await getBudgetWarningRows(selectedRakVersionId);

        if (
          !isMounted ||
          warningRequestKeyRef.current !== result.requestKey ||
          selectedRakVersionIdRef.current !== result.rakVersion?.id
        ) {
          return;
        }

        setWarningState({
          rakVersion: result.rakVersion,
          rows: result.rows,
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (
          !isMounted ||
          warningRequestKeyRef.current !== `${selectedRakVersionId}:warnings` ||
          selectedRakVersionIdRef.current !== selectedRakVersionId
        ) {
          return;
        }

        setWarningState({
          rakVersion: null,
          rows: [],
          warnings: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat warning anggaran.",
        });
      }
    }

    loadWarnings();

    return () => {
      isMounted = false;
    };
  }, [selectedRakVersionId]);

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      warningState.rakVersion ||
      null,
    [selectedRakVersionId, versionOptions, warningState.rakVersion]
  );

  const totalPlan = useMemo(
    () =>
      warningState.rows.reduce(
        (sum, row) => sum + toNumericAmount(row.annual_plan),
        0
      ),
    [warningState.rows]
  );

  const noRealizationCount = useMemo(
    () =>
      warningState.rows.filter((row) => row.warning_type === "NO_REALIZATION")
        .length,
    [warningState.rows]
  );

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>TRACKING WARNING</h1>
        <div style={getPageSubtitleStyle()}>
          Daftar warning penyerapan anggaran per item Belanja Level 5 dalam satu
          versi RAK, dengan fokus utama pada kondisi seperti NO_REALIZATION.
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

        {warningState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {warningState.warnings.join(" ")}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Warning</div>
            <div style={getTableCellLabelTypography()}>{warningState.rows.length}</div>
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>NO_REALIZATION</div>
            <div style={getTableCellLabelTypography()}>{noRealizationCount}</div>
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Plan Terdampak</div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(totalPlan)}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          Daftar Warning Anggaran
        </div>

        {warningState.isLoading ? (
          <div style={getLoadingStateStyle(prefersDarkMode)}>
            Memuat warning anggaran...
          </div>
        ) : null}

        {!warningState.isLoading && warningState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {warningState.errorMessage}
          </div>
        ) : null}

        {!warningState.isLoading &&
        !warningState.errorMessage &&
        warningState.rows.length === 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada warning anggaran yang bisa ditampilkan untuk versi ini.
          </div>
        ) : null}

        {!warningState.isLoading &&
        !warningState.errorMessage &&
        warningState.rows.length > 0 ? (
          <BudgetWarningTable prefersDarkMode={prefersDarkMode} rows={warningState.rows} />
        ) : null}
      </section>
    </div>
  );
}
