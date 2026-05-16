import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { ESTADO_WALLET } from "../../constants/empresa";
import DashboardViewHeader from "../../components/dashboard/DashboardViewHeader";
import { db } from "../../services/firebaseConfig";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import { clientesStyles as cStyles } from "../../styles/ClientesStyles";

type Props = {
  onBack: () => void;
  companyName?: string;
};

type CompanyCounter = {
  totalUsuarios: number;
  notificacionesMes: number;
  correosMes: number;
  mesConteo: string;
};

type CompanyItem = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  plan: string;
  activa: boolean;
  fechaRegistro: Date | null;
  expiraEl: Date | null;
  walletConfigurado: boolean;
  estadoWallet: string;
  walletClassId: string;
  region: string;
  ciudad: string;
  direccion: string;
  linkRegistro: string;
  counters: CompanyCounter;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function normalizeNumber(value: unknown) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatDate(value: Date | null) {
  if (!value) return "--";
  try {
    return value.toLocaleString();
  } catch {
    return "--";
  }
}

function formatShortDate(value: Date | null) {
  if (!value) return "--";
  try {
    return value.toLocaleDateString();
  } catch {
    return "--";
  }
}

function walletStatusLabel(configured: boolean, status: string) {
  if (!configured) return "Sin configurar";
  if (status === ESTADO_WALLET.LISTO) return "Listo";
  if (status === ESTADO_WALLET.ERROR) return "Error";
  return "Pendiente";
}

function walletStatusColors(configured: boolean, status: string) {
  if (!configured) {
    return { bg: "#EEF2F6", border: "#D7E2E8", text: "#51616F" };
  }
  if (status === ESTADO_WALLET.LISTO) {
    return { bg: "#E8F5E9", border: "#C8E6C9", text: "#2E7D32" };
  }
  if (status === ESTADO_WALLET.ERROR) {
    return { bg: "#FDECEC", border: "#F5C2C2", text: "#B42318" };
  }
  return { bg: "#FFF4E5", border: "#FFD39B", text: "#B54708" };
}

async function loadCountersForCompany(empresaId: string): Promise<CompanyCounter> {
  const defaultCounter: CompanyCounter = {
    totalUsuarios: 0,
    notificacionesMes: 0,
    correosMes: 0,
    mesConteo: "",
  };

  try {
    const counterSnap = await getDocs(collection(db, "Empresas", empresaId, "Contador"));
    if (counterSnap.empty) return defaultCounter;

    const data = counterSnap.docs[0].data() || {};
    return {
      totalUsuarios: normalizeNumber(data.totalUsuarios),
      notificacionesMes: normalizeNumber(data.notificacionesMes),
      correosMes: normalizeNumber(data.correosMes),
      mesConteo: normalizeString(data.mesConteo),
    };
  } catch {
    return defaultCounter;
  }
}

