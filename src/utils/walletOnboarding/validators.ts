import type { WalletIconAsset } from "../../types/walletOnboarding";

export const DEFAULT_WALLET_COLOR = "#A99985";
export const DEFAULT_VISITAS_POR_PREMIO = 6;
export const MIN_VISITAS_POR_PREMIO = 6;
export const MAX_VISITAS_POR_PREMIO = 10;

export function normalizeHexColor(value: string) {
  const cleaned = value.trim().replace(/[^#a-fA-F0-9]/g, "");
  if (!cleaned) return DEFAULT_WALLET_COLOR;
  const withHash = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
  return withHash.slice(0, 7).toUpperCase();
}

export function isValidHexColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(normalizeHexColor(value));
}

export function clampVisitasPorPremio(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_VISITAS_POR_PREMIO;
  return Math.min(MAX_VISITAS_POR_PREMIO, Math.max(MIN_VISITAS_POR_PREMIO, Math.trunc(value)));
}

export function isPngAsset(asset: Pick<WalletIconAsset, "name" | "type"> | null | undefined) {
  if (!asset) return false;
  const name = String(asset.name || "").toLowerCase();
  const type = String(asset.type || "").toLowerCase();
  return name.endsWith(".png") || type.includes("png");
}
