export function getControlBorderColor(prefersDarkMode) {
  void prefersDarkMode;
  return "var(--control-border)";
}

export function getPageTitleStyle() {
  return {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    fontFamily: '"Inter", sans-serif',
    color: "var(--text-h)",
    letterSpacing: "2px",
  };
}

export function getPageSubtitleStyle() {
  return {
    marginTop: 6,
    color: "var(--text-muted)",
    fontSize: 14,
    lineHeight: 1.5,
  };
}

const CONTROL_RADIUS = 6;
const CONTROL_PADDING = "10px 12px";
const CONTROL_MIN_HEIGHT = 40;
const CONTROL_FONT_SIZE = 13;
const CONTROL_LABEL_GAP = 6;
const CONTROL_SM_RADIUS = 8;
const CONTROL_SM_PADDING = "8px 12px";
const CONTROL_XS_RADIUS = 6;
const CONTROL_XS_PADDING = "5px 8px";

function getButtonSizeMeta(size) {
  if (size === "xs") {
    return {
      padding: CONTROL_XS_PADDING,
      radius: CONTROL_XS_RADIUS,
      minHeight: 28,
      fontSize: 11,
    };
  }

  if (size === "sm") {
    return {
      padding: CONTROL_SM_PADDING,
      radius: CONTROL_SM_RADIUS,
      minHeight: 40,
      minWidth: 140,
      fontSize: CONTROL_FONT_SIZE,
    };
  }

  return {
    padding: CONTROL_PADDING,
    radius: CONTROL_RADIUS,
    minHeight: CONTROL_MIN_HEIGHT,
    minWidth: 140,
    fontSize: CONTROL_FONT_SIZE,
  };
}

export function getSelectStyle(
  prefersDarkMode,
  { tone = "filter", height = undefined } = {}
) {
  let background = "var(--surface-1)";
  let color = "var(--text-h)";
  let border = `1px solid ${getControlBorderColor(prefersDarkMode)}`;

  if (tone === "panel") {
    background = "var(--panel-bg)";
    color = "var(--text-h)";
  } else if (tone === "filter") {
    background = "transparent";
    color = "#1A1A1B";
    border = "none";
  } else if (tone === "muted") {
    background = prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)";
    color = prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)";
  } else if (tone === "inverse") {
    background = "var(--control-inverse-bg)";
    color = "var(--control-inverse-color)";
    border = "1px solid var(--control-inverse-border)";
  }

  return {
    ...(height ? { height } : null),
    padding: CONTROL_PADDING,
    borderRadius: CONTROL_RADIUS,
    border,
    background,
    color,
    fontSize: CONTROL_FONT_SIZE,
    fontWeight: 600,
    minHeight: height ?? CONTROL_MIN_HEIGHT,
    lineHeight: 1.2,
    boxSizing: "border-box",
  };
}

export function getTextInputStyle(
  prefersDarkMode,
  { tone = "panel", height = undefined, isDisabled = false } = {}
) {
  let background = "var(--panel-bg)";
  let color = "var(--text-h)";

  if (tone === "filter") {
    background = "var(--surface-1)";
    color = "var(--text-h)";
  } else if (tone === "inverse") {
    background = "var(--control-inverse-bg)";
    color = "var(--control-inverse-color)";
  } else if (tone === "muted") {
    background = prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)";
    color = prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)";
  }

  if (isDisabled) {
    background = prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)";
    color = prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)";
  }

  return {
    ...(height ? { height } : null),
    padding: CONTROL_PADDING,
    borderRadius: CONTROL_RADIUS,
    border:
      tone === "inverse"
        ? "1px solid var(--control-inverse-border)"
        : `1px solid ${getControlBorderColor(prefersDarkMode)}`,
    background,
    color,
    fontSize: CONTROL_FONT_SIZE,
    fontWeight: 600,
    minHeight: height ?? CONTROL_MIN_HEIGHT,
    lineHeight: 1.2,
    boxSizing: "border-box",
    outline: "none",
  };
}

