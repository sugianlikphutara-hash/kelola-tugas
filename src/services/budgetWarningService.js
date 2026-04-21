import { supabase } from "../lib/supabaseClient";
import { getDefaultRakVersion, getRakVersionById } from "./budgetRakService";

async function unwrapQueryResult(promise) {
  const { data, error } = await promise;

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

function toNumericAmount(value) {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function toRequestKey(rakVersionId, scopeKey = "warnings") {
  return `${rakVersionId || "default"}:${scopeKey}`;
}

function isExpectedWarningRow(row) {
  // Guard render ringan. Asumsi leaf level 5 tetap ditegakkan oleh view dan
  // constraint backend, sehingga service hanya menahan row yang jelas tidak
  // memenuhi bentuk minimum warning item anggaran.
  return Boolean(
    row?.rak_version_id &&
      row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name &&
      row?.warning_type
  );
}

async function resolveWarningRakVersion(rakVersionId, fiscalYearId = null) {
  if (rakVersionId) {
    const version = await getRakVersionById(rakVersionId);

    if (!version?.id) {
      throw new Error("Versi RAK tidak ditemukan.");
    }

    if (
      fiscalYearId &&
      version.fiscal_year_id &&
      version.fiscal_year_id !== fiscalYearId
    ) {
      throw new Error("Versi RAK tidak berada pada fiscal year yang dipilih.");
    }

    return version;
  }

  return await getDefaultRakVersion(fiscalYearId);
}

function mapWarningRow(row) {
  const annualPlan = toNumericAmount(row?.annual_plan);
  const annualRealization = toNumericAmount(row?.annual_realization);
  const annualBalance = toNumericAmount(row?.annual_balance);

  return {
    ...row,
    annual_plan: annualPlan,
    annual_realization: annualRealization,
    annual_balance: annualBalance,
    has_balance_mismatch: annualBalance !== annualPlan - annualRealization,
    warning_label: String(row?.warning_type || "")
      .trim()
      .replaceAll("_", " "),
  };
}

export async function getBudgetWarningRows(rakVersionId = null, fiscalYearId = null) {
  const version = await resolveWarningRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null),
    };
  }

  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_warnings")
        .select("*")
        .eq("rak_version_id", version.id)
        .order("warning_type", { ascending: true })
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  const filteredRows = rawRows.filter(isExpectedWarningRow);
  const warnings = [];

  if (filteredRows.length !== rawRows.length) {
    warnings.push(
      `Sejumlah ${rawRows.length - filteredRows.length} row warning diabaikan karena tidak memenuhi asumsi minimum item anggaran.`
    );
  }

  const rows = filteredRows.map(mapWarningRow);
  const mismatchCount = rows.filter((row) => row.has_balance_mismatch).length;

  if (mismatchCount > 0) {
    warnings.push(
      `${mismatchCount} warning memiliki nilai saldo yang tidak sama dengan plan dikurangi realisasi.`
    );
  }

  return {
    rakVersion: version,
    rows,
    warnings,
    requestKey: toRequestKey(version.id),
  };
}
