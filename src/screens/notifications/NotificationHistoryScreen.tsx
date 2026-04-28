import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../services/firebaseConfig";
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import { clientesStyles as cStyles } from "../../styles/ClientesStyles";

type NotificationStatus = "completada" | "parcial" | "erronea";

type NotificationHistoryItem = {
  id: string;
  mensaje: string;
  totalClientes: number;
  totalEnviados: number;
  totalFallidos: number;
  estado: NotificationStatus;
  fechaEnvio: Date | null;
};

type Props = {
  onBack: () => void;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeStatus(value: unknown, totalEnviados: number, totalFallidos: number): NotificationStatus {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "completada" || normalized === "parcial" || normalized === "erronea") {
    return normalized;
  }
  if (totalEnviados === 0) return "erronea";
  if (totalFallidos > 0) return "parcial";
  return "completada";
}

function formatDate(value: Date | null) {
  if (!value) return "--";
  try {
    return value.toLocaleString();
  } catch {
    return "--";
  }
}

function formatClientTitle(totalClientes: number) {
  return totalClientes === 1
    ? "Notificación a 1 cliente"
    : `Notificación a ${totalClientes} clientes`;
}

function getStatusLabel(status: NotificationStatus) {
  if (status === "completada") return "Completada";
  if (status === "parcial") return "Parcial";
  return "Erronea";
}

function getStatusColors(status: NotificationStatus) {
  if (status === "completada") {
    return { bg: "#E8F5E9", border: "#C8E6C9", text: "#2E7D32" };
  }
  if (status === "parcial") {
    return { bg: "#FFF4E5", border: "#FFD39B", text: "#B54708" };
  }
  return { bg: "#FDECEC", border: "#F5C2C2", text: "#B42318" };
}

function mapNotification(docSnap: any): NotificationHistoryItem {
  const data = docSnap.data() || {};
  const rawDate = data.fechaEnvio;
  const fechaEnvio = rawDate instanceof Timestamp ? rawDate.toDate() : rawDate instanceof Date ? rawDate : null;
  const totalClientes = normalizeNumber(data.totalClientes);
  const hasDetailedStatus = data.estado != null || data.totalEnviados != null || data.totalFallidos != null;
  const totalEnviados = hasDetailedStatus ? normalizeNumber(data.totalEnviados) : totalClientes;
  const totalFallidos = hasDetailedStatus ? normalizeNumber(data.totalFallidos) : 0;

  return {
    id: docSnap.id,
    mensaje: normalizeString(data.mensaje),
    totalClientes,
    totalEnviados,
    totalFallidos,
    estado: hasDetailedStatus ? normalizeStatus(data.estado, totalEnviados, totalFallidos) : "completada",
    fechaEnvio,
  };
}

export default function NotificationHistoryScreen({ onBack }: Props) {
  const empresaUid = auth.currentUser?.uid;
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<NotificationHistoryItem | null>(null);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (!empresaUid) {
      setItems([]);
      setError("No se pudo identificar la empresa.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const historyQuery = query(
        collection(db, "Empresas", empresaUid, "HistorialNotificaciones"),
        orderBy("fechaEnvio", "desc"),
        limit(100)
      );
      const snap = await getDocs(historyQuery);
      setItems(snap.docs.map(mapNotification));
    } catch (e) {
      console.error("Error cargando historial de notificaciones:", e);
      setError("No se pudo cargar el historial de notificaciones.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [empresaUid]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) => {
      return (
        item.mensaje.toLowerCase().includes(needle) ||
        String(item.totalClientes).includes(needle) ||
        getStatusLabel(item.estado).toLowerCase().includes(needle)
      );
    });
  }, [items, search]);

  if (loading) {
    return (
      <View style={{ marginTop: 20, alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text style={{ marginTop: 10 }}>Cargando historial...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
          <View>
            <Text style={styles.sectionTitle}>Historial notificaciones</Text>
            <Text style={{ color: "#51616F" }}>Mensajes enviados a tus clientes.</Text>
          </View>

          <TouchableOpacity
            onPress={onBack}
            style={{
              borderWidth: 1,
              borderColor: "#cfd8dc",
              backgroundColor: "#fff",
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="arrow-back-outline" size={18} color="#023047" />
            <Text style={{ color: "#023047", fontWeight: "700" }}>Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={cStyles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por mensaje, cantidad o estado"
            placeholderTextColor="#607d8b"
            style={cStyles.searchInput}
          />
        </View>

        <Text style={{ color: "#60707D", marginBottom: 10 }}>
          {filteredItems.length} registro(s)
        </Text>

        {error ? <Text style={{ color: "#C62828", marginBottom: 8 }}>{error}</Text> : null}

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} />}
          ListEmptyComponent={<Text style={{ color: "#60707D" }}>Aun no hay notificaciones registradas.</Text>}
          renderItem={({ item }) => {
            const statusColors = getStatusColors(item.estado);
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSelectedItem(item)}
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#E0E6EA",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        backgroundColor: "#E8F4FD",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="people-outline" size={18} color="#175CD3" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: "#123042", fontSize: 14, fontWeight: "700" }}>
                        {formatClientTitle(item.totalClientes)}
                      </Text>
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ color: "#51616F", lineHeight: 20, marginTop: 2 }}
                      >
                        {item.mensaje || "Sin mensaje"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View
                      style={{
                        backgroundColor: statusColors.bg,
                        borderColor: statusColors.border,
                        borderWidth: 1,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ color: statusColors.text, fontWeight: "700", fontSize: 11 }}>
                        {getStatusLabel(item.estado)}
                      </Text>
                    </View>
                    <Text style={{ color: "#60707D", fontSize: 12 }}>{formatDate(item.fechaEnvio)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Modal visible={Boolean(selectedItem)} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 460, width: "92%", maxHeight: "80%" }]}> 
            <Text style={cStyles.modalTitle}>Detalle de notificacion</Text>

            {selectedItem ? (
              <>
                <ScrollView
                  style={{ width: "100%", maxHeight: 420 }}
                  contentContainerStyle={{ gap: 14, paddingBottom: 6 }}
                  showsVerticalScrollIndicator
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ color: "#023047", fontWeight: "800", fontSize: 16, flex: 1 }}>
                      {formatClientTitle(selectedItem.totalClientes)}
                    </Text>
                    <Text style={{ color: "#60707D", fontSize: 12 }}>{formatDate(selectedItem.fechaEnvio)}</Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <View
                      style={{
                        backgroundColor: getStatusColors(selectedItem.estado).bg,
                        borderColor: getStatusColors(selectedItem.estado).border,
                        borderWidth: 1,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ color: getStatusColors(selectedItem.estado).text, fontWeight: "700", fontSize: 12 }}>
                        {getStatusLabel(selectedItem.estado)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
                    <Text style={{ color: "#023047" }}>Enviadas: {selectedItem.totalEnviados}</Text>
                    <Text style={{ color: "#023047" }}>Fallidas: {selectedItem.totalFallidos}</Text>
                  </View>

                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#E0E6EA",
                      borderRadius: 12,
                      padding: 14,
                      backgroundColor: "#F8FBFD",
                    }}
                  >
                    <Text style={{ color: "#123042", lineHeight: 22 }}>
                      {selectedItem.mensaje || "Sin mensaje"}
                    </Text>
                  </View>
                </ScrollView>

                <View style={[cStyles.modalActions, { marginTop: 12 }]}>
                  <TouchableOpacity
                    onPress={() => setSelectedItem(null)}
                    style={{
                      alignSelf: "center",
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#023047",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ color: "#023047", fontWeight: "700" }}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