export function getDateInputStyle(
  prefersDarkMode,
  { tone = "panel", height = undefined, isDisabled = false } = {}
) {
  let background = "var(--panel-bg)";
  let color = "var(--text-h)";

  if (tone === "filter") {
    background = "var(--surface-1)";
    color = "var(--text-h)";
  } else if (tone === "inverse") {
    background = "var(--control-inverse-bg)";
    color = "var(--control-inverse-color)";
  } else if (tone === "muted") {
    background = prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)";
    color = prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)";
  }

  if (isDisabled) {
    background = prefersDarkMode ? "var(--surface-1)" : "var(--surface-2)";
    color = prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)";
  }

  return {
    ...(height ? { height } : null),
    padding: CONTROL_PADDING,
    borderRadius: CONTROL_RADIUS,
    border:
      tone === "inverse"
        ? "1px solid var(--control-inverse-border)"
        : `1px solid ${getControlBorderColor(prefersDarkMode)}`,
    background,
    color,
    colorScheme: prefersDarkMode ? "dark" : "light",
    fontSize: CONTROL_FONT_SIZE,
    fontWeight: 600,
    minHeight: height ?? CONTROL_MIN_HEIGHT,
    lineHeight: 1.2,
    boxSizing: "border-box",
    outline: "none",
  };
}

export function getSearchInputStyle(prefersDarkMode, { hasValue = false, isFocused = false } = {}) {
  const baseStyle = getTextInputStyle(prefersDarkMode, { tone: "panel", height: 40 });
  
  return {
    ...baseStyle,
    width: "100%",
    minWidth: 0,
    paddingLeft: 32,
    paddingRight: hasValue ? 32 : 12,
    border: isFocused
      ? "1px solid var(--btn-primary-bg)"
      : baseStyle.border,
    transition: "all 0.15s ease",
  };
}

export function getFieldLabelStyle(prefersDarkMode) {
  return {
    display: "grid",
    gap: CONTROL_LABEL_GAP,
    fontSize: CONTROL_FONT_SIZE,
    color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)",
  };
}

export function getMetaLabelStyle(prefersDarkMode) {
  return {
    fontSize: 12,
    fontWeight: 800,
    color: prefersDarkMode ? "var(--text-subtle)" : "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  };
}

export function getPrimaryButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "md" } = {}
) {
  const enabled = Boolean(isEnabled);
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: "none",
    background: "var(--btn-primary-bg)",
    color: "var(--btn-primary-text)",
    borderRadius: sizeMeta.radius,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    ...(!fullWidth && sizeMeta.minWidth ? { minWidth: sizeMeta.minWidth } : null),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.9,
  };
}

export function getDarkButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "md" } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: "none",
    background: enabled ? "var(--btn-dark-enabled-bg)" : "var(--btn-dark-disabled-bg)",
    color: enabled ? "var(--btn-dark-enabled-color)" : "var(--btn-dark-disabled-color)",
    borderRadius: sizeMeta.radius,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    ...(!fullWidth && sizeMeta.minWidth ? { minWidth: sizeMeta.minWidth } : null),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.92,
  };
}

export function getSuccessButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "xs" } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: "none",
    background: enabled ? "var(--btn-success-enabled-bg)" : "var(--btn-success-disabled-bg)",
    color: "var(--btn-primary-text)",
    borderRadius: sizeMeta.radius,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    ...(!fullWidth && sizeMeta.minWidth ? { minWidth: sizeMeta.minWidth } : null),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.92,
  };
}

export function getDangerButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "md" } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: "none",
    background: enabled ? "var(--btn-danger-enabled-bg)" : "var(--btn-danger-disabled-bg)",
    color: "var(--btn-primary-text)",
    borderRadius: sizeMeta.radius,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    ...(!fullWidth && sizeMeta.minWidth ? { minWidth: sizeMeta.minWidth } : null),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.92,
  };
}

export function getNeutralButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "sm" } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: "1px solid var(--control-border)",
    background: "var(--surface-1)",
    color: "var(--text-muted)",
    borderRadius: sizeMeta.radius,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    ...(!fullWidth && sizeMeta.minWidth ? { minWidth: sizeMeta.minWidth } : null),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.7,
  };
}

