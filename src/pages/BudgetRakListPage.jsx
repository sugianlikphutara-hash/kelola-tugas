import { useEffect, useMemo, useState } from "react";
import ToastStack from "../components/ui/ToastStack";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  getAlertStyle,
  getChipStyle,
  getEmptyStateStyle,
  getInlineActionButtonStyle,
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
import { canManageRakVersion } from "../lib/authorization";
import {
  activateDraftRakVersion,
  cloneRakVersionRevision,
  getRakFiscalYears,
  getRakVersionListByFiscalYear,
  resolveDefaultRakFiscalYear,
} from "../services/budgetRakListService";

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function getShortIdentifier(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "-";
  }

  if (normalizedValue.length <= 10) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 8)}...`;
}

function ActionButton({
  prefersDarkMode,
  label,
  tone = "accent",
  isEnabled,
  isBusy = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isEnabled || isBusy}
      style={getInlineActionButtonStyle(prefersDarkMode, {
        isEnabled: isEnabled && !isBusy,
        tone,
        height: 32,
      })}
    >
      {isBusy ? "Memproses..." : label}
    </button>
  );
}

export default function BudgetRakListPage({ onOpenVersionDetail }) {
  const prefersDarkMode = usePrefersDarkMode();
  const auth = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts({ defaultDurationMs: 5000 });
  const [fiscalYearOptions, setFiscalYearOptions] = useState([]);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState("");
  const [versionsState, setVersionsState] = useState({
    rows: [],
    isLoading: false,
    errorMessage: "",
  });
  const [isLoadingFiscalYears, setIsLoadingFiscalYears] = useState(true);
  const [fiscalYearErrorMessage, setFiscalYearErrorMessage] = useState("");
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [pendingRowId, setPendingRowId] = useState("");
  const canManageVersions = canManageRakVersion(auth.roleCode);

  useEffect(() => {
    let isMounted = true;

    async function loadFiscalYears() {
      setIsLoadingFiscalYears(true);
      setFiscalYearErrorMessage("");

      try {
        const fiscalYears = await getRakFiscalYears();

        if (!isMounted) {
          return;
        }

        const defaultFiscalYear = resolveDefaultRakFiscalYear(fiscalYears);

        setFiscalYearOptions(fiscalYears);
        setSelectedFiscalYearId((currentValue) =>
          currentValue || defaultFiscalYear?.id || ""
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFiscalYearErrorMessage(
          error?.message || "Gagal memuat daftar Tahun Anggaran."
        );
      } finally {
        if (isMounted) {
          setIsLoadingFiscalYears(false);
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
        setVersionsState({
          rows: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      setVersionsState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
      }));

      try {
        const rows = await getRakVersionListByFiscalYear(selectedFiscalYearId);

        if (!isMounted) {
          return;
        }

        setVersionsState({
          rows,
          isLoading: false,
          errorMessage: "",
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setVersionsState({
          rows: [],
          isLoading: false,
          errorMessage: error?.message || "Gagal memuat daftar versi RAK.",
        });
      }
    }

    loadVersions();

    return () => {
      isMounted = false;
    };
  }, [selectedFiscalYearId]);

  const selectedFiscalYear = useMemo(
    () =>
      fiscalYearOptions.find((item) => item.id === selectedFiscalYearId) || null,
    [fiscalYearOptions, selectedFiscalYearId]
  );

  const summary = useMemo(
    () =>
      versionsState.rows.reduce(
        (accumulator, row) => ({
          totalVersions: accumulator.totalVersions + 1,
          totalPlanAmount:
            accumulator.totalPlanAmount + Number(row?.total_plan_amount || 0),
        }),
        {
          totalVersions: 0,
          totalPlanAmount: 0,
        }
      ),
    [versionsState.rows]
  );

  async function refreshVersions() {
    if (!selectedFiscalYearId) {
      return;
    }

    const rows = await getRakVersionListByFiscalYear(selectedFiscalYearId);
    setVersionsState({
      rows,
      isLoading: false,
      errorMessage: "",
    });
  }

  async function handleCloneRevision(row) {
    if (!canManageVersions || pendingRowId) {
      return;
    }

    const actionKey = `clone:${row.id}`;
    setPendingRowId(row.id);
    setPendingActionKey(actionKey);

    try {
      await cloneRakVersionRevision(row, versionsState.rows);
      await refreshVersions();
      pushToast({
        type: "success",
        message:
          row.status === "ARCHIVED"
            ? `Draft baru dari versi ARCHIVED ${row.version_number} berhasil dibuat.`
            : `Draft revisi untuk versi RAK ${row.version_number} berhasil dibuat.`,
      });
    } catch (error) {
      pushToast({
        type: "error",
        message: error?.message || "Gagal membuat clone revisi RAK.",
      });
    } finally {
      setPendingRowId("");
      setPendingActionKey("");
    }
  }

  async function handleActivateDraft(row) {
    if (!canManageVersions || pendingRowId) {
      return;
    }

    const actionKey = `activate:${row.id}`;
    setPendingRowId(row.id);
    setPendingActionKey(actionKey);

    try {
      await activateDraftRakVersion(row.id);
      await refreshVersions();
      pushToast({
        type: "success",
        message: `Versi draft RAK ${row.version_number} berhasil diaktifkan.`,
      });
    } catch (error) {
      pushToast({
        type: "error",
        message: error?.message || "Gagal mengaktifkan draft RAK.",
      });
    } finally {
      setPendingRowId("");
      setPendingActionKey("");
    }
  }

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <ToastStack
        prefersDarkMode={prefersDarkMode}
        toasts={toasts}
        onDismiss={dismissToast}
      />

      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>VERSI RAK</h1>
        <div style={getPageSubtitleStyle()}>
          Daftar versi RAK per Tahun Anggaran. Halaman ini hanya menampilkan level
          versi, tanpa merender item anggaran.
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
            gridTemplateColumns: "minmax(240px, 320px) repeat(auto-fit, minmax(200px, 1fr))",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={getMetaLabelStyle(prefersDarkMode)}>Tahun Anggaran</span>
            <select
              value={selectedFiscalYearId}
              onChange={(event) => setSelectedFiscalYearId(event.target.value)}
              style={getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 })}
              disabled={isLoadingFiscalYears || fiscalYearOptions.length === 0}
            >
              <option value="">
                {isLoadingFiscalYears
                  ? "Memuat Tahun Anggaran..."
                  : "Pilih Tahun Anggaran"}
              </option>
              {fiscalYearOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.is_active ? " (Aktif)" : ""}
                </option>
              ))}
            </select>
          </label>

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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Context Tahun</div>
            <div style={getTableCellLabelTypography()}>
              {selectedFiscalYear?.label || "-"}
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
            <div style={getMetaLabelStyle(prefersDarkMode)}>Jumlah Versi</div>
            <div style={getTableCellLabelTypography()}>{summary.totalVersions}</div>
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
              {formatCurrency(summary.totalPlanAmount)}
            </div>
          </div>
        </div>

        {fiscalYearErrorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {fiscalYearErrorMessage}
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        {versionsState.isLoading ? (
          <div style={getLoadingStateStyle(prefersDarkMode)}>
            Memuat daftar versi RAK...
          </div>
        ) : null}

        {!versionsState.isLoading && versionsState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {versionsState.errorMessage}
          </div>
        ) : null}

        {!versionsState.isLoading &&
        !versionsState.errorMessage &&
        !selectedFiscalYearId ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada data.
          </div>
        ) : null}

        {!versionsState.isLoading &&
        !versionsState.errorMessage &&
        selectedFiscalYearId &&
        versionsState.rows.length === 0 ? (
          <div style={getEmptyStateStyle(prefersDarkMode)}>
            Belum ada data.
          </div>
        ) : null}

        {!versionsState.isLoading &&
        !versionsState.errorMessage &&
        versionsState.rows.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <div style={getTableFrameStyle({ borderRadius: 0 })}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th style={getTableHeaderCellStyle({ label: "Version" })}>Version</th>
                    <th style={getTableHeaderCellStyle({ label: "Nama" })}>Nama / Notes</th>
                    <th style={getTableHeaderCellStyle({ label: "Status" })}>Status</th>
                    <th style={getTableHeaderCellStyle({ label: "Created" })}>Created At</th>
                    <th style={getTableHeaderCellStyle({ label: "Pembuat" })}>Created By</th>
                    <th style={getTableHeaderCellStyle({ label: "Total" })}>
                      Total Plan Amount
                    </th>
                    <th style={getTableHeaderCellStyle({ label: "Items" })}>Item Count</th>
                    <th style={getTableHeaderCellStyle({ label: "Aksi" })}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versionsState.rows.map((row) => {
                    const isCloneEnabled =
                      row.status === "ACTIVE" || row.status === "ARCHIVED";
                    const isActivateEnabled = row.status === "DRAFT";
                    const isRowPending = pendingRowId === row.id;
                    const cloneLabel =
                      row.status === "ARCHIVED"
                        ? "Clone sebagai Draft"
                        : "Clone Revisi";

                    return (
                      <tr key={row.id}>
                        <td style={getTableBodyCellStyle()}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={getTableCellLabelTypography()}>
                              V{row.version_number || "-"}
                            </div>
                            <div style={getTableCellSubtitleTypography()}>
                              {row.code || "-"}
                            </div>
                          </div>
                        </td>
                        <td style={getTableBodyCellStyle()}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={getTableCellLabelTypography()}>
                              {row.display_name}
                            </div>
                            <div style={getTableCellSubtitleTypography()}>
                              {row.notes || "-"}
                            </div>
                          </div>
                        </td>
                        <td style={getTableBodyCellStyle()}>
                          <div
                            style={getChipStyle(prefersDarkMode, {
                              tone: getVersionStatusTone(row.status),
                              size: "sm",
                            })}
                          >
                            {row.status || "-"}
                          </div>
                        </td>
                        <td style={getTableBodyCellStyle()}>{formatDateTime(row.created_at)}</td>
                        <td style={getTableBodyCellStyle()}>
                          {getShortIdentifier(row.created_by)}
                        </td>
                        <td style={getTableBodyCellStyle()}>
                          {formatCurrency(row.total_plan_amount)}
                        </td>
                        <td style={getTableBodyCellStyle()}>
                          {row.item_count ?? "-"}
                        </td>
                        <td style={getTableBodyCellStyle()}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <ActionButton
                              prefersDarkMode={prefersDarkMode}
                              label={isRowPending ? "Memproses..." : "Lihat Detail"}
                              tone="accent"
                              isEnabled={Boolean(row.id) && !isRowPending}
                              onClick={() => onOpenVersionDetail?.(row)}
                            />
                            {canManageVersions ? (
                              <ActionButton
                                prefersDarkMode={prefersDarkMode}
                                label={cloneLabel}
                                tone="neutral"
                                isEnabled={isCloneEnabled && !isRowPending}
                                isBusy={pendingActionKey === `clone:${row.id}`}
                                onClick={() => handleCloneRevision(row)}
                              />
                            ) : null}
                            {canManageVersions ? (
                              <ActionButton
                                prefersDarkMode={prefersDarkMode}
                                label="Activate Draft"
                                tone="accent"
                                isEnabled={isActivateEnabled && !isRowPending}
                                isBusy={pendingActionKey === `activate:${row.id}`}
                                onClick={() => handleActivateDraft(row)}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
