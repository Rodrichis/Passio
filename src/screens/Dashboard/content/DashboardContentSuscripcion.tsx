import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../services/firebaseConfig";
import {
  cancelSubscription,
  createSubscription,
  getSubscriptionStatus,
  SubscriptionApiError,
  SubscriptionStatus,
  TipoPagoPlanCobro,
} from "../../../services/subscriptionsApi";

type Props = {
  onBack: () => void;
};

const MONTHLY_PRICE = "41.638 CLP";
const YEARLY_PRICE = "458.019 CLP";

type ActionState = "refresh" | "monthly" | "yearly" | "cancel" | null;

function parseEmpresaDate(value: any): string | null {
  if (!value) return null;

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  } catch {
    return null;
  }
}

function buildStatusFromEmpresa(empresaUid: string, data: any): SubscriptionStatus {
  const suscripcion = data?.suscripcion || {};

  return {
    empresaUid,
    plan: data?.plan ?? null,
    tipoPagoPlan: data?.tipoPagoPlan ?? null,
    estadoSuscripcion: suscripcion?.estadoSuscripcion ?? data?.estadoSuscripcion ?? null,
    expiraEl: parseEmpresaDate(suscripcion?.expiraEl ?? data?.expiraEl),
    trialTerminaEl: parseEmpresaDate(suscripcion?.trialTerminaEl),
    suscripcionOrigen: suscripcion?.suscripcionOrigen ?? null,
    mercadoPagoPreapprovalId: suscripcion?.mercadoPagoPreapprovalId ?? null,
    mercadoPagoPlanId: suscripcion?.mercadoPagoPlanId ?? null,
    mercadoPagoPreferenceId: suscripcion?.mercadoPagoPreferenceId ?? null,
    mercadoPagoPaymentId: suscripcion?.mercadoPagoPaymentId ?? null,
    ultimaSyncSuscripcion: parseEmpresaDate(suscripcion?.ultimaSyncSuscripcion),
    tieneAcceso: Boolean(
      parseEmpresaDate(suscripcion?.expiraEl ?? data?.expiraEl) &&
        new Date(parseEmpresaDate(suscripcion?.expiraEl ?? data?.expiraEl) as string).getTime() > Date.now()
    ),
  };
}

function formatDate(value?: string | null) {
  if (!value) return "--";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("es-CL");
  } catch {
    return "--";
  }
}