export function getMenuTriggerButtonStyle(prefersDarkMode, { isEnabled } = {}) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
    minHeight: 28,
    padding: "4px 8px",
    borderRadius: 8,
    border: `1px solid var(--menu-trigger-border)`,
    background: "var(--surface-1)",
    color: "var(--text-h)",
    fontSize: 14,
    lineHeight: 1,
    cursor: enabled ? "pointer" : "not-allowed",
    boxSizing: "border-box",
    opacity: enabled ? 1 : 0.6,
  };
}

export function getMenuItemButtonStyle(
  prefersDarkMode,
  { isEnabled, tone = "accent" } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);

  const colorByTone = {
    accent: "var(--menu-accent-color)",
    danger: "var(--menu-danger-color)",
    neutral: "var(--menu-neutral-color)",
  };

  const borderByTone = {
    accent: "var(--menu-accent-border)",
    danger: "var(--menu-danger-border)",
    neutral: "var(--menu-neutral-border)",
  };

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    borderRadius: 8,
    border: `1px solid ${borderByTone[tone] || borderByTone.neutral}`,
    background: "var(--panel-bg)",
    color: colorByTone[tone] || colorByTone.neutral,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.6,
    boxSizing: "border-box",
  };
}

export function getInlineActionButtonStyle(
  prefersDarkMode,
  { isEnabled, tone = "accent", height = 36 } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);

  const colorByTone = {
    accent: "var(--menu-accent-color)",
    danger: "var(--menu-danger-color)",
    neutral: "var(--menu-neutral-color)",
  };

  const borderByTone = {
    accent: "var(--menu-accent-border)",
    danger: "var(--menu-danger-border)",
    neutral: "var(--menu-neutral-border)",
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: `1px solid ${borderByTone[tone] || borderByTone.neutral}`,
    background: "var(--panel-bg)",
    color: colorByTone[tone] || colorByTone.neutral,
    padding: "8px 12px",
    minHeight: height,
    fontSize: 13,
    fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.6,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };
}

export function getWarningButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "sm", isActive = false } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  const active = Boolean(isActive);
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: `1px solid var(--btn-warning-border)`,
    background: active ? "var(--btn-warning-active-bg)" : "var(--btn-warning-bg)",
    color: "var(--btn-warning-color)",
    borderRadius: CONTROL_RADIUS,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.75,
  };
}

export function getGhostIconButtonStyle(
  prefersDarkMode,
  { isEnabled, height = 32, size = 16, radius = 10 } = {}
) {
  const enabled = Boolean(isEnabled);
  void prefersDarkMode;
  return {
    border: "none",
    background: "transparent",
    color: "var(--icon-muted)",
    fontSize: size,
    lineHeight: 1,
    padding: "6px 8px",
    borderRadius: radius,
    cursor: enabled ? "pointer" : "not-allowed",
    height,
    opacity: enabled ? 1 : 0.6,
  };
}

export function getCircleIconButtonBaseStyle(
  { isEnabled, size = 38, radius = 999 } = {}
) {
  const enabled = Boolean(isEnabled);
  return {
    width: size,
    height: size,
    borderRadius: radius,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: enabled ? "pointer" : "not-allowed",
    boxSizing: "border-box",
  };
}

const ALERT_TONE_PALETTE = {
  neutral: {
    background: "var(--surface-3)",
    border: "var(--panel-border)",
    color: "var(--text-muted)",
    isDynamic: false,
  },
  info: {
    background: "var(--alert-info-bg)",
    border: "var(--alert-info-border)",
    color: "var(--alert-info-color)",
  },
  warning: {
    background: "var(--alert-warning-bg)",
    border: "var(--alert-warning-border)",
    color: "var(--alert-warning-color)",
  },
  danger: {
    background: "var(--alert-error-bg)",
    border: "var(--alert-error-border)",
    color: "var(--alert-error-color)",
  },
  error: {
    background: "var(--alert-error-bg)",
    border: "var(--alert-error-border)",
    color: "var(--alert-error-color)",
  },
  success: {
    background: "var(--alert-success-bg)",
    border: "var(--alert-success-border)",
    color: "var(--alert-success-color)",
  },
  inverse: {
    background: "var(--control-inverse-bg)",
    border: "var(--control-inverse-border)",
    color: "var(--control-inverse-color)",
  },
};

