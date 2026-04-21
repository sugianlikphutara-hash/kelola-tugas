export const LEGACY_EMPLOYEE_STORAGE_KEYS = [
  "kelola_tugas_current_employee_id",
  "current_employee_id",
];

export const AUTH_STORAGE_KEYS = {
  userId: "kelola_tugas_current_user_id",
  authUserId: "kelola_tugas_current_auth_user_id",
  employeeId: "kelola_tugas_current_auth_employee_id",
  roleCode: "kelola_tugas_current_role_code",
  authStatus: "kelola_tugas_auth_status",
};

export function normalizeStoredValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function readStoredValue(key) {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return normalizeStoredValue(window.localStorage.getItem(key));
}

export function writeStoredValue(key, value) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const normalized = normalizeStoredValue(value);
  if (normalized) {
    window.localStorage.setItem(key, normalized);
    return;
  }

  window.localStorage.removeItem(key);
}
