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

function toRequestKey(rakVersionId, scopeKey = "all") {
  return `${rakVersionId || "default"}:${scopeKey}`;
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

function mapRealizationSummaryRow(summaryRow) {
  const monthlyPlan = toNumericAmount(summaryRow?.plan_amount);
  const monthlyRealization = toNumericAmount(summaryRow?.realization_amount);

  return {
    ...summaryRow,
    plan_amount: monthlyPlan,
    realization_amount: monthlyRealization,
    deviation_amount: monthlyPlan - monthlyRealization,
  };
}

function mapRealizationDetailRow(row) {
  const planAmount = toNumericAmount(row?.plan);
  const realizationAmount = toNumericAmount(row?.realization);
  const deviationAmount = toNumericAmount(row?.balance);

  return {
    ...row,
    plan_amount: planAmount,
    realization_amount: realizationAmount,
    deviation_amount: deviationAmount,
    is_overspend: realizationAmount > planAmount,
    has_warning: planAmount === 0 ? realizationAmount > 0 : realizationAmount > planAmount,
  };
}

function aggregateMonthlyRows(rows = []) {
  const aggregateBySubActivityId = new Map();

  rows.forEach((row) => {
    const subActivityId = row.sub_activity_id;
    if (!subActivityId) {
      return;
    }

    const currentAggregate = aggregateBySubActivityId.get(subActivityId) || {
      plan_amount: 0,
      realization_amount: 0,
      deviation_amount: 0,
      detail_count: 0,
    };

    currentAggregate.plan_amount += toNumericAmount(row.plan);
    currentAggregate.realization_amount += toNumericAmount(row.realization);
    currentAggregate.deviation_amount += toNumericAmount(row.balance);
    currentAggregate.detail_count += 1;

    aggregateBySubActivityId.set(subActivityId, currentAggregate);
  });

  return aggregateBySubActivityId;
}

export async function getBudgetRealizationStatuses() {
  return (
    await unwrapQueryResult(
      supabase
        .from("fin_budget_realization_statuses")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true })
    )
  ) || [];
}

export async function getDefaultBudgetRealizationStatus() {
  const statuses = await getBudgetRealizationStatuses();
  return statuses[0] || null;
}

export async function getRealizationSubActivitySummary(
  rakVersionId = null,
  fiscalYearId = null,
  periodMonth = null
) {
  const version = await resolveRealizationRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, `summary:${periodMonth || "all"}`),
    };
  }

  if (!periodMonth) {
    throw new Error("periodMonth wajib diisi untuk membaca realisasi bulanan.");
  }

  const [subActivitySummaryRows, rawMonthlyRows] = await Promise.all([
    unwrapQueryResult(
      supabase
        .from("fin_v_rak_sub_activity_summary")
        .select("*")
        .eq("rak_version_id", version.id)
        .order("sub_activity_code", { ascending: true })
    ),
    unwrapQueryResult(
      supabase
        .from("fin_v_budget_balance_unpivot")
        .select("*")
        .eq("rak_version_id", version.id)
        .eq("period_month", periodMonth)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    ),
  ]);

  const warnings = [];
  const balanceRows = (rawMonthlyRows || []).filter(isExpectedBalanceRow);
  const filteredOutCount = (rawMonthlyRows || []).length - balanceRows.length;

  if (filteredOutCount > 0) {
    warnings.push(
      `Sejumlah ${filteredOutCount} row realisasi bulanan diabaikan karena tidak memenuhi asumsi minimum Belanja Level 5.`
    );
  }

  const aggregatesBySubActivityId = aggregateMonthlyRows(balanceRows);
  const summaryRows = (subActivitySummaryRows || []).map((summaryRow) =>
    mapRealizationSummaryRow({
      ...summaryRow,
      ...(aggregatesBySubActivityId.get(summaryRow.sub_activity_id) || {}),
    })
  );

  const unknownAggregateCount = [...aggregatesBySubActivityId.keys()].filter(
    (subActivityId) =>
      !(subActivitySummaryRows || []).some(
        (summaryRow) => summaryRow.sub_activity_id === subActivityId
      )
  ).length;

  if (unknownAggregateCount > 0) {
    warnings.push(
      `${unknownAggregateCount} agregat realisasi bulanan tidak bisa dipetakan ke Sub Kegiatan pada versi RAK ini.`
    );
  }

  return {
    rakVersion: version,
    rows: summaryRows,
    warnings,
    requestKey: toRequestKey(version.id, `summary:${periodMonth}`),
  };
}