function getAlertToneConfig(normalizedTone, prefersDarkMode) {
  if (ALERT_TONE_PALETTE[normalizedTone]) {
    return ALERT_TONE_PALETTE[normalizedTone];
  }
  const defaultNeutral = ALERT_TONE_PALETTE.neutral;
  return {
    ...defaultNeutral,
    background: prefersDarkMode ? "var(--surface-2)" : defaultNeutral.background,
  };
}

export function getCircleIconButtonStyle(
  prefersDarkMode,
  { isEnabled, size = 38, radius = 999, tone = "neutral", variant = "soft" } = {}
) {
  const enabled = Boolean(isEnabled);
  const normalizedTone = String(tone || "neutral").trim().toLowerCase();
  const normalizedVariant = String(variant || "soft").trim().toLowerCase();

  const toneMeta = getAlertToneConfig(normalizedTone, prefersDarkMode);
  const isGhostVariant = normalizedVariant === "ghost";

  return {
    ...getCircleIconButtonBaseStyle({ isEnabled: enabled, size, radius }),
    border: isGhostVariant ? "1px solid transparent" : `1px solid ${toneMeta.border}`,
    background: isGhostVariant ? "transparent" : toneMeta.background,
    color: toneMeta.color,
    boxShadow: prefersDarkMode
      ? "inset 0 1px 0 rgba(255,255,255,0.03)"
      : "inset 0 1px 0 rgba(255,255,255,0.65)",
    opacity: enabled ? 1 : 0.6,
  };
}

export function getPanelStyle(
  {
    padding = undefined,
    borderRadius = "var(--panel-radius, 12px)",
    background = "var(--panel-bg)",
    borderColor = "var(--panel-border)",
    boxShadow = "var(--panel-shadow)",
  } = {}
) {
  return {
    ...(padding ? { padding } : null),
    background,
    border: `1px solid ${borderColor}`,
    borderRadius,
    boxShadow,
    boxSizing: "border-box",
  };
}

export function getAlertStyle(
  prefersDarkMode,
  {
    tone = "info",
    padding = "10px 12px",
    borderRadius = 10,
    fontSize = 13,
    fontWeight = 600,
  } = {}
) {
  void prefersDarkMode;
  const normalizedTone = String(tone || "info").trim().toLowerCase();

  if (normalizedTone === "success") {
    return {
      padding,
      borderRadius,
      background: "var(--alert-success-bg)",
      border: "1px solid var(--alert-success-border)",
      color: "var(--alert-success-color)",
      fontSize,
      fontWeight,
      boxSizing: "border-box",
    };
  }

  if (normalizedTone === "error" || normalizedTone === "danger") {
    return {
      padding,
      borderRadius,
      background: "var(--alert-error-bg)",
      border: "1px solid var(--alert-error-border)",
      color: "var(--alert-error-color)",
      fontSize,
      fontWeight,
      boxSizing: "border-box",
    };
  }

  if (normalizedTone === "warning") {
    return {
      padding,
      borderRadius,
      background: "var(--alert-warning-bg)",
      border: "1px solid var(--alert-warning-border)",
      color: "var(--alert-warning-color)",
      fontSize,
      fontWeight,
      boxSizing: "border-box",
    };
  }

  return {
    padding,
    borderRadius,
    background: "var(--alert-info-bg)",
    border: "1px solid var(--alert-info-border)",
    color: "var(--alert-info-color)",
    fontSize,
    fontWeight,
    boxSizing: "border-box",
  };
}

export function getOverlayStyle(
  { background = "var(--overlay-backdrop)", padding = 20, zIndex = 1000 } = {}
) {
  return {
    position: "fixed",
    inset: 0,
    background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding,
    zIndex,
    boxSizing: "border-box",
  };
}

