// src/services/apiWallet.ts
const ANDROID_BASE_URL = process.env.EXPO_PUBLIC_WALLET_ANDROID_API_BASE_URL;
const ANDROID_PREFIX = ANDROID_BASE_URL ? `${ANDROID_BASE_URL}/wallet` : "";
const APPLE_BASE_URL = process.env.EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL;
export const DEFAULT_CLASS_ID = process.env.EXPO_PUBLIC_WALLET_CLASS_ID!;

export interface WalletApiResponse {
  ok: boolean;
  status: number;
  data: any | null;
  rawText?: string;
  errorText?: string;
}

export interface AndroidWalletVisualConfig {
  walletClassId: string;
  nombreEmpresa?: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
  colorWallet?: string;
  urlIconoWallet?: string;
}

export interface AndroidWalletStateConfig {
  walletClassId: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
}

async function callWalletApi(
  path: "/syncClass" | "/createObject" | "/firma" | "/actualizar" | "/actualizarEstado",
  body: any
): Promise<WalletApiResponse> {
  if (!ANDROID_PREFIX) {
    return { ok: false, status: 0, data: null, errorText: "ANDROID_BASE_URL no configurada" };
  }

  try {
    const res = await fetch(`${ANDROID_PREFIX}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await res.text();
    let parsed: any = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }

    const result: WalletApiResponse = {
      ok: res.ok,
      status: res.status,
      data: parsed,
      rawText,
    };

    if (result.ok && parsed && typeof parsed === "object" && parsed.success === false) {
      result.ok = false;
      result.errorText = String(parsed.message || rawText || "Operacion rechazada por backend");
    }

    if (!result.ok) {
      result.errorText = result.errorText || rawText;
      console.warn(`[WalletAPI] Error en ${path} (status ${res.status}):`, parsed);
    } else {
      console.log(`[WalletAPI] OK ${path} (status ${res.status})`, parsed);
    }

    return result;
  } catch (e) {
    console.error(`[WalletAPI] Error de red en ${path}:`, e);
    return {
      ok: false,
      status: 0,
      data: null,
      errorText: String(e),
    };
  }
}

export async function syncAndroidWalletClass(config: AndroidWalletVisualConfig): Promise<WalletApiResponse> {
  const { walletClassId, nombreEmpresa, paqueteSellosWallet, visitasPorPremio, colorWallet, urlIconoWallet } = config;

  return callWalletApi("/syncClass", {
    walletClassId,
    nombreEmpresa,
    paqueteSellosWallet,
    visitasPorPremio,
    colorWallet,
    urlIconoWallet,
  });
}

export async function createWalletObject(params: {
  classId?: string;
  walletClassId?: string;
  idUsuario: string;
  nombreUsuario: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
  nombre?: string;
  apellido?: string;
  codigoQR?: string;
  cantidad?: number;
  premios?: number;
}): Promise<WalletApiResponse> {
  const {
    classId,
    walletClassId,
    idUsuario,
    nombreUsuario,
    paqueteSellosWallet,
    visitasPorPremio,
    nombre,
    apellido,
    codigoQR,
    cantidad,
    premios,
  } = params;

  const resolvedWalletClassId = walletClassId || classId;

  return callWalletApi("/createObject", {
    classId: resolvedWalletClassId,
    walletClassId: resolvedWalletClassId,
    idUsuario,
    nombreUsuario,
    paqueteSellosWallet,
    visitasPorPremio,
    ...(nombre ? { nombre } : {}),
    ...(apellido ? { apellido } : {}),
    ...(codigoQR ? { codigoQR } : {}),
    ...(typeof cantidad === "number" ? { cantidad } : {}),
    ...(typeof premios === "number" ? { premios } : {}),
  });
}

export async function signWalletObject(params: { idUsuario: string }): Promise<WalletApiResponse> {
  const { idUsuario } = params;
  return callWalletApi("/firma", { idUsuario });
}

export async function updateWalletPoints(params: {
  idUsuario: string;
  cantidadPuntos: number;
  walletClassId: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
}): Promise<WalletApiResponse> {
  const { idUsuario, cantidadPuntos, walletClassId, paqueteSellosWallet, visitasPorPremio } = params;
  return callWalletApi("/actualizar", {
    idUsuario,
    cantidadPuntos,
    walletClassId,
    paqueteSellosWallet,
    visitasPorPremio,
  });
}

export async function updateAndroidWalletState(params: {
  idUsuario: string;
  cantidad: number;
  premiosDisponibles: number;
  walletClassId: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
}): Promise<WalletApiResponse> {
  return callWalletApi("/actualizarEstado", params);
}

function isExistingWalletResponse(response: WalletApiResponse | null | undefined) {
  if (!response) return false;

  const message = [
    response.errorText,
    typeof response.data === "object" && response.data ? String((response.data as any).message || "") : "",
    response.rawText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return message.includes("ya existe") || message.includes("already exists");
}

export async function createAndSignWallet(params: {
  classId?: string;
  walletClassId?: string;
  idUsuario: string;
  nombreUsuario: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
  nombre?: string;
  apellido?: string;
  codigoQR?: string;
  cantidad?: number;
  premios?: number;
}): Promise<{
  create: WalletApiResponse;
  sign: WalletApiResponse | null;
}> {
  const create = await createWalletObject(params);
  if (!create.ok && !isExistingWalletResponse(create)) {
    return { create, sign: null };
  }

  const sign = await signWalletObject({ idUsuario: params.idUsuario });
  return { create, sign };
}

type ApplePassResponse = WalletApiResponse & {
  contentType?: string;
};

async function callAppleApi(path: "/v1/crearPasses" | "/v1/actualizarPase" | "/v1/notificacion", body: any): Promise<ApplePassResponse> {
  if (!APPLE_BASE_URL) {
    return { ok: false, status: 0, data: null, errorText: "APPLE_BASE_URL no configurada" };
  }

  try {
    const res = await fetch(`${APPLE_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.apple.pkpass, application/json, */*",
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type") || "";
    let data: any = null;
    let rawText: string | undefined;

    if (!res.ok) {
      rawText = await res.text();
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = rawText;
      }
      return {
        ok: false,
        status: res.status,
        data,
        rawText,
        contentType,
        errorText: rawText || `HTTP ${res.status}`,
      };
    }

    if (contentType.includes("application/json")) {
      rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    } else {
      data = await res.blob();
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      rawText,
      contentType,
      errorText: res.ok ? undefined : rawText,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      errorText: String(e),
    };
  }
}

export async function createApplePass(params: {
  idUsuario: number | string;
  nombre: string;
  apellido: string;
  codigoQR: string;
  empresaUid?: string;
  walletClassId?: string;
  nombreEmpresa?: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
  colorWallet?: string;
  urlIconoWallet?: string;
}): Promise<ApplePassResponse> {
  const {
    idUsuario,
    nombre,
    apellido,
    codigoQR,
    empresaUid,
    walletClassId,
    nombreEmpresa,
    paqueteSellosWallet,
    visitasPorPremio,
    colorWallet,
    urlIconoWallet,
  } = params;

  return callAppleApi("/v1/crearPasses", {
    idUsuario,
    cantidad: 1,
    premiosDisponibles: 3,
    nombre,
    apellido,
    codigoQR,
    empresaUid,
    walletClassId,
    nombreEmpresa,
    paqueteSellosWallet,
    visitasPorPremio,
    colorWallet,
    urlIconoWallet,
  });
}

export async function updateApplePass(params: {
  idUsuario: number | string;
  cantidad: number;
  premiosDisponibles: number;
  empresaUid?: string;
  walletClassId?: string;
  nombreEmpresa?: string;
  paqueteSellosWallet?: string;
  visitasPorPremio?: number;
  colorWallet?: string;
  urlIconoWallet?: string;
}): Promise<ApplePassResponse> {
  return callAppleApi("/v1/actualizarPase", params);
}

export async function notifyApplePass(params: {
  idUsuario: number | string;
  notificacion: string;
}): Promise<ApplePassResponse> {
  return callAppleApi("/v1/notificacion", params);
}

export async function notifyAndroidPass(params: {
  idUsuario: string;
  notificacion: string;
  cabecera?: string;
}): Promise<WalletApiResponse> {
  const { idUsuario, notificacion, cabecera = "Passio" } = params;
  if (!ANDROID_PREFIX) {
    return { ok: false, status: 0, data: null, errorText: "ANDROID_BASE_URL no configurada" };
  }

  try {
    const res = await fetch(`${ANDROID_PREFIX}/notificacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idUsuario,
        mensaje: notificacion,
        cabecera,
      }),
    });
    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      rawText,
      errorText: res.ok ? undefined : rawText,
    };
  } catch (e) {
    return { ok: false, status: 0, data: null, errorText: String(e) };
  }
}
