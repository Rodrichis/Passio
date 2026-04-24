import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import type { WalletConfigData } from "../../types/walletOnboarding";

export async function saveWalletConfig(empresaId: string, config: WalletConfigData) {
  await setDoc(
    doc(db, "Empresas", empresaId),
    {
      walletConfigurado: config.walletConfigurado,
      estadoWallet: config.estadoWallet,
      colorWallet: config.colorWallet,
      visitasPorPremio: config.visitasPorPremio,
      urlIconoWallet: config.urlIconoWallet,
      paqueteSellosWallet: config.paqueteSellosWallet,
      tipoSellosWallet: config.tipoSellosWallet,
      "wallet-class-id": config.walletClassId,
    },
    { merge: true }
  );
}
