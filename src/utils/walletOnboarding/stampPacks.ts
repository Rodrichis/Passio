import type { PaqueteSellosWallet, StampPackOption } from "../../types/walletOnboarding";
import { clampVisitasPorPremio } from "./validators";

export const STAMP_PREVIEW_BUCKET_BASE_URL = "https://storage.googleapis.com/passio-wallet-bucket/sellos";

export const STAMP_PACK_OPTIONS: StampPackOption[] = [
  {
    id: "generico1",
    title: "Generico 1",
    description: "Sellos redondos con estilo clasico.",
    previewColors: ["#7c5535", "#a56d42", "#d4a373"],
  },
  {
    id: "generico2",
    title: "Generico 2",
    description: "Sellos con look calido y fondo suave.",
    previewColors: ["#6b705c", "#a5a58d", "#ddbea9"],
  },
  {
    id: "generico3",
    title: "Generico 3",
    description: "Pack limpio y minimal para marcas sobrias.",
    previewColors: ["#1d3557", "#457b9d", "#a8dadc"],
  },
  {
    id: "generico4",
    title: "Generico 4",
    description: "Sellos de alto contraste con tono oscuro.",
    previewColors: ["#2b2d42", "#8d99ae", "#edf2f4"],
  },
];

export function buildStampPreviewUrl(
  paqueteSellosWallet: PaqueteSellosWallet,
  visitasPorPremio: number,
  numero: number
) {
  const safeVisits = clampVisitasPorPremio(visitasPorPremio);
  const safeNumero = Math.min(Math.max(1, Math.trunc(numero || 1)), safeVisits);
  return `${STAMP_PREVIEW_BUCKET_BASE_URL}/${paqueteSellosWallet}/${safeVisits}/${safeNumero}.png`;
}
