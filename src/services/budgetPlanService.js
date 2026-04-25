import { supabase } from "../lib/supabaseClient";
import {
  getDefaultRakVersion,
  getDraftRakBudgetItems,
  getRakVersionById,
} from "./budgetRakService";
import { getBudgetAccounts } from "./masterDataService";

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

function mergeDraftBudgetItemMetadata(summaryRows = [], draftRows = []) {
  const draftMap = new Map(
    draftRows.map((row) => [String(row?.budget_account_id || "").trim(), row])
  );

  return summaryRows.map((row) => {
    const draftRow = draftMap.get(String(row?.budget_account_id || "").trim());

    return {
      ...row,
      id: draftRow?.id || null,
      item_change_status_id: draftRow?.item_change_status_id || null,
      remarks:
        draftRow?.remarks !== undefined ? draftRow.remarks : row?.remarks ?? null,
    };
  });
}

function getItemMonthTotal(row) {
  return DETAIL_MONTH_COLUMNS.reduce(
    (sum, columnName) => sum + toNumericAmount(row?.[columnName]),
    0
  );
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

  let mappedRows = rows
    .filter(isExpectedDetailRow)
    .map(mapPlanBudgetItemDetailRow);

  const draftVersion = await getRakVersionById(version.id);

  if (draftVersion?.status === "DRAFT") {
    const draftRows = await getDraftRakBudgetItems(rakSubActivityId);
    mappedRows = mergeDraftBudgetItemMetadata(mappedRows, draftRows);
  }

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

export async function getDraftPlanEditorOptions() {
  const [budgetAccounts, itemChangeStatuses] = await Promise.all([
    getBudgetAccounts(),
    unwrapQueryResult(
      supabase
        .from("fin_budget_item_change_statuses")
        .select("id, code, name, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    ),
  ]);

  const editableBudgetAccounts = budgetAccounts.filter(
    (item) =>
      item?.is_active === true &&
      item?.is_leaf === true &&
      Number(item?.level_number || 0) === 5
  );

  const newItemStatus =
    (itemChangeStatuses || []).find((item) => item.code === "BARU") ||
    (itemChangeStatuses || [])[0] ||
    null;

  return {
    budgetAccounts: editableBudgetAccounts,
    defaultNewItemChangeStatusId: newItemStatus?.id || null,
  };
}

export async function getDraftActivationReadiness(rakVersionId) {
  if (!rakVersionId) {
    return {
      isReady: false,
      issues: ["Versi RAK draft belum dipilih."],
      summary: {
        subActivityCount: 0,
        itemCount: 0,
        totalAnnualAmount: 0,
      },
    };
  }

  const [subActivityRows, itemSummaryRows, rawDraftItems] = await Promise.all([
    getPlanSubActivitySummary(rakVersionId).then((result) => result.rows || []),
    unwrapQueryResult(
      supabase
        .from("fin_v_rak_budget_item_summary")
        .select("*")
        .eq("rak_version_id", rakVersionId)
    ),
    unwrapQueryResult(
      supabase
        .from("fin_rak_budget_items")
        .select(
          "id, rak_sub_activity_id, budget_account_id, annual_amount, jan_amount, feb_amount, mar_amount, apr_amount, may_amount, jun_amount, jul_amount, aug_amount, sep_amount, oct_amount, nov_amount, dec_amount, fin_budget_accounts(id, code, name, is_active, is_leaf, budget_level_id, fin_budget_levels(level_number))"
        )
        .eq("rak_version_id", rakVersionId)
    ),
  ]);

  const issues = [];
  const safeSubActivityRows = subActivityRows || [];
  const safeItemSummaryRows = itemSummaryRows || [];
  const safeRawDraftItems = rawDraftItems || [];

  if (safeSubActivityRows.length === 0) {
    issues.push("Draft RAK belum memiliki Sub Kegiatan.");
  }

  const itemCountBySubActivityId = new Map();
  safeRawDraftItems.forEach((item) => {
    const key = String(item?.rak_sub_activity_id || "").trim();
    itemCountBySubActivityId.set(
      key,
      Number(itemCountBySubActivityId.get(key) || 0) + 1
    );
  });

  safeSubActivityRows.forEach((row) => {
    const key = String(row?.rak_sub_activity_id || "").trim();
    const itemCount = Number(itemCountBySubActivityId.get(key) || 0);

    if (itemCount === 0) {
      issues.push(
        `Sub Kegiatan ${row?.sub_activity_name || row?.sub_activity_code || "-"} belum memiliki item anggaran.`
      );
    }
  });

  const duplicateTracker = new Map();

  safeRawDraftItems.forEach((item) => {
    const accountData = Array.isArray(item?.fin_budget_accounts)
      ? item.fin_budget_accounts[0]
      : item?.fin_budget_accounts;
    const levelData = Array.isArray(accountData?.fin_budget_levels)
      ? accountData.fin_budget_levels[0]
      : accountData?.fin_budget_levels;
    const accountCode = accountData?.code || item?.budget_account_id || "-";
    const accountName = accountData?.name || "-";

    if (
      accountData?.is_active !== true ||
      accountData?.is_leaf !== true ||
      Number(levelData?.level_number || 0) !== 5
    ) {
      issues.push(
        `Item akun ${accountCode} - ${accountName} tidak menggunakan akun belanja level 5 leaf aktif.`
      );
    }

    const annualAmount = toNumericAmount(item?.annual_amount);
    const monthTotal = getItemMonthTotal(item);

    if (annualAmount !== monthTotal) {
      issues.push(
        `Item akun ${accountCode} - ${accountName} memiliki total tahunan yang tidak sama dengan Jan-Des.`
      );
    }

    const duplicateKey = [
      String(item?.rak_sub_activity_id || "").trim(),
      String(item?.budget_account_id || "").trim(),
    ].join(":");

    duplicateTracker.set(duplicateKey, {
      count: Number(duplicateTracker.get(duplicateKey)?.count || 0) + 1,
      accountCode,
      accountName,
    });
  });

  duplicateTracker.forEach((value) => {
    if (value.count > 1) {
      issues.push(
        `Akun ${value.accountCode} - ${value.accountName} terduplikasi dalam satu Sub Kegiatan.`
      );
    }
  });

  const totalAnnualAmount = safeItemSummaryRows.reduce(
    (sum, row) => sum + toNumericAmount(row?.annual_amount),
    0
  );

  if (totalAnnualAmount <= 0) {
    issues.push("Total anggaran draft masih 0.");
  }

  return {
    isReady: issues.length === 0,
    issues,
    summary: {
      subActivityCount: safeSubActivityRows.length,
      itemCount: safeRawDraftItems.length,
      totalAnnualAmount,
    },
  };
}
