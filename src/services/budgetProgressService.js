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

function toProgressNumber(value) {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function toRequestKey(rakVersionId, scopeKey = "progress") {
  return `${rakVersionId || "default"}:${scopeKey}`;
}

function isExpectedProgressRow(row) {
  // Guard render ringan. Asumsi leaf level 5 tetap ditegakkan oleh view dan
  // constraint backend, sehingga service hanya menahan row yang jelas tidak
  // memenuhi bentuk minimum progress item anggaran.
  return Boolean(
    row?.rak_version_id &&
      row?.sub_activity_id &&
      row?.budget_account_id &&
      row?.budget_account_code &&
      row?.budget_account_name
  );
}

function getSafeProgressPercent(plan, realization, rawProgress = null) {
  const annualPlan = toNumericAmount(plan);
  const annualRealization = toNumericAmount(realization);

  if (annualPlan <= 0) {
    return annualRealization > 0 ? 100 : 0;
  }

  const computedProgress = (annualRealization / annualPlan) * 100;
  const nextProgress =
    rawProgress === null || rawProgress === undefined
      ? computedProgress
      : toProgressNumber(rawProgress);

  return Number.isFinite(nextProgress) ? nextProgress : computedProgress;
}

function getProgressStatus(progressPercent) {
  if (progressPercent <= 0) {
    return "NOT_STARTED";
  }

  if (progressPercent >= 100) {
    return "HIGH";
  }

  return "ON_TRACK";
}

function getTrackingIndicator(progressPercent) {
  const normalizedProgress = toProgressNumber(progressPercent);

  if (normalizedProgress > 100) {
    return {
      label: "OVERSPEND",
      tone: "danger",
    };
  }

  if (normalizedProgress >= 80) {
    return {
      label: "SUCCESS",
      tone: "success",
    };
  }

  if (normalizedProgress >= 50) {
    return {
      label: "WARNING",
      tone: "warning",
    };
  }

  return {
    label: "DANGER",
    tone: "danger",
  };
}

function getSubActivityMergeKey(row) {
  return (
    row?.sub_activity_id ||
    row?.rak_sub_activity_id ||
    null
  );
}

function buildSignalCountMap(rows = [], predicate = null) {
  const counts = new Map();

  rows.forEach((row) => {
    if (typeof predicate === "function" && !predicate(row)) {
      return;
    }

    const mergeKey = getSubActivityMergeKey(row);

    if (!mergeKey) {
      return;
    }

    counts.set(mergeKey, Number(counts.get(mergeKey) || 0) + 1);
  });

  return counts;
}

function hasMeaningfulDeviation(row) {
  return Math.abs(toNumericAmount(row?.annual_deviation_percent)) > 0.01;
}

function getBudgetAccountMergeKey(row) {
  return row?.budget_account_id || row?.budget_account_code || null;
}

function getBudgetAccountName(row) {
  return (
    row?.budget_account_name ||
    row?.budget_account_full_name ||
    row?.budget_account_title ||
    row?.account_name ||
    null
  );
}

async function loadTrackingWarningRows(rakVersionId) {
  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_warnings")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  return rawRows;
}

async function loadTrackingDeviationRows(rakVersionId) {
  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_deviations")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  return rawRows;
}

function mapTrackingDetailRow(row) {
  const planAmount = toNumericAmount(row?.annual_plan);
  const realizationAmount = toNumericAmount(row?.annual_realization);
  const deviationAmount =
    row?.annual_balance !== undefined && row?.annual_balance !== null
      ? toNumericAmount(row?.annual_balance)
      : planAmount - realizationAmount;
  const deviationPercent =
    row?.annual_deviation_percent !== undefined &&
    row?.annual_deviation_percent !== null
      ? toNumericAmount(row?.annual_deviation_percent)
      : Math.abs(getSafeProgressPercent(planAmount, deviationAmount));

  return {
    budget_account_id: row?.budget_account_id || null,
    budget_account_code: row?.budget_account_code || null,
    budget_account_name: getBudgetAccountName(row),
    plan_amount: planAmount,
    realization_amount: realizationAmount,
    deviation_amount: deviationAmount,
    deviation_percent: deviationPercent,
    warning_count: 0,
    warning_messages: [],
    is_overspend: realizationAmount > planAmount,
    has_deviation: Math.abs(deviationAmount) > 0.01,
  };
}

function mapProgressRow(row) {
  const annualPlan = toNumericAmount(row?.annual_plan);
  const annualRealization = toNumericAmount(row?.annual_realization);
  const progressPercent = getSafeProgressPercent(
    annualPlan,
    annualRealization,
    row?.progress_percent
  );

  return {
    ...row,
    annual_plan: annualPlan,
    annual_realization: annualRealization,
    progress_percent: progressPercent,
    progress_status:
      String(row?.progress_status || "").trim() || getProgressStatus(progressPercent),
    has_progress_mismatch:
      Math.abs(progressPercent - getSafeProgressPercent(annualPlan, annualRealization)) >
      0.01,
  };
}

function aggregateProgressRows(rows = []) {
  const aggregates = new Map();

  rows.forEach((row) => {
    const subActivityId = row.sub_activity_id;

    if (!subActivityId) {
      return;
    }

    const currentAggregate = aggregates.get(subActivityId) || {
      annual_plan: 0,
      annual_realization: 0,
    };

    currentAggregate.annual_plan += toNumericAmount(row.annual_plan);
    currentAggregate.annual_realization += toNumericAmount(row.annual_realization);

    aggregates.set(subActivityId, currentAggregate);
  });

  return aggregates;
}

async function resolveProgressRakVersion(rakVersionId, fiscalYearId = null) {
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

export async function getBudgetProgress(rakVersionId = null, fiscalYearId = null) {
  const version = await resolveProgressRakVersion(rakVersionId, fiscalYearId);

  if (!version?.id) {
    return {
      rakVersion: null,
      rows: [],
      detailRows: [],
      warnings: ["Tidak ada versi ACTIVE yang bisa dipakai sebagai default."],
      requestKey: toRequestKey(null),
    };
  }

  const rawRows =
    (await unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_progress")
        .select("*")
        .eq("rak_version_id", version.id)
        .order("sub_activity_code", { ascending: true })
        .order("budget_account_code", { ascending: true })
    )) || [];

  const filteredRows = rawRows.filter(isExpectedProgressRow);
  const warnings = [];

  if (filteredRows.length !== rawRows.length) {
    warnings.push(
      `Sejumlah ${rawRows.length - filteredRows.length} row progress diabaikan karena tidak memenuhi asumsi minimum item anggaran.`
    );
  }

  const detailRows = filteredRows.map(mapProgressRow);
  const progressMismatchCount = detailRows.filter((row) => row.has_progress_mismatch).length;

  if (progressMismatchCount > 0) {
    warnings.push(
      `${progressMismatchCount} item memiliki progress yang tidak sama dengan perhitungan plan dan realisasi.`
    );
  }

  const progressBySubActivityId = aggregateProgressRows(detailRows);
  const subActivityMeta = new Map();

  detailRows.forEach((row) => {
    if (!subActivityMeta.has(row.sub_activity_id)) {
      subActivityMeta.set(row.sub_activity_id, {
        rak_version_id: row.rak_version_id,
        fiscal_year_id: row.fiscal_year_id,
        rak_code: row.rak_code,
        sub_activity_id: row.sub_activity_id,
        sub_activity_code: row.sub_activity_code,
        sub_activity_name: row.sub_activity_name,
      });
    }
  });

  const rows = [...progressBySubActivityId.entries()].map(([subActivityId, aggregate]) => {
    const progressPercent = getSafeProgressPercent(
      aggregate.annual_plan,
      aggregate.annual_realization
    );

    return {
      ...subActivityMeta.get(subActivityId),
      annual_plan: aggregate.annual_plan,
      annual_realization: aggregate.annual_realization,
      progress_percent: progressPercent,
      progress_status: getProgressStatus(progressPercent),
    };
  });

  return {
    rakVersion: version,
    rows,
    detailRows,
    warnings,
    requestKey: toRequestKey(version.id),
  };
}

export async function getBudgetTrackingProgress(
  rakVersionId = null,
  fiscalYearId = null
) {
  const result = await getBudgetProgress(rakVersionId, fiscalYearId);

  let warningCountBySubActivity = new Map();
  let deviationCountBySubActivity = new Map();
  const signalWarnings = [];

  if (result.rakVersion?.id) {
    const [warningResult, deviationResult] = await Promise.allSettled([
      loadTrackingWarningRows(result.rakVersion.id),
      loadTrackingDeviationRows(result.rakVersion.id),
    ]);

    if (warningResult.status === "fulfilled") {
      warningCountBySubActivity = buildSignalCountMap(warningResult.value);
    } else {
      signalWarnings.push(
        "Data warning tracking gagal dimuat. Sinyal warning mungkin belum lengkap."
      );
    }

    if (deviationResult.status === "fulfilled") {
      deviationCountBySubActivity = buildSignalCountMap(
        deviationResult.value,
        hasMeaningfulDeviation
      );
    } else {
      signalWarnings.push(
        "Data deviation tracking gagal dimuat. Sinyal deviation mungkin belum lengkap."
      );
    }
  }

  const rows = (result.rows || []).map((row) => {
    const planAmount = toNumericAmount(row.annual_plan);
    const realizationAmount = toNumericAmount(row.annual_realization);
    const progressPercentage = getSafeProgressPercent(planAmount, realizationAmount);
    const mergeKey = getSubActivityMergeKey(row);
    const warningCount = Number(warningCountBySubActivity.get(mergeKey) || 0);
    const deviationCount = Number(deviationCountBySubActivity.get(mergeKey) || 0);

    return {
      ...row,
      plan_amount: planAmount,
      realization_amount: realizationAmount,
      progress_percentage: progressPercentage,
      tracking_indicator: getTrackingIndicator(progressPercentage),
      warning_count: warningCount,
      deviation_count: deviationCount,
    };
  });

  const summary = rows.reduce(
    (accumulator, row) => ({
      total_plan: accumulator.total_plan + toNumericAmount(row.plan_amount),
      total_realization:
        accumulator.total_realization + toNumericAmount(row.realization_amount),
      total_warning_count:
        accumulator.total_warning_count + Number(row.warning_count || 0),
      total_deviation_count:
        accumulator.total_deviation_count + Number(row.deviation_count || 0),
    }),
    {
      total_plan: 0,
      total_realization: 0,
      total_warning_count: 0,
      total_deviation_count: 0,
    }
  );

  return {
    ...result,
    rows,
    summary: {
      ...summary,
      overall_percentage: getSafeProgressPercent(
        summary.total_plan,
        summary.total_realization
      ),
    },
    warnings: [...(result.warnings || []), ...signalWarnings],
    requestKey: toRequestKey(result.rakVersion?.id, "tracking"),
  };
}

export async function getBudgetTrackingDetailBySubActivity(
  rakVersionId,
  subActivityId
) {
  if (!rakVersionId) {
    throw new Error("rakVersionId wajib diisi untuk detail tracking.");
  }

  if (!subActivityId) {
    throw new Error("subActivityId wajib diisi untuk detail tracking.");
  }

  const [deviationRows, warningRows] = await Promise.all([
    unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_deviations")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .eq("sub_activity_id", subActivityId)
        .order("budget_account_code", { ascending: true })
    ),
    unwrapQueryResult(
      supabase
        .from("fin_v_tracking_budget_warnings")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .eq("sub_activity_id", subActivityId)
        .order("budget_account_code", { ascending: true })
    ),
  ]);

  const mergedRows = new Map();

  (deviationRows || []).forEach((row) => {
    const mergeKey = getBudgetAccountMergeKey(row);

    if (!mergeKey) {
      return;
    }

    mergedRows.set(mergeKey, mapTrackingDetailRow(row));
  });

  (warningRows || []).forEach((row) => {
    const mergeKey = getBudgetAccountMergeKey(row);

    if (!mergeKey) {
      return;
    }

    const currentRow =
      mergedRows.get(mergeKey) ||
      mapTrackingDetailRow({
        ...row,
        annual_balance:
          row?.annual_balance !== undefined && row?.annual_balance !== null
            ? row.annual_balance
            : toNumericAmount(row?.annual_plan) - toNumericAmount(row?.annual_realization),
        annual_deviation_percent: null,
      });
    const warningMessage =
      String(row?.warning_label || row?.warning_type || "")
        .trim()
        .replaceAll("_", " ") || null;

    mergedRows.set(mergeKey, {
      ...currentRow,
      budget_account_id: currentRow.budget_account_id || row?.budget_account_id || null,
      budget_account_code:
        currentRow.budget_account_code || row?.budget_account_code || null,
      budget_account_name:
        currentRow.budget_account_name || getBudgetAccountName(row) || null,
      warning_count: Number(currentRow.warning_count || 0) + 1,
      warning_messages: warningMessage
        ? [...(currentRow.warning_messages || []), warningMessage]
        : currentRow.warning_messages || [],
    });
  });

  const rows = [...mergedRows.values()].sort((leftRow, rightRow) => {
    const leftCode = String(leftRow?.budget_account_code || "");
    const rightCode = String(rightRow?.budget_account_code || "");
    return leftCode.localeCompare(rightCode, "id");
  });

  return {
    rows,
    requestKey: `${rakVersionId}:${subActivityId}:tracking-detail`,
  };
}
