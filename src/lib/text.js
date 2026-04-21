export function getCompactText(value, maxLength = 120) {
  const normalizedValue = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalizedValue) {
    return "-";
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength).trim()}...`;
}

