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
