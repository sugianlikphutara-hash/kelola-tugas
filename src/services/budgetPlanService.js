import { supabase } from "../lib/supabaseClient";
import {
  getDefaultRakVersion,
} from "./budgetRakService";

const DETAIL_MONTH_COLUMNS = [
  "jan_amount",
  "feb_amount",
  "mar_amount",
  "apr_amount",
  "may_amount",
  "jun_amount",
  "jul_amount",
  "aug_amount",
  "sep_amount",
  "oct_amount",
  "nov_amount",
  "dec_amount",
];

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

function sumDetailMonths(row) {
  return DETAIL_MONTH_COLUMNS.reduce(
    (sum, columnName) => sum + toNumericAmount(row?.[columnName]),
    0
  );
}

function isExpectedDetailRow(row) {
  return Boolean(
    row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name
  );
}

async function resolvePlanRakVersion(rakVersionId, fiscalYearId = null) {
  if (rakVersionId) {
    return {
      id: rakVersionId,
      fiscal_year_id: fiscalYearId || null,
    };
  }

  return await getDefaultRakVersion(fiscalYearId);
}

function mapPlanSubActivitySummaryRow(row) {
  return {
    ...row,
    sub_activity_label: [row.sub_activity_code, row.sub_activity_name]
      .filter(Boolean)
      .join(" - "),
  };
}

function mapPlanBudgetItemDetailRow(row) {
  const monthlyTotal = sumDetailMonths(row);
  const annualAmount = toNumericAmount(row.annual_amount);

  return {
    ...row,
    budget_account_label: [row.budget_account_code, row.budget_account_name]
      .filter(Boolean)
      .join(" - "),
    computed_monthly_total: monthlyTotal,
    has_amount_mismatch: annualAmount !== monthlyTotal,
  };
}

export async function getPlanSubActivitySummary(rakVersionId = null, options = {}) {
  const version = await resolvePlanRakVersion(
    rakVersionId,
    options?.fiscalYearId || null
  );

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
    };
  }

  const rows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_rak_sub_activity_summary")
        .select("*")
        .eq("rak_version_id", version.id)
        .order("sub_activity_code", { ascending: true })
    )) || [];

  return {
    rakVersion: version,
    rows: rows.map(mapPlanSubActivitySummaryRow),
    warnings: [],
  };
}

export async function getPlanBudgetItemDetail(
  rakSubActivityId,
  rakVersionId = null,
  options = {}
) {
  if (!rakSubActivityId) {
    throw new Error("rakSubActivityId wajib diisi untuk membaca detail Rencana.");
  }

  const version = await resolvePlanRakVersion(
    rakVersionId,
    options?.fiscalYearId || null
  );

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
    };
  }

  const rows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_rak_budget_item_summary")
        .select("*")
        .eq("rak_version_id", version.id)
        .eq("rak_sub_activity_id", rakSubActivityId)
        .order("budget_account_code", { ascending: true })
    )) || [];

  const warnings = [];
  const filteredOutRows = rows.filter((row) => !isExpectedDetailRow(row));

  if (filteredOutRows.length > 0) {
    const warningMessage = `Sejumlah ${filteredOutRows.length} row detail diabaikan karena tidak memenuhi asumsi minimum Belanja Level 5.`;
    console.warn(
      "[budgetPlanService] Unexpected plan detail rows filtered out",
      {
        rakVersionId: version.id,
        rakSubActivityId,
        filteredOutRows,
      }
    );
    warnings.push(warningMessage);
  }

  const mappedRows = rows
    .filter(isExpectedDetailRow)
    .map(mapPlanBudgetItemDetailRow);

  const mismatchRows = mappedRows.filter((row) => row.has_amount_mismatch);

  if (mismatchRows.length > 0) {
    warnings.push(
      `${mismatchRows.length} item memiliki total bulanan yang tidak sama dengan total tahunan.`
    );
  }

  return {
    rakVersion: version,
    rows: mappedRows,
    warnings,
  };
}
