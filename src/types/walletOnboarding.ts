import { ESTADO_WALLET } from "../constants/empresa";

export type EstadoWallet = typeof ESTADO_WALLET[keyof typeof ESTADO_WALLET];

export type TipoSellosWallet = "generico" | "personalizado";

export type GenericPaqueteSellosWallet = "generico1" | "generico2" | "generico3" | "generico4";

export type PaqueteSellosWallet = string;

export interface WalletConfigData {
  walletConfigurado: boolean;
  estadoWallet: EstadoWallet;
  colorWallet: string;
  visitasPorPremio: number;
  urlIconoWallet: string;
  paqueteSellosWallet: PaqueteSellosWallet;
  tipoSellosWallet: TipoSellosWallet;
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
  id: GenericPaqueteSellosWallet;
  title: string;
  description: string;
  previewColors: [string, string, string];
}
