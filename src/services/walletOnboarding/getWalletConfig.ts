import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import type { EstadoWallet, PaqueteSellosWallet, WalletConfigData } from "../../types/walletOnboarding";
import {
  clampVisitasPorPremio,
  DEFAULT_VISITAS_POR_PREMIO,
  DEFAULT_WALLET_COLOR,
} from "../../utils/walletOnboarding/validators";
import { resolveWalletClassIdFromName } from "../../utils/walletOnboarding/walletClassId";

const DEFAULT_STAMP_PACK: PaqueteSellosWallet = "generico1";

function resolveEstadoWallet(value: unknown): EstadoWallet {
  return value === "listo" || value === "error" ? value : "pendiente";
}

function resolvePaqueteSellosWallet(value: unknown): PaqueteSellosWallet {
  return value === "generico1" || value === "generico2" || value === "generico3" || value === "generico4"
    ? value
    : DEFAULT_STAMP_PACK;
}

export async function getWalletConfig(empresaId: string): Promise<WalletConfigData> {
  const snap = await getDoc(doc(db, "Empresas", empresaId));
  const data = snap.exists() ? snap.data() : {};
  const rawWalletClassId = typeof data?.["wallet-class-id"] === "string" ? data["wallet-class-id"] : "";
  const companyName = typeof data?.nombre === "string" ? data.nombre : "";

  return {
    walletConfigurado: data?.walletConfigurado === true || data?.["walletConfigurado "] === true,
    estadoWallet: resolveEstadoWallet(data?.estadoWallet),
    colorWallet:
      typeof data?.colorWallet === "string" && data.colorWallet.trim().length > 0
        ? data.colorWallet
        : typeof data?.ColorPrincipal === "string" && data.ColorPrincipal.trim().length > 0
        ? data.ColorPrincipal
        : DEFAULT_WALLET_COLOR,
    visitasPorPremio: clampVisitasPorPremio(
      typeof data?.visitasPorPremio === "number" ? data.visitasPorPremio : DEFAULT_VISITAS_POR_PREMIO
    ),
    urlIconoWallet: typeof data?.urlIconoWallet === "string" ? data.urlIconoWallet : "",
    paqueteSellosWallet: resolvePaqueteSellosWallet(data?.paqueteSellosWallet),
    walletClassId: rawWalletClassId.trim() || resolveWalletClassIdFromName(companyName, empresaId),
    companyName,
  };
}