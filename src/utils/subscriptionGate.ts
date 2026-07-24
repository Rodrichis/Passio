import { getEmpresaSuscripcion } from "./subscription";

export type SubscriptionBlockReason = "caducada" | "pendiente" | "prueba_vencida" | null;

export type SubscriptionBlockState = {
  blocked: boolean;
  reason: SubscriptionBlockReason;
  expiresAt: Date | null;
};

export const EMPTY_SUBSCRIPTION_BLOCK: SubscriptionBlockState = {
  blocked: false,
  reason: null,
  expiresAt: null,
};

export function resolveSubscriptionBlock(data: any): SubscriptionBlockState {
  const suscripcion = getEmpresaSuscripcion(data);
  const estado = suscripcion.estadoSuscripcion;
  const expiresAt = suscripcion.expiraEl;
  const expiredByDate = Boolean(expiresAt && expiresAt.getTime() < Date.now());
  const paidPlanWithoutValidExpiry =
    suscripcion.nombrePlan !== "free" &&
    ["active", "trialing", "past_due"].includes(estado) &&
    !expiresAt;

  if (estado === "pending") {
    return {
      blocked: true,
      reason: "pendiente",
      expiresAt,
    };
  }

  if (estado === "expired" || paidPlanWithoutValidExpiry) {
    return {
      blocked: true,
      reason: "caducada",
      expiresAt,
    };
  }

  if (
    estado === "trialing" &&
    expiredByDate
  ) {
    return {
      blocked: true,
      reason: "prueba_vencida",
      expiresAt,
    };
  }

  if (
    ["active", "past_due"].includes(estado) &&
    (expiredByDate || estado === "past_due")
  ) {
    return {
      blocked: true,
      reason: "caducada",
      expiresAt,
    };
  }

  return EMPTY_SUBSCRIPTION_BLOCK;
}

export function formatSubscriptionBlockDate(value: Date | null) {
  if (!value) return null;
  try {
    return value.toLocaleDateString("es-CL");
  } catch {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

export function getSubscriptionBlockCopy(block: SubscriptionBlockState) {
  const formattedDate = formatSubscriptionBlockDate(block.expiresAt);

  if (block.reason === "pendiente") {
    return {
      title: "Pago pendiente de confirmación",
      description:
        "Estamos esperando la confirmación de Mercado Pago. Cuando el pago sea confirmado, tu acceso se actualizará automáticamente.",
      statusLabel: "Pendiente",
    };
  }

  if (block.reason === "prueba_vencida") {
    return {
      title: "Tu prueba finaliz\u00F3",
      description: formattedDate
        ? `Tu acceso termin\u00F3 el ${formattedDate}. Para seguir usando Passio, necesitamos reactivar tu cuenta.`
        : "Tu periodo de prueba termin\u00F3. Para seguir usando Passio, necesitamos reactivar tu cuenta.",
      statusLabel: "Prueba vencida",
    };
  }

  return {
    title: "Tu suscripci\u00F3n est\u00E1 caducada",
    description: formattedDate
      ? `Tu cuenta figura como caducada desde el ${formattedDate}. Escr\u00EDbenos para ayudarte a reactivarla.`
      : "Tu cuenta figura como caducada. Escr\u00EDbenos para ayudarte a reactivarla.",
    statusLabel: "Caducada",
  };
}
