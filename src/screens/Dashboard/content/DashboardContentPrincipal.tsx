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
import * as Clipboard from "expo-clipboard";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import DashboardViewHeader from "../../../components/dashboard/DashboardViewHeader";
import RegistrationQrModal from "../../../components/registration/RegistrationQrModal";
import { auth, db } from "../../../services/firebaseConfig";
import { buildRegistrationUrl } from "../../../utils/publicUrls";
import { getUserLimitByPlanName } from "../../../services/plansService";
import { getEmpresaSuscripcion } from "../../../utils/subscription";
import {
  collection,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
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

type TopVisitedClient = {
  id: string;
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
  onOpenStats?: () => void;
  onOpenBirthdayGreeting?: (clientIds: string[], message: string) => void;
  onOpenNotificationHistory?: () => void;
  onOpenNotificationComposer?: () => void;
};

const ELEVATED_CARD = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E3EDF5",
  shadowColor: "#0C2340",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 24,
  elevation: 4,
} as const;

export default function DashboardContentPrincipal({
  goToClientes,
  companyName,
  onOpenStats,
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
  const [topVisitedClients, setTopVisitedClients] = React.useState<TopVisitedClient[]>([]);
  const [lastNotification, setLastNotification] = React.useState<LatestNotification | null>(null);
  const [showBirthdayModal, setShowBirthdayModal] = React.useState(false);
  const [showTopVisitedModal, setShowTopVisitedModal] = React.useState(false);
  const [showLastNotificationModal, setShowLastNotificationModal] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const registroURL = registrationUrl || buildRegistrationUrl(uid);

  React.useEffect(() => {
    if (!copiedLink) return;
    const timer = setTimeout(() => setCopiedLink(false), 1800);
    return () => clearTimeout(timer);
  }, [copiedLink]);

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
            planName = getEmpresaSuscripcion(empresaData).nombrePlan;
            const savedRegistrationUrl =
              typeof empresaData?.LinkRegistro === "string" ? empresaData.LinkRegistro.trim() : "";

            if (savedRegistrationUrl) {
              setRegistrationUrl(savedRegistrationUrl);
            }
          }
        } catch {}

        let limitePlan: number | null = null;
        try {
          limitePlan = await getUserLimitByPlanName(planName);
        } catch {}
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

        const activeClients = allClients.filter((client) => client.activo !== false);
        const totalCount = activeClients.length;
        setTotalClientes(totalCount);

        const limitNum =
          typeof limitePlan === "number"
            ? limitePlan
            : limitePlan != null
              ? parseInt(String(limitePlan), 10)
              : null;
        const hasLimit = limitNum != null && !isNaN(limitNum);
        setAtUserLimit(hasLimit ? totalCount >= limitNum : false);

        const androidTotal = activeClients.filter(
          (client) => String(client.so || "").toLowerCase() === "android"
        ).length;
        const iosTotal = activeClients.filter(
          (client) => String(client.so || "").toLowerCase() === "ios"
        ).length;
        setAndroidCount(androidTotal);
        setIosCount(iosTotal);

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const nuevosUltimos7Dias = activeClients.filter((client) => {
          return client.creadoEn instanceof Date && client.creadoEn.getTime() > oneWeekAgo.getTime();
        }).length;
        setNuevosSemana(nuevosUltimos7Dias);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const visitasRegistradasHoy = activeClients.filter((client) => {
          return client.ultimaVisita instanceof Date && client.ultimaVisita.getTime() > startOfDay.getTime();
        }).length;
        setPuntosHoy(visitasRegistradasHoy);

        const birthdaysToday = activeClients
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

        const rankedTopVisited = activeClients
          .map((client) => ({
            id: client.id,
            name: client.nombreCompleto || "Cliente sin nombre",
            visits: Number(client.visitasTotales ?? 0),
          }))
          .sort((a, b) => {
            if (b.visits !== a.visits) {
              return b.visits - a.visits;
            }
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
          })
          .slice(0, 5);
        setTopVisitedClients(rankedTopVisited);
        setTopVisitedClient(
          rankedTopVisited[0]
            ? {
                name: rankedTopVisited[0].name,
                visits: rankedTopVisited[0].visits,
              }
            : null
        );

        const recent = activeClients
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
        setTopVisitedClients([]);
        setTopVisitedClient(null);
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

  const getInitials = (value?: string) => {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return "CL";
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  };

  const handleCopyRegistrationLink = async () => {
    if (!registroURL) return;

    try {
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        (navigator as any).clipboard?.writeText
      ) {
        await (navigator as any).clipboard.writeText(registroURL);
      } else {
        await Clipboard.setStringAsync(registroURL);
      }

      setCopiedLink(true);
    } catch (e) {
      console.log("No se pudo copiar el link:", e);
    }
  };

  const handleOpenBirthdayGreeting = () => {
    const ids = birthdayClients.map((client) => client.id).filter(Boolean);
    if (!ids.length) return;

    setShowBirthdayModal(false);
    onOpenBirthdayGreeting?.(ids, "Feliz cumpleaños. Te deseamos un gran dia.");
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
    {
      key: "birthday",
      title: "Cumpleaños hoy",
      primary: String(birthdayNames.length),
      secondary: birthdayNames.length > 0 ? birthdayNames.join(", ") : "Sin clientes de cumpleaños hoy",
      icon: "gift-outline" as const,
      iconColor: "#7C3AED",
      iconBg: "#F3E8FF",
      primaryColor: "#6D28D9",
      onPress: birthdayClients.length > 0 ? () => setShowBirthdayModal(true) : undefined,
    },
    {
      key: "top",
      title: "Cliente top visitas",
      primary: loading ? "..." : topVisitedClient?.name || "Sin clientes",
      secondary: loading
        ? "Cargando..."
        : topVisitedClient
          ? `${topVisitedClient.visits} visitas en total`
          : "A\u00FAn no hay clientes registrados",
      icon: "trophy-outline" as const,
      iconColor: "#16A34A",
      iconBg: "#E8F7EE",
      primaryColor: "#16A34A",
      onPress: topVisitedClients.length > 0 ? () => setShowTopVisitedModal(true) : undefined,
    },
    {
      key: "notification",
      title: "\u00DAltima notificaci\u00F3n",
      primary: loading
        ? "..."
        : lastNotification?.date
          ? formatDateOnly(lastNotification.date)
          : "Sin notificaciones",
      secondary: loading
        ? "Cargando..."
        : lastNotification?.date
          ? formatTimeOnly(lastNotification.date)
          : "A\u00FAn no env\u00EDas notificaciones",
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

  const highlightCardBasis = isCompactLayout ? "47%" : highlightCards.length === 2 ? "48%" : "31%";
  const useStackedNotificationDetails = isCompactLayout || isCompactWeb;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
      <DashboardViewHeader title="Principal" companyName={companyName} />

      <Text style={styles.sectionTitle}>Link de registro de clientes</Text>
      <View
        style={{
          ...ELEVATED_CARD,
          borderRadius: 24,
          padding: isCompactLayout ? 18 : 24,
          marginBottom: 26,
        }}
      >
        <View
          style={{
            backgroundColor: "#F0F7FF",
            borderWidth: 1,
            borderColor: "#D5E5F3",
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 16,
            marginBottom: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            overflow: "hidden",
          }}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            selectable={Platform.OS === "web"}
            style={{
              flex: 1,
              minWidth: 0,
              flexShrink: 1,
              color: "#4B6170",
              fontSize: isCompactLayout ? 14 : 15,
            }}
          >
            {registroURL}
          </Text>

          <TouchableOpacity
            onPress={handleCopyRegistrationLink}
            style={{
              padding: 6,
              borderRadius: 10,
            }}
          >
            <Ionicons name="copy-outline" size={20} color="#0A6F88" />
          </TouchableOpacity>
        </View>

        {copiedLink ? (
          <Text
            style={{
              color: "#2E7D32",
              fontSize: 13,
              fontWeight: "600",
              marginTop: -8,
              marginBottom: 14,
            }}
          >
            Copiado
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
          <TouchableOpacity
            onPress={() => registroURL && Linking.openURL(registroURL)}
            style={{
              backgroundColor: "#2196F3",
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              Abrir navegador
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowQrModal(true)}
            style={{
              borderWidth: 1,
              borderColor: "#FFB703",
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderRadius: 12,
              backgroundColor: "#FFB703",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ionicons name="qr-code-outline" size={18} color="#102A43" />
            <Text style={{ color: "#102A43", fontWeight: "700", fontSize: 14 }}>
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
              <View style={modalStyles.headerTitleWrap}>
                <View style={[modalStyles.headerBadge, { backgroundColor: "#F3E8FF" }]}>
                  <Ionicons name="gift-outline" size={24} color="#7C3AED" />
                </View>
                <Text style={modalStyles.title}>{"Cumpleaños de hoy"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBirthdayModal(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            <Text style={modalStyles.text}>
              {"Estas personas est\u00E1n de cumpleaños hoy. Puedes enviarles un saludo en pocos pasos."}
            </Text>
            <View style={modalStyles.statBox}>
              <Text style={modalStyles.statLabel}>{"Clientes de cumpleaños"}</Text>
              <Text style={modalStyles.statValue}>{String(birthdayClients.length)}</Text>
            </View>
            <View style={modalStyles.listBox}>
              {birthdayClients.map((client) => (
                <View key={client.id} style={modalStyles.personRow}>
                  <View style={modalStyles.personAvatar}>
                    <Text style={modalStyles.personAvatarText}>{getInitials(client.name)}</Text>
                  </View>
                  <Text style={modalStyles.listItem}>{client.name}</Text>
                </View>
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

      <Modal visible={showTopVisitedModal} transparent animationType="fade" onRequestClose={() => setShowTopVisitedModal(false)}>
        <View style={modalStyles.backdrop}>
          <Pressable style={modalStyles.dismissLayer} onPress={() => setShowTopVisitedModal(false)} />
          <View style={modalStyles.card}>
            <View style={modalStyles.headerRow}>
              <View style={modalStyles.headerTitleWrap}>
                <View style={[modalStyles.headerBadge, { backgroundColor: "#E8F7EE" }]}>
                  <Ionicons name="trophy-outline" size={24} color="#16A34A" />
                </View>
                <Text style={modalStyles.title}>Top 5 clientes</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTopVisitedModal(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            <Text style={modalStyles.text}>
              {"Estos son tus clientes con m\u00E1s visitas acumuladas hasta ahora."}
            </Text>
            <View style={modalStyles.statBox}>
              <Text style={modalStyles.statLabel}>Cliente destacado</Text>
              <Text style={modalStyles.statValueSmall}>
                {topVisitedClients[0] ? `${topVisitedClients[0].name} (${topVisitedClients[0].visits})` : "Sin clientes"}
              </Text>
            </View>
            <View style={modalStyles.listBox}>
              {topVisitedClients.length === 0 ? (
                <Text style={modalStyles.text}>A\u00FAn no hay clientes registrados.</Text>
              ) : (
                topVisitedClients.map((client, index) => (
                  <View key={client.id} style={modalStyles.personRow}>
                    <View style={modalStyles.rankBadge}>
                      <Text style={modalStyles.rankBadgeText}>{index + 1}</Text>
                    </View>
                    <Text style={modalStyles.listItem}>{client.name}</Text>
                    <Text style={modalStyles.rankValue}>{client.visits}</Text>
                  </View>
                ))
              )}
            </View>
            <View style={modalStyles.actions}>
              <TouchableOpacity onPress={() => setShowTopVisitedModal(false)} style={modalStyles.secondaryButton}>
                <Text style={modalStyles.secondaryButtonText}>Cerrar</Text>
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
              <View style={modalStyles.headerTitleWrap}>
                <View style={[modalStyles.headerBadge, { backgroundColor: "#E8F1FF" }]}>
                  <Ionicons name="notifications-outline" size={24} color="#2563EB" />
                </View>
                <Text style={modalStyles.title}>{"\u00DAltima notificaci\u00F3n"}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLastNotificationModal(false)} style={modalStyles.closeButton}>
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            <Text style={modalStyles.text}>
              {"Resumen r\u00E1pido de tu \u00FAltimo env\u00EDo a clientes."}
            </Text>
            <View
              style={[
                modalStyles.detailsGrid,
                useStackedNotificationDetails && modalStyles.detailsGridStack,
              ]}
            >
              <View
                style={[
                  modalStyles.statBox,
                  !useStackedNotificationDetails ? modalStyles.statBoxCompact : null,
                ]}
              >
                <Text style={modalStyles.statLabel}>Fecha</Text>
                <Text style={modalStyles.statValueSmall}>
                  {lastNotification?.date ? formatDateOnly(lastNotification.date) : "Sin notificaciones"}
                </Text>
              </View>
              <View
                style={[
                  modalStyles.statBox,
                  !useStackedNotificationDetails ? modalStyles.statBoxCompact : null,
                ]}
              >
                <Text style={modalStyles.statLabel}>Destinatarios</Text>
                <Text style={modalStyles.statValueSmall}>
                  {lastNotification?.date ? String(lastNotification.totalRecipients) : "0"}
                </Text>
              </View>
            </View>
            <View style={[modalStyles.previewBox, isCompactWeb ? { marginTop: 6 } : null]}>
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
            <View style={modalStyles.actions}>
              <TouchableOpacity onPress={handleOpenNotificationHistory} style={modalStyles.secondaryButton}>
                <Text style={modalStyles.secondaryButtonText}>Ver historial</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleOpenNotificationComposer} style={modalStyles.primaryButton}>
                <Text style={modalStyles.primaryButtonText}>{"Nueva notificaci\u00F3n"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Actividad destacada</Text>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
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

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Resumen de clientes</Text>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {false ? (
            <TouchableOpacity
              onPress={onOpenStats}
              style={{
                backgroundColor: "#FFB703",
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="bar-chart-outline" size={17} color="#023047" />
              <Text style={{ color: "#023047", fontWeight: "700", fontSize: 14 }}>Ver estadísticas</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={goToClientes}
            style={{
              backgroundColor: "#2196F3",
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Ver clientes</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <MetricCard
          label="Clientes totales"
          value={totalClientes}
          loading={loading}
          note={`Android: ${androidCount ?? 0} | iOS: ${iosCount ?? 0}`}
          warning={atUserLimit ? "Alcanzaste el limite." : undefined}
          icon="people-outline"
          compact={isCompactLayout}
        />
        <MetricCard
          label="Nuevos 7 dias"
          value={nuevosSemana}
          loading={loading}
          icon="trending-up-outline"
          compact={isCompactLayout}
        />
        <MetricCard
          label="Visitas registradas hoy"
          value={puntosHoy ?? 0}
          loading={loading}
          note="Clientes con ultima visita marcada hoy"
          icon="pulse-outline"
          compact={isCompactLayout}
        />
      </View>

      <Text style={styles.sectionTitle}>Actividad reciente</Text>
      <View
        style={{
          ...ELEVATED_CARD,
          borderRadius: 24,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        {actividad.length === 0 && !loading ? (
          <View style={{ padding: 22 }}>
            <Text style={{ color: "#556875" }}>Sin actividad aun.</Text>
          </View>
        ) : (
          actividad.map((item, idx) => (
            <View
              key={`${item.title}-${idx}`}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 14,
                paddingHorizontal: isCompactLayout ? 18 : 24,
                paddingVertical: 20,
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: "#EDF3F8",
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#EFF4F8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#102A43", fontWeight: "800", fontSize: 18 }}>
                  {getInitials(item.title)}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ color: "#102A43", fontSize: 16, fontWeight: "800" }}
                >
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ color: "#5A6C78", fontSize: 15, marginTop: 4 }}
                  >
                    {item.subtitle}
                  </Text>
                ) : null}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="calendar-outline" size={16} color="#72808C" />
                    <Text style={{ color: "#72808C", fontSize: 14 }}>{formatDate(item.date)}</Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: "#EDF6FF",
                      borderWidth: 1,
                      borderColor: "#D3E6FF",
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text style={{ color: "#0B7BB4", fontSize: 13, fontWeight: "700" }}>
                      {item.type === "alta" ? "Registro de cliente" : "Actividad"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  loading,
  note,
  warning,
  icon,
  compact,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  note?: string;
  warning?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  compact?: boolean;
}) {
  return (
    <View
      style={{
        flexBasis: compact ? "47%" : "30%",
        flexGrow: 1,
        minWidth: compact ? 0 : 190,
        borderRadius: 20,
        padding: 20,
        overflow: "hidden",
        ...ELEVATED_CARD,
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={54}
          color="#E1EFFA"
          style={{ position: "absolute", top: 14, right: 14 }}
        />
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 15, color: "#364C5A", fontWeight: "600" }}>{label}</Text>
        {warning ? <Text style={{ fontSize: 11, color: "#c62828" }}>{warning}</Text> : null}
      </View>

      <Text style={{ fontSize: 28, fontWeight: "800", color: "#023047", marginTop: 12 }}>
        {loading ? "..." : value ?? "0"}
      </Text>

      {note ? <Text style={{ fontSize: 14, color: "#617483", marginTop: 18 }}>{note}</Text> : null}
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
          borderRadius: 20,
          padding: 16,
          ...ELEVATED_CARD,
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={24} color={iconColor} />
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
        borderRadius: 20,
        padding: 18,
        ...ELEVATED_CARD,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 20,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#51616F", fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>
            {title}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: primaryColor, fontSize: 18, fontWeight: "800", marginTop: 6 }}
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
    backgroundColor: "rgba(15, 23, 42, 0.42)",
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
    maxWidth: 480,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: "#E7EDF1",
    shadowColor: "#0F3554",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 8,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 12,
  },
  headerTitleWrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  title: {
    color: "#023047",
    fontSize: 22,
    fontWeight: "800" as const,
    flexShrink: 1,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EDF1",
  },
  text: {
    color: "#51616F",
    fontSize: 14,
    lineHeight: 22,
  },
  statBox: {
    borderRadius: 16,
    backgroundColor: "#F8FBFE",
    borderWidth: 1,
    borderColor: "#E3EDF5",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  statBoxCompact: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: "#607381",
    fontSize: 13,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  statValue: {
    color: "#023047",
    fontSize: 26,
    fontWeight: "800" as const,
  },
  statValueSmall: {
    color: "#023047",
    fontSize: 17,
    fontWeight: "800" as const,
    lineHeight: 23,
  },
  listBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F8FBFE",
    borderWidth: 1,
    borderColor: "#E3EDF5",
    gap: 10,
  },
  personRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  personAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ECE7FF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  personAvatarText: {
    color: "#6D28D9",
    fontSize: 13,
    fontWeight: "800" as const,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E8F7EE",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  rankBadgeText: {
    color: "#16803C",
    fontSize: 13,
    fontWeight: "800" as const,
  },
  listItem: {
    flex: 1,
    color: "#023047",
    fontSize: 14,
    fontWeight: "700" as const,
    lineHeight: 20,
  },
  rankValue: {
    color: "#16A34A",
    fontSize: 15,
    fontWeight: "800" as const,
    minWidth: 28,
    textAlign: "right" as const,
  },
  detailsGrid: {
    flexDirection: "row" as const,
    gap: 12,
  },
  detailsGridStack: {
    flexDirection: "column" as const,
  },
  previewBox: {
    borderRadius: 16,
    backgroundColor: "#F8FBFE",
    borderWidth: 1,
    borderColor: "#E3EDF5",
    padding: 16,
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
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap" as const,
  },
  secondaryButton: {
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CFD8DC",
    backgroundColor: "#FFFFFF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondaryButtonText: {
    color: "#023047",
    fontWeight: "700" as const,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#2196F3",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700" as const,
    fontSize: 15,
  },
};
