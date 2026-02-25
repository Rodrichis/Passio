import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { auth, db } from "../../../services/firebaseConfig";
import { APP_BASE_URL } from "@env";
import {
  collection,
  getCountFromServer,
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

type ActivityItem = {
  title: string;
  subtitle?: string;
  date?: Date | null;
  type: "alta" | "otros";
};

type Props = {
  goToClientes?: () => void;
};

export default function DashboardContentPrincipal({ goToClientes }: Props) {
  const uid = auth.currentUser?.uid;
  const isFocused = useIsFocused();
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

  const baseURL =
    APP_BASE_URL ||
    "http://localhost:8081";

  const registroURL = uid ? `${baseURL}/register/${uid}` : "";

  React.useEffect(() => {
    const fetchStats = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const col = collection(db, "Empresas", uid, "Clientes");
        // Info de empresa/plan
        let planName: string | null = null;
        try {
          const empSnap = await getDoc(doc(db, "Empresas", uid));
          if (empSnap.exists()) {
            planName = (empSnap.data() as any)?.plan || null;
          }
        } catch {}

        // Límite del plan
        let limitePlan: number | null = null;
        if (planName) {
          try {
            const planSnap = await getDocs(
              query(collection(db, "Planes"), where("nombrePlan", "==", planName))
            );
            const first = planSnap.docs[0];
            if (first) {
              const data = first.data() as any;
              if (typeof data.limiteUsuarios === "number") limitePlan = data.limiteUsuarios;
            }
          } catch {}
        }
        setLimiteUsuarios(limitePlan);

        // Contador de usuarios desde "Contador"
        let totalFromCont: number | null = null;
        try {
          const contSnap = await getDocs(collection(db, "Empresas", uid, "Contador"));
          const first = contSnap.docs[0];
          if (first) {
            const data = first.data() as any;
            if (typeof data.totalUsuarios === "number") totalFromCont = data.totalUsuarios;
          }
        } catch {}

        const totalSnap = await getCountFromServer(col);
        const totalCount = totalFromCont ?? totalSnap.data().count;
        setTotalClientes(totalCount);

        const limitNum =
          typeof limitePlan === "number"
            ? limitePlan
            : limitePlan != null
            ? parseInt(String(limitePlan), 10)
            : null;
        const hasLimit = limitNum != null && !isNaN(limitNum);
        setAtUserLimit(hasLimit ? totalCount >= (limitNum as number) : false);

        const androidSnap = await getDocs(query(col, where("so", "==", "android")));
        setAndroidCount(androidSnap.size);
        const iosSnap = await getDocs(query(col, where("so", "==", "ios")));
        setIosCount(iosSnap.size);

        const oneWeekAgo = Timestamp.fromDate(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );
        const weekSnap = await getDocs(query(col, where("creadoEn", ">", oneWeekAgo)));
        setNuevosSemana(weekSnap.size);

        // Visitas registradas hoy (aprox: clientes con ultimaVisita >= inicio del día)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const visitasHoySnap = await getDocs(query(col, where("ultimaVisita", ">", Timestamp.fromDate(startOfDay))));
        setPuntosHoy(visitasHoySnap.size);

        const recentSnap = await getDocs(query(col, orderBy("creadoEn", "desc"), limit(5)));
        const recent = recentSnap.docs.map((d) => {
          const data = d.data() || {};
          const fecha =
            data.creadoEn?.toDate?.() ||
            data.fechaRegistro?.toDate?.() ||
            null;
          return {
            title: data.nombreCompleto || data.nombre || "Nuevo cliente",
            subtitle: data.email || "",
            date: fecha,
            type: "alta" as const,
          };
        });
        setActividad(recent);
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

  return (
    <ScrollView style={{ paddingHorizontal: 10 }}>
      <Text style={styles.sectionTitle}>Principal</Text>

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
        </View>
      </View>

      {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}

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

