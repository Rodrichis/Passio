import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
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
};

type ClientWithBirthday = ReturnType<typeof mapDoc> & {
  fechaNacimiento: Date | null;
};

type Props = {
  goToClientes?: () => void;
  companyName?: string;
};

export default function DashboardContentPrincipal({ goToClientes, companyName }: Props) {
  const uid = auth.currentUser?.uid;
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 900;
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
  const [birthdayNames, setBirthdayNames] = React.useState<string[]>([]);
  const [topVisitedClient, setTopVisitedClient] = React.useState<HighlightClient | null>(null);
  const [lastNotification, setLastNotification] = React.useState<LatestNotification | null>(null);

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
            (rawBirthday instanceof Timestamp ? rawBirthday.toDate() : rawBirthday instanceof Date ? rawBirthday : null);

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

        const androidTotal = allClients.filter((client) => String(client.so || "").toLowerCase() === "android").length;
        const iosTotal = allClients.filter((client) => String(client.so || "").toLowerCase() === "ios").length;
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
          .map((client) => client.nombreCompleto)
          .filter(Boolean);
        setBirthdayNames(birthdaysToday);

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
              (rawDate instanceof Timestamp ? rawDate.toDate() : rawDate instanceof Date ? rawDate : null);
            setLastNotification({ date });
          }
        } catch {
          setLastNotification(null);
        }
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar las métricas.");
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

  const highlightCards = [
    birthdayNames.length > 0
      ? {
          key: "birthday",
          title: "Cumpleaños hoy",
          primary: String(birthdayNames.length),
          secondary: birthdayNames.join(", "),
          icon: "gift-outline" as const,
          iconColor: "#7C3AED",
          iconBg: "#F3E8FF",
          primaryColor: "#6D28D9",
        }
      : null,
    {
      key: "top",
      title: "Cliente con más visitas",
      primary: loading ? "..." : topVisitedClient?.name || "Sin clientes",
      secondary: loading
        ? "Cargando..."
        : topVisitedClient
          ? `${topVisitedClient.visits} visitas en total`
          : "Aún no hay clientes registrados",
      icon: "trophy-outline" as const,
      iconColor: "#16A34A",
      iconBg: "#E8F7EE",
      primaryColor: "#16A34A",
    },
    {
      key: "notification",
      title: "Última notificación",
      primary: loading
        ? "..."
        : lastNotification?.date
          ? formatDateOnly(lastNotification.date)
          : "Sin notificaciones",
      secondary: loading
        ? "Cargando..."
        : lastNotification?.date
          ? formatTimeOnly(lastNotification.date)
          : "Aún no envías notificaciones",
      icon: "notifications-outline" as const,
      iconColor: "#2563EB",
      iconBg: "#E8F1FF",
      primaryColor: "#2563EB",
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
          warning={atUserLimit ? "Alcanzaste el límite." : undefined}
        />
        <MetricCard label="Nuevos 7 días" value={nuevosSemana} loading={loading} />
        <MetricCard
          label="Visitas registradas hoy"
          value={puntosHoy ?? 0}
          loading={loading}
          note="Clientes con última visita marcada hoy"
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
        <Text style={{ color: "#555", marginBottom: 16 }}>Sin actividad aún.</Text>
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
        {loading ? "…" : value ?? "0"}
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
}) {
  if (compact) {
    return (
      <View
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
          <Ionicons name="chevron-forward-outline" size={16} color="#A3B1BA" />
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
      </View>
    );
  }

  return (
    <View
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

        <Ionicons name="chevron-forward-outline" size={18} color="#A3B1BA" />
      </View>
    </View>
  );
}
