import type { WalletOnboardingSlideData } from "../../types/walletOnboarding";

export const WALLET_ONBOARDING_SLIDES: WalletOnboardingSlideData[] = [
  {
    key: "personaliza",
    title: "Personaliza tu wallet",
    description: "Sube el icono PNG de tu empresa y define el color principal de tu tarjeta.",
    iconName: "color-palette-outline",
  },
  {
    key: "sellos",
    title: "Elige tus sellos",
    description: "Selecciona uno de los packs de sellos disponibles para mostrar el avance de visitas.",
    iconName: "albums-outline",
  },
  {
    key: "visitas",
    title: "Define tus premios",
    description: "Configura cuantas visitas necesita un cliente para recibir un premio.",
    iconName: "gift-outline",
  },
];
