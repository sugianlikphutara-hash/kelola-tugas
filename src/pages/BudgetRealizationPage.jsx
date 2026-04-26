import { useEffect, useMemo, useRef, useState } from "react";
import ToastStack from "../components/ui/ToastStack";
import ConfirmActionModal from "../components/ui/ConfirmActionModal";
import RealizationAuditLogModal from "../components/budgeting/RealizationAuditLogModal";
import RealizationSubActivityTable from "../components/budgeting/RealizationSubActivityTable";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import { isAdminRole } from "../lib/authorization";
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
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
} from "../lib/controlStyles";
import { getBudgetYears } from "../services/masterDataService";
import {
  getDefaultBudgetRealizationStatus,
  getBudgetPeriodLockStatus,
  getBudgetRealizationAuditLogs,
  getRealizationBudgetItemDetail,
  getRealizationExportRows,
  getRealizationSubActivitySummary,
  setBudgetPeriodLock,
  saveMonthlyBudgetRealization,
} from "../services/budgetRealizationService";
import {
  getPreferredActiveRakVersion,
  getRakVersions,
} from "../services/budgetRakService";

const MONTH_OPTIONS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

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

function getRealizationRemark({ planAmount, realizationAmount }) {
  if (realizationAmount === 0 && planAmount > 0) {
    return "Belum terealisasi";
  }

  if (planAmount === 0 && realizationAmount > 0) {
    return "Realisasi tanpa plan";
  }

  if (realizationAmount > planAmount) {
    return "Overspending";
  }

  return "-";
}

