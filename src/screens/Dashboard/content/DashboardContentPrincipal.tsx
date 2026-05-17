import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  Linking,
  Modal,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import DashboardViewHeader from "../../../components/dashboard/DashboardViewHeader";
import RegistrationQrModal from "../../../components/registration/RegistrationQrModal";
import { auth, db } from "../../../services/firebaseConfig";
import { buildRegistrationUrl } from "../../../utils/publicUrls";
import {
  collection,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
  doc,
} from "firebase/firestore";
import { useIsFocused } from "@react-navigation/native";
import { mapDoc } from "../../../utils/clientesHelpers";

type ActivityItem = {
  title: string;
  subtitle?: string;
  date?: Date | null;
  type: "alta" | "otros";
};

type HighlightClient = {
  name: string;
  visits: number;
};

type LatestNotification = {
  date: Date | null;
  totalRecipients: number;
  messagePreview: string;
};

type ClientWithBirthday = ReturnType<typeof mapDoc> & {
  fechaNacimiento: Date | null;
};

type BirthdayClient = {
  id: string;
  name: string;
};

type Props = {
  goToClientes?: () => void;
  companyName?: string;
  onOpenBirthdayGreeting?: (clientIds: string[], message: string) => void;
  onOpenNotificationHistory?: () => void;
  onOpenNotificationComposer?: () => void;
};