export function getEmptyStateStyle(
  prefersDarkMode,
  {
    minHeight = 120,
    padding = 16,
    borderRadius = 12,
    background = "var(--surface-2)",
    borderColor = "var(--border-strong)",
    dashed = true,
    color = "var(--text-muted)",
    fontSize = 13,
    lineHeight = 1.5,
  } = {}
) {
  void prefersDarkMode;
  const borderStyle = dashed ? "dashed" : "solid";

  return {
    minHeight,
    padding,
    borderRadius,
    border: `1px ${borderStyle} ${borderColor}`,
    background,
    color,
    fontSize,
    lineHeight,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    boxSizing: "border-box",
  };
}

export function getLoadingStateStyle(
  prefersDarkMode,
  {
    padding = "14px 18px",
    borderRadius = 8,
    background = "var(--panel-bg)",
    borderColor = "var(--panel-border)",
    color = "var(--text-muted)",
    fontSize = 14,
  } = {}
) {
  void prefersDarkMode;

  return {
    ...getPanelStyle({
      padding,
      borderRadius,
      background,
      borderColor,
      boxShadow: "none",
    }),
    color,
    fontSize,
  };
}

export function getPopoverStyle(
  {
    top = "50%",
    right = "calc(100% + 8px)",
    transform = "translateY(-50%)",
    minWidth = 140,
    padding = 8,
    borderRadius = 12,
    zIndex = 20,
    gap = 6,
  } = {}
) {
  return {
    position: "absolute",
    top,
    right,
    transform,
    minWidth,
    background: "var(--panel-bg)",
    border: "1px solid var(--border-strong)",
    borderRadius,
    boxShadow: "var(--popover-shadow)",
    padding,
    zIndex,
    display: "grid",
    gap,
    boxSizing: "border-box",
  };
}

export function getLinkStyle(
  prefersDarkMode,
  { tone = "info", fontWeight = 600 } = {}
) {
  void prefersDarkMode;
  const normalizedTone = String(tone || "info").trim().toLowerCase();
  const colorByTone = {
    info: "var(--alert-info-color)",
    success: "var(--alert-success-color)",
    warning: "var(--alert-warning-color)",
    danger: "var(--alert-error-color)",
    error: "var(--alert-error-color)",
    muted: "var(--text-muted)",
  };

  return {
    color: colorByTone[normalizedTone] || colorByTone.info,
    fontWeight,
    textDecoration: "none",
    cursor: "pointer",
  };
}

export function getModalStyle(
  {
    width = "100%",
    maxWidth = 1120,
    maxHeight = "88vh",
    padding = 24,
    borderRadius = 10,
    background = "var(--modal-bg)",
    borderColor = "var(--modal-border)",
    boxShadow = "0 20px 50px rgba(15, 23, 42, 0.18)",
  } = {}
) {
  return {
    width,
    maxWidth,
    maxHeight,
    overflowY: "auto",
    background,
    borderRadius,
    border: `1px solid ${borderColor}`,
    boxShadow,
    padding,
    boxSizing: "border-box",
  };
}

export function getTableFrameStyle(
  {
    borderRadius = 0,
    background = "var(--table-bg)",
    borderColor = "var(--table-border)",
    boxShadow = "var(--table-shadow)",
  } = {}
) {
  return {
    borderRadius,
    overflow: "hidden",
    borderTop: `1px solid ${borderColor}`,
    borderBottom: `1px solid ${borderColor}`,
    borderLeft: "none",
    borderRight: "none",
    boxShadow,
    background,
    boxSizing: "border-box",
  };
}

