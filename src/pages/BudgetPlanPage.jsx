import { useEffect, useMemo, useRef, useState } from "react";
import PlanSubActivityTable from "../components/budgeting/PlanSubActivityTable";
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
  getPlanBudgetItemDetail,
  getPlanSubActivitySummary,
} from "../services/budgetPlanService";
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

export default function BudgetPlanPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [versionErrorMessage, setVersionErrorMessage] = useState("");
  const [summaryState, setSummaryState] = useState({
    rakVersion: null,
    rows: [],
    isLoading: false,
    errorMessage: "",
  });
  const [expandedRowKey, setExpandedRowKey] = useState("");
  const [detailStateByKey, setDetailStateByKey] = useState({});
  const selectedRakVersionIdRef = useRef("");

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
        const defaultVersionId = defaultVersion?.id || sortedVersions[0]?.id || "";

        setSelectedRakVersionId((currentValue) =>
          currentValue || defaultVersionId
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
        setSummaryState({
          rakVersion: null,
          rows: [],
          isLoading: false,
          errorMessage: "",
        });
        setDetailStateByKey({});
        return;
      }

      setExpandedRowKey("");
      setDetailStateByKey({});
      setSummaryState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
      }));

      try {
        const result = await getPlanSubActivitySummary(selectedRakVersionId);

        if (!isMounted) {
          return;
        }

        setSummaryState({
          rakVersion: result.rakVersion,
          rows: result.rows,
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSummaryState({
          rakVersion: null,
          rows: [],
          isLoading: false,
          errorMessage:
            error?.message || "Gagal memuat ringkasan RAK per Sub Kegiatan.",
        });
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [selectedRakVersionId]);

  const totalAnnualAmount = useMemo(
    () =>
      summaryState.rows.reduce(
        (sum, row) => sum + Number(row.annual_amount || 0),
        0
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
      },
    }));

    try {
      const requestRakVersionId = row.rak_version_id;
      const result = await getPlanBudgetItemDetail(
        row.rak_sub_activity_id,
        requestRakVersionId
      );

      if (selectedRakVersionIdRef.current !== requestRakVersionId) {
        return;
      }

      const detailAnnualAmount = result.rows.reduce(
        (sum, detailRow) => sum + toNumericAmount(detailRow.annual_amount),
        0
      );
      const summaryAnnualAmount = toNumericAmount(row.annual_amount);
      const warningMessages = [...(result.warnings || [])];

      if (detailAnnualAmount !== summaryAnnualAmount) {
        warningMessages.push(
          `Akumulasi detail ${formatCurrency(
            detailAnnualAmount
          )} tidak sama dengan total summary Sub Kegiatan ${formatCurrency(
            summaryAnnualAmount
          )}.`
        );
      }

      setDetailStateByKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          rows: result.rows,
          isLoading: false,
          errorMessage: "",
          warningMessages,
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
            error?.message || "Gagal memuat detail item anggaran.",
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
        <h1 style={getPageTitleStyle()}>RENCANA ANGGARAN</h1>
        <div style={getPageSubtitleStyle()}>
          Ringkasan anggaran RAK per Sub Kegiatan dengan detail Belanja Level 5
          dan bulanan Jan-Des dari satu versi RAK yang dipilih.
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Total Anggaran</div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(totalAnnualAmount)}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          Tabel Utama Rencana per Sub Kegiatan
        </div>

        {summaryState.isLoading ? (
          <div style={getLoadingStateStyle(prefersDarkMode)}>
            Memuat ringkasan RAK...
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
            Belum ada data RAK yang bisa ditampilkan untuk versi ini.
          </div>
        ) : null}

        {!summaryState.isLoading &&
        !summaryState.errorMessage &&
        summaryState.rows.length > 0 ? (
          <PlanSubActivityTable
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
