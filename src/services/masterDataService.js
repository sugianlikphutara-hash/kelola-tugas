import { supabase } from "../lib/supabaseClient";

export async function getEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, nip, employment_status, phone, email, is_active")
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createEmployee(payload) {
  const { data, error } = await supabase
    .from("employees")
    .insert([
      {
        full_name: payload.name,
        nip: payload.nip || null,
        employment_status: payload.employment_status || null,
        phone: payload.phone || null,
        email: payload.email || null,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateEmployee(employeeId, payload) {
  const { data, error } = await supabase
    .from("employees")
    .update({
      full_name: payload.name,
      nip: payload.nip || null,
      employment_status: payload.employment_status || null,
      phone: payload.phone || null,
      email: payload.email || null,
    })
    .eq("id", employeeId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteEmployee(employeeId) {
  const { error } = await supabase.from("employees").delete().eq("id", employeeId);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function getStatuses() {
  const { data, error } = await supabase
    .from("master_statuses")
    .select("id, code, name, description, category, sort_order, is_active")
    .eq("category", "task")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function getPriorities() {
  const { data, error } = await supabase
    .from("master_priorities")
    .select("id, code, name, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createPriority(payload) {
  const { data, error } = await supabase
    .from("master_priorities")
    .insert([
      {
        name: payload.name,
        sort_order: payload.level,
        is_active: payload.is_active,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updatePriority(priorityId, payload) {
  const { data, error } = await supabase
    .from("master_priorities")
    .update({
      name: payload.name,
      sort_order: payload.level,
      is_active: payload.is_active,
    })
    .eq("id", priorityId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deletePriority(priorityId) {
  const { error } = await supabase
    .from("master_priorities")
    .delete()
    .eq("id", priorityId);

  if (error) {
    console.error(error);
    throw error;
  }
}

async function getNextTaskStatusSortOrder() {
  const { data, error } = await supabase
    .from("master_statuses")
    .select("sort_order")
    .eq("category", "task")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    throw error;
  }

  return Number(data?.[0]?.sort_order || 0) + 1;
}

export async function createStatus(payload) {
  const sortOrder = await getNextTaskStatusSortOrder();

  const { data, error } = await supabase
    .from("master_statuses")
    .insert([
      {
        category: "task",
        code: payload.code,
        name: payload.name,
        description: payload.description || null,
        sort_order: sortOrder,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateStatus(statusId, payload) {
  const { data, error } = await supabase
    .from("master_statuses")
    .update({
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
    })
    .eq("id", statusId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteStatus(statusId) {
  const { error } = await supabase
    .from("master_statuses")
    .delete()
    .eq("id", statusId);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function getPrograms() {
  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, code, name, description, status_id, priority_id, start_date, end_date"
    )
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createProgram(payload) {
  const { data, error } = await supabase
    .from("programs")
    .insert([
      {
        code: payload.code,
        name: payload.name,
        description: payload.description || null,
        status_id: payload.status_id || null,
        priority_id: payload.priority_id || null,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateProgram(programId, payload) {
  const { data, error } = await supabase
    .from("programs")
    .update({
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
      status_id: payload.status_id || null,
      priority_id: payload.priority_id || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
    })
    .eq("id", programId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteProgram(programId) {
  const { error } = await supabase.from("programs").delete().eq("id", programId);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function getActivities() {
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, program_id, code, name, description, status_id, priority_id, start_date, end_date"
    )
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createActivity(payload) {
  const { data, error } = await supabase
    .from("activities")
    .insert([
      {
        program_id: payload.program_id || null,
        code: payload.code,
        name: payload.name,
        description: payload.description || null,
        status_id: payload.status_id || null,
        priority_id: payload.priority_id || null,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateActivity(activityId, payload) {
  const { data, error } = await supabase
    .from("activities")
    .update({
      program_id: payload.program_id || null,
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
      status_id: payload.status_id || null,
      priority_id: payload.priority_id || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
    })
    .eq("id", activityId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteActivity(activityId) {
  const { error } = await supabase.from("activities").delete().eq("id", activityId);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function getSubActivities() {
  const { data, error } = await supabase
    .from("sub_activities")
    .select(
      "id, activity_id, code, name, description, status_id, priority_id, start_date, end_date, output_target, output_unit"
    )
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createSubActivity(payload) {
  const { data, error } = await supabase
    .from("sub_activities")
    .insert([
      {
        activity_id: payload.activity_id || null,
        code: payload.code,
        name: payload.name,
        description: payload.description || null,
        status_id: payload.status_id || null,
        priority_id: payload.priority_id || null,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        output_target: payload.output_target || null,
        output_unit: payload.output_unit || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateSubActivity(subActivityId, payload) {
  const { data, error } = await supabase
    .from("sub_activities")
    .update({
      activity_id: payload.activity_id || null,
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
      status_id: payload.status_id || null,
      priority_id: payload.priority_id || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      output_target: payload.output_target || null,
      output_unit: payload.output_unit || null,
    })
    .eq("id", subActivityId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteSubActivity(subActivityId) {
  const { error } = await supabase
    .from("sub_activities")
    .delete()
    .eq("id", subActivityId);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function getWorkPlans() {
  const { data, error } = await supabase
    .from("work_plans")
    .select(
      "id, sub_activity_id, employee_id, supervisor_id, title, description, status_id, priority_id, start_date, end_date, created_at"
    )
    .order("title", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createWorkPlan(payload) {
  const { data, error } = await supabase
    .from("work_plans")
    .insert([
      {
        sub_activity_id: payload.sub_activity_id || null,
        employee_id: payload.employee_id || null,
        supervisor_id: payload.supervisor_id || null,
        title: payload.title,
        description: payload.description || null,
        status_id: payload.status_id || null,
        priority_id: payload.priority_id || null,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateWorkPlan(workPlanId, payload) {
  const { data, error } = await supabase
    .from("work_plans")
    .update({
      sub_activity_id: payload.sub_activity_id || null,
      employee_id: payload.employee_id || null,
      supervisor_id: payload.supervisor_id || null,
      title: payload.title,
      description: payload.description || null,
      status_id: payload.status_id || null,
      priority_id: payload.priority_id || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
    })
    .eq("id", workPlanId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteWorkPlan(workPlanId) {
  const { error } = await supabase.from("work_plans").delete().eq("id", workPlanId);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function getActionPlans() {
  const { data, error } = await supabase
    .from("action_plans")
    .select(
      "id, work_plan_id, employee_id, title, description, status_id, priority_id, planned_start_date, planned_end_date, actual_start_date, actual_end_date, progress_percent, created_at, employees(full_name)"
    )
    .order("title", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map((item) => ({
    ...item,
    employee_name: Array.isArray(item.employees)
      ? item.employees[0]?.full_name || null
      : item.employees?.full_name || null,
  }));
}

export async function getTaskActionPlanLinks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, action_plan_id")
    .not("action_plan_id", "is", null);

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

export async function createActionPlan(payload) {
  const { data, error } = await supabase
    .from("action_plans")
    .insert([
      {
        work_plan_id: payload.work_plan_id || null,
        employee_id: payload.employee_id || null,
        title: payload.title,
        description: payload.description || null,
        status_id: payload.status_id || null,
        priority_id: payload.priority_id || null,
        planned_start_date: payload.planned_start_date || null,
        planned_end_date: payload.planned_end_date || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateActionPlan(actionPlanId, payload) {
  const { data, error } = await supabase
    .from("action_plans")
    .update({
      work_plan_id: payload.work_plan_id || null,
      employee_id: payload.employee_id || null,
      title: payload.title,
      description: payload.description || null,
      status_id: payload.status_id || null,
      priority_id: payload.priority_id || null,
      planned_start_date: payload.planned_start_date || null,
      planned_end_date: payload.planned_end_date || null,
    })
    .eq("id", actionPlanId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function deleteActionPlan(actionPlanId) {
  const { error } = await supabase
    .from("action_plans")
    .delete()
    .eq("id", actionPlanId);

  if (error) {
    console.error(error);
    throw error;
  }
}
