import type { WalletIconAsset } from "../../types/walletOnboarding";

const WALLET_CONFIG_BASE_URL = process.env.EXPO_PUBLIC_WALLET_CONFIG_API_BASE_URL;

export interface UploadWalletIconResponse {
  ok: boolean;
  message?: string;
  data?: {
    walletClassId: string;
    bucketName: string;
    objectPath: string;
    storageUri: string;
    publicUrl?: string;
    mimeType: string;
    size: number;
  };
  error?: string;
}

export async function uploadWalletIcon(walletClassId: string, iconAsset: WalletIconAsset) {
  if (!WALLET_CONFIG_BASE_URL) {
    throw new Error("EXPO_PUBLIC_WALLET_CONFIG_API_BASE_URL no configurada.");
  }

  const formData = new FormData();
  formData.append("wallet-class-id", walletClassId);

  if (typeof Blob !== "undefined" && iconAsset.file instanceof Blob) {
    formData.append("data", iconAsset.file, "icon.png");
  } else {
    formData.append(
      "data",
      {
        ...(iconAsset.file as Exclude<WalletIconAsset["file"], Blob>),
        name: "icon.png",
        type: "image/png",
      } as any
    );
  }

  const response = await fetch(`${WALLET_CONFIG_BASE_URL}/upload-icono-wallet`, {
    method: "POST",
    body: formData,
  });

  const rawText = await response.text();
  let parsed: UploadWalletIconResponse | null = null;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.ok || !parsed.data) {
    const backendMessage = parsed?.message || parsed?.error || rawText || "No se pudo subir el icono del wallet.";
    throw new Error(backendMessage);
  }

  return parsed.data.publicUrl || parsed.data.storageUri;
}
