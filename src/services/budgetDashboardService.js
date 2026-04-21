import { supabase } from "../lib/supabaseClient";
import { getDefaultRakVersion, getRakVersionById } from "./budgetRakService";

const MONTH_ORDER = [
  { key: 1, label: "JAN" },
  { key: 2, label: "FEB" },
  { key: 3, label: "MAR" },
  { key: 4, label: "APR" },
  { key: 5, label: "MAY" },
  { key: 6, label: "JUN" },
  { key: 7, label: "JUL" },
  { key: 8, label: "AUG" },
  { key: 9, label: "SEP" },
  { key: 10, label: "OCT" },
  { key: 11, label: "NOV" },
  { key: 12, label: "DEC" },
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

function toRequestKey(rakVersionId, scopeKey) {
  return `${rakVersionId || "default"}:${scopeKey}`;
}

function getSafeProgressPercent(plan, realization) {
  const annualPlan = toNumericAmount(plan);
  const annualRealization = toNumericAmount(realization);

  if (annualPlan <= 0) {
    return annualRealization > 0 ? 100 : 0;
  }

  const computedProgress = (annualRealization / annualPlan) * 100;
  return Number.isFinite(computedProgress) ? computedProgress : 0;
}

function isExpectedBalanceSummaryRow(row) {
  // Guard render ringan. Asumsi item anggaran tetap leaf level 5 ditegakkan
  // oleh view dan constraint backend; service hanya menahan row yang tidak
  // memenuhi bentuk minimum agar dashboard tidak merender data mentah yang aneh.
  return Boolean(
    row?.rak_version_id &&
      row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name
  );
}

function isExpectedUnpivotRow(row) {
  return Boolean(
    row?.rak_version_id &&
      row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name &&
      row?.period_month
  );
}

function isExpectedWarningRow(row) {
  return Boolean(
    row?.rak_version_id &&
      row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name &&
      row?.warning_type
  );
}

function isExpectedProgressRow(row) {
  return Boolean(
    row?.rak_version_id &&
      row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name
  );
}

function mapBalanceSummaryRow(row) {
  const annualPlan = toNumericAmount(row?.annual_plan);
  const annualRealization = toNumericAmount(row?.annual_realization);
  const annualBalance = toNumericAmount(row?.annual_balance);

  return {
    ...row,
    annual_plan: annualPlan,
    annual_realization: annualRealization,
    annual_balance: annualBalance,
    absorption_percent: getSafeProgressPercent(annualPlan, annualRealization),
    has_balance_mismatch: Math.abs(annualBalance - (annualPlan - annualRealization)) > 0.01,
  };
}

function mapUnpivotRow(row) {
  const plan = toNumericAmount(row?.plan);
  const realization = toNumericAmount(row?.realization);
  const balance = toNumericAmount(row?.balance);

  return {
    ...row,
    plan,
    realization,
    balance,
    has_balance_mismatch: Math.abs(balance - (plan - realization)) > 0.01,
  };
}

function mapWarningRow(row) {
  return {
    ...row,
    annual_plan: toNumericAmount(row?.annual_plan),
    annual_realization: toNumericAmount(row?.annual_realization),
    annual_balance: toNumericAmount(row?.annual_balance),
    absorption_percent: toNumericAmount(row?.absorption_percent),
  };
}

function mapProgressRow(row) {
  const annualPlan = toNumericAmount(row?.annual_plan);
  const annualRealization = toNumericAmount(row?.annual_realization);

  return {
    ...row,
    annual_plan: annualPlan,
    annual_realization: annualRealization,
    progress_percent: getSafeProgressPercent(annualPlan, annualRealization),
  };
}

async function resolveDashboardRakVersion(rakVersionId, fiscalYearId = null) {
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

function collectFilteredRowWarnings(rawRows = [], filteredRows = [], label) {
  const filteredOutCount = rawRows.length - filteredRows.length;

  if (filteredOutCount <= 0) {
    return [];
  }

  return [
    `Sejumlah ${filteredOutCount} row ${label} diabaikan karena tidak memenuhi asumsi minimum item anggaran.`,
  ];
}

async function loadBalanceSummaryRows(rakVersionId) {
  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_budget_balance_summary")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  const filteredRows = rawRows.filter(isExpectedBalanceSummaryRow);

  return {
    rows: filteredRows.map(mapBalanceSummaryRow),
    warnings: collectFilteredRowWarnings(rawRows, filteredRows, "summary dashboard"),
  };
}

async function loadBalanceUnpivotRows(rakVersionId) {
  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_budget_balance_unpivot")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("period_month", { ascending: true })
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  const filteredRows = rawRows.filter(isExpectedUnpivotRow);

  return {
    rows: filteredRows.map(mapUnpivotRow),
    warnings: collectFilteredRowWarnings(rawRows, filteredRows, "bulanan dashboard"),
  };
}

async function loadWarningRows(rakVersionId) {
  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_warnings")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("warning_type", { ascending: true })
        .order("annual_plan", { ascending: false })
    )) || [];

  const filteredRows = rawRows.filter(isExpectedWarningRow);

  return {
    rows: filteredRows.map(mapWarningRow),
    warnings: collectFilteredRowWarnings(rawRows, filteredRows, "warning dashboard"),
  };
}

