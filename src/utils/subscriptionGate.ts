import { ESTADO_SUSCRIPCION } from "../constants/empresa";

export type SubscriptionBlockReason = "caducada" | "prueba_vencida" | null;

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

export function resolveSubscriptionBlock(data: any): SubscriptionBlockState {
  const estado = String(data?.estadoSuscripcion || "")
    .trim()
    .toLowerCase();
  const expiresAt = normalizeEmpresaDate(data?.expiraEl);
  const expiredByDate = Boolean(expiresAt && expiresAt.getTime() < Date.now());

  if (estado === ESTADO_SUSCRIPCION.CADUCADA || estado === "expired") {
    return {
      blocked: true,
      reason: "caducada",
      expiresAt,
    };
  }

  if (
    (estado === ESTADO_SUSCRIPCION.PRUEBA || estado === "trialing") &&
    expiredByDate
  ) {
    return {
      blocked: true,
      reason: "prueba_vencida",
      expiresAt,
    };
  }

  if (
    ["active", "past_due", "canceled"].includes(estado) &&
    expiredByDate
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
