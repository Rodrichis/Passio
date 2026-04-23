export function normalizeWalletClassId(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized;
}

function buildWalletClassIdSuffix(value: string) {
  const compact = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);

  return compact || "passio";
}

export function resolveWalletClassIdFromName(name: string, fallback: string) {
  const normalizedName = normalizeWalletClassId(name);
  const normalizedFallback = normalizeWalletClassId(fallback);
  const suffix = buildWalletClassIdSuffix(fallback);

  if (normalizedName) {
    return `${normalizedName}-${suffix}`;
  }

  return normalizedFallback || fallback;
}