async function loadProgressRows(rakVersionId) {
  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_progress")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  const filteredRows = rawRows.filter(isExpectedProgressRow);

  return {
    rows: filteredRows.map(mapProgressRow),
    warnings: collectFilteredRowWarnings(rawRows, filteredRows, "progress dashboard"),
  };
}

export async function getDashboardSummary(rakVersionId = null, fiscalYearId = null) {
  const version = await resolveDashboardRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      data: null,
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, "dashboard-summary"),
    };
  }

  const [balanceSummaryResult, unpivotResult, progressResult] = await Promise.all([
    loadBalanceSummaryRows(version.id),
    loadBalanceUnpivotRows(version.id),
    loadProgressRows(version.id),
  ]);

  const balanceRows = balanceSummaryResult.rows;
  const unpivotRows = unpivotResult.rows;
  const progressRows = progressResult.rows;
  const warnings = [
    ...(balanceSummaryResult.warnings || []),
    ...(unpivotResult.warnings || []),
    ...(progressResult.warnings || []),
  ];

  const summary = balanceRows.reduce(
    (accumulator, row) => ({
      total_plan: accumulator.total_plan + row.annual_plan,
      total_realization: accumulator.total_realization + row.annual_realization,
      total_balance: accumulator.total_balance + row.annual_balance,
      item_count: accumulator.item_count + 1,
    }),
    {
      total_plan: 0,
      total_realization: 0,
      total_balance: 0,
      item_count: 0,
    }
  );

  const monthlyTotals = unpivotRows.reduce(
    (accumulator, row) => ({
      total_plan: accumulator.total_plan + row.plan,
      total_realization: accumulator.total_realization + row.realization,
      total_balance: accumulator.total_balance + row.balance,
    }),
    {
      total_plan: 0,
      total_realization: 0,
      total_balance: 0,
    }
  );

  const progressTotals = progressRows.reduce(
    (accumulator, row) => ({
      total_plan: accumulator.total_plan + row.annual_plan,
      total_realization: accumulator.total_realization + row.annual_realization,
    }),
    {
      total_plan: 0,
      total_realization: 0,
    }
  );

  if (Math.abs(summary.total_balance - (summary.total_plan - summary.total_realization)) > 0.01) {
    warnings.push("Ringkasan saldo tahunan tidak sama dengan plan dikurangi realisasi.");
  }

  if (Math.abs(summary.total_plan - monthlyTotals.total_plan) > 0.01) {
    warnings.push("Akumulasi plan bulanan tidak sama dengan total plan tahunan dashboard.");
  }

  if (Math.abs(summary.total_realization - monthlyTotals.total_realization) > 0.01) {
    warnings.push(
      "Akumulasi realisasi bulanan tidak sama dengan total realisasi tahunan dashboard."
    );
  }

  if (Math.abs(summary.total_balance - monthlyTotals.total_balance) > 0.01) {
    warnings.push("Akumulasi saldo bulanan tidak sama dengan total saldo tahunan dashboard.");
  }

  if (Math.abs(summary.total_plan - progressTotals.total_plan) > 0.01) {
    warnings.push(
      "Cross-check progress menunjukkan total plan yang tidak sama dengan summary utama dashboard."
    );
  }

  if (Math.abs(summary.total_realization - progressTotals.total_realization) > 0.01) {
    warnings.push(
      "Cross-check progress menunjukkan total realisasi yang tidak sama dengan summary utama dashboard."
    );
  }

  return {
    rakVersion: version,
    data: {
      ...summary,
      progress_percent: getSafeProgressPercent(
        summary.total_plan,
        summary.total_realization
      ),
    },
    warnings,
    requestKey: toRequestKey(version.id, "dashboard-summary"),
  };
}