// alignMode: 1 (semua kiri), 2 (center kecuali label tertentu kiri)
export function getTableHeaderCellStyle(
  {
    background = "var(--table-header-bg)",
    color = "var(--table-header-color)",
    borderColor = "var(--table-header-border)",
    padding = "14px 14px",
    fontSize = 12,
    fontWeight = 500,
    letterSpacing = 0.3,
    alignMode = 1,
    label = "",
    includeTypography = true,
  } = {}
) {
  let textAlign = "left";
  if (alignMode === 2) {
    const normalizedLabel = String(label || "").toUpperCase().trim();
    const leftAlignedLabels = ["TASK", "NAMA", "SUB KEGIATAN", "PELAKSANA"];
    textAlign = leftAlignedLabels.includes(normalizedLabel) ? "left" : "center";
  }

  return {
    background,
    color,
    ...(includeTypography ? {
      fontSize,
      fontWeight,
      letterSpacing,
      fontFamily: '"Inter", sans-serif',
    } : null),
    textTransform: "uppercase",
    padding,
    textAlign,
    borderBottom: `1px solid ${borderColor}`,
  };
}

export function getTableBodyCellStyle(
  {
    padding = "16px 14px",
    borderColor = "var(--table-row-border)",
    includeTypography = true,
    includeColor = true,
    color = "var(--text-h)",
    fontSize = 13,
    lineHeight = 1.45,
  } = {}
) {
  return {
    padding,
    verticalAlign: "middle",
    borderBottom: `1px solid ${borderColor}`,
    ...(includeColor ? { color } : null),
    ...(includeTypography ? { fontSize, lineHeight } : null),
  };
}

// ===== Table Typography Helpers (Max Weight 600 for Clean Look) =====

/** Header Typography: Small + Medium Weight + Grey Color */
export function getTableHeaderTypography(options = {}) {
  const {
    fontSize = 12,
    fontWeight = 500,
    color = "var(--text-muted)",
    letterSpacing = 0.3,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    letterSpacing,
    fontFamily: '"Inter", sans-serif',
    textTransform: "uppercase",
  };
}

/** Body Typography: Standard */
export function getTableBodyTypography(options = {}) {
  const {
    fontSize = 13,
    fontWeight = 400,
    color = "var(--text-h)",
    lineHeight = 1.45,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    lineHeight,
    fontFamily: '"Inter", sans-serif',
  };
}

/** Label/Title in Cell: Larger + Bold Black (600 max) */
export function getTableCellLabelTypography(options = {}) {
  const {
    fontSize = 14,
    fontWeight = 600,
    color = "var(--text-h)",
    lineHeight = 1.4,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    lineHeight,
    fontFamily: '"Inter", sans-serif',
  };
}

/** Subtitle in Cell: Small + Regular + Grey */
export function getTableCellSubtitleTypography(options = {}) {
  const {
    fontSize = 13,
    fontWeight = 400,
    color = "var(--text-muted)",
    lineHeight = 1.4,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    lineHeight,
    fontFamily: '"Inter", sans-serif',
  };
}

/** Compact Cell: Small + Medium Weight */
export function getTableCellCompactTypography(options = {}) {
  const {
    fontSize = 12,
    fontWeight = 500,
    color = "var(--text-h)",
    lineHeight = 1.4,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    lineHeight,
    fontFamily: '"Inter", sans-serif',
  };
}

// ===== Table Layout Helpers =====

export function getTableColumnWidthStyle(options = {}) {
  const { variant, mode = 2 } = options;

  if (variant === "task") {
    return getTableTaskColumnWidthStyle({ mode });
  }

  return {};
}

export function getTableLineClampStyle(options = {}) {
  const { lines = 3 } = options;

  return {
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  };
}

export function getTableTaskColumnWidthStyle(options = {}) {
  const { mode = 1 } = options;

  if (mode === 2) {
    return {
      width: "var(--table-col-task-width-mode2)",
      maxWidth: "var(--table-col-task-width-mode2)",
    };
  }

  if (mode === 3) {
    return {
      minWidth: "var(--table-col-task-min-width-mode3)",
      width: "var(--table-col-task-width-mode3)",
      maxWidth: "var(--table-col-task-width-mode3)",
    };
  }

  // Mode 1 (default): no column width constraints.
  return {};
}

