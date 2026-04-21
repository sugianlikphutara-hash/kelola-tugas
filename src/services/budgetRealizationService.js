import { supabase } from "../lib/supabaseClient";
import { getDefaultRakVersion, getRakVersionById } from "./budgetRakService";

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
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

function toRequestKey(rakVersionId, scopeKey = "all") {
  return `${rakVersionId || "default"}:${scopeKey}`;
}

function sumMonthlyValues(row, suffix) {
  return MONTH_KEYS.reduce(
    (sum, monthKey) => sum + toNumericAmount(row?.[`${monthKey}_${suffix}`]),
    0
  );
}

function isExpectedBalanceRow(row) {
  // Guard render ringan. Validasi "active leaf level 5" diasumsikan sudah
  // ditegakkan oleh constraint dan view backend, sehingga service hanya
  // menahan row yang jelas tidak memenuhi bentuk minimum detail item.
  return Boolean(
    row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name
  );
}

async function resolveRealizationRakVersion(rakVersionId, fiscalYearId = null) {
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

function mapRealizationSummaryRow(summaryRow, detailAggregate = null) {
  const annualPlan = toNumericAmount(summaryRow?.annual_amount);
  const annualRealization = toNumericAmount(detailAggregate?.annual_realization);

  return {
    ...summaryRow,
    annual_plan: annualPlan,
    annual_realization: annualRealization,
    annual_balance: annualPlan - annualRealization,
    detail_annual_plan: toNumericAmount(detailAggregate?.annual_plan),
    detail_annual_balance: toNumericAmount(detailAggregate?.annual_balance),
  };
}

function mapRealizationDetailRow(row) {
  const annualPlan = toNumericAmount(row?.annual_plan);
  const annualRealization = toNumericAmount(row?.annual_realization);
  const annualBalance = toNumericAmount(row?.annual_balance);
  const computedPlan = sumMonthlyValues(row, "plan");
  const computedRealization = sumMonthlyValues(row, "realization");
  const computedBalance = sumMonthlyValues(row, "balance");

  return {
    ...row,
    annual_plan: annualPlan,
    annual_realization: annualRealization,
    annual_balance: annualBalance,
    computed_annual_plan: computedPlan,
    computed_annual_realization: computedRealization,
    computed_annual_balance: computedBalance,
    has_plan_mismatch: annualPlan !== computedPlan,
    has_realization_mismatch: annualRealization !== computedRealization,
    has_balance_mismatch: annualBalance !== computedBalance,
  };
}

function aggregateBalanceRows(rows = []) {
  const aggregateBySubActivityId = new Map();

  rows.forEach((row) => {
    const subActivityId = row.sub_activity_id;
    if (!subActivityId) {
      return;
    }

    const currentAggregate = aggregateBySubActivityId.get(subActivityId) || {
      annual_plan: 0,
      annual_realization: 0,
      annual_balance: 0,
      detail_count: 0,
    };

    currentAggregate.annual_plan += toNumericAmount(row.annual_plan);
    currentAggregate.annual_realization += toNumericAmount(row.annual_realization);
    currentAggregate.annual_balance += toNumericAmount(row.annual_balance);
    currentAggregate.detail_count += 1;

    aggregateBySubActivityId.set(subActivityId, currentAggregate);
  });

  return aggregateBySubActivityId;
}


export async function getRealizationSubActivitySummary(
  rakVersionId = null,
  fiscalYearId = null
) {
  const version = await resolveRealizationRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, "summary"),
    };
  }

  const [subActivitySummaryRows, rawBalanceRows] = await Promise.all([
    unwrapQueryResult(
      supabase
        .from("fin_v_rak_sub_activity_summary")
        .select("*")
        .eq("rak_version_id", version.id)
        .order("sub_activity_code", { ascending: true })
    ),
    unwrapQueryResult(
      supabase
        .from("fin_v_budget_balance_summary")
        .select("*")
        .eq("rak_version_id", version.id)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    ),
  ]);

  const warnings = [];
  const balanceRows = (rawBalanceRows || []).filter(isExpectedBalanceRow);
  const filteredOutCount = (rawBalanceRows || []).length - balanceRows.length;

  if (filteredOutCount > 0) {
    warnings.push(
      `Sejumlah ${filteredOutCount} row balance diabaikan karena tidak memenuhi asumsi minimum Belanja Level 5.`
    );
  }

  const aggregatesBySubActivityId = aggregateBalanceRows(balanceRows);
  const summaryRows = (subActivitySummaryRows || []).map((summaryRow) =>
    mapRealizationSummaryRow(
      summaryRow,
      aggregatesBySubActivityId.get(summaryRow.sub_activity_id)
    )
  );

  const unknownAggregateCount = [...aggregatesBySubActivityId.keys()].filter(
    (subActivityId) =>
      !(subActivitySummaryRows || []).some(
        (summaryRow) => summaryRow.sub_activity_id === subActivityId
      )
  ).length;

  if (unknownAggregateCount > 0) {
    warnings.push(
      `${unknownAggregateCount} agregat realisasi tidak bisa dipetakan ke Sub Kegiatan pada versi RAK ini.`
    );
  }

  const planMismatchCount = summaryRows.filter(
    (row) => row.annual_plan !== row.detail_annual_plan
  ).length;

  if (planMismatchCount > 0) {
    warnings.push(
      `${planMismatchCount} Sub Kegiatan memiliki total plan detail yang tidak sama dengan summary RAK.`
    );
  }

  return {
    rakVersion: version,
    rows: summaryRows,
    warnings,
    requestKey: toRequestKey(version.id, "summary"),
  };
}

