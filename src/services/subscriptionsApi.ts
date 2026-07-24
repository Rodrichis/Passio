import { auth } from "./firebaseConfig";

const SUBSCRIPTIONS_BASE_URL = process.env.EXPO_PUBLIC_WALLET_CONFIG_API_BASE_URL;
const MERCADO_PAGO_TEST_PAYER_EMAIL = "test_user_3824163978815692503@testuser.com";

export type TipoPagoPlanCobro = "pro_monthly" | "pro_yearly";

export type SubscriptionStatus = {
  empresaUid: string;
  nombrePlan: string | null;
  tipoPagoPlan: string | null;
  estadoSuscripcion: string | null;
  renovacionAutomatica: boolean;
  expiraEl: string | null;
  trialTerminaEl: string | null;
  suscripcionOrigen: string | null;
  mercadoPagoPreapprovalId: string | null;
  mercadoPagoPlanId: string | null;
  mercadoPagoPreferenceId: string | null;
  mercadoPagoPaymentId: string | null;
  ultimaSyncSuscripcion: string | null;
  esProActivo: boolean;
  tieneAcceso: boolean;
};

type BackendResponse<T> = {
  ok: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type CreateSubscriptionResponse = {
  empresaUid: string;
  tipoPagoPlan: TipoPagoPlanCobro;
  checkoutUrl: string;
  preapprovalId: string | null;
  preferenceId: string | null;
};

export class SubscriptionApiError extends Error {
  code?: string;
  status?: number;
  details?: unknown;

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message);
    this.name = "SubscriptionApiError";
    this.code = options?.code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

function getBaseUrl() {
  const baseUrl = String(SUBSCRIPTIONS_BASE_URL || "").trim();

  if (!baseUrl) {
    throw new SubscriptionApiError("No está configurada la URL del servicio de suscripciones.");
  }

  return baseUrl.replace(/\/+$/, "");
}

function isWalletConfigTestEnvironment() {
  return getBaseUrl().includes("wallet-config-services-test");
}

function resolvePayerEmail(correoElectronico?: string | null) {
  if (isWalletConfigTestEnvironment()) {
    return MERCADO_PAGO_TEST_PAYER_EMAIL;
  }

  return correoElectronico || undefined;
}

async function getFirebaseIdToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new SubscriptionApiError("Debes iniciar sesión para gestionar tu suscripción.");
  }

  return user.getIdToken();
}

async function parseResponse<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let parsed: BackendResponse<T> | null = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.ok || typeof parsed.data === "undefined") {
    const backendMessage =
      parsed?.error?.message ||
      parsed?.message ||
      rawText ||
      "No fue posible completar la solicitud de suscripción.";

    throw new SubscriptionApiError(backendMessage, {
      code: parsed?.error?.code,
      status: response.status,
      details: parsed?.error?.details,
    });
  }

  return parsed.data;
}

async function subscriptionRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getFirebaseIdToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

export async function createSubscription(params: {
  empresaUid: string;
  tipoPagoPlan: TipoPagoPlanCobro;
  correoElectronico?: string | null;
}) {
  return subscriptionRequest<CreateSubscriptionResponse>("/subscriptions/create", {
    method: "POST",
    body: JSON.stringify({
      empresaUid: params.empresaUid,
      tipoPagoPlan: params.tipoPagoPlan,
      correoElectronico: resolvePayerEmail(params.correoElectronico),
    }),
  });
}

export async function cancelSubscription(empresaUid: string) {
  return subscriptionRequest<SubscriptionStatus>("/subscriptions/cancel", {
    method: "POST",
    body: JSON.stringify({ empresaUid }),
  });
}

export async function getSubscriptionStatus(empresaUid: string) {
  return subscriptionRequest<SubscriptionStatus>(
    `/subscriptions/status/${encodeURIComponent(empresaUid)}`
  );
}