export async function getDashboardSubActivityBreakdown(
  rakVersionId = null,
  fiscalYearId = null
) {
  const version = await resolveDashboardRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, "dashboard-sub-activity"),
    };
  }

  const balanceSummaryResult = await loadBalanceSummaryRows(version.id);
  const balanceRows = balanceSummaryResult.rows;
  const aggregates = new Map();

  balanceRows.forEach((row) => {
    const currentRow = aggregates.get(row.sub_activity_id) || {
      rak_version_id: row.rak_version_id,
      sub_activity_id: row.sub_activity_id,
      sub_activity_code: row.sub_activity_code,
      sub_activity_name: row.sub_activity_name,
      annual_plan: 0,
      annual_realization: 0,
      annual_balance: 0,
    };

    currentRow.annual_plan += row.annual_plan;
    currentRow.annual_realization += row.annual_realization;
    currentRow.annual_balance += row.annual_balance;
    aggregates.set(row.sub_activity_id, currentRow);
  });

  const rows = [...aggregates.values()]
    .map((row) => ({
      ...row,
      progress_percent: getSafeProgressPercent(row.annual_plan, row.annual_realization),
    }))
    .sort((leftRow, rightRow) => rightRow.annual_realization - leftRow.annual_realization);

  return {
    rakVersion: version,
    rows,
    warnings: balanceSummaryResult.warnings || [],
    requestKey: toRequestKey(version.id, "dashboard-sub-activity"),
  };
}

export async function getDashboardMonthlyBreakdown(
  rakVersionId = null,
  fiscalYearId = null
) {
  const version = await resolveDashboardRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, "dashboard-monthly"),
    };
  }

  const unpivotResult = await loadBalanceUnpivotRows(version.id);
  const unpivotRows = unpivotResult.rows;
  const monthMap = new Map(
    MONTH_ORDER.map((monthMeta) => [
      monthMeta.key,
      {
        month: monthMeta.label,
        period_month: monthMeta.key,
        plan: 0,
        realization: 0,
        balance: 0,
        progress_percent: 0,
      },
    ])
  );
  const warnings = [...(unpivotResult.warnings || [])];

  unpivotRows.forEach((row) => {
    const currentMonth = monthMap.get(Number(row.period_month));

    if (!currentMonth) {
      warnings.push(`Terdapat row bulanan dengan period_month tidak dikenal: ${row.period_month}.`);
      return;
    }

    currentMonth.plan += row.plan;
    currentMonth.realization += row.realization;
    currentMonth.balance += row.balance;
  });

  const rows = MONTH_ORDER.map((monthMeta) => {
    const monthRow = monthMap.get(monthMeta.key);

    return {
      ...monthRow,
      progress_percent: getSafeProgressPercent(monthRow.plan, monthRow.realization),
    };
  });

  return {
    rakVersion: version,
    rows,
    warnings,
    requestKey: toRequestKey(version.id, "dashboard-monthly"),
  };
}

export async function getTopOverspend(rakVersionId = null, fiscalYearId = null, limit = 5) {
  const version = await resolveDashboardRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, "dashboard-overspend"),
    };
  }

  const unpivotResult = await loadBalanceUnpivotRows(version.id);
  const rows = unpivotResult.rows
    .filter((row) => row.realization > row.plan)
    .map((row) => ({
      ...row,
      annual_plan: row.plan,
      annual_realization: row.realization,
      annual_balance: row.balance,
      highlight_month: row.month,
      highlight_period_month: row.period_month,
    }))
    .sort((leftRow, rightRow) => leftRow.balance - rightRow.balance)
    .slice(0, limit);

  return {
    rakVersion: version,
    rows,
    warnings: unpivotResult.warnings || [],
    requestKey: toRequestKey(version.id, "dashboard-overspend"),
  };
}

export async function getTopWarnings(rakVersionId = null, fiscalYearId = null, limit = 5) {
  const version = await resolveDashboardRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null, "dashboard-top-warnings"),
    };
  }

  const warningResult = await loadWarningRows(version.id);
  const rows = warningResult.rows
    .filter((row) => row.warning_type === "NO_REALIZATION")
    .sort((leftRow, rightRow) => rightRow.annual_plan - leftRow.annual_plan)
    .slice(0, limit);

  return {
    rakVersion: version,
    rows,
    warnings: warningResult.warnings || [],
    requestKey: toRequestKey(version.id, "dashboard-top-warnings"),
  };
}
