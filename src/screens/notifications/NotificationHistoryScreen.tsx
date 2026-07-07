import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../services/firebaseConfig";
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";

type NotificationStatus = "completada" | "parcial" | "erronea";

type NotificationHistoryItem = {
  id: string;
  mensaje: string;
  tipo: string;
  accion: string;
  totalClientes: number;
  totalEnviados: number;
  totalFallidos: number;
  estado: NotificationStatus;
  fechaEnvio: Date | null;
};

type Props = {
  onBack: () => void;
  companyName?: string;
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

function getTypeLabel(item: NotificationHistoryItem) {
  if (item.tipo !== "georeferencia") return "";
  return item.accion === "quitar" ? "Geo quitada" : "Geo configurada";
}

function getStatusLabel(status: NotificationStatus) {
  if (status === "completada") return "Completada";
  if (status === "parcial") return "Parcial";
  return "Errónea";
}

function getStatusColors(status: NotificationStatus) {
  if (status === "completada") {
    return { bg: "#E8F5E9", border: "#C8E6C9", text: "#2E7D32", icon: "#2E7D32" };
  }
  if (status === "parcial") {
    return { bg: "#FFF4E5", border: "#FFD39B", text: "#B54708", icon: "#B54708" };
  }
  return { bg: "#FDECEC", border: "#F5C2C2", text: "#B42318", icon: "#B42318" };
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
    tipo: normalizeString(data.tipo),
    accion: normalizeString(data.accion),
    totalClientes,
    totalEnviados,
    totalFallidos,
    estado: hasDetailedStatus ? normalizeStatus(data.estado, totalEnviados, totalFallidos) : "completada",
    fechaEnvio,
  };
}

