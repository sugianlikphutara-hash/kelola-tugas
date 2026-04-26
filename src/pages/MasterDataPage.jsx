import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  createActivity,
  createActionPlan,
  createEmployee,
  createPriority,
  createProgram,
  createStatus,
  createSubActivity,
  createWorkPlan,
  createBudgetAccount,
  createBudgetItemStatus,
  createBudgetYear,
  deleteBudgetAccount,
  deleteBudgetItemStatus,
  deleteBudgetYear,
  updateBudgetAccountMetadata,
  updateBudgetItemStatus,
  updateBudgetYear,
  deleteActivity,
  deleteActionPlan,
  deleteEmployee,
  deletePriority,
  deleteProgram,
  deleteStatus,
  deleteSubActivity,
  deleteWorkPlan,
  getBudgetAccountDeleteGuards,
  getBudgetAccounts,
  getBudgetItemStatusDeleteGuard,
  getBudgetItemStatuses,
  getBudgetLevels,
  getBudgetYearUsageGuard,
  getBudgetYears,
  getActivities,
  getActionPlans,
  getEmployees,
  getPriorities,
  getPrograms,
  getStatuses,
  getSubActivities,
  getTaskActionPlanLinks,
  getWorkPlans,
  updateActivity,
  updateActionPlan,
  updateEmployee,
  updatePriority,
  updateProgram,
  updateStatus,
  updateSubActivity,
  updateWorkPlan,
} from "../services/masterDataService";
import {
  getChipStyle,
  getAlertStyle,
  getFieldLabelStyle,
  getFormLabelTypography,
  getInlineActionButtonStyle,
  getModalStyle,
  getNeutralButtonStyle,
  getOverlayStyle,
  getPrimaryButtonStyle,
  getTableBodyCellStyle,
  getTableCellCompactTypography,
  getTableCellLabelTypography,
  getTableCellSubtitleTypography,
  getTablePrimaryColumnWidthStyle,
  getTablePrimaryTitleClampClassName,
  getTableFrameStyle,
  getTableHeaderCellStyle,
  getTextInputStyle,
  getDateInputStyle,
  getPageSubtitleStyle,
  getPageTitleStyle,
} from "../lib/controlStyles";

const menus = [
  { key: "pelaksana", label: "Pelaksana" },
  { key: "status", label: "Status" },
  { key: "prioritas", label: "Prioritas" },
  { key: "program", label: "Program" },
  { key: "kegiatan", label: "Kegiatan" },
  { key: "sub-kegiatan", label: "Sub Kegiatan" },
  { key: "rhk", label: "RHK" },
  { key: "rencana-aksi", label: "Rencana Aksi" },
  { key: "anggaran", label: "Anggaran" },
];

const budgetTabs = [
  { key: "akun-belanja", label: "Akun Belanja", placeholder: "Halaman Akun Belanja" },
  { key: "status-item", label: "Status Item", placeholder: "Halaman Status Item" },
  { key: "tahun-anggaran", label: "Tahun Anggaran", placeholder: "Halaman Tahun Anggaran" },
];

function createDefaultForm() {
  return {
    name: "",
    code: "",
    description: "",
    nip: "",
    employment_status: "",
    phone: "",
    email: "",
    status_id: "",
    priority_id: "",
    program_id: "",
    activity_id: "",
    sub_activity_id: "",
    employee_id: "",
    supervisor_id: "",
    work_plan_id: "",
    title: "",
    start_date: "",
    end_date: "",
    planned_start_date: "",
    planned_end_date: "",
    output_target: "",
    output_unit: "",
    level: "",
    year: "",
    parent_id: "",
    budget_level_id: "",
    color: "#9CA3AF",
    is_leaf: false,
    is_active: true,
  };
}

function formatDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function formatPeriodDateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()] || "";
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getDeleteErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  if (code === "23503" || message.includes("foreign key")) {
    return "Data tidak bisa dihapus karena masih dipakai oleh relasi lain.";
  }
  return error?.message || "Gagal menghapus master data.";
}

function formatWorkPlanLabel(workPlan, employeeMap) {
  if (!workPlan) {
    return "-";
  }

  const employeeName = employeeMap[String(workPlan.employee_id)] || "Tanpa Pelaksana";
  return `${workPlan.title || "-"} — ${employeeName}`;
}

function normalizeSortValue(value) {
  return String(value || "").trim().toLowerCase();
}

function TableActionButtons({ onEdit, onDelete, prefersDarkMode }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={onEdit}
        style={getInlineActionButtonStyle(prefersDarkMode, { isEnabled: true, tone: "accent", height: 34 })}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        style={getInlineActionButtonStyle(prefersDarkMode, { isEnabled: true, tone: "danger", height: 34 })}
      >
        Hapus
      </button>
    </div>
  );
}

function isDuplicateBudgetAccountCodeError(error) {
  const errorCode = String(error?.code || "").trim();
  const errorMessage = String(error?.message || "").toLowerCase();

  return (
    errorCode === "23505" ||
    errorMessage.includes("duplicate") ||
    errorMessage.includes("unique")
  );
}

function resolveBudgetItemStatusColor(code, color = "") {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const normalizedColor = String(color || "").trim();

  if (normalizedColor) {
    return normalizedColor;
  }

  if (normalizedCode === "APPROVED") {
    return "#16A34A";
  }

  if (normalizedCode === "REJECTED") {
    return "#DC2626";
  }

  return "#9CA3AF";
}

function getBudgetItemStatusChipTone(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (normalizedCode === "APPROVED") {
    return "success";
  }

  if (normalizedCode === "REJECTED") {
    return "danger";
  }

  return "warning";
}

function isDuplicateBudgetItemStatusCodeError(error) {
  const errorCode = String(error?.code || "").trim();
  const errorMessage = String(error?.message || "").toLowerCase();

  return (
    errorCode === "23505" ||
    errorMessage.includes("duplicate") ||
    errorMessage.includes("unique")
  );
}

function isDuplicateBudgetYearError(error) {
  const errorCode = String(error?.code || "").trim();
  const errorMessage = String(error?.message || "").toLowerCase();

  return (
    errorCode === "23505" ||
    errorMessage.includes("duplicate") ||
    errorMessage.includes("unique")
  );
}

function parseBudgetAccountCode(rawCode) {
  const normalizedCode = String(rawCode || "").trim();

  if (!normalizedCode) {
    return {
      normalizedCode: "",
      levelNumber: null,
      parentCode: null,
      isLeaf: false,
      errorMessage: "",
    };
  }

  const levelPatterns = [
    { levelNumber: 1, regex: /^\d+\.\d+$/ },
    { levelNumber: 2, regex: /^\d+\.\d+\.\d{2}$/ },
    { levelNumber: 3, regex: /^\d+\.\d+\.\d{2}\.\d{2}$/ },
    { levelNumber: 4, regex: /^\d+\.\d+\.\d{2}\.\d{2}\.\d{3}$/ },
    { levelNumber: 5, regex: /^\d+\.\d+\.\d{2}\.\d{2}\.\d{3}\.\d{5}$/ },
  ];

  const matchedPattern = levelPatterns.find((item) => item.regex.test(normalizedCode));

  if (!matchedPattern) {
    return {
      normalizedCode,
      levelNumber: null,
      parentCode: null,
      isLeaf: false,
      errorMessage: "Format kode akun tidak valid",
    };
  }

  if (
    matchedPattern.levelNumber === 1 &&
    normalizedCode !== "5.1" &&
    normalizedCode !== "5.2"
  ) {
    return {
      normalizedCode,
      levelNumber: matchedPattern.levelNumber,
      parentCode: null,
      isLeaf: false,
      errorMessage: "Akun Belanja ini Tidak diizinkan",
    };
  }

  const codeSegments = normalizedCode.split(".");
  const parentCode =
    matchedPattern.levelNumber > 1
      ? codeSegments.slice(0, -1).join(".")
      : null;

  return {
    normalizedCode,
    levelNumber: matchedPattern.levelNumber,
    parentCode,
    isLeaf: matchedPattern.levelNumber === 5,
    errorMessage: "",
  };
}

