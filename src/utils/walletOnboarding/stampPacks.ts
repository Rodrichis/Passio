import type {
  GenericPaqueteSellosWallet,
  PaqueteSellosWallet,
  StampPackOption,
  TipoSellosWallet,
} from "../../types/walletOnboarding";
import { clampVisitasPorPremio } from "./validators";

export const STAMP_PREVIEW_BUCKET_BASE_URL = "https://storage.googleapis.com/passio-wallet-bucket/sellos";

export const GENERIC_STAMP_PACK_IDS: GenericPaqueteSellosWallet[] = ["generico1", "generico2", "generico3", "generico4"];

export const STAMP_PACK_OPTIONS: StampPackOption[] = [
  {
    id: "generico1",
    title: "Sellos de granos de cafe",
    description: "Granos de cafe sobre fondo azul.",
    previewColors: ["#FFB81C", "#28B6D7", "#000000"],
  },
  {
    id: "generico2",
    title: "Sellos Passio",
    description: "Logo Passio sobre fondo azul.",
    previewColors: ["#FFB81C", "#28B6D7", "#000000"],
  },
  {
    id: "generico3",
    title: "Sellos de tijeras",
    description: "Tijeras sobre fondo azul.",
    previewColors: ["#FFB81C", "#28B6D7", "#000000"],
  },
];

export function isGenericStampPack(value: unknown): value is GenericPaqueteSellosWallet {
  return typeof value === "string" && GENERIC_STAMP_PACK_IDS.includes(value as GenericPaqueteSellosWallet);
}

export function resolveStampPackLabel(paqueteSellosWallet: PaqueteSellosWallet, tipoSellosWallet: TipoSellosWallet = "generico") {
  const match = STAMP_PACK_OPTIONS.find((option) => option.id === paqueteSellosWallet);
  if (match) return match.title;
  if (paqueteSellosWallet === "generico4") return "Pack generico anterior";
  if (tipoSellosWallet === "personalizado") return "Pack personalizado";
  return paqueteSellosWallet || "Pack sin definir";
}

export function buildStampPreviewUrl(
  paqueteSellosWallet: PaqueteSellosWallet,
  visitasPorPremio: number,
  numero: number,
  cacheVersion?: string | number
) {
  const safeVisits = clampVisitasPorPremio(visitasPorPremio);
  const safeNumero = Math.min(Math.max(1, Math.trunc(numero || 1)), safeVisits);
  const baseUrl = `${STAMP_PREVIEW_BUCKET_BASE_URL}/${paqueteSellosWallet}/${safeVisits}/${safeNumero}.png`;
  return cacheVersion == null ? baseUrl : `${baseUrl}?v=${encodeURIComponent(String(cacheVersion))}`;
}