export function getTableTaskTitleClampClassName(options = {}) {
  const { mode = 1 } = options;

  if (mode === 2) {
    return "table-line-clamp table-line-clamp--mode2";
  }

  if (mode === 3) {
    return "table-line-clamp table-line-clamp--mode3";
  }

  return "";
}

export function getTableTaskTitleCharLimit(options = {}) {
  const { mode = 1 } = options;

  if (mode === 1) {
    return 100;
  }

  return null;
}

// Generic aliases: use these when the "primary" column isn't literally a task title.
export function getTablePrimaryColumnWidthStyle(options = {}) {
  return getTableTaskColumnWidthStyle(options);
}

export function getTablePrimaryTitleClampClassName(options = {}) {
  return getTableTaskTitleClampClassName(options);
}

export function getTablePrimaryTitleCharLimit(options = {}) {
  return getTableTaskTitleCharLimit(options);
}

/** Table Header Typography */


/** Table Cell Label Typography */

// ===== Additional Typography Helpers =====

/** Section/Card Title: Medium size + Bold */
export function getSectionTitleTypography(options = {}) {
  const {
    fontSize = 18,
    fontWeight = 600,
    color = "var(--text-h)",
    lineHeight = 1.3,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    lineHeight,
    fontFamily: '"Inter", sans-serif',
  };
}

/** Form Label: Standard for form fields */
export function getFormLabelTypography(options = {}) {
  const {
    fontSize = 13,
    fontWeight = 400,
    color = "var(--text-muted)",
    lineHeight = 1.4,
  } = options;

  return {
    fontSize,
    fontWeight,
    color,
    lineHeight,
    fontFamily: '"Inter", sans-serif',
  };
}

export function getDangerOutlinedButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "sm" } = {}
) {
  void prefersDarkMode;
  const enabled = Boolean(isEnabled);
  const padding = size === "sm" ? "0 12px" : CONTROL_PADDING;
  const radius = size === "sm" ? CONTROL_SM_RADIUS : CONTROL_RADIUS;

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: `1px solid var(--btn-danger-outlined-border)`,
    background: "var(--btn-danger-outlined-bg)",
    color: "var(--btn-danger-outlined-color)",
    borderRadius: radius,
    padding,
    minHeight: height ?? (size === "sm" ? 34 : CONTROL_MIN_HEIGHT),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.6,
  };
}

export function getPillToggleButtonStyle(
  prefersDarkMode,
  {
    isActive,
    activeBorderColor,
    inactiveBorderColor,
    activeBackground,
    inactiveBackground,
    activeColor,
    inactiveColor,
    borderRadius = 999,
    fontSize = CONTROL_FONT_SIZE,
    fontWeight = 700,
    padding = "8px 14px",
  } = {}
) {
  void prefersDarkMode;
  const active = Boolean(isActive);
  return {
    border: `1px solid ${active ? activeBorderColor : inactiveBorderColor}`,
    background: active ? activeBackground : inactiveBackground,
    color: active ? activeColor : inactiveColor,
    borderRadius,
    padding,
    fontSize,
    fontWeight,
    cursor: "pointer",
    font: "inherit",
    letterSpacing: 0.2,
  };
}

export function getSegmentButtonStyle(
  prefersDarkMode,
  { isActive, padding = "8px 14px" } = {}
) {
  const active = Boolean(isActive);
  return {
    border: active ? "1px solid #1A1A1B" : "1px solid #E5E7EB",
    background: "transparent",
    color: active
      ? "#1A1A1B"
      : "var(--text-muted)",
    borderRadius: 8,
    padding,
    fontSize: CONTROL_FONT_SIZE,
    width: 140,
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: '"Inter", sans-serif',
  };
}