export async function getRealizationBudgetItemDetail(
  rakVersionId,
  rakSubActivityId
) {
  if (!rakVersionId) {
    throw new Error("rakVersionId wajib diisi untuk membaca detail Realisasi.");
  }

  if (!rakSubActivityId) {
    throw new Error("rakSubActivityId wajib diisi untuk membaca detail Realisasi.");
  }

  const version = await resolveRealizationRakVersion(rakVersionId);

  if (!version?.id) {
    throw new Error("Versi RAK tidak ditemukan.");
  }

  const subActivity = await unwrapQueryResult(
    supabase
      .from("fin_v_rak_sub_activity_summary")
      .select("*")
      .eq("rak_version_id", version.id)
      .eq("rak_sub_activity_id", rakSubActivityId)
      .single()
  );

  const rawBalanceRows =
    await unwrapQueryResult(
      supabase
        .from("fin_v_budget_balance_summary")
        .select("*")
        .eq("rak_version_id", version.id)
        .eq("sub_activity_id", subActivity.sub_activity_id)
        .order("budget_account_code", { ascending: true })
    );

  const warnings = [];
  const nextBalanceRows = rawBalanceRows || [];
  const filteredRows = nextBalanceRows.filter(isExpectedBalanceRow);
  const filteredOutCount = nextBalanceRows.length - filteredRows.length;

  if (filteredOutCount > 0) {
    warnings.push(
      `Sejumlah ${filteredOutCount} row detail realisasi diabaikan karena tidak memenuhi asumsi minimum Belanja Level 5.`
    );
  }

  const rows = filteredRows.map(mapRealizationDetailRow);
  const mismatchCount = rows.filter(
    (row) =>
      row.has_plan_mismatch ||
      row.has_realization_mismatch ||
      row.has_balance_mismatch
  ).length;

  if (mismatchCount > 0) {
    warnings.push(
      `${mismatchCount} item memiliki total bulanan yang tidak sama dengan total tahunannya.`
    );
  }

  return {
    rakVersion: version,
    subActivity,
    rows,
    warnings,
    requestKey: toRequestKey(version.id, rakSubActivityId),
  };
}
