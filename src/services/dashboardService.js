import { supabase } from "../lib/supabaseClient";

export async function getDashboardData() {
  const [subKegiatan, pegawai] = await Promise.all([
    supabase
      .from("vw_sub_activity_monitoring_current_month")
      .select("*"),

    supabase
      .from("vw_employee_task_monitoring_summary")
      .select("*")
  ]);

  return {
    subKegiatan: subKegiatan.data || [],
    pegawai: pegawai.data || []
  };
}