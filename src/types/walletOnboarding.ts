export type EstadoWallet = "pendiente" | "listo" | "error";

export type PaqueteSellosWallet = "generico1" | "generico2" | "generico3" | "generico4";

export interface WalletConfigData {
  walletConfigurado: boolean;
  estadoWallet: EstadoWallet;
  colorWallet: string;
  visitasPorPremio: number;
  urlIconoWallet: string;
  paqueteSellosWallet: PaqueteSellosWallet;
  walletClassId: string;
  companyName?: string;
}

export type WalletIconFile =
  | Blob
  | {
      uri: string;
      name: string;
      type: string;
    };

export interface WalletIconAsset {
  file: WalletIconFile;
  name: string;
  type: string;
  previewUrl: string;
}

export interface WalletOnboardingSlideData {
  key: string;
  title: string;
  description: string;
  iconName: string;
}

export interface StampPackOption {
  id: PaqueteSellosWallet;
  title: string;
  description: string;
  previewColors: [string, string, string];
}