function MasterFormModal({
  isOpen,
  title,
  onClose,
  onSubmit,
  isSubmitting,
  prefersDarkMode,
  form,
  onChange,
  type,
  statuses,
  priorities,
  programs,
  activities,
  subActivities,
  employees,
  workPlans,
}) {
  if (!isOpen) return null;

  const modalOverlayStyle = getOverlayStyle({
    background: "rgba(15, 23, 42, 0.45)",
    padding: 24,
    zIndex: 120,
  });

  const modalPanelStyle = getModalStyle({
    maxWidth: 720,
    maxHeight: "calc(100vh - 48px)",
    padding: 20,
    borderRadius: 8,
  });

  const labelStyle = getFieldLabelStyle(prefersDarkMode);

  const fieldStyle = {
    ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };

  const dateFieldStyle = getDateInputStyle(prefersDarkMode, { height: 42 });

  return (
    <div style={modalOverlayStyle}>
      <div style={modalPanelStyle}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-h)" }}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...getNeutralButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  size: "sm",
                  height: 36,
                }),
                minWidth: 72,
              }}
            >
              Tutup
            </button>
          </div>

          {type === "pelaksana" ? (
            <>
              <label style={labelStyle}>
                <span>Nama Pelaksana</span>
                <input type="text" name="name" value={form.name} onChange={onChange} required style={fieldStyle} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>NIP</span>
                  <input type="text" name="nip" value={form.nip} onChange={onChange} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  <span>Jabatan</span>
                  <input type="text" name="employment_status" value={form.employment_status} onChange={onChange} style={fieldStyle} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>No. HP</span>
                  <input type="text" name="phone" value={form.phone} onChange={onChange} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  <span>Email</span>
                  <input type="email" name="email" value={form.email} onChange={onChange} style={fieldStyle} />
                </label>
              </div>
            </>
          ) : null}

          {type === "status" ? (
            <>
              <label style={labelStyle}>
                <span>Kode Status</span>
                <input type="text" name="code" value={form.code} onChange={onChange} required style={fieldStyle} />
              </label>
              <label style={labelStyle}>
                <span>Nama Status</span>
                <input type="text" name="name" value={form.name} onChange={onChange} required style={fieldStyle} />
              </label>
              <label style={labelStyle}>
                <span>Deskripsi</span>
                <textarea name="description" value={form.description} onChange={onChange} rows={3} style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }} />
              </label>
            </>
          ) : null}

          {type === "prioritas" ? (
            <>
              <label style={labelStyle}>
                <span>Nama Prioritas</span>
                <input type="text" name="name" value={form.name} onChange={onChange} required style={fieldStyle} />
              </label>
              <label style={labelStyle}>
                <span>Level</span>
                <input type="number" min="1" name="level" value={form.level} onChange={onChange} required style={fieldStyle} />
              </label>
              <label style={{ ...labelStyle, gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 10 }}>
                <input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={onChange} />
                <span>Status Aktif</span>
              </label>
            </>
          ) : null}

          {(type === "program" || type === "kegiatan" || type === "sub-kegiatan") ? (
            <>
              {type === "kegiatan" ? (
                <label style={labelStyle}>
                  <span>Program</span>
                  <select name="program_id" value={form.program_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih program</option>
                    {programs.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {type === "sub-kegiatan" ? (
                <label style={labelStyle}>
                  <span>Kegiatan</span>
                  <select name="activity_id" value={form.activity_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih kegiatan</option>
                    {activities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>{type === "program" ? "Kode Program" : type === "kegiatan" ? "Kode Kegiatan" : "Kode Sub Kegiatan"}</span>
                  <input type="text" name="code" value={form.code} onChange={onChange} required style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  <span>{type === "program" ? "Nama Program" : type === "kegiatan" ? "Nama Kegiatan" : "Nama Sub Kegiatan"}</span>
                  <input type="text" name="name" value={form.name} onChange={onChange} required style={fieldStyle} />
                </label>
              </div>
              <label style={labelStyle}>
                <span>Deskripsi</span>
                <textarea name="description" value={form.description} onChange={onChange} rows={3} style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Status</span>
                  <select name="status_id" value={form.status_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih status</option>
                    {statuses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Prioritas</span>
                  <select name="priority_id" value={form.priority_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih prioritas</option>
                    {priorities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Tanggal Mulai</span>
                  <input type="date" name="start_date" value={form.start_date} onChange={onChange} style={dateFieldStyle} />
                </label>
                <label style={labelStyle}>
                  <span>Tanggal Selesai</span>
                  <input type="date" name="end_date" value={form.end_date} onChange={onChange} style={dateFieldStyle} />
                </label>
              </div>
              {type === "sub-kegiatan" ? (
                <>
                  <label style={labelStyle}>
                    <span>Output Target</span>
                    <input type="text" name="output_target" value={form.output_target} onChange={onChange} style={fieldStyle} />
                  </label>
                  <label style={labelStyle}>
                    <span>Satuan Output</span>
                    <input type="text" name="output_unit" value={form.output_unit} onChange={onChange} style={fieldStyle} />
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          {type === "rhk" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Sub Kegiatan</span>
                  <select name="sub_activity_id" value={form.sub_activity_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih sub kegiatan</option>
                    {subActivities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Pelaksana</span>
                  <select name="employee_id" value={form.employee_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih pelaksana</option>
                    {employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label style={labelStyle}>
                <span>Supervisor</span>
                <select name="supervisor_id" value={form.supervisor_id} onChange={onChange} style={fieldStyle}>
                  <option value="">Pilih supervisor</option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                <span>Title</span>
                <input type="text" name="title" value={form.title} onChange={onChange} required style={fieldStyle} />
              </label>
              <label style={labelStyle}>
                <span>Deskripsi</span>
                <textarea name="description" value={form.description} onChange={onChange} rows={3} style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Status</span>
                  <select name="status_id" value={form.status_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih status</option>
                    {statuses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Prioritas</span>
                  <select name="priority_id" value={form.priority_id} onChange={onChange} required style={fieldStyle}>
                    <option value="">Pilih prioritas</option>
                    {priorities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Tanggal Mulai</span>
                  <input type="date" name="start_date" value={form.start_date} onChange={onChange} style={dateFieldStyle} />
                </label>
                <label style={labelStyle}>
                  <span>Tanggal Selesai</span>
                  <input type="date" name="end_date" value={form.end_date} onChange={onChange} style={dateFieldStyle} />
                </label>
              </div>
            </>
          ) : null}

          {type === "rencana-aksi" ? (
            <>
              <label style={labelStyle}>
                <span>RHK</span>
                <select name="work_plan_id" value={form.work_plan_id} onChange={onChange} required style={fieldStyle}>
                  <option value="">Pilih RHK</option>
                  {workPlans.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatWorkPlanLabel(
                        item,
                        Object.fromEntries(
                          employees.map((employee) => [String(employee.id), employee.full_name])
                        )
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                <span>Pelaksana</span>
                <select name="employee_id" value={form.employee_id} onChange={onChange} style={fieldStyle}>
                  <option value="">Pilih pelaksana</option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                <span>Title</span>
                <input type="text" name="title" value={form.title} onChange={onChange} required style={fieldStyle} />
              </label>
              <label style={labelStyle}>
                <span>Deskripsi</span>
                <textarea name="description" value={form.description} onChange={onChange} rows={3} style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Status</span>
                  <select name="status_id" value={form.status_id} onChange={onChange} style={fieldStyle}>
                    <option value="">Pilih status</option>
                    {statuses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Prioritas</span>
                  <select name="priority_id" value={form.priority_id} onChange={onChange} style={fieldStyle}>
                    <option value="">Pilih prioritas</option>
                    {priorities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  <span>Tanggal Mulai</span>
                  <input type="date" name="planned_start_date" value={form.planned_start_date} onChange={onChange} style={dateFieldStyle} />
                </label>
                <label style={labelStyle}>
                  <span>Tanggal Selesai</span>
                  <input type="date" name="planned_end_date" value={form.planned_end_date} onChange={onChange} style={dateFieldStyle} />
                </label>
              </div>
            </>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className={`btn-specific-action ${!isSubmitting ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
              onClick={onClose}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? "wait" : "pointer" }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: !isSubmitting, height: 40 }),
                minWidth: 120,
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BudgetAccountFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  prefersDarkMode,
  form,
  onChange,
  derivedBudgetAccountMeta,
  isEditMode = false,
}) {
  if (!isOpen) return null;

  const modalOverlayStyle = getOverlayStyle({
    background: "rgba(15, 23, 42, 0.45)",
    padding: 24,
    zIndex: 120,
  });

  const modalPanelStyle = getModalStyle({
    maxWidth: 640,
    maxHeight: "calc(100vh - 48px)",
    padding: 20,
    borderRadius: 8,
  });

  const labelStyle = getFieldLabelStyle(prefersDarkMode);
  const fieldStyle = {
    ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };
  const readOnlyFieldStyle = {
    ...fieldStyle,
    background: prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)",
    color: "var(--text-muted)",
    cursor: "default",
  };
  const checkboxLabelStyle = {
    ...labelStyle,
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: 10,
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalPanelStyle}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-h)" }}>
              {isEditMode ? "Edit Akun Belanja" : "Tambah Akun Belanja"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...getNeutralButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  size: "sm",
                  height: 36,
                }),
                minWidth: 72,
              }}
            >
              Tutup
            </button>
          </div>

          {derivedBudgetAccountMeta.errorMessage ? (
            <div
              style={getAlertStyle(prefersDarkMode, {
                tone: "error",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
              })}
            >
              {derivedBudgetAccountMeta.errorMessage}
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={labelStyle}>
              <span>Kode Akun</span>
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={onChange}
                required
                readOnly={isEditMode}
                style={isEditMode ? readOnlyFieldStyle : fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              <span>Nama Akun</span>
              <input type="text" name="name" value={form.name} onChange={onChange} required style={fieldStyle} />
            </label>
          </div>

          <label style={labelStyle}>
            <span>Parent</span>
            <input
              type="text"
              readOnly
              value={derivedBudgetAccountMeta.parentLabel}
              style={readOnlyFieldStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Level Akun</span>
            <input
              type="text"
              readOnly
              value={derivedBudgetAccountMeta.levelLabel}
              style={readOnlyFieldStyle}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={labelStyle}>
              <span>Leaf</span>
              <input
                type="text"
                readOnly
                value={derivedBudgetAccountMeta.leafLabel}
                style={readOnlyFieldStyle}
              />
            </label>
            <label style={checkboxLabelStyle}>
              <input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={onChange} />
              <span>Status Aktif</span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className={`btn-specific-action ${!isSubmitting ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
              onClick={onClose}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? "wait" : "pointer" }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: !isSubmitting, height: 40 }),
                minWidth: 120,
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  prefersDarkMode,
  title,
  message,
}) {
  if (!isOpen) return null;

  const modalOverlayStyle = getOverlayStyle({
    background: "rgba(15, 23, 42, 0.45)",
    padding: 24,
    zIndex: 130,
  });

  const modalPanelStyle = getModalStyle({
    maxWidth: 520,
    maxHeight: "calc(100vh - 48px)",
    padding: 20,
    borderRadius: 8,
  });

  return (
    <div style={modalOverlayStyle}>
      <div style={modalPanelStyle}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-h)" }}>{title}</h2>
            <div style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>
              {message}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className={`btn-specific-action ${!isSubmitting ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
              onClick={onClose}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? "wait" : "pointer" }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              style={{
                ...getInlineActionButtonStyle(prefersDarkMode, {
                  isEnabled: !isSubmitting,
                  tone: "danger",
                  height: 40,
                }),
                minWidth: 120,
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting ? "Menghapus..." : "Hapus"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetItemStatusFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  prefersDarkMode,
  form,
  onChange,
  isEditMode = false,
}) {
  if (!isOpen) return null;

  const modalOverlayStyle = getOverlayStyle({
    background: "rgba(15, 23, 42, 0.45)",
    padding: 24,
    zIndex: 120,
  });

  const modalPanelStyle = getModalStyle({
    maxWidth: 560,
    maxHeight: "calc(100vh - 48px)",
    padding: 20,
    borderRadius: 8,
  });

  const labelStyle = getFieldLabelStyle(prefersDarkMode);
  const fieldStyle = {
    ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };
  const checkboxLabelStyle = {
    ...labelStyle,
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: 10,
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalPanelStyle}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-h)" }}>
              {isEditMode ? "Edit Status Item" : "Tambah Status Item"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...getNeutralButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  size: "sm",
                  height: 36,
                }),
                minWidth: 72,
              }}
            >
              Tutup
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={labelStyle}>
              <span>Code</span>
              <input type="text" name="code" value={form.code} onChange={onChange} required style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              <span>Name</span>
              <input type="text" name="name" value={form.name} onChange={onChange} style={fieldStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Preview Status</span>
            <div
              style={{
                ...getChipStyle(prefersDarkMode, {
                  size: "xs",
                  tone: getBudgetItemStatusChipTone(form.code),
                }),
                width: "fit-content",
                fontWeight: 500,
              }}
            >
              {String(form.code || "").trim().toUpperCase() || "PREVIEW"}
            </div>
          </div>

          <label style={checkboxLabelStyle}>
            <input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={onChange} />
            <span>Status Aktif</span>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className={`btn-specific-action ${!isSubmitting ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
              onClick={onClose}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? "wait" : "pointer" }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: !isSubmitting, height: 40 }),
                minWidth: 120,
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BudgetYearFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  prefersDarkMode,
  form,
  onChange,
  isEditMode = false,
  isLocked = false,
}) {
  if (!isOpen) return null;

  const modalOverlayStyle = getOverlayStyle({
    background: "rgba(15, 23, 42, 0.45)",
    padding: 24,
    zIndex: 120,
  });

  const modalPanelStyle = getModalStyle({
    maxWidth: 560,
    maxHeight: "calc(100vh - 48px)",
    padding: 20,
    borderRadius: 8,
  });

  const labelStyle = getFieldLabelStyle(prefersDarkMode);
  const fieldStyle = {
    ...getTextInputStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };
  const dateFieldStyle = {
    ...getDateInputStyle(prefersDarkMode, { tone: "panel" }),
    width: "100%",
    borderRadius: 6,
  };
  const readOnlyFieldStyle = {
    ...fieldStyle,
    background: "var(--surface-muted)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  };
  const checkboxLabelStyle = {
    ...labelStyle,
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: 10,
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalPanelStyle}>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--text-h)" }}>
              {isEditMode ? "Edit Tahun Anggaran" : "Tambah Tahun Anggaran"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...getNeutralButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  size: "sm",
                  height: 36,
                }),
                minWidth: 72,
              }}
            >
              Tutup
            </button>
          </div>

          {isEditMode && isLocked ? (
            <div
              style={getAlertStyle(prefersDarkMode, {
                tone: "warning",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
              })}
            >
              Tahun anggaran ini sudah digunakan, sehingga periode hanya bisa dilihat dan status aktif saja yang bisa diubah.
            </div>
          ) : null}

          <label style={labelStyle}>
            <span>Tahun</span>
            <input
              type="number"
              name="year"
              value={form.year}
              onChange={onChange}
              required
              min="2000"
              max="9999"
              disabled={isLocked}
              style={isLocked ? readOnlyFieldStyle : fieldStyle}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={labelStyle}>
              <span>Start Date</span>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={onChange}
                required
                disabled={isLocked}
                style={isLocked ? readOnlyFieldStyle : dateFieldStyle}
              />
            </label>
            <label style={labelStyle}>
              <span>End Date</span>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={onChange}
                required
                disabled={isLocked}
                style={isLocked ? readOnlyFieldStyle : dateFieldStyle}
              />
            </label>
          </div>

          <label style={checkboxLabelStyle}>
            <input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={onChange} />
            <span>Status Aktif</span>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className={`btn-specific-action ${!isSubmitting ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
              onClick={onClose}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? "wait" : "pointer" }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: !isSubmitting, height: 40 }),
                minWidth: 120,
                cursor: isSubmitting ? "wait" : "pointer",
              }}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DataTable({ headers, rows, emptyText, columnStyles = [], minWidth = 860 }) {
  // Header default: all left-aligned.
  const tableHeaderAlignMode = 1;

  const emptyCellStyle = {
    ...getTableBodyCellStyle({
      padding: 20,
      borderColor: "transparent",
      includeTypography: false,
      includeColor: false,
    }),
    textAlign: "left",
    color: "var(--text-muted)",
    fontSize: 13,
  };

  return (
    <table style={{ width: "100%", minWidth, borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th
              key={header}
              style={{
                ...getTableHeaderCellStyle({
                  alignMode: tableHeaderAlignMode,
                  label: header,
                  background: "var(--table-header-bg)",
                  color: "var(--table-header-color)",
                  borderColor: "var(--table-header-border)",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 0,
                }),
                ...(columnStyles[index] || {}),
                textAlign: "left",
              }}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows : (
          <tr>
            <td colSpan={headers.length} style={emptyCellStyle}>
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function MasterDataPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [activeMenu, setActiveMenu] = useState("pelaksana");
  const [activeBudgetTab, setActiveBudgetTab] = useState("akun-belanja");
  const [employees, setEmployees] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [subActivities, setSubActivities] = useState([]);
  const [workPlans, setWorkPlans] = useState([]);
  const [actionPlans, setActionPlans] = useState([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("pelaksana");
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(createDefaultForm());
  const [rhkProgramFilter, setRhkProgramFilter] = useState("");
  const [rhkActivityFilter, setRhkActivityFilter] = useState("");
  const [rhkSubActivityFilter, setRhkSubActivityFilter] = useState("");
  const [rhkEmployeeFilter, setRhkEmployeeFilter] = useState("");
  const [rhkSort, setRhkSort] = useState("NEWEST");
  const [actionPlanProgramFilter, setActionPlanProgramFilter] = useState("");
  const [actionPlanActivityFilter, setActionPlanActivityFilter] = useState("");
  const [actionPlanSubActivityFilter, setActionPlanSubActivityFilter] = useState("");
  const [actionPlanWorkPlanFilter, setActionPlanWorkPlanFilter] = useState("");
  const [actionPlanEmployeeFilter, setActionPlanEmployeeFilter] = useState("");
  const [actionPlanSort, setActionPlanSort] = useState("NEWEST");
  const [taskActionPlanLinks, setTaskActionPlanLinks] = useState([]);
  const [budgetAccounts, setBudgetAccounts] = useState([]);
  const [isBudgetAccountsLoading, setIsBudgetAccountsLoading] = useState(false);
  const [budgetAccountsError, setBudgetAccountsError] = useState("");
  const [hasLoadedBudgetAccounts, setHasLoadedBudgetAccounts] = useState(false);
  const [budgetItemStatuses, setBudgetItemStatuses] = useState([]);
  const [isBudgetItemStatusesLoading, setIsBudgetItemStatusesLoading] = useState(false);
  const [budgetItemStatusesError, setBudgetItemStatusesError] = useState("");
  const [hasLoadedBudgetItemStatuses, setHasLoadedBudgetItemStatuses] = useState(false);
  const [budgetYears, setBudgetYears] = useState([]);
  const [isBudgetYearsLoading, setIsBudgetYearsLoading] = useState(false);
  const [budgetYearsError, setBudgetYearsError] = useState("");
  const [hasLoadedBudgetYears, setHasLoadedBudgetYears] = useState(false);
  const [budgetLevels, setBudgetLevels] = useState([]);
  const [hasLoadedBudgetLevels, setHasLoadedBudgetLevels] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  const tableFrameStyle = getTableFrameStyle();
  const labelStyle = getFieldLabelStyle(prefersDarkMode);
  const tableBodyCellStyle = useMemo(
    () => getTableBodyCellStyle({ padding: "14px 14px" }),
    []
  );

  const primaryColMode2Style = useMemo(() => getTablePrimaryColumnWidthStyle({ mode: 2 }), []);
  const primaryColMode3Style = useMemo(() => getTablePrimaryColumnWidthStyle({ mode: 3 }), []);
  const primaryTitleMode2ClampClassName = useMemo(
    () => getTablePrimaryTitleClampClassName({ mode: 2 }),
    []
  );
  const primaryTitleMode3ClampClassName = useMemo(
    () => getTablePrimaryTitleClampClassName({ mode: 3 }),
    []
  );
  const codeColumnStyle = useMemo(() => {
    // Keep "Code" truly one-line even when other columns grow.
    return { width: 140, maxWidth: 180, whiteSpace: "nowrap" };
  }, []);

  const budgetLevelByNumber = useMemo(
    () => Object.fromEntries(budgetLevels.map((item) => [Number(item.level_number), item])),
    [budgetLevels]
  );

  const loadBudgetAccounts = useCallback(async () => {
    setIsBudgetAccountsLoading(true);
    setBudgetAccountsError("");

    try {
      const rows = await getBudgetAccounts();
      setBudgetAccounts(rows || []);
      setHasLoadedBudgetAccounts(true);
      return rows || [];
    } catch (error) {
      setBudgetAccountsError(
        error?.message || "Gagal memuat data akun belanja."
      );
      setHasLoadedBudgetAccounts(true);
      throw error;
    } finally {
      setIsBudgetAccountsLoading(false);
    }
  }, []);

  const loadBudgetItemStatuses = useCallback(async () => {
    setIsBudgetItemStatusesLoading(true);
    setBudgetItemStatusesError("");

    try {
      const rows = await getBudgetItemStatuses();
      setBudgetItemStatuses(rows || []);
      setHasLoadedBudgetItemStatuses(true);
      return rows || [];
    } catch (error) {
      setBudgetItemStatusesError(
        error?.message || "Gagal memuat data status item."
      );
      setHasLoadedBudgetItemStatuses(true);
      throw error;
    } finally {
      setIsBudgetItemStatusesLoading(false);
    }
  }, []);

  const loadBudgetLevels = useCallback(async () => {
    const rows = await getBudgetLevels();
    setBudgetLevels(rows || []);
    setHasLoadedBudgetLevels(true);
    return rows || [];
  }, []);

  const loadBudgetYears = useCallback(async () => {
    setIsBudgetYearsLoading(true);
    setBudgetYearsError("");

    try {
      const rows = await getBudgetYears();
      const rowsWithUsage = await Promise.all(
        (rows || []).map(async (item) => {
          const usage = await getBudgetYearUsageGuard(item);

          return {
            ...item,
            has_relations: usage.isUsed,
            usage_guard: usage,
          };
        })
      );

      setBudgetYears(rowsWithUsage);
      setHasLoadedBudgetYears(true);
      return rowsWithUsage;
    } catch (error) {
      setBudgetYearsError(
        error?.message || "Gagal memuat data tahun anggaran."
      );
      setHasLoadedBudgetYears(true);
      throw error;
    } finally {
      setIsBudgetYearsLoading(false);
    }
  }, []);

  const loadMasterData = useCallback(async () => {
    const [employeeData, statusData, priorityData, programData, activityData, subActivityData, workPlanData, actionPlanData, taskActionPlanLinkData] =
      await Promise.all([
        getEmployees(),
        getStatuses(),
        getPriorities(),
        getPrograms(),
        getActivities(),
        getSubActivities(),
        getWorkPlans(),
        getActionPlans(),
        getTaskActionPlanLinks(),
      ]);

    setEmployees(employeeData || []);
    setStatuses(statusData || []);
    setPriorities(priorityData || []);
    setPrograms(programData || []);
    setActivities(activityData || []);
    setSubActivities(subActivityData || []);
    setWorkPlans(workPlanData || []);
    setActionPlans(actionPlanData || []);
    setTaskActionPlanLinks(taskActionPlanLinkData || []);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      void loadMasterData();
    });

    return () => {
      isCancelled = true;
    };
  }, [loadMasterData]);

  useEffect(() => {
    if (activeMenu !== "anggaran" || activeBudgetTab !== "akun-belanja") {
      return;
    }

    if (hasLoadedBudgetAccounts) {
      return;
    }

    let isCancelled = false;

    Promise.resolve().then(async () => {
      if (isCancelled) {
        return;
      }

      try {
        const rows = await loadBudgetAccounts();

        if (isCancelled) {
          return;
        }

        setBudgetAccounts(rows || []);
      } catch {
        if (isCancelled) {
          return;
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    activeBudgetTab,
    activeMenu,
    hasLoadedBudgetAccounts,
    loadBudgetAccounts,
  ]);

  useEffect(() => {
    if (activeMenu !== "anggaran" || activeBudgetTab !== "status-item") {
      return;
    }

    if (hasLoadedBudgetItemStatuses) {
      return;
    }

    let isCancelled = false;

    Promise.resolve().then(async () => {
      if (isCancelled) {
        return;
      }

      try {
        const rows = await loadBudgetItemStatuses();

        if (isCancelled) {
          return;
        }

        setBudgetItemStatuses(rows || []);
      } catch {
        if (isCancelled) {
          return;
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    activeBudgetTab,
    activeMenu,
    hasLoadedBudgetItemStatuses,
    loadBudgetItemStatuses,
  ]);

  useEffect(() => {
    if (activeMenu !== "anggaran" || activeBudgetTab !== "tahun-anggaran") {
      return;
    }

    if (hasLoadedBudgetYears) {
      return;
    }

    let isCancelled = false;

    Promise.resolve().then(async () => {
      if (isCancelled) {
        return;
      }

      try {
        const rows = await loadBudgetYears();

        if (isCancelled) {
          return;
        }

        setBudgetYears(rows || []);
      } catch {
        if (isCancelled) {
          return;
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    activeBudgetTab,
    activeMenu,
    hasLoadedBudgetYears,
    loadBudgetYears,
  ]);

  useEffect(() => {
    if (activeMenu !== "anggaran" || activeBudgetTab !== "akun-belanja") {
      return;
    }

    if (hasLoadedBudgetLevels) {
      return;
    }

    let isCancelled = false;

    Promise.resolve().then(async () => {
      if (isCancelled) {
        return;
      }

      try {
        const rows = await loadBudgetLevels();

        if (isCancelled) {
          return;
        }

        setBudgetLevels(rows || []);
      } catch {
        if (isCancelled) {
          return;
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    activeBudgetTab,
    activeMenu,
    hasLoadedBudgetLevels,
    loadBudgetLevels,
  ]);

  const statusMap = useMemo(
    () => Object.fromEntries(statuses.map((item) => [String(item.id), item.name])),
    [statuses]
  );
  const priorityMap = useMemo(
    () => Object.fromEntries(priorities.map((item) => [String(item.id), item.name])),
    [priorities]
  );
  const programMap = useMemo(
    () => Object.fromEntries(programs.map((item) => [String(item.id), item.name])),
    [programs]
  );
  const activityMap = useMemo(
    () => Object.fromEntries(activities.map((item) => [String(item.id), item.name])),
    [activities]
  );
  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((item) => [String(item.id), item.full_name])),
    [employees]
  );
  const subActivityCodeMap = useMemo(
    () => Object.fromEntries(subActivities.map((item) => [String(item.id), item.code || ""])),
    [subActivities]
  );
  const activityById = useMemo(
    () => Object.fromEntries(activities.map((item) => [String(item.id), item])),
    [activities]
  );
  const subActivityById = useMemo(
    () => Object.fromEntries(subActivities.map((item) => [String(item.id), item])),
    [subActivities]
  );
  const actionPlanCountMap = useMemo(() => {
    const counts = {};

    actionPlans.forEach((item) => {
      const workPlanId = String(item.work_plan_id || "");
      if (!workPlanId) return;
      counts[workPlanId] = (counts[workPlanId] || 0) + 1;
    });

    return counts;
  }, [actionPlans]);
  const taskCountByActionPlanMap = useMemo(() => {
    const counts = {};

    taskActionPlanLinks.forEach((item) => {
      const actionPlanId = String(item.action_plan_id || "");
      if (!actionPlanId) return;
      counts[actionPlanId] = (counts[actionPlanId] || 0) + 1;
    });

    return counts;
  }, [taskActionPlanLinks]);
  const rhkProgramOptions = useMemo(() => programs, [programs]);
  const rhkActivityOptions = useMemo(() => {
    if (!rhkProgramFilter) {
      return activities;
    }

    return activities.filter(
      (item) => String(item.program_id || "") === rhkProgramFilter
    );
  }, [activities, rhkProgramFilter]);
  const rhkSubActivityOptions = useMemo(() => {
    return subActivities.filter((item) => {
      const activity = activityById[String(item.activity_id || "")];
      if (rhkProgramFilter && String(activity?.program_id || "") !== rhkProgramFilter) {
        return false;
      }
      if (rhkActivityFilter && String(item.activity_id || "") !== rhkActivityFilter) {
        return false;
      }
      return true;
    });
  }, [activityById, rhkActivityFilter, rhkProgramFilter, subActivities]);

  useEffect(() => {
    if (
      rhkActivityFilter &&
      !rhkActivityOptions.some((item) => String(item.id) === rhkActivityFilter)
    ) {
      let isCancelled = false;

      Promise.resolve().then(() => {
        if (isCancelled) {
          return;
        }
        setRhkActivityFilter("");
      });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [rhkActivityFilter, rhkActivityOptions]);

  useEffect(() => {
    if (
      rhkSubActivityFilter &&
      !rhkSubActivityOptions.some((item) => String(item.id) === rhkSubActivityFilter)
    ) {
      let isCancelled = false;

      Promise.resolve().then(() => {
        if (isCancelled) {
          return;
        }
        setRhkSubActivityFilter("");
      });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [rhkSubActivityFilter, rhkSubActivityOptions]);

  const filteredSortedWorkPlans = useMemo(() => {
    const filtered = workPlans.filter((item) => {
      const subActivity = subActivityById[String(item.sub_activity_id || "")];
      const activity = activityById[String(subActivity?.activity_id || "")];

      if (rhkProgramFilter && String(activity?.program_id || "") !== rhkProgramFilter) {
        return false;
      }
      if (rhkActivityFilter && String(subActivity?.activity_id || "") !== rhkActivityFilter) {
        return false;
      }
      if (rhkSubActivityFilter && String(item.sub_activity_id || "") !== rhkSubActivityFilter) {
        return false;
      }
      if (rhkEmployeeFilter && String(item.employee_id || "") !== rhkEmployeeFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((firstItem, secondItem) => {
      if (rhkSort === "NAME_ASC") {
        return normalizeSortValue(firstItem.title).localeCompare(
          normalizeSortValue(secondItem.title),
          "id"
        );
      }

      if (rhkSort === "NAME_DESC") {
        return normalizeSortValue(secondItem.title).localeCompare(
          normalizeSortValue(firstItem.title),
          "id"
        );
      }

      if (rhkSort === "CODE_ASC") {
        const firstCode = normalizeSortValue(
          subActivityCodeMap[String(firstItem.sub_activity_id || "")]
        );
        const secondCode = normalizeSortValue(
          subActivityCodeMap[String(secondItem.sub_activity_id || "")]
        );
        const codeCompare = firstCode.localeCompare(secondCode, "id", {
          numeric: true,
        });

        if (codeCompare !== 0) return codeCompare;
      }

      const firstCreatedAt = new Date(firstItem.created_at || 0).getTime();
      const secondCreatedAt = new Date(secondItem.created_at || 0).getTime();

      if (rhkSort === "OLDEST") {
        return firstCreatedAt - secondCreatedAt;
      }

      return secondCreatedAt - firstCreatedAt;
    });
  }, [
    activityById,
    rhkActivityFilter,
    rhkEmployeeFilter,
    rhkProgramFilter,
    rhkSort,
    rhkSubActivityFilter,
    subActivityById,
    subActivityCodeMap,
    workPlans,
  ]);
  const actionPlanProgramOptions = useMemo(() => programs, [programs]);
  const actionPlanActivityOptions = useMemo(() => {
    if (!actionPlanProgramFilter) {
      return activities;
    }

    return activities.filter(
      (item) => String(item.program_id || "") === actionPlanProgramFilter
    );
  }, [actionPlanProgramFilter, activities]);
  const actionPlanSubActivityOptions = useMemo(() => {
    return subActivities.filter((item) => {
      const activity = activityById[String(item.activity_id || "")];
      if (
        actionPlanProgramFilter &&
        String(activity?.program_id || "") !== actionPlanProgramFilter
      ) {
        return false;
      }
      if (
        actionPlanActivityFilter &&
        String(item.activity_id || "") !== actionPlanActivityFilter
      ) {
        return false;
      }
      return true;
    });
  }, [actionPlanActivityFilter, actionPlanProgramFilter, activityById, subActivities]);
  const actionPlanWorkPlanOptions = useMemo(() => {
    return workPlans.filter((item) => {
      const subActivity = subActivityById[String(item.sub_activity_id || "")];
      const activity = activityById[String(subActivity?.activity_id || "")];

      if (
        actionPlanProgramFilter &&
        String(activity?.program_id || "") !== actionPlanProgramFilter
      ) {
        return false;
      }
      if (
        actionPlanActivityFilter &&
        String(subActivity?.activity_id || "") !== actionPlanActivityFilter
      ) {
        return false;
      }
      if (
        actionPlanSubActivityFilter &&
        String(item.sub_activity_id || "") !== actionPlanSubActivityFilter
      ) {
        return false;
      }

      return true;
    });
  }, [actionPlanActivityFilter, actionPlanProgramFilter, actionPlanSubActivityFilter, activityById, subActivityById, workPlans]);

  useEffect(() => {
    if (
      actionPlanActivityFilter &&
      !actionPlanActivityOptions.some(
        (item) => String(item.id) === actionPlanActivityFilter
      )
    ) {
      let isCancelled = false;

      Promise.resolve().then(() => {
        if (isCancelled) {
          return;
        }
        setActionPlanActivityFilter("");
      });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [actionPlanActivityFilter, actionPlanActivityOptions]);

  useEffect(() => {
    if (
      actionPlanSubActivityFilter &&
      !actionPlanSubActivityOptions.some(
        (item) => String(item.id) === actionPlanSubActivityFilter
      )
    ) {
      let isCancelled = false;

      Promise.resolve().then(() => {
        if (isCancelled) {
          return;
        }
        setActionPlanSubActivityFilter("");
      });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [actionPlanSubActivityFilter, actionPlanSubActivityOptions]);

  useEffect(() => {
    if (
      actionPlanWorkPlanFilter &&
      !actionPlanWorkPlanOptions.some(
        (item) => String(item.id) === actionPlanWorkPlanFilter
      )
    ) {
      let isCancelled = false;

      Promise.resolve().then(() => {
        if (isCancelled) {
          return;
        }
        setActionPlanWorkPlanFilter("");
      });

      return () => {
        isCancelled = true;
      };
    }
    return undefined;
  }, [actionPlanWorkPlanFilter, actionPlanWorkPlanOptions]);

  const filteredSortedActionPlans = useMemo(() => {
    const filtered = actionPlans.filter((item) => {
      const workPlan = workPlans.find(
        (workPlanItem) => String(workPlanItem.id) === String(item.work_plan_id || "")
      );
      const subActivity = subActivityById[String(workPlan?.sub_activity_id || "")];
      const activity = activityById[String(subActivity?.activity_id || "")];

      if (
        actionPlanProgramFilter &&
        String(activity?.program_id || "") !== actionPlanProgramFilter
      ) {
        return false;
      }
      if (
        actionPlanActivityFilter &&
        String(subActivity?.activity_id || "") !== actionPlanActivityFilter
      ) {
        return false;
      }
      if (
        actionPlanSubActivityFilter &&
        String(workPlan?.sub_activity_id || "") !== actionPlanSubActivityFilter
      ) {
        return false;
      }
      if (
        actionPlanWorkPlanFilter &&
        String(item.work_plan_id || "") !== actionPlanWorkPlanFilter
      ) {
        return false;
      }
      if (
        actionPlanEmployeeFilter &&
        String(item.employee_id || "") !== actionPlanEmployeeFilter
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((firstItem, secondItem) => {
      if (actionPlanSort === "NAME_ASC") {
        return normalizeSortValue(firstItem.title).localeCompare(
          normalizeSortValue(secondItem.title),
          "id"
        );
      }

      if (actionPlanSort === "NAME_DESC") {
        return normalizeSortValue(secondItem.title).localeCompare(
          normalizeSortValue(firstItem.title),
          "id"
        );
      }

      const firstCreatedAt = new Date(firstItem.created_at || 0).getTime();
      const secondCreatedAt = new Date(secondItem.created_at || 0).getTime();

      if (actionPlanSort === "OLDEST") {
        return firstCreatedAt - secondCreatedAt;
      }

      return secondCreatedAt - firstCreatedAt;
    });
  }, [
    actionPlanActivityFilter,
    actionPlanEmployeeFilter,
    actionPlanProgramFilter,
    actionPlanSort,
    actionPlanSubActivityFilter,
    actionPlanWorkPlanFilter,
    actionPlans,
    activityById,
    subActivityById,
    workPlans,
  ]);

  const moduleMeta = useMemo(
    () =>
      ({
        pelaksana: {
          title: "Master Pelaksana",
          description: "Kelola daftar pelaksana yang digunakan sebagai assignee task.",
          addLabel: "+ Tambah Pelaksana",
        },
        status: {
          title: "Master Status",
          description: "Kelola daftar status task yang digunakan di seluruh aplikasi.",
          addLabel: "+ Tambah Status",
        },
        prioritas: {
          title: "Master Prioritas",
          description: "Kelola level prioritas sederhana untuk dipakai di Task.",
          addLabel: "+ Tambah Prioritas",
        },
        program: {
          title: "Master Program",
          description: "Kelola struktur program beserta status, prioritas, dan rentang waktu.",
          addLabel: "+ Tambah Program",
        },
        kegiatan: {
          title: "Master Kegiatan",
          description: "Kelola kegiatan di bawah program untuk kebutuhan monitoring dan task.",
          addLabel: "+ Tambah Kegiatan",
        },
        "sub-kegiatan": {
          title: "Master Sub Kegiatan",
          description: "Kelola sub kegiatan dan target output untuk kebutuhan operasional.",
          addLabel: "+ Tambah Sub Kegiatan",
        },
        rhk: {
          title: "Master RHK",
          description: "Kelola work plan atau RHK sebagai jembatan antara sub kegiatan dan rencana aksi.",
          addLabel: "+ Tambah RHK",
        },
        "rencana-aksi": {
          title: "Master Rencana Aksi",
          description: "Kelola rencana aksi di bawah RHK sebelum task dibentuk.",
          addLabel: "+ Tambah Rencana Aksi",
        },
        anggaran: {
          title: "Master Anggaran",
          description: "Kelola master data anggaran melalui tab internal sesuai domain referensi.",
          addLabel: null,
        },
      })[activeMenu],
    [activeMenu]
  );

  function resetForm() {
    setForm(createDefaultForm());
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingItem(null);
    resetForm();
  }

  function closeDeleteModal() {
    if (isDeleteSubmitting) {
      return;
    }

    setDeleteTarget(null);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function openCreateModal(type) {
    setMessage("");
    setErrorMessage("");
    setModalType(type);
    setEditingItem(null);
    resetForm();
    setIsModalOpen(true);
  }

  function requestDelete(type, item) {
    setDeleteTarget({ type, item });
  }

  function openEditModal(type, item) {
    setMessage("");
    setErrorMessage("");
    setModalType(type);
    setEditingItem(item);
    setForm({
      ...createDefaultForm(),
      name: item.full_name || item.name || "",
      code: item.code || "",
      description: item.description || "",
      nip: item.nip || "",
      employment_status: item.employment_status || "",
      phone: item.phone || "",
      email: item.email || "",
      status_id: item.status_id ? String(item.status_id) : "",
      priority_id: item.priority_id ? String(item.priority_id) : "",
      program_id: item.program_id ? String(item.program_id) : "",
      activity_id: item.activity_id ? String(item.activity_id) : "",
      sub_activity_id: item.sub_activity_id ? String(item.sub_activity_id) : "",
      employee_id: item.employee_id ? String(item.employee_id) : "",
      supervisor_id: item.supervisor_id ? String(item.supervisor_id) : "",
      work_plan_id: item.work_plan_id ? String(item.work_plan_id) : "",
      title: item.title || "",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      planned_start_date: item.planned_start_date || "",
      planned_end_date: item.planned_end_date || "",
      output_target: item.output_target != null ? String(item.output_target) : "",
      output_unit: item.output_unit || "",
      level: item.level != null ? String(item.level) : item.sort_order != null ? String(item.sort_order) : "",
      year: item.year != null ? String(item.year) : "",
      parent_id: item.parent_id ? String(item.parent_id) : "",
      budget_level_id: item.budget_level_id ? String(item.budget_level_id) : "",
      color: item.color || resolveBudgetItemStatusColor(item.code, item.color),
      is_leaf: item.is_leaf === true,
      is_active: item.is_active !== false,
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (modalType === "pelaksana") {
        if (!form.name.trim()) throw new Error("Nama pelaksana wajib diisi.");
        const payload = {
          name: form.name.trim(),
          nip: form.nip.trim(),
          employment_status: form.employment_status.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        };
        if (editingItem?.id) {
          await updateEmployee(editingItem.id, payload);
          setMessage("Pelaksana berhasil diperbarui.");
        } else {
          await createEmployee(payload);
          setMessage("Pelaksana berhasil ditambahkan.");
        }
      }

      if (modalType === "status") {
        if (!form.code.trim() || !form.name.trim()) {
          throw new Error("Kode dan nama status wajib diisi.");
        }
        const payload = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim(),
        };
        if (editingItem?.id) {
          await updateStatus(editingItem.id, payload);
          setMessage("Status berhasil diperbarui.");
        } else {
          await createStatus(payload);
          setMessage("Status berhasil ditambahkan.");
        }
      }

      if (modalType === "prioritas") {
        if (!form.name.trim() || !String(form.level).trim()) {
          throw new Error("Nama dan level prioritas wajib diisi.");
        }
        const payload = {
          name: form.name.trim(),
          level: Number(form.level),
          is_active: Boolean(form.is_active),
        };
        if (editingItem?.id) {
          await updatePriority(editingItem.id, payload);
          setMessage("Prioritas berhasil diperbarui.");
        } else {
          await createPriority(payload);
          setMessage("Prioritas berhasil ditambahkan.");
        }
      }

      if (modalType === "program") {
        if (!form.code.trim() || !form.name.trim()) {
          throw new Error("Kode dan nama program wajib diisi.");
        }
        const payload = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim(),
          status_id: form.status_id || null,
          priority_id: form.priority_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        };
        if (editingItem?.id) {
          await updateProgram(editingItem.id, payload);
          setMessage("Program berhasil diperbarui.");
        } else {
          await createProgram(payload);
          setMessage("Program berhasil ditambahkan.");
        }
      }

      if (modalType === "kegiatan") {
        if (!form.program_id || !form.code.trim() || !form.name.trim()) {
          throw new Error("Program, kode, dan nama kegiatan wajib diisi.");
        }
        const payload = {
          program_id: form.program_id,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim(),
          status_id: form.status_id || null,
          priority_id: form.priority_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        };
        if (editingItem?.id) {
          await updateActivity(editingItem.id, payload);
          setMessage("Kegiatan berhasil diperbarui.");
        } else {
          await createActivity(payload);
          setMessage("Kegiatan berhasil ditambahkan.");
        }
      }

      if (modalType === "sub-kegiatan") {
        if (!form.activity_id || !form.code.trim() || !form.name.trim()) {
          throw new Error("Kegiatan, kode, dan nama sub kegiatan wajib diisi.");
        }
        const payload = {
          activity_id: form.activity_id,
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim(),
          status_id: form.status_id || null,
          priority_id: form.priority_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          output_target: form.output_target.trim(),
          output_unit: form.output_unit.trim(),
        };
        if (editingItem?.id) {
          await updateSubActivity(editingItem.id, payload);
          setMessage("Sub kegiatan berhasil diperbarui.");
        } else {
          await createSubActivity(payload);
          setMessage("Sub kegiatan berhasil ditambahkan.");
        }
      }

      if (modalType === "rhk") {
        if (!form.sub_activity_id || !form.employee_id || !form.title.trim()) {
          throw new Error("Sub kegiatan, pelaksana, dan title RHK wajib diisi.");
        }
        const payload = {
          sub_activity_id: form.sub_activity_id,
          employee_id: form.employee_id,
          supervisor_id: form.supervisor_id || null,
          title: form.title.trim(),
          description: form.description.trim(),
          status_id: form.status_id || null,
          priority_id: form.priority_id || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        };
        if (editingItem?.id) {
          await updateWorkPlan(editingItem.id, payload);
          setMessage("RHK berhasil diperbarui.");
        } else {
          await createWorkPlan(payload);
          setMessage("RHK berhasil ditambahkan.");
        }
      }

      if (modalType === "rencana-aksi") {
        if (!form.work_plan_id || !form.title.trim()) {
          throw new Error("RHK dan title rencana aksi wajib diisi.");
        }
        const payload = {
          work_plan_id: form.work_plan_id,
          title: form.title.trim(),
          description: form.description.trim(),
          employee_id: form.employee_id || null,
          status_id: form.status_id || null,
          priority_id: form.priority_id || null,
          planned_start_date: form.planned_start_date || null,
          planned_end_date: form.planned_end_date || null,
        };
        if (editingItem?.id) {
          await updateActionPlan(editingItem.id, payload);
          setMessage("Rencana aksi berhasil diperbarui.");
        } else {
          await createActionPlan(payload);
          setMessage("Rencana aksi berhasil ditambahkan.");
        }
      }

      if (modalType === "akun-belanja") {
        const normalizedName = form.name.trim();

        if (!normalizedName) {
          throw new Error("Nama akun wajib diisi.");
        }

        if (editingItem?.id) {
          await updateBudgetAccountMetadata(editingItem.id, {
            name: normalizedName,
            is_active: Boolean(form.is_active),
          });

          await loadBudgetAccounts();
          setMessage("Akun belanja berhasil diperbarui.");
          closeModal();
          return;
        }

        const normalizedCode = derivedBudgetAccountMeta.normalizedCode.toUpperCase();

        if (!normalizedCode) {
          throw new Error("Kode akun wajib diisi.");
        }

        if (derivedBudgetAccountMeta.errorMessage) {
          throw new Error(derivedBudgetAccountMeta.errorMessage);
        }

        const payload = {
          code: normalizedCode,
          name: normalizedName,
          parent_id: derivedBudgetAccountMeta.parentId,
          budget_level_id: derivedBudgetAccountMeta.budgetLevelId,
          is_leaf: derivedBudgetAccountMeta.isLeaf,
          is_active: Boolean(form.is_active),
        };

        try {
          await createBudgetAccount(payload);
        } catch (error) {
          if (isDuplicateBudgetAccountCodeError(error)) {
            throw new Error("Kode akun sudah digunakan");
          }
          throw error;
        }

        await loadBudgetAccounts();
        setMessage("Akun belanja berhasil ditambahkan.");
        closeModal();
        return;
      }

      if (modalType === "status-item") {
        const normalizedCode = form.code.trim().toUpperCase();
        const normalizedName = form.name.trim() || normalizedCode;
        const resolvedColor = resolveBudgetItemStatusColor(normalizedCode, form.color);

        if (!normalizedCode) {
          throw new Error("Code wajib diisi.");
        }

        const duplicateCode = budgetItemStatuses.some(
          (item) =>
            String(item.code || "").trim().toUpperCase() === normalizedCode &&
            String(item.id) !== String(editingItem?.id || "")
        );

        if (duplicateCode) {
          throw new Error("Code sudah digunakan.");
        }

        const payload = {
          code: normalizedCode,
          name: normalizedName,
          color: resolvedColor,
          is_active: Boolean(form.is_active),
        };

        try {
          if (editingItem?.id) {
            await updateBudgetItemStatus(editingItem.id, payload);
            setMessage("Status item berhasil diperbarui.");
          } else {
            await createBudgetItemStatus(payload);
            setMessage("Status item berhasil ditambahkan.");
          }
        } catch (error) {
          if (isDuplicateBudgetItemStatusCodeError(error)) {
            throw new Error("Code sudah digunakan.");
          }
          throw error;
        }

        await loadBudgetItemStatuses();
        closeModal();
        return;
      }

      if (modalType === "tahun-anggaran") {
        const normalizedYear = String(form.year || "").trim();
        const startDate = String(form.start_date || "").trim();
        const endDate = String(form.end_date || "").trim();
        const isActive = Boolean(form.is_active);
        const hasRelations = editingItem?.has_relations === true;

        if (!normalizedYear) {
          throw new Error("Tahun wajib diisi.");
        }

        if (!startDate || !endDate) {
          throw new Error("Start Date dan End Date wajib diisi.");
        }

        if (startDate >= endDate) {
          throw new Error("Start Date harus lebih kecil dari End Date.");
        }

        const duplicateYear = budgetYears.some(
          (item) =>
            String(item.year || "").trim() === normalizedYear &&
            String(item.id) !== String(editingItem?.id || "")
        );

        if (duplicateYear) {
          throw new Error("Tahun anggaran sudah digunakan.");
        }

        const payload = hasRelations
          ? {
              year: editingItem.year,
              start_date: editingItem.start_date,
              end_date: editingItem.end_date,
              is_active: isActive,
            }
          : {
              year: Number(normalizedYear),
              start_date: startDate,
              end_date: endDate,
              is_active: isActive,
            };

        try {
          if (editingItem?.id) {
            await updateBudgetYear(editingItem.id, payload);
            setMessage("Tahun anggaran berhasil diperbarui.");
          } else {
            await createBudgetYear(payload);
            setMessage("Tahun anggaran berhasil ditambahkan.");
          }
        } catch (error) {
          if (isDuplicateBudgetYearError(error)) {
            throw new Error("Tahun anggaran sudah digunakan.");
          }
          throw error;
        }

        await loadBudgetYears();
        closeModal();
        return;
      }

      await loadMasterData();
      closeModal();
    } catch (error) {
      setErrorMessage(error.message || "Gagal menyimpan master data.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDelete = useCallback(async (type, item) => {
    setMessage("");
    setErrorMessage("");

    try {
      if (type === "pelaksana") {
        await deleteEmployee(item.id);
        setMessage("Pelaksana berhasil dihapus.");
      }
      if (type === "status") {
        await deleteStatus(item.id);
        setMessage("Status berhasil dihapus.");
      }
      if (type === "prioritas") {
        await deletePriority(item.id);
        setMessage("Prioritas berhasil dihapus.");
      }
      if (type === "program") {
        await deleteProgram(item.id);
        setMessage("Program berhasil dihapus.");
      }
      if (type === "kegiatan") {
        await deleteActivity(item.id);
        setMessage("Kegiatan berhasil dihapus.");
      }
      if (type === "sub-kegiatan") {
        await deleteSubActivity(item.id);
        setMessage("Sub kegiatan berhasil dihapus.");
      }
      if (type === "rhk") {
        await deleteWorkPlan(item.id);
        setMessage("RHK berhasil dihapus.");
      }
      if (type === "rencana-aksi") {
        await deleteActionPlan(item.id);
        setMessage("Rencana aksi berhasil dihapus.");
      }
      if (type === "akun-belanja") {
        const deleteGuards = await getBudgetAccountDeleteGuards(item.id);

        if (deleteGuards.hasChildren) {
          throw new Error("Akun tidak bisa dihapus karena masih memiliki akun turunan");
        }

        if (deleteGuards.isUsedInRak) {
          throw new Error("Akun tidak bisa dihapus karena sudah digunakan di RAK");
        }

        if (deleteGuards.isUsedInRealization) {
          throw new Error("Akun tidak bisa dihapus karena sudah digunakan di Realisasi");
        }

        await deleteBudgetAccount(item.id);
        await loadBudgetAccounts();
        setMessage("Akun belanja berhasil dihapus.");
        return;
      }
      if (type === "status-item") {
        const deleteGuard = await getBudgetItemStatusDeleteGuard(item.id);

        if (deleteGuard.isUsed) {
          throw new Error("Status tidak bisa dihapus karena sudah digunakan");
        }

        await deleteBudgetItemStatus(item.id);
        await loadBudgetItemStatuses();
        setMessage("Status item berhasil dihapus.");
        return;
      }
      if (type === "tahun-anggaran") {
        const deleteGuard = await getBudgetYearUsageGuard(item);

        if (deleteGuard.isUsed) {
          throw new Error("Tahun anggaran tidak bisa dihapus karena sudah digunakan");
        }

        await deleteBudgetYear(item.id);
        await loadBudgetYears();
        setMessage("Tahun anggaran berhasil dihapus.");
        return;
      }
      await loadMasterData();
    } catch (error) {
      if (type === "akun-belanja") {
        const errorMessage = String(error?.message || "").toLowerCase();

        if (errorMessage.includes("constraint") || errorMessage.includes("foreign key")) {
          setErrorMessage("Akun tidak bisa dihapus karena masih terhubung dengan data lain.");
          return;
        }

        setErrorMessage(
          error?.message || "Gagal menghapus akun belanja."
        );
        return;
      }

      if (type === "status-item") {
        const errorMessage = String(error?.message || "").toLowerCase();

        if (errorMessage.includes("constraint") || errorMessage.includes("foreign key")) {
          setErrorMessage("Status tidak bisa dihapus karena sudah digunakan");
          return;
        }

        setErrorMessage(
          error?.message || "Gagal menghapus status item."
        );
        return;
      }

      if (type === "tahun-anggaran") {
        const errorMessage = String(error?.message || "").toLowerCase();

        if (errorMessage.includes("constraint") || errorMessage.includes("foreign key")) {
          setErrorMessage("Tahun anggaran tidak bisa dihapus karena sudah digunakan");
          return;
        }

        setErrorMessage(
          error?.message || "Gagal menghapus tahun anggaran."
        );
        return;
      }

      setErrorMessage(getDeleteErrorMessage(error));
    }
  }, [loadBudgetAccounts, loadBudgetItemStatuses, loadBudgetYears, loadMasterData]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.type || !deleteTarget?.item) {
      return;
    }

    setIsDeleteSubmitting(true);

    try {
      await handleDelete(deleteTarget.type, deleteTarget.item);
      setDeleteTarget(null);
    } finally {
      setIsDeleteSubmitting(false);
    }
  }, [deleteTarget, handleDelete]);

  const tableProps = useMemo(() => {
    if (activeMenu === "anggaran") {
      return null;
    }

    if (activeMenu === "pelaksana") {
      return {
        headers: ["Nama", "NIP", "Jabatan", "No. HP", "Email", "Status Aktif", "Aksi"],
        columnStyles: [primaryColMode3Style],
        emptyText: "Belum ada data pelaksana.",
        rows: employees.map((item) => (
          <tr key={item.id}>
            <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
              <div className={primaryTitleMode3ClampClassName || undefined} style={{ width: "100%" }}>
                {item.full_name || "-"}
              </div>
            </td>
            <td style={tableBodyCellStyle}>{item.nip || "-"}</td>
            <td style={tableBodyCellStyle}>{item.employment_status || "-"}</td>
            <td style={tableBodyCellStyle}>{item.phone || "-"}</td>
            <td style={tableBodyCellStyle}>{item.email || "-"}</td>
            <td style={tableBodyCellStyle}>
              <span
                style={getChipStyle(prefersDarkMode, {
                  size: "sm",
                  tone: item.is_active ? "success" : "neutral",
                })}
              >
                {item.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </td>
            <td style={tableBodyCellStyle}>
              <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("pelaksana", item)} onDelete={() => requestDelete("pelaksana", item)} />
            </td>
          </tr>
        )),
      };
    }

    if (activeMenu === "status") {
      return {
        headers: ["Code", "Name", "Deskripsi", "Aksi"],
        columnStyles: [{}, primaryColMode2Style],
        emptyText: "Belum ada data status.",
        rows: statuses.map((item) => (
          <tr key={item.id}>
            <td style={tableBodyCellStyle}>
              <span style={getTableCellCompactTypography({ fontWeight: 600 })}>
                {item.code || "-"}
              </span>
            </td>
            <td style={{ ...tableBodyCellStyle, ...primaryColMode2Style }}>
              <div className={primaryTitleMode2ClampClassName || undefined} style={{ width: "100%" }}>
                {item.name || "-"}
              </div>
            </td>
            <td style={tableBodyCellStyle}>{item.description || "-"}</td>
            <td style={tableBodyCellStyle}>
              <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("status", item)} onDelete={() => requestDelete("status", item)} />
            </td>
          </tr>
        )),
      };
    }

    if (activeMenu === "prioritas") {
      return {
        headers: ["Nama Prioritas", "Level", "Status", "Aksi"],
        columnStyles: [primaryColMode2Style],
        emptyText: "Belum ada data prioritas.",
        rows: [...priorities]
          .sort(
            (firstItem, secondItem) =>
              Number(firstItem.sort_order || 0) - Number(secondItem.sort_order || 0)
          )
          .map((item) => (
            <tr key={item.id}>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode2Style }}>
                <div
                  className={primaryTitleMode2ClampClassName || undefined}
                  style={getTableCellLabelTypography()}
                >
                  {item.name || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>{item.sort_order ?? "-"}</td>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
                <span
                  style={getChipStyle(prefersDarkMode, {
                    size: "xs",
                    tone: item.is_active ? "success" : "neutral",
                    padding: "5px 9px",
                    fontWeight: 600,
                  })}
                >
                  {item.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td style={tableBodyCellStyle}>
                <TableActionButtons
                  prefersDarkMode={prefersDarkMode}
                  onEdit={() => openEditModal("prioritas", item)}
                  onDelete={() => requestDelete("prioritas", item)}
                />
              </td>
            </tr>
          )),
      };
    }

    if (activeMenu === "program") {
      return {
        headers: ["Code", "Name", "Status", "Priority", "Start Date", "End Date", "Aksi"],
        columnStyles: [{}, primaryColMode3Style],
        emptyText: "Belum ada data program.",
        rows: programs.map((item) => (
          <tr key={item.id}>
            <td style={tableBodyCellStyle}>
              <span style={getTableCellCompactTypography({ fontWeight: 600 })}>
                {item.code || "-"}
              </span>
            </td>
            <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
              <div className={primaryTitleMode3ClampClassName || undefined} style={{ width: "100%" }}>
                {item.name || "-"}
              </div>
            </td>
            <td style={tableBodyCellStyle}>{statusMap[String(item.status_id)] || "-"}</td>
            <td style={tableBodyCellStyle}>{priorityMap[String(item.priority_id)] || "-"}</td>
            <td style={tableBodyCellStyle}>{formatDateLabel(item.start_date)}</td>
            <td style={tableBodyCellStyle}>{formatDateLabel(item.end_date)}</td>
            <td style={tableBodyCellStyle}>
              <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("program", item)} onDelete={() => requestDelete("program", item)} />
            </td>
          </tr>
        )),
      };
    }

    if (activeMenu === "kegiatan") {
      return {
        headers: ["Code", "Name", "Program", "Status", "Priority", "Aksi"],
        columnStyles: [{}, primaryColMode3Style],
        emptyText: "Belum ada data kegiatan.",
        rows: activities.map((item) => (
          <tr key={item.id}>
            <td style={tableBodyCellStyle}>
              <span style={getTableCellCompactTypography({ fontWeight: 600 })}>
                {item.code || "-"}
              </span>
            </td>
            <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
              <div className={primaryTitleMode3ClampClassName || undefined} style={{ width: "100%" }}>
                {item.name || "-"}
              </div>
            </td>
            <td style={tableBodyCellStyle}>{programMap[String(item.program_id)] || "-"}</td>
            <td style={tableBodyCellStyle}>{statusMap[String(item.status_id)] || "-"}</td>
            <td style={tableBodyCellStyle}>{priorityMap[String(item.priority_id)] || "-"}</td>
            <td style={tableBodyCellStyle}>
              <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("kegiatan", item)} onDelete={() => requestDelete("kegiatan", item)} />
            </td>
          </tr>
        )),
      };
    }

    if (activeMenu === "rhk") {
      return {
        headers: ["Nama RHK", "Sub Kegiatan", "Pelaksana", "Periode", "Status", "Rencana Aksi", "Aksi"],
        columnStyles: [
          primaryColMode3Style,
          { width: "18%" },
          {},
          { width: "17%" },
          {},
          {},
          {},
        ],
        emptyText: "Belum ada data RHK yang sesuai filter.",
        rows: filteredSortedWorkPlans.map((item) => {
          const subActivity = subActivityById[String(item.sub_activity_id || "")];
          const activity = activityById[String(subActivity?.activity_id || "")];
          const programName = programMap[String(activity?.program_id || "")] || "-";
          const activityName = activity?.name || "-";
          const actionPlanCount = actionPlanCountMap[String(item.id)] || 0;

          return (
            <tr key={item.id}>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
                <div
                  className={primaryTitleMode3ClampClassName || undefined}
                  style={getTableCellLabelTypography()}
                >
                  {item.title || "-"}
                </div>
                <div style={{ ...getTableCellSubtitleTypography({ fontSize: 12 }), marginTop: 4 }}>
                  {programName} • {activityName}
                </div>
              </td>
              <td style={tableBodyCellStyle}>
                <div>{subActivity?.name || "-"}</div>
                <div style={{ ...getTableCellSubtitleTypography({ fontSize: 12 }), marginTop: 4 }}>
                  {subActivity?.code || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>{employeeMap[String(item.employee_id)] || "-"}</td>
              <td style={tableBodyCellStyle}>
                <div style={{ display: "grid", gap: 2, justifyItems: "start" }}>
                  <div>{formatPeriodDateLabel(item.start_date)}</div>
                  <div style={getTableCellSubtitleTypography({ fontSize: 12 })}>s.d</div>
                  <div>{formatPeriodDateLabel(item.end_date)}</div>
                </div>
              </td>
              <td style={tableBodyCellStyle}>{statusMap[String(item.status_id)] || "-"}</td>
              <td style={tableBodyCellStyle}>
                {actionPlanCount > 0
                  ? `${actionPlanCount} Rencana Aksi`
                  : "Belum ada Rencana Aksi"}
              </td>
              <td style={tableBodyCellStyle}>
                <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("rhk", item)} onDelete={() => requestDelete("rhk", item)} />
              </td>
            </tr>
          );
        }),
      };
    }

    if (activeMenu === "rencana-aksi") {
      const periodColumnStyle = { width: 200, maxWidth: 220, whiteSpace: "nowrap" };
      const taskCountColumnStyle = { width: 170, maxWidth: 200, whiteSpace: "nowrap" };

      return {
        headers: ["Nama Rencana Aksi", "RHK", "Sub Kegiatan", "Pelaksana", "Periode", "Status", "Task", "Aksi"],
        minWidth: 1280,
        columnStyles: [
          primaryColMode3Style,
          { minWidth: 280 },
          { width: "18%" },
          { width: "14%" },
          periodColumnStyle,
          { width: "12%" },
          taskCountColumnStyle,
          { width: 120, maxWidth: 140, whiteSpace: "nowrap" },
        ],
        emptyText: "Belum ada data rencana aksi yang sesuai filter.",
        rows: filteredSortedActionPlans.map((item) => {
          const workPlan = workPlans.find(
            (workPlanItem) => String(workPlanItem.id) === String(item.work_plan_id || "")
          );
          const subActivity = subActivityById[String(workPlan?.sub_activity_id || "")];
          const activity = activityById[String(subActivity?.activity_id || "")];
          const programName = programMap[String(activity?.program_id || "")] || "-";
          const taskCount = taskCountByActionPlanMap[String(item.id)] || 0;

          return (
            <tr key={item.id}>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
                <div
                  className={primaryTitleMode3ClampClassName || undefined}
                  style={getTableCellLabelTypography()}
                >
                  {item.title || "-"}
                </div>
                <div style={{ ...getTableCellSubtitleTypography({ fontSize: 12 }), marginTop: 4 }}>
                  {programName} • {activity?.name || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>
                <div>{workPlan?.title || "-"}</div>
                <div style={{ ...getTableCellSubtitleTypography({ fontSize: 12 }), marginTop: 4 }}>
                  {employeeMap[String(workPlan?.employee_id || "")] || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>
                <div>{subActivity?.name || "-"}</div>
                <div style={{ ...getTableCellSubtitleTypography({ fontSize: 12 }), marginTop: 4 }}>
                  {subActivity?.code || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>{item.employee_name || "-"}</td>
              <td style={{ ...tableBodyCellStyle, ...periodColumnStyle }}>
                <div style={{ display: "grid", gap: 2, justifyItems: "start" }}>
                  <div>{formatPeriodDateLabel(item.planned_start_date)}</div>
                  <div style={getTableCellSubtitleTypography({ fontSize: 12 })}>s.d</div>
                  <div>{formatPeriodDateLabel(item.planned_end_date)}</div>
                </div>
              </td>
              <td style={tableBodyCellStyle}>{statusMap[String(item.status_id)] || "-"}</td>
              <td style={{ ...tableBodyCellStyle, ...taskCountColumnStyle }}>
                {taskCount > 0 ? `${taskCount} Task` : "Belum ada Task"}
              </td>
              <td style={tableBodyCellStyle}>
                <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("rencana-aksi", item)} onDelete={() => requestDelete("rencana-aksi", item)} />
              </td>
            </tr>
          );
        }),
      };
    }

    return {
      headers: ["Code", "Name", "Kegiatan", "Status", "Priority", "Output Target", "Aksi"],
      columnStyles: [codeColumnStyle, primaryColMode3Style],
      emptyText: "Belum ada data sub kegiatan.",
      rows: subActivities.map((item) => (
        <tr key={item.id}>
          <td style={{ ...tableBodyCellStyle, ...codeColumnStyle }}>
            <span
              style={{
                display: "inline-block",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                ...getTableCellCompactTypography({ fontWeight: 600 }),
              }}
              title={item.code || ""}
            >
              {item.code || "-"}
            </span>
          </td>
          <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
            <div className={primaryTitleMode3ClampClassName || undefined} style={{ width: "100%" }}>
              {item.name || "-"}
            </div>
          </td>
          <td style={tableBodyCellStyle}>{activityMap[String(item.activity_id)] || "-"}</td>
          <td style={tableBodyCellStyle}>{statusMap[String(item.status_id)] || "-"}</td>
          <td style={tableBodyCellStyle}>{priorityMap[String(item.priority_id)] || "-"}</td>
          <td style={tableBodyCellStyle}>
            {item.output_target
              ? item.output_unit
                ? `${item.output_target} ${item.output_unit}`
                : item.output_target
              : "-"}
          </td>
          <td style={tableBodyCellStyle}>
            <TableActionButtons prefersDarkMode={prefersDarkMode} onEdit={() => openEditModal("sub-kegiatan", item)} onDelete={() => requestDelete("sub-kegiatan", item)} />
          </td>
        </tr>
      )),
    };
  }, [
    actionPlanCountMap,
    activeMenu,
    activities,
    activityById,
    activityMap,
    employeeMap,
    employees,
    filteredSortedActionPlans,
    filteredSortedWorkPlans,
    prefersDarkMode,
    primaryColMode2Style,
    primaryColMode3Style,
    primaryTitleMode2ClampClassName,
    primaryTitleMode3ClampClassName,
    priorities,
    priorityMap,
    programMap,
    programs,
    statuses,
    statusMap,
    codeColumnStyle,
    subActivities,
    subActivityById,
    tableBodyCellStyle,
    taskCountByActionPlanMap,
    workPlans,
  ]);

  const derivedBudgetAccountMeta = (() => {
    const parsedCode = parseBudgetAccountCode(form.code);

    if (!parsedCode.normalizedCode) {
      return {
        normalizedCode: "",
        levelNumber: null,
        levelLabel: "-",
        parentCode: null,
        parentId: null,
        parentLabel: "-",
        budgetLevelId: null,
        isLeaf: false,
        leafLabel: "Non-Leaf",
        errorMessage: "",
      };
    }

    if (parsedCode.errorMessage) {
      return {
        normalizedCode: parsedCode.normalizedCode,
        levelNumber: parsedCode.levelNumber,
        levelLabel: parsedCode.levelNumber ? `Level ${parsedCode.levelNumber}` : "-",
        parentCode: parsedCode.parentCode,
        parentId: null,
        parentLabel: parsedCode.parentCode || "-",
        budgetLevelId: null,
        isLeaf: parsedCode.isLeaf,
        leafLabel: parsedCode.isLeaf ? "Leaf" : "Non-Leaf",
        errorMessage: parsedCode.errorMessage,
      };
    }

    const duplicateCode = budgetAccounts.some(
      (item) =>
        String(item.code || "").trim().toUpperCase() ===
        parsedCode.normalizedCode.toUpperCase()
    );

    if (duplicateCode) {
      return {
        normalizedCode: parsedCode.normalizedCode,
        levelNumber: parsedCode.levelNumber,
        levelLabel: parsedCode.levelNumber ? `Level ${parsedCode.levelNumber}` : "-",
        parentCode: parsedCode.parentCode,
        parentId: null,
        parentLabel: parsedCode.parentCode || "-",
        budgetLevelId: null,
        isLeaf: parsedCode.isLeaf,
        leafLabel: parsedCode.isLeaf ? "Leaf" : "Non-Leaf",
        errorMessage: "Kode akun sudah digunakan",
      };
    }

    const parentAccount = parsedCode.parentCode
      ? budgetAccounts.find(
          (item) =>
            String(item.code || "").trim().toUpperCase() ===
            parsedCode.parentCode.toUpperCase()
        )
      : null;

    if (parsedCode.levelNumber > 1 && !parentAccount) {
      return {
        normalizedCode: parsedCode.normalizedCode,
        levelNumber: parsedCode.levelNumber,
        levelLabel: `Level ${parsedCode.levelNumber}`,
        parentCode: parsedCode.parentCode,
        parentId: null,
        parentLabel: parsedCode.parentCode || "-",
        budgetLevelId: null,
        isLeaf: parsedCode.isLeaf,
        leafLabel: parsedCode.isLeaf ? "Leaf" : "Non-Leaf",
        errorMessage: "Akun belum memiliki parent",
      };
    }

    const matchedBudgetLevel = budgetLevelByNumber[parsedCode.levelNumber];

    if (!matchedBudgetLevel?.id) {
      return {
        normalizedCode: parsedCode.normalizedCode,
        levelNumber: parsedCode.levelNumber,
        levelLabel: `Level ${parsedCode.levelNumber}`,
        parentCode: parsedCode.parentCode,
        parentId: parentAccount?.id || null,
        parentLabel: parentAccount
          ? [parentAccount.code, parentAccount.name].filter(Boolean).join(" - ")
          : "-",
        budgetLevelId: null,
        isLeaf: parsedCode.isLeaf,
        leafLabel: parsedCode.isLeaf ? "Leaf" : "Non-Leaf",
        errorMessage: "Level akun tidak valid",
      };
    }

    return {
      normalizedCode: parsedCode.normalizedCode,
      levelNumber: parsedCode.levelNumber,
      levelLabel: `Level ${matchedBudgetLevel.level_number} - ${matchedBudgetLevel.name}`,
      parentCode: parsedCode.parentCode,
      parentId: parentAccount?.id || null,
      parentLabel: parentAccount
        ? [parentAccount.code, parentAccount.name].filter(Boolean).join(" - ")
        : "-",
      budgetLevelId: matchedBudgetLevel.id,
      isLeaf: parsedCode.isLeaf,
      leafLabel: parsedCode.isLeaf ? "Leaf" : "Non-Leaf",
      errorMessage: "",
    };
  })();

  const budgetAccountTableProps = useMemo(() => {
    if (activeBudgetTab !== "akun-belanja") {
      return null;
    }

    const budgetAccountCodeById = Object.fromEntries(
      budgetAccounts.map((item) => [String(item.id), item.code || "-"])
    );

    return {
      headers: ["Kode Akun", "Nama Akun", "Level", "Parent", "Tipe", "Status", "Aksi"],
      minWidth: 980,
      columnStyles: [
        { width: 160, maxWidth: 180, whiteSpace: "nowrap" },
        primaryColMode3Style,
        { width: 100, maxWidth: 120, whiteSpace: "nowrap" },
        { width: 280, maxWidth: 320 },
        { width: 130, maxWidth: 140, whiteSpace: "nowrap" },
        { width: 130, maxWidth: 140, whiteSpace: "nowrap" },
        { width: 190, maxWidth: 220, whiteSpace: "nowrap" },
      ],
      emptyText: isBudgetAccountsLoading
        ? "Memuat data akun belanja..."
        : budgetAccountsError
          ? budgetAccountsError
          : "Belum ada data akun belanja.",
      rows: isBudgetAccountsLoading || budgetAccountsError
        ? []
        : budgetAccounts.map((item) => (
            <tr key={item.id}>
              <td style={tableBodyCellStyle}>{item.code || "-"}</td>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
                <div style={getTableCellLabelTypography({ fontSize: 14 })}>
                  {item.name || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>{item.level_number ?? "-"}</td>
              <td style={tableBodyCellStyle}>
                {item.parent_id
                  ? budgetAccountCodeById[String(item.parent_id)] || "-"
                  : "-"}
              </td>
              <td style={tableBodyCellStyle}>
                <span
                  style={getChipStyle(prefersDarkMode, {
                    tone: item.is_leaf ? "success" : "muted",
                    size: "sm",
                    minWidth: 88,
                    fontWeight: 700,
                  })}
                >
                  {item.is_leaf ? "Leaf" : "Non-Leaf"}
                </span>
              </td>
              <td style={tableBodyCellStyle}>
                <span
                  style={getChipStyle(prefersDarkMode, {
                    tone: item.is_active ? "info" : "disabled",
                    size: "sm",
                    minWidth: 88,
                    fontWeight: 700,
                  })}
                >
                  {item.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td style={tableBodyCellStyle}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openEditModal("akun-belanja", item)}
                    style={getInlineActionButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      tone: "accent",
                      height: 34,
                    })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete("akun-belanja", item)}
                    style={getInlineActionButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      tone: "danger",
                      height: 34,
                    })}
                  >
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          )),
    };
  }, [
    activeBudgetTab,
    budgetAccounts,
    budgetAccountsError,
    isBudgetAccountsLoading,
    prefersDarkMode,
    primaryColMode3Style,
    tableBodyCellStyle,
  ]);

  const budgetItemStatusTableProps = useMemo(() => {
    if (activeBudgetTab !== "status-item") {
      return null;
    }

    return {
      headers: ["Code", "Name", "Status", "Status Aktif", "Aksi"],
      minWidth: 860,
      columnStyles: [
        { width: 140, maxWidth: 160, whiteSpace: "nowrap" },
        primaryColMode3Style,
        { width: 150, maxWidth: 180, whiteSpace: "nowrap" },
        { width: 130, maxWidth: 140, whiteSpace: "nowrap" },
        { width: 180, maxWidth: 220, whiteSpace: "nowrap" },
      ],
      emptyText: isBudgetItemStatusesLoading
        ? "Memuat data status item..."
        : budgetItemStatusesError
          ? budgetItemStatusesError
          : "Belum ada data status item.",
      rows: isBudgetItemStatusesLoading || budgetItemStatusesError
        ? []
        : budgetItemStatuses.map((item) => (
            <tr key={item.id}>
              <td style={tableBodyCellStyle}>{item.code || "-"}</td>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
                <div style={getTableCellLabelTypography({ fontSize: 14 })}>
                  {item.name || "-"}
                </div>
              </td>
              <td style={tableBodyCellStyle}>
                <span
                  style={{
                    ...getChipStyle(prefersDarkMode, {
                      size: "xs",
                      tone: getBudgetItemStatusChipTone(item.code),
                    }),
                    fontWeight: 500,
                  }}
                >
                  {item.code || "-"}
                </span>
              </td>
              <td style={tableBodyCellStyle}>
                <span
                  style={getChipStyle(prefersDarkMode, {
                    tone: item.is_active ? "info" : "disabled",
                    size: "sm",
                    minWidth: 88,
                    fontWeight: 700,
                  })}
                >
                  {item.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td style={tableBodyCellStyle}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openEditModal("status-item", item)}
                    style={getInlineActionButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      tone: "accent",
                      height: 34,
                    })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete("status-item", item)}
                    style={getInlineActionButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      tone: "danger",
                      height: 34,
                    })}
                  >
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          )),
    };
  }, [
    activeBudgetTab,
    budgetItemStatuses,
    budgetItemStatusesError,
    isBudgetItemStatusesLoading,
    prefersDarkMode,
    primaryColMode3Style,
    tableBodyCellStyle,
  ]);

  const budgetYearTableProps = useMemo(() => {
    if (activeBudgetTab !== "tahun-anggaran") {
      return null;
    }

    return {
      headers: ["Tahun", "Periode", "Status", "Aksi"],
      minWidth: 760,
      columnStyles: [
        { width: 120, maxWidth: 140, whiteSpace: "nowrap" },
        primaryColMode3Style,
        { width: 130, maxWidth: 150, whiteSpace: "nowrap" },
        { width: 180, maxWidth: 220, whiteSpace: "nowrap" },
      ],
      emptyText: isBudgetYearsLoading
        ? "Memuat data tahun anggaran..."
        : budgetYearsError
          ? budgetYearsError
          : "Belum ada data tahun anggaran.",
      rows: isBudgetYearsLoading || budgetYearsError
        ? []
        : budgetYears.map((item) => (
            <tr key={item.id}>
              <td style={tableBodyCellStyle}>{item.year || "-"}</td>
              <td style={{ ...tableBodyCellStyle, ...primaryColMode3Style }}>
                <div style={getTableCellLabelTypography({ fontSize: 14 })}>
                  {`${formatPeriodDateLabel(item.start_date)} - ${formatPeriodDateLabel(item.end_date)}`}
                </div>
              </td>
              <td style={tableBodyCellStyle}>
                <span
                  style={getChipStyle(prefersDarkMode, {
                    tone: item.is_active ? "success" : "neutral",
                    size: "sm",
                    minWidth: 96,
                    fontWeight: 700,
                  })}
                >
                  {item.is_active ? "Aktif" : "Tidak Aktif"}
                </span>
              </td>
              <td style={tableBodyCellStyle}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openEditModal("tahun-anggaran", item)}
                    style={getInlineActionButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      tone: "accent",
                      height: 34,
                    })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDelete("tahun-anggaran", item)}
                    style={getInlineActionButtonStyle(prefersDarkMode, {
                      isEnabled: true,
                      tone: "danger",
                      height: 34,
                    })}
                  >
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          )),
    };
  }, [
    activeBudgetTab,
    budgetYears,
    budgetYearsError,
    isBudgetYearsLoading,
    prefersDarkMode,
    primaryColMode3Style,
    tableBodyCellStyle,
  ]);

  return (
    <div style={{ paddingBottom: 60, width: "100%", boxSizing: "border-box" }}>
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 20, 
          marginBottom: 24,
          flexWrap: "wrap"
        }}
      >
        <h1 style={{ ...getPageTitleStyle(), margin: 0 }}>MASTER DATA</h1>
        
        {/* Garis Vertikal Pemisah */}
        <div 
          style={{ 
            width: "1.5px", 
            height: "28px", 
            backgroundColor: "var(--border-strong)",
            display: "block" 
          }} 
        />

        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center"
          }}
        >
          {menus.map((menu) => (
            <button
              key={menu.key}
              type="button"
              onClick={() => {
                setActiveMenu(menu.key);
                if (menu.key === "anggaran") {
                  setActiveBudgetTab("akun-belanja");
                }
              }}
              className={`sub-page-button ${activeMenu === menu.key ? "sub-page-button--active" : "sub-page-button--inactive"}`}
            >
              {menu.label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, {
              tone: "success",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
            }),
          }}
        >
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div
          style={{
            marginBottom: 12,
            ...getAlertStyle(prefersDarkMode, {
              tone: "error",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
            }),
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 16 }}>

        <section style={{ minWidth: 0, display: "grid", gap: 16 }}>
          <div style={{ padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={getPageSubtitleStyle()}>{moduleMeta.title}</h2>
              <div style={getFormLabelTypography()}>{moduleMeta.description}</div>
            </div>
            {moduleMeta.addLabel ? (
              <button
                type="button"
                onClick={() => openCreateModal(activeMenu)}
                style={{
                  ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: true, height: 40 }),
                  minWidth: 170,
                }}
              >
                {moduleMeta.addLabel}
              </button>
            ) : null}
          </div>

          {activeMenu === "anggaran" ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                  alignItems: "flex-end",
                  padding: "0 0 2px 0",
                }}
              >
                {budgetTabs.map((tab) => {
                  const isActive = activeBudgetTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveBudgetTab(tab.key)}
                      style={{
                        border: "none",
                        background: "transparent",
                        boxShadow: "none",
                        borderRadius: 0,
                        borderBottom: isActive
                          ? "2px solid var(--btn-primary-bg)"
                          : "2px solid transparent",
                        color: isActive ? "var(--text-h)" : "var(--text-muted)",
                        padding: "0 0 10px 0",
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        lineHeight: 1.2,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        fontFamily: '"Inter", sans-serif',
                        transition: "color 140ms ease, border-color 140ms ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

            </>
          ) : null}

          {activeMenu === "anggaran" && activeBudgetTab === "status-item" && budgetItemStatusTableProps ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => openCreateModal("status-item")}
                  style={{
                    ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: true, height: 40 }),
                    minWidth: 170,
                  }}
                >
                  + Tambah Status
                </button>
              </div>
              <div style={tableFrameStyle}>
                <div style={{ overflowX: "auto" }}>
                  <DataTable
                    headers={budgetItemStatusTableProps.headers}
                    rows={budgetItemStatusTableProps.rows}
                    emptyText={budgetItemStatusTableProps.emptyText}
                    columnStyles={budgetItemStatusTableProps.columnStyles}
                    minWidth={budgetItemStatusTableProps.minWidth}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeMenu === "anggaran" && activeBudgetTab === "tahun-anggaran" && budgetYearTableProps ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => openCreateModal("tahun-anggaran")}
                  style={{
                    ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: true, height: 40 }),
                    minWidth: 180,
                  }}
                >
                  + Tambah Tahun
                </button>
              </div>
              <div style={tableFrameStyle}>
                <div style={{ overflowX: "auto" }}>
                  <DataTable
                    headers={budgetYearTableProps.headers}
                    rows={budgetYearTableProps.rows}
                    emptyText={budgetYearTableProps.emptyText}
                    columnStyles={budgetYearTableProps.columnStyles}
                    minWidth={budgetYearTableProps.minWidth}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeMenu === "rhk" ? (
            <div
              style={{
                padding: "4px 0 12px 0",
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={labelStyle}>
                  <select
                    value={rhkProgramFilter}
                    onChange={(event) => setRhkProgramFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Program</option>
                    {rhkProgramOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={rhkActivityFilter}
                    onChange={(event) => setRhkActivityFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Kegiatan</option>
                    {rhkActivityOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={rhkSubActivityFilter}
                    onChange={(event) => setRhkSubActivityFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Sub Kegiatan</option>
                    {rhkSubActivityOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={rhkEmployeeFilter}
                    onChange={(event) => setRhkEmployeeFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Pelaksana</option>
                    {employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={rhkSort}
                    onChange={(event) => setRhkSort(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="NEWEST">Terbaru</option>
                    <option value="OLDEST">Terlama</option>
                    <option value="NAME_ASC">Nama A-Z</option>
                    <option value="NAME_DESC">Nama Z-A</option>
                    <option value="CODE_ASC">Kode Sub Kegiatan</option>
                  </select>
                </label>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Menampilkan <span style={{ fontWeight: 700, color: "var(--text-h)" }}>{filteredSortedWorkPlans.length}</span> RHK dengan konteks sub kegiatan, pelaksana, dan status turunan.
              </div>
            </div>
          ) : null}

          {activeMenu === "rencana-aksi" ? (
            <div
              style={{
                padding: "4px 0 12px 0",
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={labelStyle}>
                  <select
                    value={actionPlanProgramFilter}
                    onChange={(event) => setActionPlanProgramFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Program</option>
                    {actionPlanProgramOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={actionPlanActivityFilter}
                    onChange={(event) => setActionPlanActivityFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Kegiatan</option>
                    {actionPlanActivityOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={actionPlanSubActivityFilter}
                    onChange={(event) => setActionPlanSubActivityFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Sub Kegiatan</option>
                    {actionPlanSubActivityOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={actionPlanWorkPlanFilter}
                    onChange={(event) => setActionPlanWorkPlanFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua RHK</option>
                    {actionPlanWorkPlanOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title || "-"}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={actionPlanEmployeeFilter}
                    onChange={(event) => setActionPlanEmployeeFilter(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Semua Pelaksana</option>
                    {employees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <select
                    value={actionPlanSort}
                    onChange={(event) => setActionPlanSort(event.target.value)}
                    className="filter-select"
                    style={{ width: "100%" }}
                  >
                    <option value="NEWEST">Terbaru</option>
                    <option value="OLDEST">Terlama</option>
                    <option value="NAME_ASC">Nama A-Z</option>
                    <option value="NAME_DESC">Nama Z-A</option>
                  </select>
                </label>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Menampilkan <span style={{ fontWeight: 700, color: "var(--text-h)" }}>{filteredSortedActionPlans.length}</span> Rencana Aksi dengan konteks induk dan status turunan task.
              </div>
            </div>
          ) : null}

          {activeMenu === "anggaran" && activeBudgetTab === "akun-belanja" && budgetAccountTableProps ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => openCreateModal("akun-belanja")}
                  style={{
                    ...getPrimaryButtonStyle(prefersDarkMode, { isEnabled: true, height: 40 }),
                    minWidth: 170,
                  }}
                >
                  + Tambah Akun
                </button>
              </div>
              <div style={tableFrameStyle}>
              <div style={{ overflowX: "auto" }}>
                <DataTable
                  headers={budgetAccountTableProps.headers}
                  rows={budgetAccountTableProps.rows}
                  emptyText={budgetAccountTableProps.emptyText}
                  columnStyles={budgetAccountTableProps.columnStyles}
                  minWidth={budgetAccountTableProps.minWidth}
                />
              </div>
              </div>
            </div>
          ) : null}

          {tableProps ? (
            <div style={tableFrameStyle}>
              <div style={{ overflowX: "auto" }}>
                <DataTable
                  headers={tableProps.headers}
                  rows={tableProps.rows}
                  emptyText={tableProps.emptyText}
                  columnStyles={tableProps.columnStyles}
                  minWidth={tableProps.minWidth}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {modalType === "akun-belanja" ? (
        <BudgetAccountFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          prefersDarkMode={prefersDarkMode}
          form={form}
          onChange={handleChange}
          derivedBudgetAccountMeta={derivedBudgetAccountMeta}
          isEditMode={Boolean(editingItem?.id)}
        />
      ) : modalType === "tahun-anggaran" ? (
        <BudgetYearFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          prefersDarkMode={prefersDarkMode}
          form={form}
          onChange={handleChange}
          isEditMode={Boolean(editingItem?.id)}
          isLocked={editingItem?.has_relations === true}
        />
      ) : modalType === "status-item" ? (
        <BudgetItemStatusFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          prefersDarkMode={prefersDarkMode}
          form={form}
          onChange={handleChange}
          isEditMode={Boolean(editingItem?.id)}
        />
      ) : (
        <MasterFormModal
          isOpen={isModalOpen}
          title={`${editingItem ? "Edit" : "Tambah"} ${menus.find((item) => item.key === modalType)?.label || ""}`}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          prefersDarkMode={prefersDarkMode}
          form={form}
          onChange={handleChange}
          type={modalType}
          statuses={statuses}
          priorities={priorities}
          programs={programs}
          activities={activities}
          subActivities={subActivities}
          employees={employees}
          workPlans={workPlans}
        />
      )}

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        isSubmitting={isDeleteSubmitting}
        prefersDarkMode={prefersDarkMode}
        title={
          deleteTarget?.type === "akun-belanja"
            ? "Hapus Akun Belanja"
            : deleteTarget?.type === "status-item"
              ? "Hapus Status Item"
              : deleteTarget?.type === "tahun-anggaran"
                ? "Hapus Tahun Anggaran"
              : "Hapus Data"
        }
        message={
          deleteTarget?.type === "akun-belanja"
            ? `Yakin ingin menghapus akun ${[
                deleteTarget?.item?.code,
                deleteTarget?.item?.name,
              ]
                .filter(Boolean)
                .join(" - ")}?`
            : deleteTarget?.type === "status-item"
              ? `Yakin ingin menghapus status ${[
                  deleteTarget?.item?.code,
                  deleteTarget?.item?.name,
                ]
                  .filter(Boolean)
                  .join(" - ")}?`
              : deleteTarget?.type === "tahun-anggaran"
                ? `Yakin ingin menghapus tahun anggaran ${deleteTarget?.item?.year || "-"}?`
            : `Yakin ingin menghapus ${deleteTarget?.item?.full_name || deleteTarget?.item?.name || deleteTarget?.item?.code || "data ini"}?`
        }
      />
    </div>
  );
}