function formatStatus(value?: string | null) {
  const status = String(value || "").toLowerCase();

  switch (status) {
    case "trialing":
      return "Prueba activa";
    case "active":
      return "Activa";
    case "past_due":
      return "Pago pendiente";
    case "canceled":
      return "Cancelada";
    case "expired":
      return "Expirada";
    case "activa":
      return "Activa";
    case "prueba":
      return "Prueba";
    case "caducada":
      return "Caducada";
    case "inactiva":
      return "Inactiva";
    default:
      return value ? String(value) : "Sin suscripción";
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof SubscriptionApiError) {
    switch (error.code) {
      case "SUBSCRIPTION_ALREADY_EXISTS":
        return "Tu empresa ya tiene una suscripción de Mercado Pago en curso.";
      case "MISSING_PAYER_EMAIL":
        return "No encontramos un correo para crear la suscripción anual.";
      case "SUBSCRIPTION_NOT_FOUND":
        return "No encontramos una renovación mensual activa para cancelar.";
      case "AUTH_EMPRESA_MISMATCH":
        return "La cuenta actual no coincide con la empresa solicitada.";
      case "EMPRESA_NOT_FOUND":
        return "No encontramos la empresa asociada a esta cuenta.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) return error.message;
  return "No fue posible completar la acción. Intenta nuevamente.";
}

function isMercadoPagoSubscription(status: SubscriptionStatus | null) {
  return (
    status?.suscripcionOrigen === "mercadopago" &&
    Boolean(status.mercadoPagoPreapprovalId) &&
    status.estadoSuscripcion !== "expired"
  );
}

function canCancelSubscription(status: SubscriptionStatus | null) {
  return (
    status?.suscripcionOrigen === "mercadopago" &&
    Boolean(status.mercadoPagoPreapprovalId) &&
    ["active", "past_due"].includes(String(status.estadoSuscripcion || ""))
  );
}

function canCreateNewSubscription(status: SubscriptionStatus | null) {
  const state = String(status?.estadoSuscripcion || "").toLowerCase();
  const plan = String(status?.plan || "").toLowerCase();

  if (plan === "pro" && status?.tieneAcceso) {
    return false;
  }

  if (
    status?.tieneAcceso &&
    ["active", "activa", "trialing", "prueba", "canceled", "cancelada"].includes(state)
  ) {
    return false;
  }

  if (
    status?.mercadoPagoPreapprovalId &&
    ["active", "past_due", "canceled"].includes(state)
  ) {
    return false;
  }

  return true;
}

function isYearlyCheckout(status: SubscriptionStatus | null) {
  return (
    status?.suscripcionOrigen === "mercadopago" &&
    status?.tipoPagoPlan === "pro_yearly" &&
    Boolean(status.mercadoPagoPreferenceId || status.mercadoPagoPaymentId)
  );
}

async function openCheckoutUrl(checkoutUrl: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.href = checkoutUrl;
    return;
  }

  await Linking.openURL(checkoutUrl);
}

export default function DashboardContentSuscripcion({ onBack }: Props) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionState>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const uid = auth.currentUser?.uid || "";
  const userEmail = auth.currentUser?.email || "";
  const isWeb = Platform.OS === "web";
  const compact = width < 820;

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setError("Debes iniciar sesión para gestionar la suscripción.");
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "Empresas", uid),
      (snap) => {
        if (snap.exists()) {
          setStatus(buildStatusFromEmpresa(uid, snap.data()));
        }
        setLoading(false);
      },
      (snapshotError) => {
        console.log("No se pudo leer estado de suscripción:", snapshotError);
        setLoading(false);
        setError("No pudimos leer el estado de la suscripción.");
      }
    );

    return unsubscribe;
  }, [uid]);

  const isPro = Boolean(
    String(status?.plan || "").toLowerCase() === "pro" && status?.tieneAcceso
  );
  const canCreate = canCreateNewSubscription(status);
  const canCancel = canCancelSubscription(status);
  const hasCanceledAccess =
    status?.estadoSuscripcion === "canceled" && status.tieneAcceso;

  const statusAccent = useMemo(() => {
    const state = String(status?.estadoSuscripcion || "").toLowerCase();
    if (status?.tieneAcceso && state !== "past_due") return "#087C94";
    if (state === "past_due" || state === "canceled") return "#C77700";
    if (state === "expired" || state === "caducada") return "#C62828";
    return "#607381";
  }, [status]);

  const refreshStatus = async () => {
    if (!uid) return;
    setAction("refresh");
    setError(null);
    setNotice(null);

    try {
      const result = await getSubscriptionStatus(uid);
      setStatus(result);
      setNotice("Estado actualizado correctamente.");
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    } finally {
      setAction(null);
    }
  };

  const startPayment = async (tipoPagoPlan: TipoPagoPlanCobro) => {
    if (!isWeb) {
      setError("La contratación de suscripción está disponible desde la versión web.");
      return;
    }

    if (!uid) return;
    setAction(tipoPagoPlan === "pro_monthly" ? "monthly" : "yearly");
    setRedirecting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await createSubscription({
        empresaUid: uid,
        tipoPagoPlan,
        correoElectronico: userEmail,
      });
      setNotice("Te estamos redirigiendo a Mercado Pago.");
      await openCheckoutUrl(result.checkoutUrl);
    } catch (paymentError) {
      setRedirecting(false);
      setError(getErrorMessage(paymentError));
    } finally {
      setAction(null);
    }
  };

  const confirmCancel = () => {
    if (!canCancel) return;

    const runCancel = async () => {
      setAction("cancel");
      setError(null);
      setNotice(null);

      try {
        const result = await cancelSubscription(uid);
        setStatus(result);
        setNotice("Renovación mensual cancelada. Mantendrás acceso hasta la fecha indicada.");
      } catch (cancelError) {
        setError(getErrorMessage(cancelError));
      } finally {
        setAction(null);
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm(
        "¿Deseas cancelar la renovación mensual? Mantendrás acceso hasta la fecha indicada."
      );
      if (ok) runCancel();
      return;
    }

    Alert.alert(
      "Cancelar renovación",
      "¿Deseas cancelar la renovación mensual? Mantendrás acceso hasta la fecha indicada.",
      [
        { text: "Volver", style: "cancel" },
        { text: "Cancelar renovación", style: "destructive", onPress: runCancel },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando suscripción...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {redirecting ? (
        <View style={styles.redirectOverlay}>
          <View style={styles.redirectCard}>
            <View style={styles.redirectIcon}>
              <ActivityIndicator size="small" color="#023047" />
            </View>
            <Text style={styles.redirectTitle}>Te estamos redirigiendo a Mercado Pago</Text>
            <Text style={styles.redirectText}>No cierres esta ventana.</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={20} color="#023047" />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Suscripción</Text>
          <Text style={styles.subtitle}>
            Gestiona tu acceso Pro con Mercado Pago desde la versión web.
          </Text>
        </View>
      </View>

      <View style={[styles.statusCard, compact && styles.statusCardCompact]}>
        <View style={[styles.statusIcon, { backgroundColor: `${statusAccent}16` }]}>
          <Ionicons name="shield-checkmark-outline" size={24} color={statusAccent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.statusLabel}>Estado actual</Text>
          <Text style={[styles.statusValue, { color: statusAccent }]}>
            {isPro ? "Pro" : "Free"} · {formatStatus(status?.estadoSuscripcion)}
          </Text>
          <Text style={styles.statusMeta}>Expira el: {formatDate(status?.expiraEl)}</Text>
          {hasCanceledAccess ? (
            <Text style={styles.statusNote}>
              La renovación está cancelada, pero el acceso sigue vigente hasta la fecha indicada.
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={refreshStatus}
          disabled={action !== null}
          style={[styles.refreshButton, action === "refresh" && styles.disabledButton]}
        >
          {action === "refresh" ? (
            <ActivityIndicator size="small" color="#0A6F88" />
          ) : (
            <Ionicons name="refresh-outline" size={18} color="#0A6F88" />
          )}
          <Text style={styles.refreshText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#B42318" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {notice ? (
        <View style={styles.noticeBox}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#087C94" />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {!isWeb ? (
        <View style={styles.mobileNotice}>
          <Ionicons name="desktop-outline" size={22} color="#0A6F88" />
          <View style={{ flex: 1 }}>
            <Text style={styles.mobileNoticeTitle}>Gestión disponible en web</Text>
            <Text style={styles.mobileNoticeText}>
              Desde Android o iOS puedes ver el estado. Para contratar o cancelar, ingresa desde la versión web.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.compareRow, compact && styles.compareRowCompact]}>
        <PlanComparisonCard
          title="Free"
          icon="leaf-outline"
          tone="muted"
          current={!isPro}
          description="Para empezar y probar Passio con funciones limitadas."
          items={[
            "Clientes y uso limitado",
            "Configuración básica",
            "Acceso ideal para pruebas",
          ]}
        />
        <PlanComparisonCard
          title="Pro"
          icon="rocket-outline"
          tone="pro"
          current={isPro}
          description="Para operar Passio completo con tu empresa."
          items={[
            "Más capacidad para clientes",
            "Notificaciones y georeferencia",
            "Estadísticas y funciones avanzadas",
          ]}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Planes Pro</Text>
        <Text style={styles.sectionSubtitle}>
          El acceso se activa cuando Mercado Pago confirma el pago.
        </Text>
      </View>

      <View style={[styles.planRow, compact && styles.planRowCompact]}>
        <PaymentPlanCard
          title="Pro mensual"
          price={`$${MONTHLY_PRICE}`}
          period="/ mes"
          description="Pago mensual automático. Puedes cancelar la renovación cuando lo necesites."
          icon="calendar-outline"
          disabled={!isWeb || !canCreate || action !== null}
          loading={action === "monthly"}
          buttonText="Pagar mensual"
          onPress={() => startPayment("pro_monthly")}
        />
        <PaymentPlanCard
          title="Pro anual"
          price={`$${YEARLY_PRICE}`}
          period="/ año"
          description="Pago único por 12 meses. Incluye un mes gratis frente al pago mensual."
          icon="trophy-outline"
          badge="1 mes gratis"
          highlighted
          disabled={!isWeb || !canCreate || action !== null}
          loading={action === "yearly"}
          buttonText="Pagar anual"
          onPress={() => startPayment("pro_yearly")}
        />
      </View>

      {!canCreate ? (
        <Text style={styles.helperText}>
          Ya existe un plan Pro activo asociado a esta empresa.
        </Text>
      ) : null}

      <View style={styles.managementCard}>
        <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.managementTitle}>Renovación</Text>
        <Text style={styles.managementText}>
            {isMercadoPagoSubscription(status)
              ? "Puedes cancelar la renovación automática mensual. El acceso vigente se mantiene hasta la fecha de expiración."
              : isYearlyCheckout(status)
                ? "El plan anual es un pago único por 12 meses. No tiene renovación automática para cancelar."
                : "No hay una renovación mensual activa para cancelar."}
          </Text>
        </View>
        <TouchableOpacity
          onPress={confirmCancel}
          disabled={!isWeb || !canCancel || action !== null}
          style={[
            styles.cancelButton,
            (!isWeb || !canCancel || action !== null) && styles.disabledCancelButton,
          ]}
        >
          {action === "cancel" ? (
            <ActivityIndicator size="small" color="#A94700" />
          ) : (
            <Ionicons name="close-circle-outline" size={18} color={!isWeb || !canCancel ? "#8AA0AE" : "#A94700"} />
          )}
          <Text style={[styles.cancelText, (!isWeb || !canCancel) && { color: "#8AA0AE" }]}>
            Cancelar renovación
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PlanComparisonCard({
  title,
  description,
  icon,
  items,
  current,
  tone,
}: {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: string[];
  current: boolean;
  tone: "muted" | "pro";
}) {
  const accent = tone === "pro" ? "#0A6F88" : "#607381";
  const bg = tone === "pro" ? "#E8F7FB" : "#F7FBFF";

  return (
    <View style={[styles.comparisonCard, current && styles.currentCard]}>
      <View style={styles.comparisonHeader}>
        <View style={[styles.comparisonIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={22} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.comparisonTitle}>{title}</Text>
          {current ? <Text style={styles.currentBadge}>Plan actual</Text> : null}
        </View>
      </View>
      <Text style={styles.comparisonDescription}>{description}</Text>
      <View style={{ gap: 8 }}>
        {items.map((item) => (
          <View key={item} style={styles.featureRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={accent} />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PaymentPlanCard({
  title,
  price,
  period,
  description,
  icon,
  badge,
  highlighted = false,
  disabled,
  loading,
  buttonText,
  onPress,
}: {
  title: string;
  price: string;
  period: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  badge?: string;
  highlighted?: boolean;
  disabled: boolean;
  loading: boolean;
  buttonText: string;
  onPress: () => void;
}) {
  return (
    <View style={[styles.paymentCard, highlighted && styles.paymentCardHighlighted]}>
      <View style={styles.paymentHeader}>
        <View style={[styles.paymentIcon, highlighted && styles.paymentIconHighlighted]}>
          <Ionicons name={icon} size={22} color={highlighted ? "#6C4B00" : "#0A6F88"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentTitle}>{title}</Text>
          {badge ? <Text style={styles.paymentBadge}>{badge}</Text> : null}
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.period}>{period}</Text>
      </View>
      <Text style={styles.paymentDescription}>{description}</Text>

      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.payButton,
          highlighted && styles.payButtonHighlighted,
          disabled && styles.disabledButton,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={highlighted ? "#023047" : "#FFFFFF"} />
        ) : (
          <Ionicons name="card-outline" size={18} color={highlighted ? "#023047" : "#FFFFFF"} />
        )}
        <Text style={[styles.payButtonText, highlighted && { color: "#023047" }]}>
          {buttonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  redirectOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(2, 48, 71, 0.22)",
  },
  redirectCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D7E7EF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingVertical: 24,
    shadowColor: "#0F3554",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 12,
  },
  redirectIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "#FFB703",
  },
  redirectTitle: {
    color: "#023047",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  redirectText: {
    color: "#607381",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  loadingText: {
    color: "#4F6470",
    fontSize: 15,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerRowCompact: {
    alignItems: "flex-start",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEAF5",
  },
  title: {
    color: "#023047",
    fontSize: 26,
    fontWeight: "900",
  },
  subtitle: {
    color: "#4F6470",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE8F0",
    shadowColor: "#103B5C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  statusCardCompact: {
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    color: "#607381",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusValue: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3,
  },
  statusMeta: {
    color: "#4F6470",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  statusNote: {
    color: "#8A5A00",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F7FBFF",
    borderWidth: 1,
    borderColor: "#DCEAF5",
  },
  refreshText: {
    color: "#0A6F88",
    fontSize: 13,
    fontWeight: "900",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FFF1F0",
    borderWidth: 1,
    borderColor: "#FFD0CC",
  },
  errorText: {
    color: "#B42318",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#E8F7FB",
    borderWidth: 1,
    borderColor: "#BEE7F1",
  },
  noticeText: {
    color: "#075D70",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  mobileNotice: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#F3C27A",
  },
  mobileNoticeTitle: {
    color: "#6C4B00",
    fontSize: 15,
    fontWeight: "900",
  },
  mobileNoticeText: {
    color: "#7A5A10",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 19,
  },
  compareRow: {
    flexDirection: "row",
    gap: 16,
  },
  compareRowCompact: {
    flexDirection: "column",
  },
  comparisonCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE8F0",
    gap: 14,
  },
  currentCard: {
    borderColor: "#0A6F88",
    backgroundColor: "#F7FCFF",
  },
  comparisonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  comparisonIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonTitle: {
    color: "#023047",
    fontSize: 20,
    fontWeight: "900",
  },
  currentBadge: {
    color: "#087C94",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  comparisonDescription: {
    color: "#4F6470",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    color: "#365263",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#023047",
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#4F6470",
    fontSize: 14,
    fontWeight: "700",
  },
  planRow: {
    flexDirection: "row",
    gap: 16,
  },
  planRowCompact: {
    flexDirection: "column",
  },
  paymentCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: "#DDE8F0",
    gap: 14,
    shadowColor: "#103B5C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  paymentCardHighlighted: {
    borderColor: "#FFB703",
    backgroundColor: "#FFFCF2",
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F7FB",
  },
  paymentIconHighlighted: {
    backgroundColor: "#FFF0C7",
  },
  paymentTitle: {
    color: "#023047",
    fontSize: 20,
    fontWeight: "900",
  },
  paymentBadge: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: "hidden",
    color: "#6C4B00",
    backgroundColor: "#FFE3A3",
    fontSize: 11,
    fontWeight: "900",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    flexWrap: "wrap",
  },
  price: {
    color: "#023047",
    fontSize: 30,
    fontWeight: "900",
  },
  period: {
    color: "#607381",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  paymentDescription: {
    color: "#4F6470",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  payButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#0A6F88",
  },
  payButtonHighlighted: {
    backgroundColor: "#FFB703",
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  helperText: {
    color: "#607381",
    fontSize: 13,
    fontWeight: "700",
  },
  managementCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE8F0",
  },
  managementTitle: {
    color: "#023047",
    fontSize: 18,
    fontWeight: "900",
  },
  managementText: {
    color: "#4F6470",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#F3C27A",
  },
  disabledCancelButton: {
    backgroundColor: "#F3F7FA",
    borderColor: "#D8E4EE",
  },
  cancelText: {
    color: "#A94700",
    fontSize: 13,
    fontWeight: "900",
  },
});
