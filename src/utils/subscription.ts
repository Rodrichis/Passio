export type NombrePlan = "free" | "pro" | "premium";
export type EstadoSuscripcion = "active" | "pending" | "past_due" | "expired" | "trialing";
export type TipoPagoPlan = "none" | "trial" | "pro_monthly" | "pro_yearly" | null;
export type SuscripcionOrigen = "mercadopago" | "manual" | "none";

export type EmpresaSuscripcion = {
  nombrePlan: NombrePlan;
  estadoSuscripcion: EstadoSuscripcion;
  renovacionAutomatica: boolean;
  expiraEl: Date | null;
  trialTerminaEl: Date | null;
  tipoPagoPlan: TipoPagoPlan;
  suscripcionOrigen: SuscripcionOrigen;
  mercadoPagoPreapprovalId: string | null;
  mercadoPagoPlanId: string | null;
  mercadoPagoPreferenceId: string | null;
  mercadoPagoPaymentId: string | null;
  ultimaSyncSuscripcion: Date | null;
};

export const DEFAULT_FREE_SUBSCRIPTION = {
  nombrePlan: "free",
  estadoSuscripcion: "active",
  renovacionAutomatica: false,
  expiraEl: null,
  trialTerminaEl: null,
  tipoPagoPlan: "none",
  suscripcionOrigen: "none",
  mercadoPagoPreapprovalId: null,
  mercadoPagoPlanId: null,
  mercadoPagoPreferenceId: null,
  mercadoPagoPaymentId: null,
  ultimaSyncSuscripcion: null,
} as const;

export function normalizeEmpresaDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function normalizeNombrePlan(value: unknown): NombrePlan {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pro" || normalized === "premium") return normalized;
  return "free";
}

export function normalizeEstadoSuscripcion(value: unknown, plan: NombrePlan): EstadoSuscripcion {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "activa") return "active";
  if (normalized === "pendiente") return "pending";
  if (normalized === "caducada" || normalized === "inactiva" || normalized === "cancelada") {
    return "expired";
  }
  if (normalized === "prueba") return "trialing";

  if (
    normalized === "active" ||
    normalized === "pending" ||
    normalized === "past_due" ||
    normalized === "expired" ||
    normalized === "trialing"
  ) {
    return normalized;
  }

  return plan === "free" ? "active" : "expired";
}

export function normalizeTipoPagoPlan(value: unknown): TipoPagoPlan {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "none" ||
    normalized === "trial" ||
    normalized === "pro_monthly" ||
    normalized === "pro_yearly"
  ) {
    return normalized;
  }
  return "none";
}

export function normalizeSuscripcionOrigen(value: unknown): SuscripcionOrigen {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "mercadopago" || normalized === "manual") return normalized;
  return "none";
}

function hasSubscriptionObject(data: any) {
  const raw = data?.suscripcion;
  return raw && typeof raw === "object" && !Array.isArray(raw);
}

export function getEmpresaSuscripcion(data: any): EmpresaSuscripcion {
  const legacyRaw = {
    nombrePlan: data?.plan,
    estadoSuscripcion: data?.estadoSuscripcion,
    renovacionAutomatica: false,
    expiraEl: data?.expiraEl,
    trialTerminaEl: null,
    tipoPagoPlan: data?.tipoPagoPlan,
    suscripcionOrigen: normalizeNombrePlan(data?.plan) === "free" ? "none" : "manual",
    mercadoPagoPreapprovalId: null,
    mercadoPagoPlanId: null,
    mercadoPagoPreferenceId: null,
    mercadoPagoPaymentId: null,
    ultimaSyncSuscripcion: null,
  };
  const raw = hasSubscriptionObject(data) ? { ...legacyRaw, ...data.suscripcion } : legacyRaw;
  const nombrePlan = normalizeNombrePlan(raw.nombrePlan);

  return {
    nombrePlan,
    estadoSuscripcion: normalizeEstadoSuscripcion(raw.estadoSuscripcion, nombrePlan),
    renovacionAutomatica: raw.renovacionAutomatica === true,
    expiraEl: normalizeEmpresaDate(raw.expiraEl),
    trialTerminaEl: normalizeEmpresaDate(raw.trialTerminaEl),
    tipoPagoPlan: normalizeTipoPagoPlan(raw.tipoPagoPlan),
    suscripcionOrigen: normalizeSuscripcionOrigen(raw.suscripcionOrigen),
    mercadoPagoPreapprovalId:
      typeof raw.mercadoPagoPreapprovalId === "string" ? raw.mercadoPagoPreapprovalId : null,
    mercadoPagoPlanId:
      typeof raw.mercadoPagoPlanId === "string" ? raw.mercadoPagoPlanId : null,
    mercadoPagoPreferenceId:
      typeof raw.mercadoPagoPreferenceId === "string" ? raw.mercadoPagoPreferenceId : null,
    mercadoPagoPaymentId:
      typeof raw.mercadoPagoPaymentId === "string" ? raw.mercadoPagoPaymentId : null,
    ultimaSyncSuscripcion: normalizeEmpresaDate(raw.ultimaSyncSuscripcion),
  };
}

export function hasValidPaidAccess(suscripcion: EmpresaSuscripcion): boolean {
  return (
    (suscripcion.nombrePlan === "pro" || suscripcion.nombrePlan === "premium") &&
    (suscripcion.estadoSuscripcion === "active" || suscripcion.estadoSuscripcion === "trialing") &&
    Boolean(suscripcion.expiraEl && suscripcion.expiraEl.getTime() > Date.now())
  );
}

export function hasActiveProAccess(suscripcion: EmpresaSuscripcion): boolean {
  return (
    suscripcion.nombrePlan === "pro" &&
    suscripcion.estadoSuscripcion === "active" &&
    Boolean(suscripcion.expiraEl && suscripcion.expiraEl.getTime() > Date.now())
  );
}

export function formatPlanName(value: unknown) {
  const plan = normalizeNombrePlan(value);
  if (plan === "pro") return "Pro";
  if (plan === "premium") return "Premium";
  return "Free";
}

export function formatSubscriptionStatus(value: unknown) {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  switch (status) {
    case "active":
      return "Activa";
    case "pending":
      return "Pendiente";
    case "past_due":
      return "Pago pendiente";
    case "expired":
      return "Expirada";
    case "trialing":
      return "Prueba activa";
    default:
      return "--";
  }
}
