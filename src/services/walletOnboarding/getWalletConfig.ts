import { doc, getDoc } from "firebase/firestore";
import { ESTADO_WALLET } from "../../constants/empresa";
import { db } from "../firebaseConfig";
import type { EstadoWallet, PaqueteSellosWallet, TipoSellosWallet, WalletConfigData } from "../../types/walletOnboarding";
import {
  clampVisitasPorPremio,
  DEFAULT_VISITAS_POR_PREMIO,
  DEFAULT_WALLET_COLOR,
} from "../../utils/walletOnboarding/validators";
import { resolveWalletClassIdFromName } from "../../utils/walletOnboarding/walletClassId";
import { isGenericStampPack } from "../../utils/walletOnboarding/stampPacks";

const DEFAULT_STAMP_PACK: PaqueteSellosWallet = "generico1";

function resolveEstadoWallet(value: unknown): EstadoWallet {
  return value === ESTADO_WALLET.LISTO || value === ESTADO_WALLET.ERROR
    ? value
    : ESTADO_WALLET.PENDIENTE;
}

function resolvePaqueteSellosWallet(value: unknown): PaqueteSellosWallet {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_STAMP_PACK;
}

function resolveTipoSellosWallet(value: unknown, paqueteSellosWallet: PaqueteSellosWallet): TipoSellosWallet {
  if (value === "generico" || value === "personalizado") {
    return value;
  }

  return isGenericStampPack(paqueteSellosWallet) ? "generico" : "personalizado";
}

export async function getWalletConfig(empresaId: string): Promise<WalletConfigData> {
  const snap = await getDoc(doc(db, "Empresas", empresaId));
  const data = snap.exists() ? snap.data() : {};
  const rawWalletClassId = typeof data?.["wallet-class-id"] === "string" ? data["wallet-class-id"] : "";
  const companyName = typeof data?.nombre === "string" ? data.nombre : "";
  const paqueteSellosWallet = resolvePaqueteSellosWallet(data?.paqueteSellosWallet);

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
    paqueteSellosWallet,
    tipoSellosWallet: resolveTipoSellosWallet(data?.tipoSellosWallet, paqueteSellosWallet),
    walletClassId: rawWalletClassId.trim() || resolveWalletClassIdFromName(companyName, empresaId),
    companyName,
  };
}