export default function NotificationHistoryScreen({ onBack, companyName }: Props) {
  const empresaUid = auth.currentUser?.uid;
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<NotificationHistoryItem | null>(null);

  const loadHistory = useCallback(
    async (isRefresh = false) => {
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
    },
    [empresaUid]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) => {
      return (
        item.mensaje.toLowerCase().includes(needle) ||
        getTypeLabel(item).toLowerCase().includes(needle) ||
        String(item.totalClientes).includes(needle) ||
        getStatusLabel(item.estado).toLowerCase().includes(needle)
      );
    });
  }, [items, search]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={[styles.loadingCard, ELEVATED_CARD]}>
          <View style={styles.loadingIconWrap}>
            <Ionicons name="notifications-outline" size={24} color="#023047" />
          </View>
          <Text style={styles.loadingTitle}>Cargando historial</Text>
          <Text style={styles.loadingText}>Estamos buscando las notificaciones enviadas a tus clientes.</Text>
          <ActivityIndicator size="large" color="#023047" style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.screen}>
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={onBack} style={styles.backIconButton}>
            <Ionicons name="arrow-back-outline" size={18} color="#023047" />
          </TouchableOpacity>

          <View style={[styles.searchCard, ELEVATED_CARD]}>
            <View style={styles.searchIconWrap}>
              <Ionicons name="search-outline" size={18} color="#175CD3" />
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por mensaje, cantidad o estado"
              placeholderTextColor="#7A8C98"
              style={styles.searchInput}
            />
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{filteredItems.length} registro(s)</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[styles.listContent, filteredItems.length === 0 && styles.listContentEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} />}
          ListEmptyComponent={
            <View style={[styles.emptyCard, ELEVATED_CARD]}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="mail-open-outline" size={22} color="#60707D" />
              </View>
              <Text style={styles.emptyTitle}>Aún no hay notificaciones registradas</Text>
              <Text style={styles.emptyText}>Cuando envíes mensajes a tus clientes, aparecerán aquí.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColors = getStatusColors(item.estado);

            return (
              <TouchableOpacity
                activeOpacity={0.94}
                onPress={() => setSelectedItem(item)}
                style={[styles.itemCard, ELEVATED_CARD]}
              >
                <View style={styles.itemCardTop}>
                  <View style={styles.itemMainInfo}>
                    <View style={styles.itemIconWrap}>
                      <Ionicons name="paper-plane-outline" size={18} color="#175CD3" />
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text numberOfLines={1} style={styles.itemTitle}>
                        {formatClientTitle(item.totalClientes)}
                      </Text>
                      <Text numberOfLines={2} ellipsizeMode="tail" style={styles.itemMessage}>
                        {item.mensaje || "Sin mensaje"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemStatusWrap}>
                    {getTypeLabel(item) ? (
                      <View style={styles.geoTypeChip}>
                        <Ionicons name="location-outline" size={12} color="#A86D00" />
                        <Text style={styles.geoTypeChipText}>{getTypeLabel(item)}</Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.statusChip,
                        {
                          backgroundColor: statusColors.bg,
                          borderColor: statusColors.border,
                        },
                      ]}
                    >
                      <Ionicons name="ellipse" size={8} color={statusColors.icon} />
                      <Text style={[styles.statusChipText, { color: statusColors.text }]}>
                        {getStatusLabel(item.estado)}
                      </Text>
                    </View>
                    <Text style={styles.itemDate}>{formatDate(item.fechaEnvio)}</Text>
                  </View>
                </View>

                <View style={styles.itemStatsRow}>
                  <View style={styles.itemStat}>
                    <Text style={styles.itemStatLabel}>Destinatarios</Text>
                    <Text style={styles.itemStatValue}>{item.totalClientes}</Text>
                  </View>
                  <View style={styles.itemStat}>
                    <Text style={styles.itemStatLabel}>Enviadas</Text>
                    <Text style={styles.itemStatValue}>{item.totalEnviados}</Text>
                  </View>
                  <View style={styles.itemStat}>
                    <Text style={styles.itemStatLabel}>Fallidas</Text>
                    <Text style={styles.itemStatValue}>{item.totalFallidos}</Text>
                  </View>
                  <View style={styles.itemOpenWrap}>
                    <Text style={styles.itemOpenText}>Ver detalle</Text>
                    <Ionicons name="chevron-forward" size={16} color="#60707D" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Modal visible={Boolean(selectedItem)} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, ELEVATED_CARD]}>
            {selectedItem ? (
              <>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedItem(null)}>
                  <Ionicons name="close" size={22} color="#617786" />
                </TouchableOpacity>

                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeaderLabel}>Detalle de notificación</Text>
                    <Text style={styles.modalHeaderTitle}>{formatClientTitle(selectedItem.totalClientes)}</Text>
                  </View>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator
                >
                  <View style={styles.modalMetaTop}>
                    <Text style={styles.modalDate}>{formatDate(selectedItem.fechaEnvio)}</Text>
                    <View
                      style={[
                        styles.statusChip,
                        {
                          backgroundColor: getStatusColors(selectedItem.estado).bg,
                          borderColor: getStatusColors(selectedItem.estado).border,
                        },
                      ]}
                    >
                      <Ionicons name="ellipse" size={8} color={getStatusColors(selectedItem.estado).icon} />
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: getStatusColors(selectedItem.estado).text },
                        ]}
                      >
                        {getStatusLabel(selectedItem.estado)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailStatsGrid}>
                    <View style={styles.detailStatCard}>
                      <Text style={styles.detailStatLabel}>Destinatarios</Text>
                      <Text style={styles.detailStatValue}>{selectedItem.totalClientes}</Text>
                    </View>
                    <View style={styles.detailStatCard}>
                      <Text style={styles.detailStatLabel}>Enviadas</Text>
                      <Text style={styles.detailStatValue}>{selectedItem.totalEnviados}</Text>
                    </View>
                    <View style={styles.detailStatCard}>
                      <Text style={styles.detailStatLabel}>Fallidas</Text>
                      <Text style={styles.detailStatValue}>{selectedItem.totalFallidos}</Text>
                    </View>
                  </View>

                  <View style={styles.messageCard}>
                    <Text style={styles.messageCardLabel}>Mensaje enviado</Text>
                    <Text style={styles.messageCardText}>{selectedItem.mensaje || "Sin mensaje"}</Text>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.modalSecondaryButton}>
                    <Text style={styles.modalSecondaryButtonText}>Cerrar</Text>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
  },
  loadingCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
  },
  loadingIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EAF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 8,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#526977",
    textAlign: "center",
    maxWidth: 520,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  backIconButton: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: "#D6E3EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchCard: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  searchIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E8F1FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#123042",
    fontSize: 15,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  metaText: {
    color: "#60707D",
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    color: "#C62828",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  itemCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  itemCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  itemMainInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E8F1FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: "#123042",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  itemMessage: {
    color: "#51616F",
    lineHeight: 20,
    fontSize: 14,
  },
  itemStatusWrap: {
    alignItems: "flex-end",
    gap: 8,
    maxWidth: 170,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontWeight: "700",
    fontSize: 11,
  },
  geoTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#FFE2A3",
    backgroundColor: "#FFF8E1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  geoTypeChipText: {
    color: "#A86D00",
    fontWeight: "800",
    fontSize: 11,
  },
  itemDate: {
    color: "#60707D",
    fontSize: 12,
    textAlign: "right",
  },
  itemStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  itemStat: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F6FAFF",
    borderWidth: 1,
    borderColor: "#E3EDF5",
  },
  itemStatLabel: {
    color: "#60707D",
    fontSize: 12,
    marginBottom: 4,
  },
  itemStatValue: {
    color: "#023047",
    fontSize: 16,
    fontWeight: "800",
  },
  itemOpenWrap: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  itemOpenText: {
    color: "#60707D",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    flex: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EEF5FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#526977",
    textAlign: "center",
    maxWidth: 420,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 25, 36, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: "100%",
    maxWidth: 520,
    maxHeight: "84%",
    overflow: "hidden",
  },
  modalCloseButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    zIndex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#E8F1FE",
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#175CD3",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modalHeaderLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#175CD3",
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: "#023047",
    paddingRight: 26,
  },
  modalScroll: {
    width: "100%",
  },
  modalScrollContent: {
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  modalMetaTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  modalDate: {
    color: "#60707D",
    fontSize: 13,
  },
  detailStatsGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  detailStatCard: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EDF5",
    backgroundColor: "#F6FAFF",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  detailStatLabel: {
    color: "#60707D",
    fontSize: 12,
    marginBottom: 4,
  },
  detailStatValue: {
    color: "#023047",
    fontSize: 17,
    fontWeight: "800",
  },
  messageCard: {
    borderWidth: 1,
    borderColor: "#E0E6EA",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F8FBFD",
  },
  messageCardLabel: {
    color: "#60707D",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  messageCardText: {
    color: "#123042",
    lineHeight: 22,
    fontSize: 14,
  },
  modalActions: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalSecondaryButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#023047",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonText: {
    color: "#023047",
    fontWeight: "700",
  },
});
