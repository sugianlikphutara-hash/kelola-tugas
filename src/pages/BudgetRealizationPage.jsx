import { useEffect, useMemo, useRef, useState } from "react";
import RealizationSubActivityTable from "../components/budgeting/RealizationSubActivityTable";
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
  getRealizationBudgetItemDetail,
  getRealizationSubActivitySummary,
} from "../services/budgetRealizationService";
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

export default function BudgetRealizationPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionErrorMessage, setVersionErrorMessage] = useState("");
  const [summaryState, setSummaryState] = useState({
    rakVersion: null,
    rows: [],
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const [expandedRowKey, setExpandedRowKey] = useState("");
  const [detailStateByKey, setDetailStateByKey] = useState({});
  const selectedRakVersionIdRef = useRef("");
  const summaryRequestKeyRef = useRef("");

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

    async function loadSummary() {
      if (!selectedRakVersionId) {
        summaryRequestKeyRef.current = "";
        setSummaryState({
          rakVersion: null,
          rows: [],
          warnings: [],
          isLoading: false,
          errorMessage: "",
        });
        setExpandedRowKey("");
        setDetailStateByKey({});
        return;
      }

      setExpandedRowKey("");
      setDetailStateByKey({});
      summaryRequestKeyRef.current = `${selectedRakVersionId}:summary`;
      setSummaryState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
        warnings: [],
      }));

      try {
        const result = await getRealizationSubActivitySummary(selectedRakVersionId);

        if (
          !isMounted ||
          summaryRequestKeyRef.current !== result.requestKey ||
          selectedRakVersionIdRef.current !== result.rakVersion?.id
        ) {
          return;
        }

        setSummaryState({
          rakVersion: result.rakVersion,
          rows: result.rows,
          warnings: result.warnings || [],
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (
          !isMounted ||
          summaryRequestKeyRef.current !== `${selectedRakVersionId}:summary` ||
          selectedRakVersionIdRef.current !== selectedRakVersionId
        ) {
          return;
        }

        setSummaryState({
          rakVersion: null,
          rows: [],
          warnings: [],
          isLoading: false,
          errorMessage:
            error?.message || "Gagal memuat ringkasan realisasi per Sub Kegiatan.",
        });
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [selectedRakVersionId]);

  const summaryTotals = useMemo(
    () =>
      summaryState.rows.reduce(
        (accumulator, row) => ({
          annual_plan:
            accumulator.annual_plan + toNumericAmount(row.annual_plan),
          annual_realization:
            accumulator.annual_realization +
            toNumericAmount(row.annual_realization),
          annual_balance:
            accumulator.annual_balance + toNumericAmount(row.annual_balance),
        }),
        {
          annual_plan: 0,
          annual_realization: 0,
          annual_balance: 0,
        }
      ),
    [summaryState.rows]
  );

  async function handleToggleExpand(row) {
    const detailKey = `${row.rak_version_id}:${row.rak_sub_activity_id}`;

    if (expandedRowKey === detailKey) {
      setExpandedRowKey("");
      return;
    }

    setExpandedRowKey(detailKey);

    if (detailStateByKey[detailKey]) {
      return;
    }

    setDetailStateByKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        rows: [],
        isLoading: true,
        errorMessage: "",
        warningMessages: [],
        requestKey: detailKey,
      },
    }));

    try {
      const requestRakVersionId = row.rak_version_id;
      const result = await getRealizationBudgetItemDetail(
        requestRakVersionId,
        row.rak_sub_activity_id
      );

      if (selectedRakVersionIdRef.current !== requestRakVersionId) {
        return;
      }

      const detailTotals = result.rows.reduce(
        (accumulator, detailRow) => ({
          annual_plan:
            accumulator.annual_plan + toNumericAmount(detailRow.annual_plan),
          annual_realization:
            accumulator.annual_realization +
            toNumericAmount(detailRow.annual_realization),
          annual_balance:
            accumulator.annual_balance + toNumericAmount(detailRow.annual_balance),
        }),
        {
          annual_plan: 0,
          annual_realization: 0,
          annual_balance: 0,
        }
      );

      const warningMessages = [...(result.warnings || [])];

      if (detailTotals.annual_plan !== toNumericAmount(row.annual_plan)) {
        warningMessages.push(
          `Akumulasi detail plan ${formatCurrency(
            detailTotals.annual_plan
          )} tidak sama dengan total summary ${formatCurrency(row.annual_plan)}.`
        );
      }

      if (
        detailTotals.annual_realization !==
        toNumericAmount(row.annual_realization)
      ) {
        warningMessages.push(
          `Akumulasi detail realisasi ${formatCurrency(
            detailTotals.annual_realization
          )} tidak sama dengan total summary ${formatCurrency(
            row.annual_realization
          )}.`
        );
      }

      if (detailTotals.annual_balance !== toNumericAmount(row.annual_balance)) {
        warningMessages.push(
          `Akumulasi detail saldo ${formatCurrency(
            detailTotals.annual_balance
          )} tidak sama dengan total summary ${formatCurrency(row.annual_balance)}.`
        );
      }

      setDetailStateByKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          rows: result.rows,
          isLoading: false,
          errorMessage: "",
          warningMessages: [...new Set(warningMessages)],
          requestKey: result.requestKey,
        },
      }));
    } catch (error) {
      if (selectedRakVersionIdRef.current !== row.rak_version_id) {
        return;
      }

      setDetailStateByKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          rows: [],
          isLoading: false,
          errorMessage:
            error?.message || "Gagal memuat detail realisasi anggaran.",
          warningMessages: [],
        },
      }));
    }
  }

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      summaryState.rakVersion ||
      null,
    [selectedRakVersionId, summaryState.rakVersion, versionOptions]
  );

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>REALISASI ANGGARAN</h1>
        <div style={getPageSubtitleStyle()}>
          Monitoring penyerapan anggaran per Sub Kegiatan terhadap satu versi RAK
          dengan detail Belanja Level 5 dan saldo bulanan Jan-Des.
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

        {summaryState.warnings.length > 0 ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            {summaryState.warnings.join(" ")}
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
            <div style={getTableCellLabelTypography()}>
              {summaryState.rows.length}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Plan</div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(summaryTotals.annual_plan)}
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
              {formatCurrency(summaryTotals.annual_realization)}
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
              {formatCurrency(summaryTotals.annual_balance)}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          Tabel Utama Realisasi per Sub Kegiatan
        </div>

        {summaryState.isLoading ? (
          <div style={getLoadingStateStyle(prefersDarkMode)}>
            Memuat ringkasan realisasi...
          </div>
        ) : null}

        {!summaryState.isLoading && summaryState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {summaryState.errorMessage}
          </div>
        ) : null}

        {!summaryState.isLoading &&
        !summaryState.errorMessage &&
        summaryState.rows.length === 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada data realisasi yang bisa ditampilkan untuk versi ini.
          </div>
        ) : null}

        {!summaryState.isLoading &&
        !summaryState.errorMessage &&
        summaryState.rows.length > 0 ? (
          <RealizationSubActivityTable
            rows={summaryState.rows}
            expandedRowKey={expandedRowKey}
            detailStateByKey={detailStateByKey}
            onToggleExpand={handleToggleExpand}
          />
        ) : null}
      </section>
    </div>
  );
}
