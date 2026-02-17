// src/services/apiWallet.ts
const ANDROID_BASE_URL = process.env.EXPO_PUBLIC_WALLET_ANDROID_API_BASE_URL;
const APPLE_BASE_URL = process.env.EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL;
export const DEFAULT_CLASS_ID = process.env.EXPO_PUBLIC_WALLET_CLASS_ID!;

export interface WalletApiResponse {
  ok: boolean;      // true si status 2xx
  status: number;   // status HTTP (0 si fallo de red)
  data: any | null; // cuerpo parseado (JSON si se pudo, si no string)
  rawText?: string; // texto crudo de la respuesta
  errorText?: string;
}

async function callWalletApi(
  path: "/createObject" | "/firma" | "/actualizar",
  body: any
): Promise<WalletApiResponse> {
  try {
    const res = await fetch(`${ANDROID_BASE_URL}${path}`, {
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
      parsed = rawText; // no era JSON, lo dejamos como string
    }

    const result: WalletApiResponse = {
      ok: res.ok,
      status: res.status,
      data: parsed,
      rawText,
    };

    if (!res.ok) {
      result.errorText = rawText;
      console.warn(`[WalletAPI] Error en ${path} (status ${res.status}):`, rawText);
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

export async function createWalletObject(params: {
  classId?: string;
  idUsuario: string;
  nombreUsuario: string;
}): Promise<WalletApiResponse> {
  const { classId = DEFAULT_CLASS_ID, idUsuario, nombreUsuario } = params;

  return callWalletApi("/createObject", {
    classId,
    idUsuario,
    nombreUsuario,
  });
}

export async function signWalletObject(params: {
  idUsuario: string;
}): Promise<WalletApiResponse> {
  const { idUsuario } = params;
  return callWalletApi("/firma", { idUsuario });
}

export async function updateWalletPoints(params: {
  idUsuario: string;
  cantidadPuntos: number;
}): Promise<WalletApiResponse> {
  const { idUsuario, cantidadPuntos } = params;
  return callWalletApi("/actualizar", { idUsuario, cantidadPuntos });
}

export async function createAndSignWallet(params: {
  classId?: string;
  idUsuario: string;
  nombreUsuario: string;
}): Promise<{
  create: WalletApiResponse;
  sign: WalletApiResponse | null;
}> {
  const create = await createWalletObject(params);
  if (!create.ok) {
    return { create, sign: null };
  }

  const sign = await signWalletObject({ idUsuario: params.idUsuario });
  return { create, sign };
}

// --------- Apple Wallet services (separados) ---------
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

    // Si no es OK, intentamos leer texto para mostrar detalle
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

    // Apple puede responder bytes (.pkpass) o JSON de ok
    if (contentType.includes("application/json")) {
      rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText;
      }
    } else {
      // bytes
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
}): Promise<ApplePassResponse> {
  const { idUsuario, nombre, apellido, codigoQR } = params;
  return callAppleApi("/v1/crearPasses", {
    idUsuario,
    cantidad: 1,
    premiosDisponibles: 3,
    nombre,
    apellido,
    codigoQR,
  });
}

export async function updateApplePass(params: {
  idUsuario: number | string;
  cantidad: number;
  premiosDisponibles: number;
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
}): Promise<WalletApiResponse> {
  if (!ANDROID_BASE_URL) {
    return { ok: false, status: 0, data: null, errorText: "ANDROID_BASE_URL no configurada" };
  }
  try {
    const res = await fetch(`${ANDROID_BASE_URL}/notificacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
