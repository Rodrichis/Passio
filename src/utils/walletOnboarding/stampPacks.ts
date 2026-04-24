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
    title: "Sellos clasicos",
    description: "Sellos redondos con estilo clasico y tono artesanal.",
    previewColors: ["#7c5535", "#a56d42", "#d4a373"],
  },
  {
    id: "generico2",
    title: "Sellos calidos",
    description: "Sellos suaves con look calido para marcas cercanas.",
    previewColors: ["#6b705c", "#a5a58d", "#ddbea9"],
  },
  {
    id: "generico3",
    title: "Sellos de granos de cafe",
    description: "Pack generico inspirado en granos de cafe y tonos naturales.",
    previewColors: ["#1d3557", "#457b9d", "#a8dadc"],
  },
  {
    id: "generico4",
    title: "Sellos de alto contraste",
    description: "Sellos de contraste alto para marcas con personalidad fuerte.",
    previewColors: ["#2b2d42", "#8d99ae", "#edf2f4"],
  },
];

export function isGenericStampPack(value: unknown): value is GenericPaqueteSellosWallet {
  return typeof value === "string" && GENERIC_STAMP_PACK_IDS.includes(value as GenericPaqueteSellosWallet);
}

export function resolveStampPackLabel(paqueteSellosWallet: PaqueteSellosWallet, tipoSellosWallet: TipoSellosWallet = "generico") {
  const match = STAMP_PACK_OPTIONS.find((option) => option.id === paqueteSellosWallet);
  if (match) return match.title;
  if (tipoSellosWallet === "personalizado") return "Pack personalizado";
  return paqueteSellosWallet || "Pack sin definir";
}

export function buildStampPreviewUrl(
  paqueteSellosWallet: PaqueteSellosWallet,
  visitasPorPremio: number,
  numero: number
) {
  const safeVisits = clampVisitasPorPremio(visitasPorPremio);
  const safeNumero = Math.min(Math.max(1, Math.trunc(numero || 1)), safeVisits);
  return `${STAMP_PREVIEW_BUCKET_BASE_URL}/${paqueteSellosWallet}/${safeVisits}/${safeNumero}.png`;
}