export default function DashboardContentPrincipal({
  goToClientes,
  companyName,
  onOpenBirthdayGreeting,
  onOpenNotificationHistory,
  onOpenNotificationComposer,
}: Props) {
  const uid = auth.currentUser?.uid;
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 900;
  const isCompactWeb = Platform.OS === "web" && isCompactLayout;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [totalClientes, setTotalClientes] = React.useState<number | null>(null);
  const [nuevosSemana, setNuevosSemana] = React.useState<number | null>(null);
  const [androidCount, setAndroidCount] = React.useState<number | null>(null);
  const [iosCount, setIosCount] = React.useState<number | null>(null);
  const [puntosHoy, setPuntosHoy] = React.useState<number | null>(null);
  const [actividad, setActividad] = React.useState<ActivityItem[]>([]);
  const [limiteUsuarios, setLimiteUsuarios] = React.useState<number | null>(null);
  const [atUserLimit, setAtUserLimit] = React.useState(false);
  const [registrationUrl, setRegistrationUrl] = React.useState("");
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [birthdayClients, setBirthdayClients] = React.useState<BirthdayClient[]>([]);
  const [topVisitedClient, setTopVisitedClient] = React.useState<HighlightClient | null>(null);
  const [lastNotification, setLastNotification] = React.useState<LatestNotification | null>(null);
  const [showBirthdayModal, setShowBirthdayModal] = React.useState(false);
  const [showLastNotificationModal, setShowLastNotificationModal] = React.useState(false);

  const registroURL = registrationUrl || buildRegistrationUrl(uid);

  React.useEffect(() => {
    const fetchStats = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const col = collection(db, "Empresas", uid, "Clientes");
        let planName: string | null = null;

        try {
          const empSnap = await getDoc(doc(db, "Empresas", uid));
          if (empSnap.exists()) {
            const empresaData = empSnap.data() as any;
            planName = empresaData?.plan || null;
            const savedRegistrationUrl =
              typeof empresaData?.LinkRegistro === "string" ? empresaData.LinkRegistro.trim() : "";

            if (savedRegistrationUrl) {
              setRegistrationUrl(savedRegistrationUrl);
            }
          }
        } catch {}

        let limitePlan: number | null = null;
        if (planName) {
          try {
            const planSnap = await getDocs(
              query(collection(db, "Planes"), where("nombrePlan", "==", planName))
            );
            const first = planSnap.docs[0];
            if (first) {
              const data = first.data() as any;
              if (typeof data.limiteUsuarios === "number") {
                limitePlan = data.limiteUsuarios;
              }
            }
          } catch {}
        }
        setLimiteUsuarios(limitePlan);

        const allClientsSnap = await getDocs(col);
        const allClients: ClientWithBirthday[] = allClientsSnap.docs.map((clientDoc) => {
          const cliente = mapDoc(clientDoc);
          const data = clientDoc.data() || {};
          const rawBirthday = data.fechaNacimiento;
          const fechaNacimiento =
            rawBirthday?.toDate?.() ||
            (rawBirthday instanceof Timestamp
              ? rawBirthday.toDate()
              : rawBirthday instanceof Date
                ? rawBirthday
                : null);

          return {
            ...cliente,
            fechaNacimiento,
          };
        });

        const totalCount = allClients.length;
        setTotalClientes(totalCount);

        const limitNum =
          typeof limitePlan === "number"
            ? limitePlan
            : limitePlan != null
              ? parseInt(String(limitePlan), 10)
              : null;
        const hasLimit = limitNum != null && !isNaN(limitNum);
        setAtUserLimit(hasLimit ? totalCount >= limitNum : false);

        const androidTotal = allClients.filter(
          (client) => String(client.so || "").toLowerCase() === "android"
        ).length;
        const iosTotal = allClients.filter(
          (client) => String(client.so || "").toLowerCase() === "ios"
        ).length;
        setAndroidCount(androidTotal);
        setIosCount(iosTotal);

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const nuevosUltimos7Dias = allClients.filter((client) => {
          return client.creadoEn instanceof Date && client.creadoEn.getTime() > oneWeekAgo.getTime();
        }).length;
        setNuevosSemana(nuevosUltimos7Dias);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const visitasRegistradasHoy = allClients.filter((client) => {
          return client.ultimaVisita instanceof Date && client.ultimaVisita.getTime() > startOfDay.getTime();
        }).length;
        setPuntosHoy(visitasRegistradasHoy);

        const birthdaysToday = allClients
          .filter((client) => {
            return (
              client.fechaNacimiento instanceof Date &&
              client.fechaNacimiento.getMonth() === startOfDay.getMonth() &&
              client.fechaNacimiento.getDate() === startOfDay.getDate()
            );
          })
          .map((client) => ({
            id: client.id,
            name: client.nombreCompleto || "Cliente sin nombre",
          }));
        setBirthdayClients(birthdaysToday);

        const topVisited = allClients.reduce<HighlightClient | null>((best, client) => {
          const visits = Number(client.visitasTotales ?? 0);
          if (!best || visits > best.visits) {
            return {
              name: client.nombreCompleto || "Cliente sin nombre",
              visits,
            };
          }
          return best;
        }, null);
        setTopVisitedClient(topVisited);

        const recent = allClients
          .slice()
          .sort((a, b) => {
            const aTime = a.creadoEn instanceof Date ? a.creadoEn.getTime() : 0;
            const bTime = b.creadoEn instanceof Date ? b.creadoEn.getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 5)
          .map((client) => ({
            title: client.nombreCompleto || "Nuevo cliente",
            subtitle: client.email || "",
            date: client.creadoEn || null,
            type: "alta" as const,
          }));
        setActividad(recent);

        try {
          const latestNotificationSnap = await getDocs(
            query(
              collection(db, "Empresas", uid, "HistorialNotificaciones"),
              orderBy("fechaEnvio", "desc"),
              limit(1)
            )
          );

          const firstNotification = latestNotificationSnap.docs[0];
          if (!firstNotification) {
            setLastNotification(null);
          } else {
            const notificationData = firstNotification.data() || {};
            const rawDate = notificationData.fechaEnvio;
            const date =
              rawDate?.toDate?.() ||
              (rawDate instanceof Timestamp
                ? rawDate.toDate()
                : rawDate instanceof Date
                  ? rawDate
                  : null);
            const totalRecipients = Number(notificationData.totalClientes ?? 0);
            const messagePreview =
              typeof notificationData.mensaje === "string" ? notificationData.mensaje.trim() : "";

            setLastNotification({
              date,
              totalRecipients: Number.isFinite(totalRecipients) ? totalRecipients : 0,
              messagePreview,
            });
          }
        } catch {
          setLastNotification(null);
        }
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar las metricas.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [uid, isFocused]);

  const formatDate = (d?: Date | null) => {
    if (!d) return "";
    try {
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  };

  const formatDateOnly = (d?: Date | null) => {
    if (!d) return "--";
    try {
      return d.toLocaleDateString("es-CL");
    } catch {
      return "--";
    }
  };

  const formatTimeOnly = (d?: Date | null) => {
    if (!d) return "--";
    try {
      const base = d.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${base} hrs`;
    } catch {
      return "--";
    }
  };

  const handleOpenBirthdayGreeting = () => {
    const ids = birthdayClients.map((client) => client.id).filter(Boolean);
    if (!ids.length) return;

    setShowBirthdayModal(false);
    onOpenBirthdayGreeting?.(ids, "¡Feliz cumpleaños! Te deseamos un gran día.");
  };

  const handleOpenNotificationHistory = () => {
    setShowLastNotificationModal(false);
    onOpenNotificationHistory?.();
  };

  const handleOpenNotificationComposer = () => {
    setShowLastNotificationModal(false);
    onOpenNotificationComposer?.();
  };

  const birthdayNames = birthdayClients.map((client) => client.name);

  const highlightCards = [
    birthdayClients.length > 0
      ? {
          key: "birthday",
          title: "Cumpleaños hoy",
          primary: String(birthdayNames.length),
          secondary: birthdayNames.join(", "),
          icon: "gift-outline" as const,
          iconColor: "#7C3AED",
          iconBg: "#F3E8FF",
          primaryColor: "#6D28D9",
          onPress: () => setShowBirthdayModal(true),
        }
      : null,
    {
      key: "top",
      title: "Cliente con mas visitas",
      primary: loading ? "..." : topVisitedClient?.name || "Sin clientes",
      secondary: loading
        ? "Cargando..."
        : topVisitedClient
          ? `${topVisitedClient.visits} visitas en total`
          : "Aun no hay clientes registrados",
      icon: "trophy-outline" as const,
      iconColor: "#16A34A",
      iconBg: "#E8F7EE",
      primaryColor: "#16A34A",
    },
    {
      key: "notification",
      title: "Ultima notificación",
      primary: loading
        ? "..."
        : lastNotification?.date
          ? formatDateOnly(lastNotification.date)
          : "Sin notificaciones",
      secondary: loading
        ? "Cargando..."
        : lastNotification?.date
          ? formatTimeOnly(lastNotification.date)
          : "Aun no envias notificaciones",
      icon: "notifications-outline" as const,
      iconColor: "#2563EB",
      iconBg: "#E8F1FF",
      primaryColor: "#2563EB",
      onPress: () => setShowLastNotificationModal(true),
    },
  ].filter(Boolean) as Array<{
    key: string;
    title: string;
    primary: string;
    secondary: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    iconColor: string;
    iconBg: string;
    primaryColor: string;
    onPress?: () => void;
  }>;

  const highlightCardBasis = isCompactLayout ? "48%" : highlightCards.length === 2 ? "48%" : "31%";

  return (
    <ScrollView>
      <DashboardViewHeader title="Principal" companyName={companyName} />

      <Text style={styles.sectionTitle}>Link de registro de clientes</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e0e0e0",
          borderRadius: 8,
          padding: 12,
          backgroundColor: "#fff",
          marginBottom: 16,
        }}
      >
        <Text selectable style={{ color: "#333", marginBottom: 10 }}>
          {registroURL}
        </Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => registroURL && Linking.openURL(registroURL)}
            style={{
              backgroundColor: "#2196F3",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 5,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
              Abrir navegador
            </Text>
          </TouchableOpacity>

          {Platform.OS === "web" &&
            typeof navigator !== "undefined" &&
            (navigator as any).clipboard && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (registroURL) {
                      await (navigator as any).clipboard.writeText(registroURL);
                      alert("Link copiado");
                    }
                  } catch (e) {
                    console.log(e);
                  }
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#2196F3",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 5,
                  backgroundColor: "#E3F2FD",
                }}
              >
                <Text style={{ color: "#0D47A1", fontWeight: "bold", fontSize: 14 }}>
                  Copiar
                </Text>
              </TouchableOpacity>
            )}

          <TouchableOpacity
            onPress={() => setShowQrModal(true)}
            style={{
              borderWidth: 1,
              borderColor: "#fb8500",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 5,
              backgroundColor: "#fb8500",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
              Ver QR
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <RegistrationQrModal
        visible={showQrModal}
        value={registroURL}
        fileName={`qr-registro-${uid || "empresa"}.png`}
        onClose={() => setShowQrModal(false)}
      />

      <Modal visible={showBirthdayModal} transparent animationType="fade" onRequestClose={() => setShowBirthdayModal(false)}>
        <View style={modalStyles.backdrop}>
          <Pressable style={modalStyles.dismissLayer} onPress={() => setShowBirthdayModal(false)} />
          <View style={modalStyles.card}>
            <View style={modalStyles.headerRow}>
              <Text style={modalStyles.title}>Cumpleaños de hoy</Text>
              <TouchableOpacity onPress={() => setShowBirthdayModal(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            <Text style={modalStyles.text}>
              Estas personas estan de cumpleaños hoy. Puedes enviarles un saludo.
            </Text>

            <View style={modalStyles.listBox}>
              {birthdayClients.map((client) => (
                <Text key={client.id} style={modalStyles.listItem}>
                  {client.name}
                </Text>
              ))}
            </View>

            <View style={modalStyles.actions}>
              <TouchableOpacity onPress={() => setShowBirthdayModal(false)} style={modalStyles.secondaryButton}>
                <Text style={modalStyles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleOpenBirthdayGreeting} style={modalStyles.primaryButton}>
                <Text style={modalStyles.primaryButtonText}>Enviar saludo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLastNotificationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLastNotificationModal(false)}
      >
        <View style={modalStyles.backdrop}>
          <Pressable style={modalStyles.dismissLayer} onPress={() => setShowLastNotificationModal(false)} />
          <View style={modalStyles.card}>
            <View style={modalStyles.headerRow}>
              <Text style={modalStyles.title}>Ultima notificación</Text>
              <TouchableOpacity onPress={() => setShowLastNotificationModal(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            {isCompactWeb ? (
              <>
                <View>
                  <Text style={modalStyles.detailLabel}>Fecha</Text>
                  <Text style={modalStyles.detailValue}>
                    {lastNotification?.date ? formatDateOnly(lastNotification.date) : "Sin notificaciones"}
                  </Text>
                  <Text style={modalStyles.detailLabel}>Destinatarios</Text>
                  <Text style={modalStyles.detailValue}>
                    {lastNotification?.date ? String(lastNotification.totalRecipients) : "0"}
                  </Text>
                </View>

                <View style={[modalStyles.previewBox, { marginTop: 16 }]}>
                  <Text style={modalStyles.previewLabel}>Vista previa</Text>
                  <Text numberOfLines={4} ellipsizeMode="tail" style={modalStyles.previewText}>
                    {lastNotification?.messagePreview
                      ? lastNotification.messagePreview
                      : "Sin mensaje disponible."}
                  </Text>
                </View>
              </>
            ) : (
              <View
                style={{
                  flexDirection: isCompactLayout ? "column" : "row",
                  alignItems: isCompactLayout ? "stretch" : "flex-start",
                  gap: 14,
                }}
              >
                <View style={{ flex: isCompactLayout ? 0 : 1 }}>
                  <Text style={modalStyles.detailLabel}>Fecha</Text>
                  <Text style={modalStyles.detailValue}>
                    {lastNotification?.date ? formatDateOnly(lastNotification.date) : "Sin notificaciones"}
                  </Text>
                  <Text style={modalStyles.detailLabel}>Destinatarios</Text>
                  <Text style={modalStyles.detailValue}>
                    {lastNotification?.date ? String(lastNotification.totalRecipients) : "0"}
                  </Text>
                </View>

                <View
                  style={[
                    modalStyles.previewBox,
                    !isCompactLayout && { flex: 1.2, minWidth: 0, marginTop: 10 },
                  ]}
                >
                  <Text style={modalStyles.previewLabel}>Vista previa</Text>
                  <Text
                    numberOfLines={isCompactLayout ? 4 : 5}
                    ellipsizeMode="tail"
                    style={modalStyles.previewText}
                  >
                    {lastNotification?.messagePreview
                      ? lastNotification.messagePreview
                      : "Sin mensaje disponible."}
                  </Text>
                </View>
              </View>
            )}

            <View style={modalStyles.actions}>
              <TouchableOpacity onPress={handleOpenNotificationHistory} style={modalStyles.secondaryButton}>
                <Text style={modalStyles.secondaryButtonText}>Ver historial</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleOpenNotificationComposer} style={modalStyles.primaryButton}>
                <Text style={modalStyles.primaryButtonText}>Nueva notificacion</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Actividad destacada</Text>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {highlightCards.map((card) => (
          <HighlightCard
            key={card.key}
            title={card.title}
            primary={card.primary}
            secondary={card.secondary}
            icon={card.icon}
            iconColor={card.iconColor}
            iconBg={card.iconBg}
            primaryColor={card.primaryColor}
            basis={highlightCardBasis}
            compact={isCompactLayout}
            onPress={card.onPress}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Resumen de clientes</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <MetricCard
          label="Clientes totales"
          value={totalClientes}
          loading={loading}
          note={`Android: ${androidCount ?? 0} · iOS: ${iosCount ?? 0}`}
          warning={atUserLimit ? "Alcanzaste el limite." : undefined}
        />
        <MetricCard label="Nuevos 7 dias" value={nuevosSemana} loading={loading} />
        <MetricCard
          label="Visitas registradas hoy"
          value={puntosHoy ?? 0}
          loading={loading}
          note="Clientes con ultima visita marcada hoy"
        />
      </View>

      <TouchableOpacity
        onPress={goToClientes}
        style={{
          alignSelf: "flex-start",
          backgroundColor: "#2196F3",
          paddingVertical: 7,
          paddingHorizontal: 11,
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
          Ver clientes
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Actividad reciente</Text>
      {actividad.length === 0 && !loading ? (
        <Text style={{ color: "#555", marginBottom: 16 }}>Sin actividad aun.</Text>
      ) : (
        actividad.map((item, idx) => (
          <View
            key={`${item.title}-${idx}`}
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: "#e0e0e0",
              marginBottom: 10,
            }}
          >
            <Text style={{ fontWeight: "bold", color: "#023047" }}>{item.title}</Text>
            {item.subtitle ? <Text style={{ color: "#555" }}>{item.subtitle}</Text> : null}
            <Text style={{ color: "#777", fontSize: 12 }}>{formatDate(item.date)}</Text>
            <Text style={{ color: "#2196F3", fontSize: 12, marginTop: 4 }}>
              {item.type === "alta" ? "Registro de cliente" : "Actividad"}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  loading,
  note,
  warning,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  note?: string;
  warning?: string;
}) {
  return (
    <View
      style={{
        flexBasis: "30%",
        flexGrow: 1,
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        minWidth: 160,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 13, color: "#555" }}>{label}</Text>
        {warning ? <Text style={{ fontSize: 11, color: "#c62828" }}>{warning}</Text> : null}
      </View>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#023047" }}>
        {loading ? "..." : value ?? "0"}
      </Text>
      {note ? <Text style={{ fontSize: 11, color: "#888" }}>{note}</Text> : null}
    </View>
  );
}

function HighlightCard({
  title,
  primary,
  secondary,
  icon,
  iconColor,
  iconBg,
  primaryColor,
  basis,
  compact,
  onPress,
}: {
  title: string;
  primary: string;
  secondary: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBg: string;
  primaryColor: string;
  basis: string;
  compact?: boolean;
  onPress?: () => void;
}) {
  const showChevron = typeof onPress === "function";
  const Container = showChevron ? TouchableOpacity : View;
  const containerProps = showChevron ? { activeOpacity: 0.92, onPress } : {};

  if (compact) {
    return (
      <Container
        {...containerProps}
        style={{
          flexBasis: basis as any,
          flexGrow: 1,
          minWidth: 0,
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 12,
          borderWidth: 1,
          borderColor: "#E7EDF1",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ color: "#51616F", fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 17 }}
          >
            {title}
          </Text>
          {showChevron ? <Ionicons name="chevron-forward-outline" size={16} color="#A3B1BA" /> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={22} color={iconColor} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{ color: primaryColor, fontSize: 16, fontWeight: "800", lineHeight: 20 }}
            >
              {primary}
            </Text>
            <Text
              numberOfLines={3}
              ellipsizeMode="tail"
              style={{ color: "#51616F", fontSize: 12, lineHeight: 17, marginTop: 4 }}
            >
              {secondary}
            </Text>
          </View>
        </View>
      </Container>
    );
  }

  return (
    <Container
      {...containerProps}
      style={{
        flexBasis: basis as any,
        flexGrow: 1,
        minWidth: 160,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E7EDF1",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#51616F", fontSize: 13, fontWeight: "700" }}>{title}</Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: primaryColor, fontSize: 18, fontWeight: "800", marginTop: 4 }}
          >
            {primary}
          </Text>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ color: "#51616F", fontSize: 13, lineHeight: 19, marginTop: 4 }}
          >
            {secondary}
          </Text>
        </View>

        {showChevron ? <Ionicons name="chevron-forward-outline" size={18} color="#A3B1BA" /> : null}
      </View>
    </Container>
  );
}

const modalStyles = {
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 20,
  },
  dismissLayer: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    width: "100%" as const,
    maxWidth: 460,
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7EDF1",
  },
  title: {
    color: "#023047",
    fontSize: 20,
    fontWeight: "800" as const,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: 10,
    gap: 12,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EDF1",
  },
  text: {
    color: "#51616F",
    fontSize: 14,
    lineHeight: 21,
  },
  listBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EDF1",
    gap: 8,
  },
  listItem: {
    color: "#023047",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  detailLabel: {
    color: "#51616F",
    fontSize: 14,
    fontWeight: "700" as const,
    marginTop: 10,
  },
  detailValue: {
    color: "#023047",
    fontSize: 16,
    fontWeight: "800" as const,
    marginTop: 4,
    lineHeight: 22,
  },
  previewBox: {
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EDF1",
    padding: 14,
  },
  previewLabel: {
    color: "#51616F",
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  previewText: {
    color: "#023047",
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap" as const,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CFD8DC",
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: "#023047",
    fontWeight: "700" as const,
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#2196F3",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700" as const,
  },
};