export default function AdminCompaniesScreen({ onBack, companyName }: Props) {
  const [items, setItems] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<CompanyItem | null>(null);
  const [showEmulationInfo, setShowEmulationInfo] = useState(false);

  const loadCompanies = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const companiesQuery = query(collection(db, "Empresas"), orderBy("FechaRegistro", "desc"), limit(100));
      const snap = await getDocs(companiesQuery);

      const companyItems = await Promise.all(
        snap.docs.map(async (companyDoc) => {
          const data = companyDoc.data() || {};
          const counters = await loadCountersForCompany(companyDoc.id);

          return {
            id: companyDoc.id,
            nombre: normalizeString(data.nombre) || "Empresa sin nombre",
            email: normalizeString(data.Mail),
            telefono: normalizeString(data.telefono),
            plan: normalizeString(data.plan) || "--",
            activa: data.Activo !== false,
            fechaRegistro: normalizeDate(data.FechaRegistro),
            expiraEl: normalizeDate(data.expiraEl),
            walletConfigurado: data.walletConfigurado === true,
            estadoWallet: normalizeString(data.estadoWallet),
            walletClassId: normalizeString(data["wallet-class-id"]),
            region: normalizeString(data.region),
            ciudad: normalizeString(data.ciudad),
            direccion: normalizeString(data["Dirección"] || data["Direccion"]),
            linkRegistro: normalizeString(data.LinkRegistro),
            counters,
          } satisfies CompanyItem;
        })
      );

      setItems(companyItems);
    } catch (e) {
      console.error("Error cargando empresas:", e);
      setError("No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) => {
      const haystack = [
        item.id,
        item.nombre,
        item.email,
        item.plan,
        item.walletClassId,
        item.region,
        item.ciudad,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [items, search]);

  if (loading) {
    return (
      <View style={{ marginTop: 20, alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text style={{ marginTop: 10 }}>Cargando empresas...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1 }}>
        <DashboardViewHeader
          title="Empresas"
          subtitle="Monitoreo general de empresas y contadores."
          companyName={companyName}
          rightSlot={(
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
          )}
        />

        <View style={cStyles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre, UID, correo, plan o wallet-class-id"
            placeholderTextColor="#607d8b"
            style={cStyles.searchInput}
          />
        </View>

        <Text style={{ color: "#60707D", marginBottom: 10 }}>{filteredItems.length} empresa(s)</Text>

        {error ? <Text style={{ color: "#C62828", marginBottom: 8 }}>{error}</Text> : null}

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCompanies(true)} />}
          ListEmptyComponent={<Text style={{ color: "#60707D" }}>No hay empresas registradas.</Text>}
          renderItem={({ item }) => {
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700" }}>{item.nombre}</Text>
                    <Text style={{ color: "#51616F", marginTop: 4 }} numberOfLines={1} ellipsizeMode="tail">
                      {item.email || item.id}
                    </Text>
                    <Text style={{ color: "#60707D", marginTop: 2, fontSize: 12 }}>
                      Plan: {item.plan} | Registro: {formatShortDate(item.fechaRegistro)}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 8 }}>
                    <TouchableOpacity
                      onPress={(event: any) => {
                        event?.stopPropagation?.();
                        setShowEmulationInfo(true);
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#B42318",
                        backgroundColor: "#FFF5F4",
                      }}
                    >
                      <Text style={{ color: "#B42318", fontWeight: "700" }}>Emular</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <Text style={cStyles.chipText}>Usuarios: {item.counters.totalUsuarios}</Text>
                  <Text style={cStyles.chipText}>Push: {item.counters.notificacionesMes}</Text>
                  <Text style={cStyles.chipText}>Correos: {item.counters.correosMes}</Text>
                  <Text style={cStyles.chipText}>{item.activa ? "Activa" : "Inactiva"}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Modal visible={Boolean(selectedItem)} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 520, width: "92%", maxHeight: "82%" }]}> 
            <Text style={cStyles.modalTitle}>Detalle de empresa</Text>

            {selectedItem ? (
              <>
                <ScrollView style={{ width: "100%", maxHeight: 460 }} contentContainerStyle={{ gap: 14, paddingBottom: 6 }}>
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: "#023047", fontWeight: "800", fontSize: 18 }}>{selectedItem.nombre}</Text>
                    <Text style={{ color: "#60707D" }}>{selectedItem.email || "Sin correo"}</Text>
                    <Text style={{ color: "#60707D", fontSize: 12 }}>UID: {selectedItem.id}</Text>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    <Text style={cStyles.chipText}>Plan: {selectedItem.plan}</Text>
                    <Text style={cStyles.chipText}>{selectedItem.activa ? "Activa" : "Inactiva"}</Text>
                    <Text style={cStyles.chipText}>Wallet: {walletStatusLabel(selectedItem.walletConfigurado, selectedItem.estadoWallet)}</Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ color: "#123042", fontWeight: "700" }}>Contadores</Text>
                    <Text style={{ color: "#123042" }}>Usuarios: {selectedItem.counters.totalUsuarios}</Text>
                    <Text style={{ color: "#123042" }}>Notificaciones del mes: {selectedItem.counters.notificacionesMes}</Text>
                    <Text style={{ color: "#123042" }}>Correos del mes: {selectedItem.counters.correosMes}</Text>
                    <Text style={{ color: "#123042" }}>Mes de conteo: {selectedItem.counters.mesConteo || "--"}</Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ color: "#123042", fontWeight: "700" }}>Datos generales</Text>
                    <Text style={{ color: "#123042" }}>Teléfono: {selectedItem.telefono || "--"}</Text>
                    <Text style={{ color: "#123042" }}>Región: {selectedItem.region || "--"}</Text>
                    <Text style={{ color: "#123042" }}>Ciudad: {selectedItem.ciudad || "--"}</Text>
                    <Text style={{ color: "#123042" }}>Dirección: {selectedItem.direccion || "--"}</Text>
                    <Text style={{ color: "#123042" }}>Fecha de registro: {formatDate(selectedItem.fechaRegistro)}</Text>
                    <Text style={{ color: "#123042" }}>Expira el: {formatDate(selectedItem.expiraEl)}</Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ color: "#123042", fontWeight: "700" }}>Wallet</Text>
                    <Text style={{ color: "#123042" }}>wallet-class-id: {selectedItem.walletClassId || "--"}</Text>
                    <Text style={{ color: "#123042" }}>Link de registro:</Text>
                    <Text selectable style={{ color: "#175CD3" }}>{selectedItem.linkRegistro || "--"}</Text>
                  </View>
                </ScrollView>

                <View style={[cStyles.modalActions, { marginTop: 12, justifyContent: "center" }]}> 
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

      <Modal visible={showEmulationInfo} transparent animationType="fade" onRequestClose={() => setShowEmulationInfo(false)}>
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 420, width: "90%" }]}> 
            <Text style={cStyles.modalTitle}>Emular empresa</Text>
            <Text style={{ color: "#123042", lineHeight: 22 }}>
              Desarrollar en el futuro la función de emular.
            </Text>

            <View style={[cStyles.modalActions, { marginTop: 14, justifyContent: "center" }]}> 
              <TouchableOpacity
                onPress={() => setShowEmulationInfo(false)}
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
          </View>
        </View>
      </Modal>
    </>
  );
}
