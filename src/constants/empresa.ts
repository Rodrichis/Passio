export const PLAN = {
  FREE: "free",
  PRO: "pro",
} as const;

export const ESTADO_SUSCRIPCION = {
  ACTIVA: "active",
  PENDIENTE: "pending",
  PAGO_PENDIENTE: "past_due",
  CADUCADA: "expired",
  PRUEBA: "trialing",
} as const;

export const ESTADO_WALLET = {
  PENDIENTE: "pendiente",
  LISTO: "listo",
  ERROR: "error",
} as const;