function getSafeFileSegment(value) {
  return String(value || "-")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
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

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function BudgetRealizationPage() {
  const auth = useAuth();
  const prefersDarkMode = usePrefersDarkMode();
  const { toasts, pushToast, dismissToast } = useToasts({ defaultDurationMs: 5000 });
  const [fiscalYearOptions, setFiscalYearOptions] = useState([]);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState("");
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedRakVersionId, setSelectedRakVersionId] = useState("");
  const [selectedPeriodMonth, setSelectedPeriodMonth] = useState(
    new Date().getMonth() + 1
  );
  const [defaultRealizationStatus, setDefaultRealizationStatus] = useState(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [filterErrorMessage, setFilterErrorMessage] = useState("");
  const [summaryState, setSummaryState] = useState({
    rakVersion: null,
    rows: [],
    warnings: [],
    isLoading: false,
    errorMessage: "",
  });
  const [expandedRowKey, setExpandedRowKey] = useState("");
  const [detailStateByKey, setDetailStateByKey] = useState({});
  const [draftValuesByDetailKey, setDraftValuesByDetailKey] = useState({});
  const [rowMutationStateByDetailKey, setRowMutationStateByDetailKey] = useState({});
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [historyModalState, setHistoryModalState] = useState({
    isOpen: false,
    context: null,
    rows: [],
    isLoading: false,
    errorMessage: "",
  });
  const [periodLockState, setPeriodLockState] = useState({
    isLocked: false,
    isLoading: false,
    isMutating: false,
    errorMessage: "",
  });
  const [isExporting, setIsExporting] = useState(false);
  const selectedRakVersionIdRef = useRef("");
  const selectedFiscalYearIdRef = useRef("");
  const selectedPeriodMonthRef = useRef(selectedPeriodMonth);
  const summaryRequestKeyRef = useRef("");
  const savedIndicatorTimeoutsRef = useRef(new Map());

  useEffect(() => {
    selectedRakVersionIdRef.current = selectedRakVersionId;
  }, [selectedRakVersionId]);

  useEffect(() => {
    selectedFiscalYearIdRef.current = selectedFiscalYearId;
  }, [selectedFiscalYearId]);

  useEffect(() => {
    selectedPeriodMonthRef.current = selectedPeriodMonth;
  }, [selectedPeriodMonth]);

  useEffect(
    () => () => {
      savedIndicatorTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      savedIndicatorTimeoutsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialFilters() {
      setLoadingFilters(true);
      setFilterErrorMessage("");

      try {
        const [fiscalYears, defaultStatus] = await Promise.all([
          getBudgetYears(),
          getDefaultBudgetRealizationStatus(),
        ]);

        if (!isMounted) {
          return;
        }

        const defaultFiscalYear = resolveDefaultFiscalYear(fiscalYears);
        setFiscalYearOptions(fiscalYears);
        setSelectedFiscalYearId((currentValue) =>
          currentValue || defaultFiscalYear?.id || ""
        );
        setDefaultRealizationStatus(defaultStatus);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFilterErrorMessage(
          error?.message || "Gagal memuat filter realisasi anggaran."
        );
      } finally {
        if (isMounted) {
          setLoadingFilters(false);
        }
      }
    }

    loadInitialFilters();

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

    async function loadPeriodLockStatus() {
      if (!selectedFiscalYearId || !selectedPeriodMonth) {
        setPeriodLockState({
          isLocked: false,
          isLoading: false,
          isMutating: false,
          errorMessage: "",
        });
        return;
      }

      setPeriodLockState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
      }));

      try {
        const result = await getBudgetPeriodLockStatus(
          selectedFiscalYearId,
          selectedPeriodMonth
        );

        if (
          !isMounted ||
          selectedFiscalYearIdRef.current !== selectedFiscalYearId ||
          selectedPeriodMonthRef.current !== selectedPeriodMonth
        ) {
          return;
        }

        setPeriodLockState({
          isLocked: Boolean(result?.is_locked),
          isLoading: false,
          isMutating: false,
          errorMessage: "",
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPeriodLockState({
          isLocked: false,
          isLoading: false,
          isMutating: false,
          errorMessage:
            error?.message || "Gagal memuat status lock periode realisasi.",
        });
      }
    }

    loadPeriodLockStatus();

    return () => {
      isMounted = false;
    };
  }, [selectedFiscalYearId, selectedPeriodMonth]);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      if (!selectedRakVersionId || !selectedFiscalYearId || !selectedPeriodMonth) {
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
        setDraftValuesByDetailKey({});
        setRowMutationStateByDetailKey({});
        setPendingConfirmation(null);
        setHistoryModalState({
          isOpen: false,
          context: null,
          rows: [],
          isLoading: false,
          errorMessage: "",
        });
        return;
      }

      setExpandedRowKey("");
      setDetailStateByKey({});
      setDraftValuesByDetailKey({});
      setRowMutationStateByDetailKey({});
      setPendingConfirmation(null);
      setHistoryModalState({
        isOpen: false,
        context: null,
        rows: [],
        isLoading: false,
        errorMessage: "",
      });
      summaryRequestKeyRef.current = `${selectedRakVersionId}:summary:${selectedPeriodMonth}`;
      setSummaryState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
        warnings: [],
      }));

      try {
        const result = await getRealizationSubActivitySummary(
          selectedRakVersionId,
          selectedFiscalYearId,
          selectedPeriodMonth
        );

        if (
          !isMounted ||
          summaryRequestKeyRef.current !== result.requestKey ||
          selectedRakVersionIdRef.current !== result.rakVersion?.id ||
          selectedFiscalYearIdRef.current !== selectedFiscalYearId ||
          selectedPeriodMonthRef.current !== selectedPeriodMonth
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
          summaryRequestKeyRef.current !== `${selectedRakVersionId}:summary:${selectedPeriodMonth}` ||
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
  }, [selectedFiscalYearId, selectedRakVersionId, selectedPeriodMonth]);

  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      summaryState.rakVersion ||
      null,
    [selectedRakVersionId, summaryState.rakVersion, versionOptions]
  );

  const selectedFiscalYear = useMemo(
    () =>
      fiscalYearOptions.find((year) => year.id === selectedFiscalYearId) || null,
    [fiscalYearOptions, selectedFiscalYearId]
  );

  const selectedMonthMeta = useMemo(
    () =>
      MONTH_OPTIONS.find((month) => month.value === Number(selectedPeriodMonth)) ||
      MONTH_OPTIONS[0],
    [selectedPeriodMonth]
  );

  const canManagePeriodLock = isAdminRole(auth.roleCode);

  const summaryTotals = useMemo(
    () =>
      summaryState.rows.reduce(
        (accumulator, row) => ({
          plan_amount: accumulator.plan_amount + toNumericAmount(row.plan_amount),
          realization_amount:
            accumulator.realization_amount + toNumericAmount(row.realization_amount),
          deviation_amount:
            accumulator.deviation_amount + toNumericAmount(row.deviation_amount),
        }),
        {
          plan_amount: 0,
          realization_amount: 0,
          deviation_amount: 0,
        }
      ),
    [summaryState.rows]
  );

  const dirtyRowCount = useMemo(
    () =>
      Object.entries(detailStateByKey).reduce((totalCount, [detailKey, detailState]) => {
        const draftValues = draftValuesByDetailKey[detailKey] || {};
        const rows = detailState?.rows || [];

        return (
          totalCount +
          rows.filter((detailRow) => {
            const draftValue =
              draftValues[detailRow.budget_account_id] ??
              String(Number(detailRow.realization_amount || 0));
            const normalizedAmount = draftValue === "" ? 0 : Number(draftValue);

            return (
              Number.isFinite(normalizedAmount) &&
              normalizedAmount !== Number(detailRow.realization_amount || 0)
            );
          }).length
        );
      }, 0),
    [detailStateByKey, draftValuesByDetailKey]
  );

  async function refreshSummaryKeepingExpansion(targetDetailKey = "") {
    if (!selectedRakVersionId || !selectedFiscalYearId || !selectedPeriodMonth) {
      return;
    }

    const result = await getRealizationSubActivitySummary(
      selectedRakVersionId,
      selectedFiscalYearId,
      selectedPeriodMonth
    );

    setSummaryState({
      rakVersion: result.rakVersion,
      rows: result.rows,
      warnings: result.warnings || [],
      isLoading: false,
      errorMessage: "",
    });

    if (targetDetailKey) {
      setExpandedRowKey(targetDetailKey);
    }
  }

  async function refreshDetailForRow(row, detailKey) {
    const result = await getRealizationBudgetItemDetail(
      row.rak_version_id,
      row.rak_sub_activity_id,
      selectedPeriodMonth
    );

    setDetailStateByKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        rows: result.rows,
        isLoading: false,
        errorMessage: "",
        warningMessages: result.warnings || [],
        requestKey: result.requestKey,
      },
    }));

    setDraftValuesByDetailKey((currentState) => ({
      ...currentState,
      [detailKey]: Object.fromEntries(
        (result.rows || []).map((detailRow) => [
          detailRow.budget_account_id,
          String(Number(detailRow.realization_amount || 0)),
        ])
      ),
    }));
  }

  async function handleToggleExpand(row) {
    const detailKey = `${row.rak_version_id}:${row.rak_sub_activity_id}`;

    if (expandedRowKey === detailKey) {
      setExpandedRowKey("");
      return;
    }

    setExpandedRowKey(detailKey);

    if (detailStateByKey[detailKey]?.rows?.length || detailStateByKey[detailKey]?.isLoading) {
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
      await refreshDetailForRow(row, detailKey);
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

  function handleDraftChange(detailKey, detailRow, value) {
    const budgetAccountId = detailRow.budget_account_id;
    const indicatorKey = `${detailKey}:${budgetAccountId}`;

    if (savedIndicatorTimeoutsRef.current.has(indicatorKey)) {
      window.clearTimeout(savedIndicatorTimeoutsRef.current.get(indicatorKey));
      savedIndicatorTimeoutsRef.current.delete(indicatorKey);
    }

    setDraftValuesByDetailKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        ...(currentState[detailKey] || {}),
        [budgetAccountId]: value,
      },
    }));

    setRowMutationStateByDetailKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        ...(currentState[detailKey] || {}),
        [budgetAccountId]: {
          ...(currentState[detailKey]?.[budgetAccountId] || {}),
          errorMessage: "",
          savedMessage: "",
        },
      },
    }));
  }

  function showSavedIndicator(detailKey, budgetAccountId) {
    const indicatorKey = `${detailKey}:${budgetAccountId}`;

    if (savedIndicatorTimeoutsRef.current.has(indicatorKey)) {
      window.clearTimeout(savedIndicatorTimeoutsRef.current.get(indicatorKey));
    }

    setRowMutationStateByDetailKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        ...(currentState[detailKey] || {}),
        [budgetAccountId]: {
          ...(currentState[detailKey]?.[budgetAccountId] || {}),
          isSaving: false,
          errorMessage: "",
          savedMessage: "Tersimpan",
        },
      },
    }));

    const timeoutId = window.setTimeout(() => {
      setRowMutationStateByDetailKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          ...(currentState[detailKey] || {}),
          [budgetAccountId]: {
            ...(currentState[detailKey]?.[budgetAccountId] || {}),
            savedMessage: "",
          },
        },
      }));
      savedIndicatorTimeoutsRef.current.delete(indicatorKey);
    }, 2200);

    savedIndicatorTimeoutsRef.current.set(indicatorKey, timeoutId);
  }

  function handlePreviousMonth() {
    setSelectedPeriodMonth((currentMonth) => Math.max(1, Number(currentMonth) - 1));
  }

  function handleNextMonth() {
    setSelectedPeriodMonth((currentMonth) => Math.min(12, Number(currentMonth) + 1));
  }

  const isPreviousMonthDisabled = Number(selectedPeriodMonth) <= 1;
  const isNextMonthDisabled = Number(selectedPeriodMonth) >= 12;

  async function refreshPeriodLockStatus() {
    if (!selectedFiscalYearId || !selectedPeriodMonth) {
      return;
    }

    const result = await getBudgetPeriodLockStatus(
      selectedFiscalYearId,
      selectedPeriodMonth
    );

    setPeriodLockState((currentState) => ({
      ...currentState,
      isLocked: Boolean(result?.is_locked),
      isLoading: false,
      errorMessage: "",
    }));
  }

  async function handleTogglePeriodLock() {
    if (!selectedFiscalYearId || !selectedPeriodMonth) {
      return;
    }

    const nextIsLocked = !periodLockState.isLocked;

    setPeriodLockState((currentState) => ({
      ...currentState,
      isMutating: true,
      errorMessage: "",
    }));

    try {
      const result = await setBudgetPeriodLock(
        selectedFiscalYearId,
        selectedPeriodMonth,
        nextIsLocked
      );

      setPeriodLockState({
        isLocked: Boolean(result?.is_locked),
        isLoading: false,
        isMutating: false,
        errorMessage: "",
      });

      pushToast({
        type: "success",
        message: nextIsLocked ? "Bulan dikunci" : "Bulan dibuka",
      });
    } catch (error) {
      setPeriodLockState((currentState) => ({
        ...currentState,
        isMutating: false,
        errorMessage:
          error?.message || "Gagal mengubah status lock periode realisasi.",
      }));

      pushToast({
        type: "error",
        message: error?.message || "Gagal mengubah status lock periode realisasi.",
      });
    }
  }

  async function executeSaveRow(detailKey, summaryRow, detailRow, normalizedAmount) {
    if (periodLockState.isLocked) {
      setRowMutationStateByDetailKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          ...(currentState[detailKey] || {}),
          [detailRow.budget_account_id]: {
            ...(currentState[detailKey]?.[detailRow.budget_account_id] || {}),
            isSaving: false,
            errorMessage: "Bulan ini sudah dikunci. Realisasi tidak bisa diubah.",
            savedMessage: "",
          },
        },
      }));
      return;
    }

    setRowMutationStateByDetailKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        ...(currentState[detailKey] || {}),
        [detailRow.budget_account_id]: {
          isSaving: true,
          errorMessage: "",
          savedMessage: "",
        },
      },
    }));

    try {
      await saveMonthlyBudgetRealization({
        p_fiscal_year_id: selectedFiscalYearId,
        p_sub_activity_id: summaryRow.sub_activity_id,
        p_budget_account_id: detailRow.budget_account_id,
        p_rak_version_id: selectedRakVersionId,
        p_period_month: selectedPeriodMonth,
        p_amount: normalizedAmount,
      });

      await Promise.all([
        refreshSummaryKeepingExpansion(detailKey),
        refreshDetailForRow(summaryRow, detailKey),
      ]);

      showSavedIndicator(detailKey, detailRow.budget_account_id);

      pushToast({
        type: "success",
        message: "Tersimpan",
      });
    } catch (error) {
      const errorMessage =
        error?.message === "Periode realisasi bulan ini sudah dikunci."
          ? "Bulan ini sudah dikunci. Realisasi tidak bisa diubah."
          : error?.message || "Gagal menyimpan realisasi.";

      if (error?.message === "Periode realisasi bulan ini sudah dikunci.") {
        await refreshPeriodLockStatus();
      }

      setRowMutationStateByDetailKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          ...(currentState[detailKey] || {}),
          [detailRow.budget_account_id]: {
            isSaving: false,
            errorMessage,
            savedMessage: "",
          },
        },
      }));

      pushToast({
        type: "error",
        message: errorMessage,
      });
    }
  }

  async function handleSaveRow(detailKey, summaryRow, detailRow) {
    const draftValue =
      draftValuesByDetailKey[detailKey]?.[detailRow.budget_account_id] ??
      String(Number(detailRow.realization_amount || 0));
    const normalizedAmount = draftValue === "" ? 0 : Number(draftValue);
    const existingAmount = Number(detailRow.realization_amount || 0);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      setRowMutationStateByDetailKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          ...(currentState[detailKey] || {}),
          [detailRow.budget_account_id]: {
            isSaving: false,
            errorMessage: "Nilai realisasi tidak valid.",
          },
        },
      }));
      return;
    }

    if (normalizedAmount === existingAmount) {
      setRowMutationStateByDetailKey((currentState) => ({
        ...currentState,
        [detailKey]: {
          ...(currentState[detailKey] || {}),
          [detailRow.budget_account_id]: {
            ...(currentState[detailKey]?.[detailRow.budget_account_id] || {}),
            isSaving: false,
            errorMessage: "",
          },
        },
      }));
      return;
    }

    if (existingAmount > 0) {
      setPendingConfirmation({
        title: normalizedAmount === 0 ? "Hapus realisasi" : "Ganti realisasi",
        message:
          normalizedAmount === 0
            ? "Realisasi bulan ini akan dihapus. Lanjutkan?"
            : "Realisasi bulan ini akan diganti. Lanjutkan?",
        payload: {
          detailKey,
          summaryRow,
          detailRow,
          normalizedAmount,
        },
      });
      return;
    }

    await executeSaveRow(detailKey, summaryRow, detailRow, normalizedAmount);
  }

  async function handleConfirmPendingAction() {
    const currentConfirmation = pendingConfirmation;

    if (!currentConfirmation) {
      return;
    }

    setPendingConfirmation(null);

    await executeSaveRow(
      currentConfirmation.payload.detailKey,
      currentConfirmation.payload.summaryRow,
      currentConfirmation.payload.detailRow,
      currentConfirmation.payload.normalizedAmount
    );
  }

  function handleCancelPendingAction() {
    setPendingConfirmation(null);
  }

  async function handleOpenHistory(summaryRow, detailRow) {
    const context = {
      fiscalYearId: selectedFiscalYearId,
      subActivityId: summaryRow.sub_activity_id,
      subActivityName: summaryRow.sub_activity_name,
      subActivityCode: summaryRow.sub_activity_code,
      budgetAccountId: detailRow.budget_account_id,
      budgetAccountName: detailRow.budget_account_name,
      budgetAccountCode: detailRow.budget_account_code,
      rakVersionIdSnapshot: selectedRakVersionId,
      periodMonth: selectedPeriodMonth,
      monthLabel: selectedMonthMeta.label,
    };
    const requestKey = [
      context.fiscalYearId,
      context.subActivityId,
      context.budgetAccountId,
      context.rakVersionIdSnapshot,
      context.periodMonth,
    ].join(":");

    setHistoryModalState({
      isOpen: true,
      context: {
        ...context,
        requestKey,
      },
      rows: [],
      isLoading: true,
      errorMessage: "",
    });

    try {
      const rows = await getBudgetRealizationAuditLogs({
        fiscalYearId: context.fiscalYearId,
        subActivityId: context.subActivityId,
        budgetAccountId: context.budgetAccountId,
        rakVersionIdSnapshot: context.rakVersionIdSnapshot,
        periodMonth: context.periodMonth,
        limit: 20,
      });

      setHistoryModalState((currentState) => {
        if (currentState.context?.requestKey !== requestKey) {
          return currentState;
        }

        return {
          ...currentState,
          rows,
          isLoading: false,
          errorMessage: "",
        };
      });
    } catch (error) {
      setHistoryModalState((currentState) => {
        if (currentState.context?.requestKey !== requestKey) {
          return currentState;
        }

        return {
          ...currentState,
          rows: [],
          isLoading: false,
          errorMessage:
            error?.message || "Gagal memuat riwayat perubahan realisasi.",
        };
      });
    }
  }

  function handleCloseHistory() {
    setHistoryModalState({
      isOpen: false,
      context: null,
      rows: [],
      isLoading: false,
      errorMessage: "",
    });
  }

  async function handleExportExcel() {
    if (!selectedFiscalYearId || !selectedRakVersionId || !selectedPeriodMonth) {
      pushToast({
        type: "error",
        message: "Pilih tahun anggaran, versi RAK, dan bulan terlebih dahulu.",
      });
      return;
    }

    setIsExporting(true);

    try {
      const XLSX = await import("xlsx");
      const rows = await getRealizationExportRows({
        fiscalYearId: selectedFiscalYearId,
        rakVersionId: selectedRakVersionId,
        periodMonth: selectedPeriodMonth,
      });
      const fiscalYearLabel = selectedFiscalYear?.year || "-";
      const versionLabel = selectedVersion
        ? `V${selectedVersion.version_number} - ${
            selectedVersion.title || selectedVersion.code || selectedVersion.id
          }`
        : selectedRakVersionId;
      const worksheetRows = rows.map((row) => {
        const planAmount = toNumericAmount(row.plan_amount);
        const realizationAmount = toNumericAmount(row.realization_amount);

        return {
          "Tahun Anggaran": fiscalYearLabel,
          "Versi RAK": versionLabel,
          Bulan: selectedMonthMeta.label,
          "Sub Kegiatan Kode": row.sub_activity_code || "",
          "Sub Kegiatan Nama": row.sub_activity_name || "",
          "Akun Kode": row.budget_account_code || "",
          "Akun Nama": row.budget_account_name || "",
          Plan: planAmount,
          Realisasi: realizationAmount,
          Deviasi: toNumericAmount(row.deviation_amount),
          Keterangan: getRealizationRemark({
            planAmount,
            realizationAmount,
          }),
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      worksheet["!cols"] = [
        { wch: 16 },
        { wch: 34 },
        { wch: 14 },
        { wch: 20 },
        { wch: 34 },
        { wch: 18 },
        { wch: 34 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 24 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Realisasi");
      XLSX.writeFile(
        workbook,
        `realisasi-anggaran-${getSafeFileSegment(
          fiscalYearLabel
        )}-${getSafeFileSegment(selectedMonthMeta.label)}.xlsx`
      );

      pushToast({
        type: "success",
        message: "Export Excel berhasil dibuat.",
      });
    } catch (error) {
      pushToast({
        type: "error",
        message: error?.message || "Gagal export Excel realisasi.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={getPageTitleStyle()}>REALISASI ANGGARAN</h1>
        <div style={getPageSubtitleStyle()}>
          Input realisasi agregat bulanan per Sub Kegiatan dan akun belanja level 5
          untuk satu versi RAK, tetap tanpa transaksi individual.
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
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
                Tahun Anggaran {selectedFiscalYear?.year || "-"}
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

        {!defaultRealizationStatus?.id ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            Status realisasi aktif/default belum tersedia. Penyimpanan realisasi akan
            gagal sampai master status realisasi valid.
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
                padding: 16,
                borderRadius: 10,
              }),
              display: "grid",
              gap: 6,
            }}
          >
            <div style={getMetaLabelStyle(prefersDarkMode)}>Sub Kegiatan</div>
            <div style={getTableCellLabelTypography()}>{summaryState.rows.length}</div>
          </div>
          <div
            style={{
              ...getPanelStyle({
                padding: 16,
                borderRadius: 10,
              }),
              display: "grid",
              gap: 6,
            }}
          >
            <div style={getMetaLabelStyle(prefersDarkMode)}>
              Total Plan {selectedMonthMeta.label}
            </div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(summaryTotals.plan_amount)}
            </div>
          </div>
          <div
            style={{
              ...getPanelStyle({
                padding: 16,
                borderRadius: 10,
              }),
              display: "grid",
              gap: 6,
            }}
          >
            <div style={getMetaLabelStyle(prefersDarkMode)}>
              Total Realisasi {selectedMonthMeta.label}
            </div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(summaryTotals.realization_amount)}
            </div>
          </div>
          <div
            style={{
              ...getPanelStyle({
                padding: 16,
                borderRadius: 10,
              }),
              display: "grid",
              gap: 6,
            }}
          >
            <div style={getMetaLabelStyle(prefersDarkMode)}>
              Total Deviation (Plan - Realisasi)
            </div>
            <div style={getTableCellLabelTypography()}>
              {formatCurrency(summaryTotals.deviation_amount)}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={getTableCellLabelTypography()}>
              REALISASI BULAN {String(selectedMonthMeta.label || "").toUpperCase()} PER SUB KEGIATAN
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              style={getInlineActionButtonStyle(prefersDarkMode, {
                isEnabled:
                  !isExporting &&
                  Boolean(selectedFiscalYearId) &&
                  Boolean(selectedRakVersionId) &&
                  Boolean(selectedPeriodMonth),
                tone: "accent",
                height: 36,
              })}
              disabled={
                isExporting ||
                !selectedFiscalYearId ||
                !selectedRakVersionId ||
                !selectedPeriodMonth
              }
            >
              {isExporting ? "Mengekspor..." : "Export Excel"}
            </button>
          </div>
          {dirtyRowCount > 0 ? (
            <div style={getTableCellSubtitleTypography()}>
              {dirtyRowCount} perubahan belum disimpan
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              marginLeft: "auto",
            }}
          >
            {canManagePeriodLock ? (
              <button
                type="button"
                onClick={handleTogglePeriodLock}
                style={getInlineActionButtonStyle(prefersDarkMode, {
                  isEnabled:
                    !periodLockState.isLoading &&
                    !periodLockState.isMutating &&
                    Boolean(selectedFiscalYearId),
                  tone: "neutral",
                  height: 42,
                })}
                disabled={
                  periodLockState.isLoading ||
                  periodLockState.isMutating ||
                  !selectedFiscalYearId
                }
              >
                {periodLockState.isMutating
                  ? "Memproses..."
                  : periodLockState.isLocked
                    ? "Unlock Bulan"
                    : "Lock Bulan"}
              </button>
            ) : null}

            <span
              style={getChipStyle(prefersDarkMode, {
                tone: periodLockState.isLocked ? "warning" : "muted",
                size: "sm",
              })}
            >
              {periodLockState.isLoading
                ? "Memuat status..."
                : periodLockState.isLocked
                  ? "LOCKED"
                  : "OPEN"}
            </span>

            <select
              value={selectedPeriodMonth}
              onChange={(event) => setSelectedPeriodMonth(Number(event.target.value))}
              style={{
                ...getSelectStyle(prefersDarkMode, { tone: "panel", height: 42 }),
                width: 220,
              }}
              aria-label="Pilih bulan realisasi"
            >
              {MONTH_OPTIONS.map((monthOption) => (
                <option key={monthOption.value} value={monthOption.value}>
                  {monthOption.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handlePreviousMonth}
              title="Bulan sebelumnya"
              aria-label="Bulan sebelumnya"
              style={{
                ...getInlineActionButtonStyle(prefersDarkMode, {
                  isEnabled: !isPreviousMonthDisabled,
                  tone: "neutral",
                  height: 42,
                }),
                width: 42,
                minWidth: 42,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isPreviousMonthDisabled ? 0.45 : 1,
                cursor: isPreviousMonthDisabled ? "not-allowed" : "pointer",
              }}
              disabled={isPreviousMonthDisabled}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Bulan berikutnya"
              aria-label="Bulan berikutnya"
              style={{
                ...getInlineActionButtonStyle(prefersDarkMode, {
                  isEnabled: !isNextMonthDisabled,
                  tone: "neutral",
                  height: 42,
                }),
                width: 42,
                minWidth: 42,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isNextMonthDisabled ? 0.45 : 1,
                cursor: isNextMonthDisabled ? "not-allowed" : "pointer",
              }}
              disabled={isNextMonthDisabled}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        {periodLockState.errorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {periodLockState.errorMessage}
          </div>
        ) : null}

        {periodLockState.isLocked ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
            Bulan ini sudah dikunci. Realisasi tidak bisa diubah.
          </div>
        ) : null}

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
            Belum ada data realisasi yang bisa ditampilkan untuk konteks ini.
          </div>
        ) : null}

        {!summaryState.isLoading &&
        !summaryState.errorMessage &&
        summaryState.rows.length > 0 ? (
          <RealizationSubActivityTable
            prefersDarkMode={prefersDarkMode}
            monthLabel={selectedMonthMeta.label}
            rows={summaryState.rows}
            expandedRowKey={expandedRowKey}
            detailStateByKey={detailStateByKey}
            onToggleExpand={handleToggleExpand}
            draftValuesByDetailKey={draftValuesByDetailKey}
            rowMutationStateByDetailKey={rowMutationStateByDetailKey}
            isPeriodLocked={periodLockState.isLocked}
            onDraftChange={handleDraftChange}
            onSaveRow={handleSaveRow}
            onOpenHistory={handleOpenHistory}
          />
        ) : null}
      </section>

      <ToastStack
        prefersDarkMode={prefersDarkMode}
        toasts={toasts}
        onDismiss={dismissToast}
      />

      <ConfirmActionModal
        open={Boolean(pendingConfirmation)}
        title={pendingConfirmation?.title || "Konfirmasi"}
        message={pendingConfirmation?.message || ""}
        onConfirm={handleConfirmPendingAction}
        onCancel={handleCancelPendingAction}
      />

      <RealizationAuditLogModal
        prefersDarkMode={prefersDarkMode}
        isOpen={historyModalState.isOpen}
        context={historyModalState.context}
        rows={historyModalState.rows}
        isLoading={historyModalState.isLoading}
        errorMessage={historyModalState.errorMessage}
        onClose={handleCloseHistory}
      />
    </div>
  );
}
