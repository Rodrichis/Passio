import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { auth } from "../../../services/firebaseConfig";
import { APP_BASE_URL } from "@env";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../services/firebaseConfig";

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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [totalClientes, setTotalClientes] = React.useState<number | null>(null);
  const [nuevosSemana, setNuevosSemana] = React.useState<number | null>(null);
  const [puntosHoy] = React.useState<number | null>(null); // placeholder sin fuente de datos
  const [actividad, setActividad] = React.useState<ActivityItem[]>([]);

  const baseURL =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : APP_BASE_URL || "http://10.45.41.36:8082";

  const registroURL = uid ? `${baseURL}/register/${uid}` : null;

  React.useEffect(() => {
    const fetchStats = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const col = collection(db, "Empresas", uid, "Clientes");

        // Total clientes
        const totalSnap = await getCountFromServer(col);
        setTotalClientes(totalSnap.data().count);

        // Nuevos en los últimos 7 días
        const oneWeekAgo = Timestamp.fromDate(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );
        const weekSnap = await getDocs(query(col, where("creadoEn", ">", oneWeekAgo)));
        setNuevosSemana(weekSnap.size);

        // Actividad reciente (últimas 5 altas)
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
  }, [uid]);

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

      {/* Link de registro - arriba */}
      <Text style={styles.label}>Acción rápida</Text>
      <Text style={{ marginBottom: 12, color: "#555" }}>
        Comparte el link de registro de clientes directamente desde aquí.
      </Text>

      <Text style={styles.sectionTitle}>Link de registro</Text>
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
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              Abrir en navegador
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
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: "#E3F2FD",
                }}
              >
                <Text style={{ color: "#0D47A1", fontWeight: "bold" }}>Copiar</Text>
              </TouchableOpacity>
            )}
        </View>
      </View>

      {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Resumen de clientes</Text>
      {/* Métricas rápidas */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <MetricCard label="Clientes totales" value={totalClientes} loading={loading} />
        <MetricCard label="Nuevos 7 días" value={nuevosSemana} loading={loading} />
        <MetricCard
          label="Puntos otorgados hoy"
          value={puntosHoy ?? 0}
          loading={loading}
          note="Pendiente de origen de datos"
        />
      </View>

      <TouchableOpacity
        onPress={goToClientes}
        style={{
          alignSelf: "flex-start",
          backgroundColor: "#2196F3",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>Ver todos los clientes</Text>
      </TouchableOpacity>

      {/* Actividad reciente */}
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
              {item.type === "alta" ? "Alta de cliente" : "Actividad"}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.label}>Acción rápida</Text>
      <Text style={{ marginBottom: 12, color: "#555" }}>
        Comparte el link de registro de clientes directamente desde aquí.
      </Text>

      <Text style={styles.sectionTitle}>Link de registro</Text>
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
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              Abrir en navegador
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
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: "#E3F2FD",
                }}
              >
                <Text style={{ color: "#0D47A1", fontWeight: "bold" }}>Copiar</Text>
              </TouchableOpacity>
            )}
        </View>
      </View>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  loading,
  note,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  note?: string;
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
      <Text style={{ fontSize: 13, color: "#555" }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#023047" }}>
        {loading ? "…" : value ?? "0"}
      </Text>
      {note ? <Text style={{ fontSize: 11, color: "#888" }}>{note}</Text> : null}
    </View>
  );
}
