import { useEffect, useMemo, useRef, useState } from "react";
import ToastStack from "../components/ui/ToastStack";
import AddDraftBudgetItemModal from "../components/budgeting/AddDraftBudgetItemModal";
import EditRakMetadataModal from "../components/budgeting/EditRakMetadataModal";
import SubActivityTable from "../components/budgeting/SubActivityTable";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../hooks/useToasts";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  getAlertStyle,
  getChipStyle,
  getEmptyStateStyle,
  getLoadingStateStyle,
  getMetaLabelStyle,
  getFormLabelTypography,
  getOutlinedButtonStyle,
  getPageSubtitleStyle,
  getPanelStyle,
  getSelectStyle,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
} from "../lib/controlStyles";
import { canEditRakDraft } from "../lib/authorization";
import {
  getDraftActivationReadiness,
  getDraftPlanEditorOptions,
  getPlanBudgetItemDetail,
  getPlanSubActivitySummary,
} from "../services/budgetPlanService";
import { getDefaultRakVersion, getRakVersionById, getRakVersions, createDraftRakBudgetItem, deleteDraftRakBudgetItem, updateDraftRakBudgetItem, updateDraftRakVersionMetadata } from "../services/budgetRakService";

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

export default function BudgetPlanPage({ forcedRakVersionId = "" }) {
  const prefersDarkMode = usePrefersDarkMode();
  const auth = useAuth();
  const { toasts, pushToast, dismissToast } = useToasts({ defaultDurationMs: 5000 });
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
  const [pendingDraftRowActionKey, setPendingDraftRowActionKey] = useState("");
  const [draftEditorOptions, setDraftEditorOptions] = useState({
    budgetAccounts: [],
    defaultNewItemChangeStatusId: null,
  });
  const [addItemModalState, setAddItemModalState] = useState({
    isOpen: false,
    subActivityRow: null,
    existingRows: [],
    isSubmitting: false,
    errorMessage: "",
  });
  const [readinessState, setReadinessState] = useState({
    isLoading: false,
    errorMessage: "",
    data: null,
  });
  const [metadataModalState, setMetadataModalState] = useState({
    isOpen: false,
    isSubmitting: false,
    errorMessage: "",
  });
  const totalAnnualAmount = useMemo(
    () =>
      summaryState.rows.reduce(
        (sum, row) => sum + Number(row.annual_amount || 0),
        0
      ),
    [summaryState.rows]
  );
  const selectedVersion = useMemo(
    () =>
      versionOptions.find((version) => version.id === selectedRakVersionId) ||
      summaryState.rakVersion ||
      null,
    [selectedRakVersionId, summaryState.rakVersion, versionOptions]
  );
  const canEditCurrentDraft = canEditRakDraft(auth.roleCode);
  const isDraftEditable =
    selectedVersion?.status === "DRAFT" && canEditCurrentDraft;
  const isDraftReadOnlyByRole =
    selectedVersion?.status === "DRAFT" && !canEditCurrentDraft;

  useEffect(() => {
    selectedRakVersionIdRef.current = selectedRakVersionId;
  }, [selectedRakVersionId]);

  useEffect(() => {
    if (!forcedRakVersionId) {
      return;
    }

    setSelectedRakVersionId(forcedRakVersionId);
  }, [forcedRakVersionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadDraftEditorOptions() {
      try {
        const result = await getDraftPlanEditorOptions();

        if (!isMounted) {
          return;
        }

        setDraftEditorOptions(result);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error(error);
      }
    }

    loadDraftEditorOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadVersions() {
      setLoadingVersions(true);
      setVersionErrorMessage("");

      try {
        const allVersions = await getRakVersions();

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
        const defaultVersion = forcedRakVersionId
          ? sortedVersions.find((version) => version.id === forcedRakVersionId) || null
          : await getDefaultRakVersion();
        const defaultVersionId =
          forcedRakVersionId || defaultVersion?.id || sortedVersions[0]?.id || "";

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
  }, [forcedRakVersionId]);

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

  useEffect(() => {
    handleCloseAddBudgetItem();
    handleCloseMetadataModal();
  }, [selectedRakVersionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadReadiness() {
      if (!selectedRakVersionId || selectedVersion?.status !== "DRAFT") {
        setReadinessState({
          isLoading: false,
          errorMessage: "",
          data: null,
        });
        return;
      }

      setReadinessState({
        isLoading: true,
        errorMessage: "",
        data: null,
      });

      try {
        const result = await getDraftActivationReadiness(selectedRakVersionId);

        if (!isMounted) {
          return;
        }

        setReadinessState({
          isLoading: false,
          errorMessage: "",
          data: result,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setReadinessState({
          isLoading: false,
          errorMessage:
            error?.message || "Gagal memuat kesiapan aktivasi draft.",
          data: null,
        });
      }
    }

    loadReadiness();

    return () => {
      isMounted = false;
    };
  }, [selectedRakVersionId, selectedVersion?.status]);

  function toFriendlyMutationErrorMessage(error) {
    const rawMessage = String(error?.message || "").trim();
    const normalizedMessage = rawMessage.toLowerCase();

    if (!rawMessage) {
      return "Operasi item anggaran gagal diproses.";
    }

    if (normalizedMessage.includes("duplicate key")) {
      return "Akun belanja tersebut sudah ada pada Sub Kegiatan ini.";
    }

    if (normalizedMessage.includes("not active leaf level-5 accounts")) {
      return "Akun belanja harus aktif, leaf, dan level 5.";
    }

    if (
      normalizedMessage.includes("not editable") ||
      normalizedMessage.includes("is not editable") ||
      normalizedMessage.includes("status=active") ||
      normalizedMessage.includes("status=archived") ||
      normalizedMessage.includes("bukan draft")
    ) {
      return "Versi RAK ini sudah tidak berstatus DRAFT. Refresh halaman.";
    }

    if (normalizedMessage.includes("angka yang valid")) {
      return rawMessage;
    }

    return rawMessage;
  }

  function toFriendlyMetadataErrorMessage(error) {
    const rawMessage = String(error?.message || "").trim();
    const normalizedMessage = rawMessage.toLowerCase();

    if (
      normalizedMessage.includes("sudah tidak berstatus draft") ||
      normalizedMessage.includes("status=draft") ||
      normalizedMessage.includes("bukan draft") ||
      normalizedMessage.includes("not draft")
    ) {
      return "Versi RAK ini sudah tidak berstatus DRAFT. Refresh halaman.";
    }

    if (!rawMessage) {
      return "Gagal menyimpan metadata versi RAK.";
    }

    return rawMessage;
  }

  async function assertSelectedVersionIsStillDraft() {
    const currentVersionId = selectedRakVersionIdRef.current;

    if (!currentVersionId) {
      throw new Error("Versi RAK ini sudah tidak berstatus DRAFT. Refresh halaman.");
    }

    const latestVersion = await getRakVersionById(currentVersionId);

    if (latestVersion?.status !== "DRAFT") {
      throw new Error("Versi RAK ini sudah tidak berstatus DRAFT. Refresh halaman.");
    }

    return latestVersion;
  }

  async function refreshSummaryForVersion(rakVersionId) {
    const result = await getPlanSubActivitySummary(rakVersionId);

    setSummaryState({
      rakVersion: result.rakVersion,
      rows: result.rows,
      isLoading: false,
      errorMessage: "",
    });
  }

  async function refreshVersionOptions(currentVersionId = selectedRakVersionIdRef.current) {
    const allVersions = await getRakVersions();
    const sortedVersions = [...allVersions].sort((leftVersion, rightVersion) => {
      const leftDate = new Date(leftVersion.rak_date || 0).getTime();
      const rightDate = new Date(rightVersion.rak_date || 0).getTime();

      if (rightDate !== leftDate) {
        return rightDate - leftDate;
      }

      return Number(rightVersion.version_number || 0) - Number(leftVersion.version_number || 0);
    });

    setVersionOptions(sortedVersions);
    setSelectedRakVersionId((currentValue) => currentValue || currentVersionId || "");
  }

  async function refreshDraftReadinessForVersion(rakVersionId) {
    if (!rakVersionId || selectedVersion?.status !== "DRAFT") {
      setReadinessState({
        isLoading: false,
        errorMessage: "",
        data: null,
      });
      return;
    }

    setReadinessState((currentState) => ({
      ...currentState,
      isLoading: true,
      errorMessage: "",
    }));

    try {
      const result = await getDraftActivationReadiness(rakVersionId);

      setReadinessState({
        isLoading: false,
        errorMessage: "",
        data: result,
      });
    } catch (error) {
      setReadinessState({
        isLoading: false,
        errorMessage:
          error?.message || "Gagal memuat kesiapan aktivasi draft.",
        data: null,
      });
    }
  }

  async function refreshDetailForRow(row) {
    const detailKey = `${row.rak_version_id}:${row.rak_sub_activity_id}`;

    setDetailStateByKey((currentState) => ({
      ...currentState,
      [detailKey]: {
        rows: currentState[detailKey]?.rows || [],
        isLoading: true,
        errorMessage: "",
        warningMessages: currentState[detailKey]?.warningMessages || [],
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
    await refreshDetailForRow(row);
  }

  async function handleSaveDraftRow(row, payload) {
    if (!isDraftEditable || !row?.id) {
      return;
    }

    setPendingDraftRowActionKey(`save:${row.id}`);

    try {
      await assertSelectedVersionIsStillDraft();
      await updateDraftRakBudgetItem(row.id, payload);
      const summaryRow =
        summaryState.rows.find(
          (item) =>
            item.rak_sub_activity_id === row.rak_sub_activity_id &&
            item.rak_version_id === row.rak_version_id
        ) || null;

      if (summaryRow) {
        await refreshDetailForRow(summaryRow);
      }
      await refreshSummaryForVersion(selectedRakVersionIdRef.current);
      await refreshDraftReadinessForVersion(selectedRakVersionIdRef.current);
      pushToast({ type: "success", message: "Item anggaran draft berhasil disimpan." });
    } catch (error) {
      pushToast({
        type: "error",
        message: toFriendlyMutationErrorMessage(error),
      });
    } finally {
      setPendingDraftRowActionKey("");
    }
  }

  async function handleDeleteDraftRow(row) {
    if (!isDraftEditable || !row?.id) {
      return;
    }

    setPendingDraftRowActionKey(`delete:${row.id}`);

    try {
      await assertSelectedVersionIsStillDraft();
      await deleteDraftRakBudgetItem(row.id);
      const summaryRow =
        summaryState.rows.find(
          (item) =>
            item.rak_sub_activity_id === row.rak_sub_activity_id &&
            item.rak_version_id === row.rak_version_id
        ) || null;

      if (summaryRow) {
        await refreshDetailForRow(summaryRow);
      }
      await refreshSummaryForVersion(selectedRakVersionIdRef.current);
      await refreshDraftReadinessForVersion(selectedRakVersionIdRef.current);
      pushToast({ type: "success", message: "Item anggaran draft berhasil dihapus." });
    } catch (error) {
      pushToast({
        type: "error",
        message: toFriendlyMutationErrorMessage(error),
      });
    } finally {
      setPendingDraftRowActionKey("");
    }
  }

  function handleOpenAddBudgetItem(subActivityRow, existingRows) {
    if (!isDraftEditable) {
      return;
    }

    setAddItemModalState({
      isOpen: true,
      subActivityRow,
      existingRows: existingRows || [],
      isSubmitting: false,
      errorMessage: "",
    });
  }

  function handleCloseAddBudgetItem() {
    setAddItemModalState({
      isOpen: false,
      subActivityRow: null,
      existingRows: [],
      isSubmitting: false,
      errorMessage: "",
    });
  }

  function handleOpenMetadataModal() {
    setMetadataModalState({
      isOpen: true,
      isSubmitting: false,
      errorMessage: "",
    });
  }

  function handleCloseMetadataModal() {
    setMetadataModalState({
      isOpen: false,
      isSubmitting: false,
      errorMessage: "",
    });
  }

  async function handleSubmitAddBudgetItem(form) {
    if (!isDraftEditable) {
      return;
    }

    const subActivityRow = addItemModalState.subActivityRow;

    if (!subActivityRow?.rak_sub_activity_id) {
      return;
    }

    if (!draftEditorOptions.defaultNewItemChangeStatusId) {
      setAddItemModalState((current) => ({
        ...current,
        errorMessage: "Status perubahan item default tidak tersedia di sistem.",
      }));
      return;
    }

    setAddItemModalState((current) => ({
      ...current,
      isSubmitting: true,
      errorMessage: "",
    }));

    try {
      await assertSelectedVersionIsStillDraft();
      await createDraftRakBudgetItem({
        rak_sub_activity_id: subActivityRow.rak_sub_activity_id,
        budget_account_id: form.budget_account_id,
        item_change_status_id: draftEditorOptions.defaultNewItemChangeStatusId,
        jan_amount: Number(form.jan_amount || 0),
        feb_amount: Number(form.feb_amount || 0),
        mar_amount: Number(form.mar_amount || 0),
        apr_amount: Number(form.apr_amount || 0),
        may_amount: Number(form.may_amount || 0),
        jun_amount: Number(form.jun_amount || 0),
        jul_amount: Number(form.jul_amount || 0),
        aug_amount: Number(form.aug_amount || 0),
        sep_amount: Number(form.sep_amount || 0),
        oct_amount: Number(form.oct_amount || 0),
        nov_amount: Number(form.nov_amount || 0),
        dec_amount: Number(form.dec_amount || 0),
      });

      await refreshDetailForRow(subActivityRow);
      await refreshSummaryForVersion(selectedRakVersionIdRef.current);
      await refreshDraftReadinessForVersion(selectedRakVersionIdRef.current);
      handleCloseAddBudgetItem();
      pushToast({ type: "success", message: "Akun belanja draft berhasil ditambahkan." });
    } catch (error) {
      setAddItemModalState((current) => ({
        ...current,
        isSubmitting: false,
        errorMessage: toFriendlyMutationErrorMessage(error),
      }));
    }
  }

  async function handleSubmitMetadata(payload) {
    if (!isDraftEditable || !selectedVersion?.id) {
      return;
    }

    setMetadataModalState((current) => ({
      ...current,
      isSubmitting: true,
      errorMessage: "",
    }));

    try {
      await assertSelectedVersionIsStillDraft();
      await updateDraftRakVersionMetadata(selectedVersion.id, payload);
      await refreshVersionOptions(selectedVersion.id);
      await refreshSummaryForVersion(selectedVersion.id);
      handleCloseMetadataModal();
      pushToast({
        type: "success",
        message: "Metadata versi RAK berhasil diperbarui.",
      });
    } catch (error) {
      setMetadataModalState((current) => ({
        ...current,
        isSubmitting: false,
        errorMessage: toFriendlyMetadataErrorMessage(error),
      }));
    }
  }

  const availableBudgetAccountOptions = useMemo(() => {
    const existingBudgetAccountIds = new Set(
      (addItemModalState.existingRows || [])
        .map((item) => String(item?.budget_account_id || "").trim())
        .filter(Boolean)
    );

    return draftEditorOptions.budgetAccounts.filter(
      (item) => !existingBudgetAccountIds.has(String(item.id || "").trim())
    );
  }, [addItemModalState.existingRows, draftEditorOptions.budgetAccounts]);

  return (
    <div style={{ paddingBottom: 60, display: "grid", gap: 18 }}>
      <ToastStack
        prefersDarkMode={prefersDarkMode}
        toasts={toasts}
        onDismiss={dismissToast}
      />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={getPageSubtitleStyle()}>RENCANA ANGGARAN</div>
        <div style={getFormLabelTypography()}>
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
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 16,
                minWidth: 0,
                flex: "1 1 520px",
              }}
            >
              <div style={{ display: "grid", gap: 4, alignContent: "center" }}>
                <div style={getMetaLabelStyle(prefersDarkMode)}>Versi Terpilih</div>
                <div style={getTableCellLabelTypography()}>
                  {selectedVersion?.title || selectedVersion?.code || "Belum ada versi"}
                </div>
              </div>

              {selectedVersion ? (
                <>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 1,
                      background: "var(--border-strong)",
                    }}
                  />
                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                      alignContent: "center",
                      minWidth: 220,
                    }}
                  >
                    {selectedVersion.notes ? (
                      <div style={getTableCellSubtitleTypography()}>
                        {selectedVersion.notes}
                      </div>
                    ) : null}
                    {selectedVersion.rak_date ? (
                      <div style={getTableCellSubtitleTypography()}>
                        Tanggal RAK: {selectedVersion.rak_date}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            {selectedVersion ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div
                  style={getChipStyle(prefersDarkMode, {
                    tone: getVersionStatusTone(selectedVersion.status),
                    size: "sm",
                  })}
                >
                  {selectedVersion.status}
                </div>
                {!isDraftEditable ? (
                  <div
                    style={getChipStyle(prefersDarkMode, {
                      tone: "muted",
                      size: "sm",
                    })}
                  >
                    Read-only
                  </div>
                ) : null}
                {isDraftEditable ? (
                  <button
                    type="button"
                    onClick={handleOpenMetadataModal}
                    style={getOutlinedButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      height: 36,
                      size: "sm",
                    })}
                  >
                    Edit Metadata
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {versionErrorMessage ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
            {versionErrorMessage}
          </div>
        ) : null}

        {isDraftReadOnlyByRole ? (
          <div style={getAlertStyle(prefersDarkMode, { tone: "info" })}>
            Anda tidak memiliki izin untuk mengedit draft RAK.
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

      {isDraftEditable ? (
        <section
          style={{
            ...getPanelStyle({ padding: 16, borderRadius: 12 }),
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={getMetaLabelStyle(prefersDarkMode)}>Kesiapan Aktivasi</div>
            <div style={getTableCellLabelTypography()}>
              {readinessState.isLoading
                ? "Memeriksa kesiapan aktivasi..."
                : readinessState.data?.isReady
                  ? "Siap diaktifkan"
                  : "Belum siap diaktifkan"}
            </div>
          </div>

          {readinessState.isLoading ? (
            <div style={getLoadingStateStyle(prefersDarkMode)}>
              Memuat readiness check draft...
            </div>
          ) : null}

          {!readinessState.isLoading && readinessState.errorMessage ? (
            <div style={getAlertStyle(prefersDarkMode, { tone: "error" })}>
              {readinessState.errorMessage}
            </div>
          ) : null}

          {!readinessState.isLoading && !readinessState.errorMessage && readinessState.data ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div
                  style={getChipStyle(prefersDarkMode, {
                    tone: readinessState.data.isReady ? "success" : "warning",
                    size: "sm",
                  })}
                >
                  {readinessState.data.isReady ? "Siap diaktifkan" : "Belum siap diaktifkan"}
                </div>
                <div
                  style={getChipStyle(prefersDarkMode, {
                    tone: "muted",
                    size: "sm",
                  })}
                >
                  {`${readinessState.data.summary.subActivityCount} Sub Kegiatan`}
                </div>
                <div
                  style={getChipStyle(prefersDarkMode, {
                    tone: "muted",
                    size: "sm",
                  })}
                >
                  {`${readinessState.data.summary.itemCount} item`}
                </div>
                <div
                  style={getChipStyle(prefersDarkMode, {
                    tone: "muted",
                    size: "sm",
                  })}
                >
                  {formatCurrency(readinessState.data.summary.totalAnnualAmount)}
                </div>
              </div>

              {readinessState.data.issues.length > 0 ? (
                <div style={getAlertStyle(prefersDarkMode, { tone: "warning" })}>
                  <div style={{ display: "grid", gap: 6 }}>
                    {readinessState.data.issues.map((issue, index) => (
                      <div key={`${index}-${issue}`}>{issue}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={getAlertStyle(prefersDarkMode, { tone: "success" })}>
                  Draft RAK sudah lulus pre-check kesiapan aktivasi. Validasi final tetap mengikuti RPC activate.
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={getTableCellLabelTypography()}>
          TABEL UTAMA RENCANA PER SUB KEGIATAN
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
            Belum ada data.
          </div>
        ) : null}

        {!summaryState.isLoading &&
        !summaryState.errorMessage &&
        summaryState.rows.length > 0 ? (
          <SubActivityTable
            prefersDarkMode={prefersDarkMode}
            rows={summaryState.rows}
            expandedRowKey={expandedRowKey}
            detailStateByKey={detailStateByKey}
            onToggleExpand={handleToggleExpand}
            isEditable={isDraftEditable}
            pendingRowActionKey={pendingDraftRowActionKey}
            onSaveRow={handleSaveDraftRow}
            onDeleteRow={handleDeleteDraftRow}
            onOpenAddBudgetItem={handleOpenAddBudgetItem}
          />
        ) : null}
      </section>

      <AddDraftBudgetItemModal
        key={
          addItemModalState.isOpen
            ? `add-${addItemModalState.subActivityRow?.rak_sub_activity_id || "open"}`
            : "add-closed"
        }
        prefersDarkMode={prefersDarkMode}
        isOpen={addItemModalState.isOpen}
        subActivityRow={addItemModalState.subActivityRow}
        budgetAccountOptions={availableBudgetAccountOptions}
        isSubmitting={addItemModalState.isSubmitting}
        errorMessage={addItemModalState.errorMessage}
        onClose={handleCloseAddBudgetItem}
        onSubmit={handleSubmitAddBudgetItem}
      />

      <EditRakMetadataModal
        key={
          metadataModalState.isOpen
            ? `metadata-${selectedVersion?.id || "open"}`
            : "metadata-closed"
        }
        prefersDarkMode={prefersDarkMode}
        isOpen={metadataModalState.isOpen}
        version={selectedVersion}
        isSubmitting={metadataModalState.isSubmitting}
        errorMessage={metadataModalState.errorMessage}
        onClose={handleCloseMetadataModal}
        onSubmit={handleSubmitMetadata}
      />
    </div>
  );
}
