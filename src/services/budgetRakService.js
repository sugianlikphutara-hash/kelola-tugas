import { supabase } from "../lib/supabaseClient";

function applyRakVersionFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.fiscalYearId) {
    nextQuery = nextQuery.eq("fiscal_year_id", filters.fiscalYearId);
  }

  if (filters.status) {
    nextQuery = nextQuery.eq("status", filters.status);
  }

  if (typeof filters.isActive === "boolean") {
    nextQuery = nextQuery.eq("is_active", filters.isActive);
  }

  return nextQuery;
}

function toFiscalYearSortValue(value) {
  if (value === null || value === undefined || value === "") {
    return Number.NEGATIVE_INFINITY;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  return String(value);
}

function sortRakVersionsDescending(versions = []) {
  return [...versions].sort((leftVersion, rightVersion) => {
    const leftFiscalYear = toFiscalYearSortValue(leftVersion?.fiscal_year_id);
    const rightFiscalYear = toFiscalYearSortValue(rightVersion?.fiscal_year_id);

    if (leftFiscalYear !== rightFiscalYear) {
      return rightFiscalYear > leftFiscalYear ? 1 : -1;
    }

    const leftDate = new Date(leftVersion?.rak_date || 0).getTime();
    const rightDate = new Date(rightVersion?.rak_date || 0).getTime();

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return (
      Number(rightVersion?.version_number || 0) -
      Number(leftVersion?.version_number || 0)
    );
  });
}

function toAmountNumber(value) {
  const nextValue = Number(value ?? 0);

  if (!Number.isFinite(nextValue)) {
    throw new Error("Nilai anggaran harus berupa angka yang valid.");
  }

  return nextValue;
}

function buildDraftBudgetItemPayload(payload = {}, basePayload = {}) {
  const janAmount = toAmountNumber(payload.jan_amount ?? basePayload.jan_amount);
  const febAmount = toAmountNumber(payload.feb_amount ?? basePayload.feb_amount);
  const marAmount = toAmountNumber(payload.mar_amount ?? basePayload.mar_amount);
  const aprAmount = toAmountNumber(payload.apr_amount ?? basePayload.apr_amount);
  const mayAmount = toAmountNumber(payload.may_amount ?? basePayload.may_amount);
  const junAmount = toAmountNumber(payload.jun_amount ?? basePayload.jun_amount);
  const julAmount = toAmountNumber(payload.jul_amount ?? basePayload.jul_amount);
  const augAmount = toAmountNumber(payload.aug_amount ?? basePayload.aug_amount);
  const sepAmount = toAmountNumber(payload.sep_amount ?? basePayload.sep_amount);
  const octAmount = toAmountNumber(payload.oct_amount ?? basePayload.oct_amount);
  const novAmount = toAmountNumber(payload.nov_amount ?? basePayload.nov_amount);
  const decAmount = toAmountNumber(payload.dec_amount ?? basePayload.dec_amount);

  const annualAmount =
    janAmount +
    febAmount +
    marAmount +
    aprAmount +
    mayAmount +
    junAmount +
    julAmount +
    augAmount +
    sepAmount +
    octAmount +
    novAmount +
    decAmount;

  return {
    rak_sub_activity_id: payload.rak_sub_activity_id ?? basePayload.rak_sub_activity_id,
    budget_account_id: payload.budget_account_id ?? basePayload.budget_account_id,
    item_change_status_id: payload.item_change_status_id ?? basePayload.item_change_status_id,
    annual_amount: annualAmount,
    jan_amount: janAmount,
    feb_amount: febAmount,
    mar_amount: marAmount,
    apr_amount: aprAmount,
    may_amount: mayAmount,
    jun_amount: junAmount,
    jul_amount: julAmount,
    aug_amount: augAmount,
    sep_amount: sepAmount,
    oct_amount: octAmount,
    nov_amount: novAmount,
    dec_amount: decAmount,
    remarks:
      payload.remarks !== undefined
        ? payload.remarks || null
        : (basePayload.remarks ?? null),
  };
}

async function unwrapQueryResult(promise) {
  const { data, error } = await promise;

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function getActiveRakVersions(filters = {}) {
  const query = applyRakVersionFilters(
    supabase
      .from("fin_v_active_rak_versions")
      .select("*")
      .order("rak_date", { ascending: false })
      .order("version_number", { ascending: false }),
    filters
  );

  return (await unwrapQueryResult(query)) || [];
}

export async function getPreferredActiveRakVersion(fiscalYearId = null) {
  const activeVersions = await getActiveRakVersions(
    fiscalYearId ? { fiscalYearId } : {}
  );

  return activeVersions[0] || null;
}

export async function getDefaultRakVersion(fiscalYearId = null) {
  const versions = await getRakVersions(fiscalYearId ? { fiscalYearId } : {});

  if (versions.length === 0) {
    return null;
  }

  const sortedVersions = sortRakVersionsDescending(versions);
  const resolvedFiscalYearId =
    fiscalYearId || sortedVersions[0]?.fiscal_year_id || null;

  if (!resolvedFiscalYearId) {
    return sortedVersions[0] || null;
  }

  const preferredActiveVersion = await getPreferredActiveRakVersion(
    resolvedFiscalYearId
  );

  if (preferredActiveVersion) {
    return preferredActiveVersion;
  }

  return (
    sortedVersions.find(
      (version) => version.fiscal_year_id === resolvedFiscalYearId
    ) ||
    sortedVersions[0] ||
    null
  );
}

export async function getRakVersions(filters = {}) {
  const query = applyRakVersionFilters(
    supabase
      .from("fin_rak_versions")
      .select("*")
      .order("fiscal_year_id", { ascending: true })
      .order("version_number", { ascending: false }),
    filters
  );

  return (await unwrapQueryResult(query)) || [];
}

export async function getDraftRakVersions(filters = {}) {
  return await getRakVersions({
    ...filters,
    status: "DRAFT",
    isActive: false,
  });
}

export async function getRakVersionById(rakVersionId) {
  return (
    await unwrapQueryResult(
      supabase.from("fin_rak_versions").select("*").eq("id", rakVersionId).single()
    )
  ) || null;
}

export async function getDraftRakVersionById(rakVersionId) {
  return (
    await unwrapQueryResult(
      supabase
        .from("fin_rak_versions")
        .select("*")
        .eq("id", rakVersionId)
        .eq("status", "DRAFT")
        .eq("is_active", false)
        .single()
    )
  ) || null;
}

export async function getRakSubActivitySummary(rakVersionId) {
  return (
    await unwrapQueryResult(
      supabase
        .from("fin_v_rak_sub_activity_summary")
        .select("*")
        .eq("rak_version_id", rakVersionId)
        .order("sub_activity_code", { ascending: true })
    )
  ) || [];
}

export async function getDraftRakSubActivities(rakVersionId) {
  return (
    await unwrapQueryResult(
      supabase
        .from("fin_rak_sub_activities")
        .select(
          "id, rak_version_id, sub_activity_id, sub_activity_status_id, remarks, created_at, updated_at, sub_activities(id, code, name), fin_sub_activity_rak_statuses(id, code, name)"
        )
        .eq("rak_version_id", rakVersionId)
        .order("created_at", { ascending: true })
    )
  ) || [];
}

export async function getRakBudgetItemSummary(rakVersionId, options = {}) {
  let query = supabase
    .from("fin_v_rak_budget_item_summary")
    .select("*")
    .eq("rak_version_id", rakVersionId)
    .order("sub_activity_code", { ascending: true })
    .order("budget_account_code", { ascending: true });

  if (options.subActivityId) {
    query = query.eq("sub_activity_id", options.subActivityId);
  }

  return (await unwrapQueryResult(query)) || [];
}

export async function getDraftRakBudgetItems(rakSubActivityId) {
  return (
    await unwrapQueryResult(
      supabase
        .from("fin_rak_budget_items")
        .select(
          "id, rak_version_id, rak_sub_activity_id, budget_account_id, item_change_status_id, annual_amount, jan_amount, feb_amount, mar_amount, apr_amount, may_amount, jun_amount, jul_amount, aug_amount, sep_amount, oct_amount, nov_amount, dec_amount, remarks, created_at, updated_at, fin_budget_accounts(id, code, name, full_name), fin_budget_item_change_statuses(id, code, name)"
        )
        .eq("rak_sub_activity_id", rakSubActivityId)
        .order("budget_account_id", { ascending: true })
    )
  ) || [];
}

export async function getDraftRakBudgetItemById(rakBudgetItemId) {
  return (
    await unwrapQueryResult(
      supabase
        .from("fin_rak_budget_items")
        .select(
          "id, rak_version_id, rak_sub_activity_id, budget_account_id, item_change_status_id, annual_amount, jan_amount, feb_amount, mar_amount, apr_amount, may_amount, jun_amount, jul_amount, aug_amount, sep_amount, oct_amount, nov_amount, dec_amount, remarks, created_at, updated_at"
        )
        .eq("id", rakBudgetItemId)
        .single()
    )
  ) || null;
}

export async function getRakVersionDetail(rakVersionId) {
  const [version, subActivities, budgetItems] = await Promise.all([
    getRakVersionById(rakVersionId),
    getRakSubActivitySummary(rakVersionId),
    getRakBudgetItemSummary(rakVersionId),
  ]);

  return {
    version,
    subActivities,
    budgetItems,
  };
}

export async function cloneRakVersion(payload) {
  const sourceRakVersionId = payload?.sourceRakVersionId;

  if (!sourceRakVersionId) {
    throw new Error("sourceRakVersionId wajib diisi untuk clone RAK.");
  }

  return await unwrapQueryResult(
    supabase.rpc("fin_clone_rak_version", {
      p_source_rak_version_id: sourceRakVersionId,
      p_new_code: payload?.newCode || null,
      p_new_rak_date: payload?.newRakDate || null,
      p_new_title: payload?.newTitle || null,
      p_new_notes: payload?.notes || null,
      p_created_by: payload?.createdBy || null,
    })
  );
}

export async function activateRakVersion(rakVersionId) {
  if (!rakVersionId) {
    throw new Error("rakVersionId wajib diisi untuk aktivasi RAK.");
  }

  return await unwrapQueryResult(
    supabase.rpc("fin_activate_rak_version", {
      p_rak_version_id: rakVersionId,
    })
  );
}

export async function createDraftRakBudgetItem(payload) {
  if (!payload?.rak_sub_activity_id) {
    throw new Error("rak_sub_activity_id wajib diisi.");
  }

  if (!payload?.budget_account_id) {
    throw new Error("budget_account_id wajib diisi.");
  }

  if (!payload?.item_change_status_id) {
    throw new Error("item_change_status_id wajib diisi.");
  }

  return (
    await unwrapQueryResult(
      supabase
        .from("fin_rak_budget_items")
        .insert([buildDraftBudgetItemPayload(payload)])
        .select("*")
        .single()
    )
  ) || null;
}

export async function updateDraftRakBudgetItem(rakBudgetItemId, payload) {
  if (!rakBudgetItemId) {
    throw new Error("rakBudgetItemId wajib diisi.");
  }

  const existingItem = await getDraftRakBudgetItemById(rakBudgetItemId);

  if (!existingItem) {
    throw new Error("Item RAK draft tidak ditemukan.");
  }

  return (
    await unwrapQueryResult(
      supabase
        .from("fin_rak_budget_items")
        .update(buildDraftBudgetItemPayload(payload, existingItem))
        .eq("id", rakBudgetItemId)
        .select("*")
        .single()
    )
  ) || null;
}

export async function deleteDraftRakBudgetItem(rakBudgetItemId) {
  if (!rakBudgetItemId) {
    throw new Error("rakBudgetItemId wajib diisi.");
  }

  const { error } = await supabase
    .from("fin_rak_budget_items")
    .delete()
    .eq("id", rakBudgetItemId);

  if (error) {
    console.error(error);
    throw error;
  }
}
