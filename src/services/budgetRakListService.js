import { supabase } from "../lib/supabaseClient";
import { getBudgetYears } from "./masterDataService";
import {
  activateRakVersion,
  cloneRakVersion,
  getDraftRakVersions,
  getRakVersionById,
  getRakVersions,
} from "./budgetRakService";

const RAK_VERSION_STATUSES = new Set(["DRAFT", "ACTIVE", "ARCHIVED"]);

async function unwrapQueryResult(promise) {
  const { data, error } = await promise;

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

function toNumber(value) {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function compareDescending(leftValue, rightValue) {
  if (leftValue === rightValue) {
    return 0;
  }

  return rightValue > leftValue ? 1 : -1;
}

function sortFiscalYearsDescending(fiscalYears = []) {
  return [...fiscalYears].sort((leftYear, rightYear) =>
    compareDescending(Number(leftYear?.year || 0), Number(rightYear?.year || 0))
  );
}

function sortRakVersionsDescending(versions = []) {
  return [...versions].sort((leftVersion, rightVersion) => {
    const leftVersionNumber = Number(leftVersion?.version_number || 0);
    const rightVersionNumber = Number(rightVersion?.version_number || 0);

    if (leftVersionNumber !== rightVersionNumber) {
      return compareDescending(leftVersionNumber, rightVersionNumber);
    }

    const leftCreatedAt = new Date(leftVersion?.created_at || 0).getTime();
    const rightCreatedAt = new Date(rightVersion?.created_at || 0).getTime();

    return compareDescending(leftCreatedAt, rightCreatedAt);
  });
}

function getTodayCodePart() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date()).replace(/-/g, "");
}

function getTimestampCodePart() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return formatter.format(new Date()).replace(/:/g, "");
}

function buildCloneCode(sourceVersion, siblingVersions = []) {
  const nextVersionNumber =
    siblingVersions.reduce(
      (maxValue, version) =>
        Math.max(maxValue, Number(version?.version_number || 0)),
      0
    ) + 1;

  const fiscalYearCodePart =
    sourceVersion?.fiscal_year_year || sourceVersion?.fiscal_year_label || "FY";

  return [
    "RAK",
    fiscalYearCodePart,
    getTodayCodePart(),
    getTimestampCodePart(),
    `V${nextVersionNumber}`,
  ].join("-");
}

function buildAggregateMaps(subActivityRows = [], itemRows = []) {
  const totalPlanAmountByVersionId = new Map();
  const itemCountByVersionId = new Map();

  subActivityRows.forEach((row) => {
    const versionId = String(row?.rak_version_id || "").trim();

    if (!versionId) {
      return;
    }

    totalPlanAmountByVersionId.set(
      versionId,
      toNumber(totalPlanAmountByVersionId.get(versionId)) +
        toNumber(row?.annual_amount)
    );
  });

  itemRows.forEach((row) => {
    const versionId = String(row?.rak_version_id || "").trim();

    if (!versionId) {
      return;
    }

    itemCountByVersionId.set(
      versionId,
      toNumber(itemCountByVersionId.get(versionId)) + 1
    );
  });

  return {
    totalPlanAmountByVersionId,
    itemCountByVersionId,
  };
}

async function loadVersionAggregateMaps(versionIds = []) {
  if (versionIds.length === 0) {
    return buildAggregateMaps();
  }

  try {
    const [subActivityRows, itemRows] = await Promise.all([
      unwrapQueryResult(
        supabase
          .from("fin_v_rak_sub_activity_summary")
          .select("rak_version_id, annual_amount")
          .in("rak_version_id", versionIds)
      ),
      unwrapQueryResult(
        supabase
          .from("fin_v_rak_budget_item_summary")
          .select("rak_version_id")
          .in("rak_version_id", versionIds)
      ),
    ]);

    return buildAggregateMaps(subActivityRows || [], itemRows || []);
  } catch (error) {
    console.warn(
      "[budgetRakListService] Gagal memuat aggregate summary versi RAK, fallback ke nilai null.",
      error
    );

    return buildAggregateMaps();
  }
}

function mapFiscalYearOption(row) {
  return {
    id: row.id,
    year: Number(row.year || 0),
    label: String(row?.year || ""),
    is_active: Boolean(row?.is_active),
    start_date: row?.start_date || null,
    end_date: row?.end_date || null,
  };
}

function normalizeRakVersionStatus(status) {
  const normalizedStatus = String(status || "").trim().toUpperCase();

  if (RAK_VERSION_STATUSES.has(normalizedStatus)) {
    return normalizedStatus;
  }

  return normalizedStatus || "UNKNOWN";
}

function toFriendlyCloneErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (!rawMessage) {
    return "Gagal membuat clone revisi RAK.";
  }

  if (
    normalizedMessage.includes("duplicate key") ||
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("unique")
  ) {
    return "Kode versi RAK bentrok dengan data yang sudah ada. Silakan coba lagi.";
  }

  if (normalizedMessage.includes("new rak code is required")) {
    return "Kode versi RAK baru tidak valid untuk proses clone revisi.";
  }

  if (normalizedMessage.includes("source rak version not found")) {
    return "Versi RAK sumber tidak ditemukan.";
  }

  if (
    normalizedMessage.includes("status=archived") ||
    normalizedMessage.includes("archived") ||
    normalizedMessage.includes("not allowed")
  ) {
    return "Sistem backend belum mengizinkan clone dari versi ARCHIVED. RPC fin_clone_rak_version perlu disesuaikan.";
  }

  if (normalizedMessage.includes("constraint")) {
    return "Clone revisi gagal karena data versi RAK tidak memenuhi constraint sistem.";
  }

  return rawMessage;
}

function toFriendlyActivateErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (!rawMessage) {
    return "Gagal mengaktifkan draft RAK.";
  }

  if (normalizedMessage.includes("not found")) {
    return "Versi RAK yang akan diaktifkan tidak ditemukan.";
  }

  if (normalizedMessage.includes("sub activities without budget items")) {
    return "Draft RAK belum bisa diaktifkan karena masih ada Sub Kegiatan tanpa item anggaran.";
  }

  if (normalizedMessage.includes("not active leaf level-5 accounts")) {
    return "Draft RAK belum bisa diaktifkan karena ada item yang bukan akun belanja level 5 leaf aktif.";
  }

  if (
    normalizedMessage.includes("annual_amount not equal") ||
    normalizedMessage.includes("jan-dec")
  ) {
    return "Draft RAK belum bisa diaktifkan karena total tahunan item tidak sama dengan akumulasi Jan-Des.";
  }

  return rawMessage;
}

export async function getRakFiscalYears() {
  const fiscalYears = await getBudgetYears();
  return sortFiscalYearsDescending(fiscalYears.map(mapFiscalYearOption));
}

export function resolveDefaultRakFiscalYear(fiscalYears = []) {
  const activeFiscalYear = fiscalYears.find((item) => item.is_active);

  if (activeFiscalYear) {
    return activeFiscalYear;
  }

  return sortFiscalYearsDescending(fiscalYears)[0] || null;
}

export async function getRakVersionListByFiscalYear(fiscalYearId) {
  const versions = sortRakVersionsDescending(
    await getRakVersions(fiscalYearId ? { fiscalYearId } : {})
  );
  const aggregateMaps = await loadVersionAggregateMaps(
    versions.map((version) => version.id)
  );

  return versions.map((version) => ({
    ...version,
    status: normalizeRakVersionStatus(version?.status),
    display_name: version?.title || version?.code || "-",
    notes: version?.notes || null,
    total_plan_amount: aggregateMaps.totalPlanAmountByVersionId.has(version.id)
      ? aggregateMaps.totalPlanAmountByVersionId.get(version.id)
      : null,
    item_count: aggregateMaps.itemCountByVersionId.has(version.id)
      ? aggregateMaps.itemCountByVersionId.get(version.id)
      : null,
  }));
}

export async function cloneRakVersionRevision(sourceVersion, siblingVersions = []) {
  if (!sourceVersion?.id) {
    throw new Error("Versi RAK sumber tidak valid untuk clone revisi.");
  }

  const normalizedSourceStatus = normalizeRakVersionStatus(sourceVersion?.status);

  if (!["ACTIVE", "ARCHIVED"].includes(normalizedSourceStatus)) {
    throw new Error(
      "Clone sebagai draft hanya boleh dilakukan dari versi RAK ACTIVE atau ARCHIVED."
    );
  }

  const draftVersions = await getDraftRakVersions({
    fiscalYearId: sourceVersion.fiscal_year_id,
  });

  if (draftVersions.length > 0) {
    throw new Error(
      "Sudah ada versi RAK DRAFT pada Tahun Anggaran ini. Selesaikan atau aktifkan draft tersebut terlebih dahulu."
    );
  }

  try {
    return await cloneRakVersion({
      sourceRakVersionId: sourceVersion.id,
      newCode: buildCloneCode(sourceVersion, siblingVersions),
      newTitle: null,
      newRakDate: new Date().toISOString().slice(0, 10),
      notes: sourceVersion?.notes || null,
      createdBy: null,
    });
  } catch (error) {
    throw new Error(toFriendlyCloneErrorMessage(error));
  }
}

export async function activateDraftRakVersion(rakVersionId) {
  if (!rakVersionId) {
    throw new Error("rakVersionId wajib diisi untuk aktivasi RAK.");
  }

  const version = await getRakVersionById(rakVersionId);

  if (!version?.id) {
    throw new Error("Versi RAK yang akan diaktifkan tidak ditemukan.");
  }

  if (normalizeRakVersionStatus(version?.status) !== "DRAFT") {
    throw new Error("Activate draft hanya boleh dilakukan pada versi RAK berstatus DRAFT.");
  }

  try {
    return await activateRakVersion(rakVersionId);
  } catch (error) {
    throw new Error(toFriendlyActivateErrorMessage(error));
  }
}
