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

export function resolveWalletClassIdFromName(name: string, fallback: string) {
  return normalizeWalletClassId(name) || normalizeWalletClassId(fallback) || fallback;
}