export function getOutlinedButtonStyle(
  prefersDarkMode,
  { isEnabled, fullWidth = false, height = undefined, size = "md" } = {}
) {
  void prefersDarkMode;
  const sizeMeta = getButtonSizeMeta(size);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...(height ? { height } : null),
    border: `1px solid ${getControlBorderColor(prefersDarkMode)}`,
    background: isEnabled ? "var(--btn-outlined-bg)" : "var(--btn-outlined-bg-disabled)",
    color: isEnabled ? "var(--btn-outlined-color)" : "var(--btn-outlined-color-disabled)",
    borderRadius: sizeMeta.radius,
    padding: sizeMeta.padding,
    minHeight: height ?? sizeMeta.minHeight,
    ...(!fullWidth && sizeMeta.minWidth ? { minWidth: sizeMeta.minWidth } : null),
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    flex: "0 0 auto",
    fontSize: sizeMeta.fontSize,
    fontWeight: 700,
    lineHeight: 1.2,
    boxSizing: "border-box",
    cursor: isEnabled ? "pointer" : "not-allowed",
  };
}

function getChipSizeMeta(size) {
  if (size === "xs") {
    return {
      padding: CONTROL_XS_PADDING,
      fontSize: 11,
    };
  }

  if (size === "md") {
    return {
      padding: CONTROL_PADDING,
      fontSize: CONTROL_FONT_SIZE,
    };
  }

  return {
    padding: "6px 10px",
    fontSize: 12,
  };
}

function getChipToneMeta(prefersDarkMode, tone) {
  void prefersDarkMode;
  const normalizedTone = String(tone || "neutral").trim().toLowerCase();

  if (normalizedTone === "success") {
    return { background: "var(--chip-success-bg)", color: "var(--chip-success-color)" };
  }

  if (normalizedTone === "warning") {
    return { background: "var(--chip-warning-bg)", color: "var(--chip-warning-color)" };
  }

  if (normalizedTone === "danger") {
    return { background: "var(--chip-danger-bg)", color: "var(--chip-danger-color)" };
  }

  if (normalizedTone === "info") {
    return { background: "var(--chip-info-bg)", color: "var(--chip-info-color)" };
  }

  if (normalizedTone === "purple") {
    return { background: "var(--chip-purple-bg)", color: "var(--chip-purple-color)" };
  }

  if (normalizedTone === "muted") {
    return { background: "var(--surface-3)", color: "var(--text-muted)" };
  }

  if (normalizedTone === "canceled") {
    return { background: "var(--chip-canceled-bg)", color: "var(--chip-canceled-color)" };
  }

  if (normalizedTone === "disabled") {
    return { background: "var(--chip-disabled-bg)", color: "var(--chip-disabled-color)" };
  }

  return { background: "var(--surface-2)", color: "var(--text-subtle)" };
}

export function getChipStyle(
  prefersDarkMode,
  {
    tone = "neutral",
    size = "sm",
    background = undefined,
    color = undefined,
    borderColor = undefined,
    fontWeight = 700,
    fontSize = undefined,
    minWidth = undefined,
    padding = undefined,
  } = {}
) {
  const sizeMeta = getChipSizeMeta(size);
  const toneMeta = getChipToneMeta(prefersDarkMode, tone);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: padding ?? sizeMeta.padding,
    borderRadius: 999,
    fontSize: fontSize ?? sizeMeta.fontSize,
    fontWeight,
    lineHeight: 1.2,
    background: background ?? toneMeta.background,
    color: color ?? toneMeta.color,
    border: borderColor ? `1px solid ${borderColor}` : "1px solid transparent",
    ...(minWidth ? { minWidth } : null),
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };
}

export function getToastAccentColor(type = "info") {
  const normalizedType = String(type || "").trim().toLowerCase();

  if (normalizedType === "success") {
    return "var(--alert-success-color)";
  }
  if (normalizedType === "error") {
    return "var(--alert-error-color)";
  }
  return "var(--alert-info-color)";
}

export function getSubPageButtonStyle(
  prefersDarkMode,
  { isActive, padding = "8px 14px" } = {}
) {
  void prefersDarkMode;
  const active = Boolean(isActive);
  const fontSize = 12;

  return {
    border: "none",
    background: "transparent",
    color: active
      ? "#1A1A1B"
      : "#687288",
    padding,
    fontSize,
    textAlign: "left",
    alignItems: "center",
    display: "inline-flex",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: '"Inter", sans-serif',
    transition: "color 140ms ease",
    width: "auto",
  };
}