export async function getRealizationBudgetItemDetail(
  rakVersionId,
  rakSubActivityId,
  periodMonth
) {
  if (!rakVersionId) {
    throw new Error("rakVersionId wajib diisi untuk membaca detail Realisasi.");
  }

  if (!rakSubActivityId) {
    throw new Error("rakSubActivityId wajib diisi untuk membaca detail Realisasi.");
  }

  if (!periodMonth) {
    throw new Error("periodMonth wajib diisi untuk membaca detail Realisasi.");
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
        .from("fin_v_budget_balance_unpivot")
        .select("*")
        .eq("rak_version_id", version.id)
        .eq("sub_activity_id", subActivity.sub_activity_id)
        .eq("period_month", periodMonth)
        .order("budget_account_code", { ascending: true })
    );

  const warnings = [];
  const nextBalanceRows = rawBalanceRows || [];
  const filteredRows = nextBalanceRows.filter(isExpectedBalanceRow);
  const filteredOutCount = nextBalanceRows.length - filteredRows.length;

  if (filteredOutCount > 0) {
    warnings.push(
      `Sejumlah ${filteredOutCount} row detail realisasi bulanan diabaikan karena tidak memenuhi asumsi minimum Belanja Level 5.`
    );
  }

  const rows = filteredRows.map(mapRealizationDetailRow);

  return {
    rakVersion: version,
    subActivity,
    rows,
    warnings,
    requestKey: toRequestKey(version.id, `${rakSubActivityId}:${periodMonth}`),
  };
}

export async function saveAggregatedMonthlyRealization({
  fiscalYearId,
  subActivityId,
  budgetAccountId,
  rakVersionIdSnapshot,
  periodMonth,
  amount,
}) {
  return await saveMonthlyBudgetRealization({
    p_fiscal_year_id: fiscalYearId,
    p_sub_activity_id: subActivityId,
    p_budget_account_id: budgetAccountId,
    p_rak_version_id: rakVersionIdSnapshot,
    p_period_month: periodMonth,
    p_amount: amount,
  });
}

export async function saveMonthlyBudgetRealization({
  p_fiscal_year_id,
  p_sub_activity_id,
  p_budget_account_id,
  p_rak_version_id,
  p_period_month,
  p_amount,
}) {
  const normalizedAmount = toNumericAmount(p_amount);

  if (normalizedAmount < 0) {
    throw new Error("Nilai realisasi tidak boleh negatif.");
  }

  if (!p_fiscal_year_id) {
    throw new Error("Fiscal year wajib diisi.");
  }

  if (!p_sub_activity_id) {
    throw new Error("Sub Kegiatan wajib diisi.");
  }

  if (!p_budget_account_id) {
    throw new Error("Akun belanja wajib diisi.");
  }

  if (!p_rak_version_id) {
    throw new Error("Snapshot versi RAK wajib diisi.");
  }

  if (!p_period_month || Number(p_period_month) < 1 || Number(p_period_month) > 12) {
    throw new Error("Bulan realisasi tidak valid.");
  }

  const { error } = await supabase.rpc("fin_save_monthly_budget_realization", {
    p_fiscal_year_id,
    p_sub_activity_id,
    p_budget_account_id,
    p_rak_version_id,
    p_period_month,
    p_amount: normalizedAmount,
  });

  if (error) {
    console.error(error);
    throw error;
  }

  return {
    action: normalizedAmount > 0 ? "replace" : "delete",
    amount: normalizedAmount,
  };
}
