const ROLE_CODES = {
  ADMIN: "ADMIN",
  KASI: "KASI",
  KASUBAG: "KASUBAG",
  PIMPINAN: "PIMPINAN",
  STAF: "STAF",
  VIEWER: "VIEWER",
};

function normalizeRoleCode(roleCode) {
  return String(roleCode || "").trim().toUpperCase();
}

function normalizeWorkflowCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_");
}

export function hasAuthorizedRole(roleCode) {
  return Object.values(ROLE_CODES).includes(normalizeRoleCode(roleCode));
}

export function isAdminRole(roleCode) {
  return normalizeRoleCode(roleCode) === ROLE_CODES.ADMIN;
}

export function canAccessMasterData(roleCode) {
  return isAdminRole(roleCode);
}

export function canCreateTask(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return (
    hasAuthorizedRole(normalizedRoleCode) &&
    ![ROLE_CODES.VIEWER, ROLE_CODES.PIMPINAN].includes(normalizedRoleCode)
  );
}

export function canEditTask(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
  ].includes(normalizedRoleCode);
}

export function canManageTaskApproval(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
  ].includes(normalizedRoleCode);
}

export function canCreateProgressReport(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
    ROLE_CODES.STAF,
  ].includes(normalizedRoleCode);
}

export function canDeleteProgressReport(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
  ].includes(normalizedRoleCode);
}

export function canUploadTaskEvidence(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
    ROLE_CODES.STAF,
  ].includes(normalizedRoleCode);
}

export function canDeleteTaskEvidence(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
  ].includes(normalizedRoleCode);
}

export function canOpenTaskEvidence(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return (
    hasAuthorizedRole(normalizedRoleCode) &&
    ![ROLE_CODES.VIEWER, ROLE_CODES.PIMPINAN].includes(normalizedRoleCode)
  );
}

export function canCreateTaskFollowUp(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
  ].includes(normalizedRoleCode);
}

export function canCompleteTaskFollowUp(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
    ROLE_CODES.STAF,
  ].includes(normalizedRoleCode);
}

export function canMoveTaskKanban(roleCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  return [
    ROLE_CODES.ADMIN,
    ROLE_CODES.KASI,
    ROLE_CODES.KASUBAG,
    ROLE_CODES.STAF,
  ].includes(normalizedRoleCode);
}

export function canMoveTaskKanbanTransition(roleCode, currentStatusCode, targetStatusCode) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if ([ROLE_CODES.ADMIN, ROLE_CODES.KASI, ROLE_CODES.KASUBAG].includes(normalizedRoleCode)) {
    return true;
  }

  if (normalizedRoleCode !== ROLE_CODES.STAF) {
    return false;
  }

  const allowedCodes = new Set(["BELUM_MULAI", "PROSES"]);
  return (
    allowedCodes.has(normalizeWorkflowCode(currentStatusCode)) &&
    allowedCodes.has(normalizeWorkflowCode(targetStatusCode))
  );
}

export function getRoleCodeLabel(roleCode) {
  return normalizeRoleCode(roleCode) || "-";
}
