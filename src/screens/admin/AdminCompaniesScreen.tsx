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
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { ESTADO_WALLET } from "../../constants/empresa";
import DashboardViewHeader from "../../components/dashboard/DashboardViewHeader";
import { db } from "../../services/firebaseConfig";
import { clientesStyles as cStyles } from "../../styles/ClientesStyles";
import {
  formatPlanName,
  formatSubscriptionStatus,
  getEmpresaSuscripcion,
  normalizeEstadoSuscripcion,
  normalizeNombrePlan,
} from "../../utils/subscription";

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
  estadoSuscripcion: string;
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

type AdminClientItem = {
  id: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  so: string;
  activo: boolean;
  creadoEn: Date | null;
  ultimaVisita: Date | null;
  fechaNacimiento: Date | null;
  visitasTotales: number;
  cicloVisitas: number;
  premiosDisponibles: number;
  premiosCanjeados: number;
};

type AdminHistoryItem = {
  id: string;
  mensaje: string;
  totalClientes: number;
  totalEnviados: number;
  totalFallidos: number;
  estado: string;
  fechaEnvio: Date | null;
};

type ModalView = "detail" | "clients" | "history";

const PLAN_OPTIONS = ["free", "pro"] as const;
const SUBSCRIPTION_OPTIONS = ["active", "pending", "past_due", "expired", "trialing"] as const;
type PlanOption = (typeof PLAN_OPTIONS)[number];
type SubscriptionOption = (typeof SUBSCRIPTION_OPTIONS)[number];

function normalizeSubscriptionOption(value: unknown): SubscriptionOption {
  const normalized = normalizeEstadoSuscripcion(value, "free");
  return SUBSCRIPTION_OPTIONS.includes(normalized as SubscriptionOption)
    ? (normalized as SubscriptionOption)
    : "expired";
}

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
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "--";
  }
}

function formatInputDate(value: Date | null) {
  if (!value) return "";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseInputDate(value: string): Date | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "invalid";

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "invalid";
  }

  return parsed;
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

function subscriptionStatusLabel(value: string) {
  return formatSubscriptionStatus(value);
}

function historyStatusLabel(value: string) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "completada") return "Completada";
  if (normalized === "parcial") return "Parcial";
  if (normalized === "erronea") return "Erronea";
  return value || "--";
}

function historyStatusColors(value: string) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "completada") {
    return { bg: "#E8F5E9", border: "#C8E6C9", text: "#2E7D32" };
  }
  if (normalized === "parcial") {
    return { bg: "#FFF8E1", border: "#FFE0B2", text: "#B54708" };
  }
  if (normalized === "erronea") {
    return { bg: "#FDECEC", border: "#F5C2C2", text: "#B42318" };
  }
  return { bg: "#EEF2F6", border: "#D7E2E8", text: "#51616F" };
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

async function loadClientsForCompany(empresaId: string): Promise<AdminClientItem[]> {
  const snap = await getDocs(collection(db, "Empresas", empresaId, "Clientes"));
  return snap.docs
    .map((clientDoc) => {
      const data = clientDoc.data() || {};
      return {
        id: clientDoc.id,
        nombreCompleto: `${normalizeString(data.nombre)} ${normalizeString(data.apellido)}`.trim() || "Cliente sin nombre",
        email: normalizeString(data.email),
        telefono: normalizeString(data.telefono),
        so: normalizeString(data.so),
        activo: data.activo !== false,
        creadoEn: normalizeDate(data.creadoEn),
        ultimaVisita: normalizeDate(data.ultimaVisita),
        fechaNacimiento: normalizeDate(data.fechaNacimiento),
        visitasTotales: normalizeNumber(data.visitasTotales),
        cicloVisitas: normalizeNumber(data.cicloVisitas),
        premiosDisponibles: normalizeNumber(data.premiosDisponibles),
        premiosCanjeados: normalizeNumber(data.premiosCanjeados),
      } satisfies AdminClientItem;
    })
    .sort((a, b) => {
      if (b.visitasTotales !== a.visitasTotales) return b.visitasTotales - a.visitasTotales;
      return a.nombreCompleto.localeCompare(b.nombreCompleto);
    });
}

async function loadHistoryForCompany(empresaId: string): Promise<AdminHistoryItem[]> {
  const snap = await getDocs(collection(db, "Empresas", empresaId, "HistorialNotificaciones"));
  return snap.docs
    .map((historyDoc) => {
      const data = historyDoc.data() || {};
      return {
        id: historyDoc.id,
        mensaje: normalizeString(data.mensaje),
        totalClientes: normalizeNumber(data.totalClientes),
        totalEnviados: normalizeNumber(data.totalEnviados),
        totalFallidos: normalizeNumber(data.totalFallidos),
        estado: normalizeString(data.estado),
        fechaEnvio: normalizeDate(data.fechaEnvio),
      } satisfies AdminHistoryItem;
    })
    .sort((a, b) => (b.fechaEnvio?.getTime() || 0) - (a.fechaEnvio?.getTime() || 0));
}

export default function AdminCompaniesScreen({ onBack, companyName }: Props) {
  const [items, setItems] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<CompanyItem | null>(null);
  const [selectedView, setSelectedView] = useState<ModalView>("detail");
  const [showEmulationInfo, setShowEmulationInfo] = useState(false);

  const [editPlan, setEditPlan] = useState<PlanOption>("free");
  const [editSubscriptionStatus, setEditSubscriptionStatus] = useState<SubscriptionOption>(
    "active"
  );
  const [editExpiryInput, setEditExpiryInput] = useState("");
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const [companyClients, setCompanyClients] = useState<AdminClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState("");

  const [companyHistory, setCompanyHistory] = useState<AdminHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

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
          const suscripcion = getEmpresaSuscripcion(data);

          return {
            id: companyDoc.id,
            nombre: normalizeString(data.nombre) || "Empresa sin nombre",
            email: normalizeString(data.Mail),
            telefono: normalizeString(data.telefono),
            plan: suscripcion.nombrePlan,
            estadoSuscripcion: suscripcion.estadoSuscripcion,
            activa: data.Activo !== false,
            fechaRegistro: normalizeDate(data.FechaRegistro),
            expiraEl: suscripcion.expiraEl,
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
        item.estadoSuscripcion,
        item.walletClassId,
        item.region,
        item.ciudad,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [items, search]);

  const selectedWalletColors = selectedItem
    ? walletStatusColors(selectedItem.walletConfigurado, selectedItem.estadoWallet)
    : walletStatusColors(false, "");

  const openCompanyDetail = (item: CompanyItem) => {
    setSelectedItem(item);
    setSelectedView("detail");
    setEditPlan(normalizeNombrePlan(item.plan) === "pro" ? "pro" : "free");
    setEditSubscriptionStatus(normalizeSubscriptionOption(item.estadoSuscripcion));
    setEditExpiryInput(formatInputDate(item.expiraEl));
    setSaveError("");
    setSaveSuccess("");
    setCompanyClients([]);
    setClientsError("");
    setCompanyHistory([]);
    setHistoryError("");
  };

  const closeCompanyModal = () => {
    setSelectedItem(null);
    setSelectedView("detail");
    setSaveError("");
    setSaveSuccess("");
  };

  const handleSaveSubscription = async () => {
    if (!selectedItem) return;

    const parsedDate = parseInputDate(editExpiryInput);
    if (parsedDate === "invalid") {
      setSaveError("Usa la fecha en formato DD/MM/AAAA.");
      setSaveSuccess("");
      return;
    }

    if (
      editPlan !== "free" &&
      (editSubscriptionStatus === "active" || editSubscriptionStatus === "trialing") &&
      !parsedDate
    ) {
      setSaveError("Un plan Pro manual activo debe tener fecha de expiraci\u00F3n.");
      setSaveSuccess("");
      return;
    }

    setSavingSubscription(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      await setDoc(
        doc(db, "Empresas", selectedItem.id),
        {
          suscripcion: {
            nombrePlan: editPlan,
            estadoSuscripcion: editSubscriptionStatus,
            renovacionAutomatica: false,
            expiraEl: parsedDate ? Timestamp.fromDate(parsedDate) : null,
            trialTerminaEl:
              editSubscriptionStatus === "trialing" && parsedDate
                ? Timestamp.fromDate(parsedDate)
                : null,
            tipoPagoPlan: "none",
            suscripcionOrigen: "manual",
            mercadoPagoPreapprovalId: null,
            mercadoPagoPlanId: null,
            mercadoPagoPreferenceId: null,
            mercadoPagoPaymentId: null,
            ultimaSyncSuscripcion: Timestamp.fromDate(new Date()),
          },
        },
        { merge: true }
      );

      const nextItem: CompanyItem = {
        ...selectedItem,
        plan: editPlan,
        estadoSuscripcion: editSubscriptionStatus,
        expiraEl: parsedDate,
      };

      setSelectedItem(nextItem);
      setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? nextItem : item)));
      setSaveSuccess("Cambios guardados.");
    } catch (saveSubscriptionError) {
      console.error("Error guardando suscripción:", saveSubscriptionError);
      setSaveError("No se pudieron guardar los cambios.");
    } finally {
      setSavingSubscription(false);
    }
  };

  const handleOpenClients = async () => {
    if (!selectedItem) return;
    setSelectedView("clients");

    if (companyClients.length > 0 || clientsLoading) return;

    setClientsLoading(true);
    setClientsError("");
    try {
      const loadedClients = await loadClientsForCompany(selectedItem.id);
      setCompanyClients(loadedClients);
    } catch (loadClientsError) {
      console.error("Error cargando clientes de empresa:", loadClientsError);
      setClientsError("No se pudieron cargar los clientes de la empresa.");
    } finally {
      setClientsLoading(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!selectedItem) return;
    setSelectedView("history");

    if (companyHistory.length > 0 || historyLoading) return;

    setHistoryLoading(true);
    setHistoryError("");
    try {
      const loadedHistory = await loadHistoryForCompany(selectedItem.id);
      setCompanyHistory(loadedHistory);
    } catch (loadHistoryError) {
      console.error("Error cargando historial de empresa:", loadHistoryError);
      setHistoryError("No se pudo cargar el historial de notificaciones.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderModalHeader = () => {
    const title =
      selectedView === "clients"
        ? "Clientes de la empresa"
        : selectedView === "history"
          ? "Historial de notificaciones"
          : "Detalle de empresa";

    return (
      <View style={adminStyles.modalHeader}>
        <View style={adminStyles.modalHeaderLeft}>
          {selectedView !== "detail" ? (
            <TouchableOpacity
              onPress={() => setSelectedView("detail")}
              style={adminStyles.headerIconButton}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#023047" />
            </TouchableOpacity>
          ) : null}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={cStyles.modalTitle}>{title}</Text>
            {selectedItem ? (
              <Text style={adminStyles.modalSubtitle}>
                {selectedItem.nombre}
              </Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity onPress={closeCompanyModal} style={adminStyles.headerIconButton}>
          <Ionicons name="close" size={18} color="#023047" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCompanyDetail = () => {
    if (!selectedItem) return null;

    return (
      <>
        <ScrollView style={{ width: "100%", maxHeight: 500 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
          <View style={adminStyles.sectionCard}>
            <View style={{ gap: 4 }}>
              <Text style={adminStyles.companyTitle}>{selectedItem.nombre}</Text>
              <Text style={adminStyles.subtleText}>{selectedItem.email || "Sin correo"}</Text>
              <Text style={adminStyles.smallMutedText}>UID: {selectedItem.id}</Text>
            </View>

            <View style={adminStyles.chipsRow}>
              <View style={adminStyles.infoChip}>
                <Text style={adminStyles.infoChipText}>{`Plan: ${formatPlanName(selectedItem.plan)}`}</Text>
              </View>
              <View style={adminStyles.infoChip}>
                <Text style={adminStyles.infoChipText}>
                  {`Suscripción: ${subscriptionStatusLabel(selectedItem.estadoSuscripcion)}`}
                </Text>
              </View>
              <View
                style={[
                  adminStyles.statusChip,
                  {
                    backgroundColor: selectedWalletColors.bg,
                    borderColor: selectedWalletColors.border,
                  },
                ]}
              >
                <Text style={[adminStyles.statusChipText, { color: selectedWalletColors.text }]}>
                  {`Wallet: ${walletStatusLabel(selectedItem.walletConfigurado, selectedItem.estadoWallet)}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={adminStyles.sectionCard}>
            <Text style={adminStyles.sectionTitle}>Suscripción</Text>

            <Text style={adminStyles.fieldLabel}>Plan</Text>
            <View style={adminStyles.optionRow}>
              {PLAN_OPTIONS.map((option) => {
                const selected = editPlan === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setEditPlan(option)}
                    style={[adminStyles.optionPill, selected && adminStyles.optionPillActive]}
                  >
                    <Text style={[adminStyles.optionPillText, selected && adminStyles.optionPillTextActive]}>
                      {formatPlanName(option)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={adminStyles.fieldLabel}>Estado suscripción</Text>
            <View style={adminStyles.optionRow}>
              {SUBSCRIPTION_OPTIONS.map((option) => {
                const selected = editSubscriptionStatus === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setEditSubscriptionStatus(option)}
                    style={[adminStyles.optionPill, selected && adminStyles.optionPillActive]}
                  >
                    <Text style={[adminStyles.optionPillText, selected && adminStyles.optionPillTextActive]}>
                      {subscriptionStatusLabel(option)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={adminStyles.fieldLabel}>Expira el</Text>
            <TextInput
              value={editExpiryInput}
              onChangeText={setEditExpiryInput}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#607D8B"
              style={adminStyles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={adminStyles.helperText}>Deja el campo vacío si quieres limpiar la fecha.</Text>

            {saveError ? <Text style={adminStyles.errorText}>{saveError}</Text> : null}
            {saveSuccess ? <Text style={adminStyles.successText}>{saveSuccess}</Text> : null}

            <View style={adminStyles.inlineActions}>
              <TouchableOpacity
                onPress={handleSaveSubscription}
                disabled={savingSubscription}
                style={[adminStyles.primaryButton, savingSubscription && { opacity: 0.7 }]}
              >
                <Text style={adminStyles.primaryButtonText}>
                  {savingSubscription ? "Guardando..." : "Guardar cambios"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={adminStyles.sectionCard}>
            <Text style={adminStyles.sectionTitle}>Contadores</Text>
            <View style={adminStyles.statsGrid}>
              <View style={adminStyles.statCard}>
                <Text style={adminStyles.statLabel}>Usuarios</Text>
                <Text style={adminStyles.statValue}>{selectedItem.counters.totalUsuarios}</Text>
              </View>
              <View style={adminStyles.statCard}>
                <Text style={adminStyles.statLabel}>Push del mes</Text>
                <Text style={adminStyles.statValue}>{selectedItem.counters.notificacionesMes}</Text>
              </View>
              <View style={adminStyles.statCard}>
                <Text style={adminStyles.statLabel}>Correos del mes</Text>
                <Text style={adminStyles.statValue}>{selectedItem.counters.correosMes}</Text>
              </View>
              <View style={adminStyles.statCard}>
                <Text style={adminStyles.statLabel}>Mes de conteo</Text>
                <Text style={adminStyles.statValue}>{selectedItem.counters.mesConteo || "--"}</Text>
              </View>
            </View>
          </View>

          <View style={adminStyles.sectionCard}>
            <Text style={adminStyles.sectionTitle}>Datos generales</Text>
            <View style={adminStyles.infoList}>
              <Text style={adminStyles.infoLine}>{`Teléfono: ${selectedItem.telefono || "--"}`}</Text>
              <Text style={adminStyles.infoLine}>{`Región: ${selectedItem.region || "--"}`}</Text>
              <Text style={adminStyles.infoLine}>{`Ciudad: ${selectedItem.ciudad || "--"}`}</Text>
              <Text style={adminStyles.infoLine}>{`Dirección: ${selectedItem.direccion || "--"}`}</Text>
              <Text style={adminStyles.infoLine}>{`Fecha de registro: ${formatDate(selectedItem.fechaRegistro)}`}</Text>
              <Text style={adminStyles.infoLine}>{`Expira el: ${formatDate(selectedItem.expiraEl)}`}</Text>
              <Text style={adminStyles.infoLine}>{`Activo: ${selectedItem.activa ? "Sí" : "No"}`}</Text>
            </View>
          </View>

          <View style={adminStyles.sectionCard}>
            <Text style={adminStyles.sectionTitle}>Wallet</Text>
            <View style={adminStyles.infoList}>
              <Text style={adminStyles.infoLine}>{`wallet-class-id: ${selectedItem.walletClassId || "--"}`}</Text>
              <Text style={adminStyles.infoLine}>Link de registro:</Text>
              <Text selectable style={adminStyles.linkText}>
                {selectedItem.linkRegistro || "--"}
              </Text>
            </View>
          </View>

          <View style={adminStyles.sectionCard}>
            <Text style={adminStyles.sectionTitle}>Acciones</Text>
            <View style={adminStyles.inlineActions}>
              <TouchableOpacity onPress={handleOpenClients} style={adminStyles.secondaryButton}>
                <Text style={adminStyles.secondaryButtonText}>Ver clientes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleOpenHistory} style={adminStyles.secondaryButton}>
                <Text style={adminStyles.secondaryButtonText}>Ver historial</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={[cStyles.modalActions, { marginTop: 12, justifyContent: "center" }]}>
          <TouchableOpacity onPress={closeCompanyModal} style={adminStyles.outlineButton}>
            <Text style={adminStyles.outlineButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderClientsView = () => {
    if (clientsLoading) {
      return (
        <View style={adminStyles.centerState}>
          <ActivityIndicator size="large" color="#8ecae6" />
          <Text style={adminStyles.subtleText}>Cargando clientes...</Text>
        </View>
      );
    }

    if (clientsError) {
      return <Text style={adminStyles.errorText}>{clientsError}</Text>;
    }

    if (companyClients.length === 0) {
      return <Text style={adminStyles.subtleText}>Esta empresa todavía no tiene clientes registrados.</Text>;
    }

    return (
      <ScrollView style={{ width: "100%", maxHeight: 500 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        {companyClients.map((client) => (
          <View key={client.id} style={adminStyles.sectionCard}>
            <View style={{ gap: 4 }}>
              <Text style={adminStyles.companyTitle}>{client.nombreCompleto}</Text>
              <Text style={adminStyles.subtleText}>{client.email || "Sin correo"}</Text>
              <Text style={adminStyles.smallMutedText}>{`ID: ${client.id}`}</Text>
            </View>

            <View style={adminStyles.chipsRow}>
              <View style={adminStyles.infoChip}>
                <Text style={adminStyles.infoChipText}>{client.activo ? "Activo" : "Inactivo"}</Text>
              </View>
              <View style={adminStyles.infoChip}>
                <Text style={adminStyles.infoChipText}>{`SO: ${client.so || "--"}`}</Text>
              </View>
              <View style={adminStyles.infoChip}>
                <Text style={adminStyles.infoChipText}>{`Visitas: ${client.visitasTotales}`}</Text>
              </View>
            </View>

            <View style={adminStyles.infoList}>
              <Text style={adminStyles.infoLine}>{`Teléfono: ${client.telefono || "--"}`}</Text>
              <Text style={adminStyles.infoLine}>{`Nacimiento: ${formatShortDate(client.fechaNacimiento)}`}</Text>
              <Text style={adminStyles.infoLine}>{`Creado: ${formatDate(client.creadoEn)}`}</Text>
              <Text style={adminStyles.infoLine}>{`Última visita: ${formatDate(client.ultimaVisita)}`}</Text>
              <Text style={adminStyles.infoLine}>{`Ciclo: ${client.cicloVisitas}`}</Text>
              <Text style={adminStyles.infoLine}>{`Premios disponibles: ${client.premiosDisponibles}`}</Text>
              <Text style={adminStyles.infoLine}>{`Premios canjeados: ${client.premiosCanjeados}`}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderHistoryView = () => {
    if (historyLoading) {
      return (
        <View style={adminStyles.centerState}>
          <ActivityIndicator size="large" color="#8ecae6" />
          <Text style={adminStyles.subtleText}>Cargando historial...</Text>
        </View>
      );
    }

    if (historyError) {
      return <Text style={adminStyles.errorText}>{historyError}</Text>;
    }

    if (companyHistory.length === 0) {
      return <Text style={adminStyles.subtleText}>Esta empresa todavía no tiene notificaciones registradas.</Text>;
    }

    return (
      <ScrollView style={{ width: "100%", maxHeight: 500 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        {companyHistory.map((historyItem) => {
          const colors = historyStatusColors(historyItem.estado);
          return (
            <View key={historyItem.id} style={adminStyles.sectionCard}>
              <View style={adminStyles.historyHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={adminStyles.companyTitle}>{formatDate(historyItem.fechaEnvio)}</Text>
                  <Text style={adminStyles.subtleText}>{`${historyItem.totalClientes} destinatarios`}</Text>
                </View>

                <View
                  style={[
                    adminStyles.statusChip,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[adminStyles.statusChipText, { color: colors.text }]}>
                    {historyStatusLabel(historyItem.estado)}
                  </Text>
                </View>
              </View>

              <View style={adminStyles.chipsRow}>
                <View style={adminStyles.infoChip}>
                  <Text style={adminStyles.infoChipText}>{`Enviadas: ${historyItem.totalEnviados}`}</Text>
                </View>
                <View style={adminStyles.infoChip}>
                  <Text style={adminStyles.infoChipText}>{`Fallidas: ${historyItem.totalFallidos}`}</Text>
                </View>
              </View>

              <View style={adminStyles.messageCard}>
                <Text style={adminStyles.messageCardLabel}>Mensaje</Text>
                <Text style={adminStyles.messageCardText}>
                  {historyItem.mensaje || "Sin mensaje"}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={adminStyles.centerState}>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text style={adminStyles.subtleText}>Cargando empresas...</Text>
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
            <TouchableOpacity onPress={onBack} style={adminStyles.backButton}>
              <Ionicons name="arrow-back-outline" size={18} color="#023047" />
              <Text style={adminStyles.backButtonText}>Volver</Text>
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

        <Text style={adminStyles.countText}>{`${filteredItems.length} empresa(s)`}</Text>

        {error ? <Text style={adminStyles.errorText}>{error}</Text> : null}

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCompanies(true)} />}
          ListEmptyComponent={<Text style={adminStyles.subtleText}>No hay empresas registradas.</Text>}
          renderItem={({ item }) => {
            const walletColors = walletStatusColors(item.walletConfigurado, item.estadoWallet);
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => openCompanyDetail(item)}
                style={adminStyles.companyCard}
              >
                <View style={adminStyles.companyCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={adminStyles.companyCardTitle}>{item.nombre}</Text>
                    <Text style={adminStyles.subtleText} numberOfLines={1} ellipsizeMode="tail">
                      {item.email || item.id}
                    </Text>
                    <Text style={adminStyles.smallMutedText}>
                      {`Plan: ${formatPlanName(item.plan)} | Registro: ${formatShortDate(item.fechaRegistro)}`}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      setShowEmulationInfo(true);
                    }}
                    style={adminStyles.emulationButton}
                  >
                    <Text style={adminStyles.emulationButtonText}>Emular</Text>
                  </TouchableOpacity>
                </View>

                <View style={adminStyles.chipsRow}>
                  <View style={adminStyles.infoChip}>
                    <Text style={adminStyles.infoChipText}>{`Usuarios: ${item.counters.totalUsuarios}`}</Text>
                  </View>
                  <View style={adminStyles.infoChip}>
                    <Text style={adminStyles.infoChipText}>{`Push: ${item.counters.notificacionesMes}`}</Text>
                  </View>
                  <View style={adminStyles.infoChip}>
                    <Text style={adminStyles.infoChipText}>{`Plan: ${formatPlanName(item.plan)}`}</Text>
                  </View>
                  <View style={adminStyles.infoChip}>
                    <Text style={adminStyles.infoChipText}>
                      {`Suscripción: ${subscriptionStatusLabel(item.estadoSuscripcion)}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      adminStyles.statusChip,
                      {
                        backgroundColor: walletColors.bg,
                        borderColor: walletColors.border,
                      },
                    ]}
                  >
                    <Text style={[adminStyles.statusChipText, { color: walletColors.text }]}>
                      {walletStatusLabel(item.walletConfigurado, item.estadoWallet)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="fade"
        onRequestClose={closeCompanyModal}
      >
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, adminStyles.modalCard]}>
            {renderModalHeader()}
            {selectedView === "detail"
              ? renderCompanyDetail()
              : selectedView === "clients"
                ? renderClientsView()
                : renderHistoryView()}
          </View>
        </View>
      </Modal>

      <Modal visible={showEmulationInfo} transparent animationType="fade" onRequestClose={() => setShowEmulationInfo(false)}>
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 420, width: "90%" }]}>
            <Text style={cStyles.modalTitle}>Emular empresa</Text>
            <Text style={adminStyles.infoLine}>
              Desarrollar en el futuro la función de emular.
            </Text>

            <View style={[cStyles.modalActions, { marginTop: 14, justifyContent: "center" }]}>
              <TouchableOpacity
                onPress={() => setShowEmulationInfo(false)}
                style={adminStyles.outlineButton}
              >
                <Text style={adminStyles.outlineButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const adminStyles = StyleSheet.create({
  centerState: {
    marginTop: 20,
    alignItems: "center",
    gap: 10,
  },
  subtleText: {
    color: "#60707D",
  },
  smallMutedText: {
    color: "#60707D",
    marginTop: 2,
    fontSize: 12,
  },
  countText: {
    color: "#60707D",
    marginBottom: 10,
  },
  errorText: {
    color: "#C62828",
    marginBottom: 8,
  },
  successText: {
    color: "#2E7D32",
    fontWeight: "700",
    marginTop: 8,
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backButtonText: {
    color: "#023047",
    fontWeight: "700",
  },
  companyCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E6EA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  companyCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  companyCardTitle: {
    color: "#123042",
    fontSize: 16,
    fontWeight: "700",
  },
  emulationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B42318",
    backgroundColor: "#FFF5F4",
  },
  emulationButtonText: {
    color: "#B42318",
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF7FD",
    borderWidth: 1,
    borderColor: "#D8E4EE",
  },
  infoChipText: {
    color: "#023047",
    fontSize: 12,
    fontWeight: "700",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalCard: {
    maxWidth: 620,
    width: "94%",
    maxHeight: "86%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalSubtitle: {
    color: "#60707D",
    marginTop: 2,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8E4EE",
    backgroundColor: "#F8FBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCard: {
    backgroundColor: "#F8FBFE",
    borderWidth: 1,
    borderColor: "#E0EAF1",
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: "#123042",
    fontWeight: "800",
    fontSize: 16,
  },
  companyTitle: {
    color: "#023047",
    fontWeight: "800",
    fontSize: 18,
  },
  fieldLabel: {
    color: "#60707D",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D2E2EE",
    backgroundColor: "#FFFFFF",
  },
  optionPillActive: {
    backgroundColor: "#EAF5FF",
    borderColor: "#8ecae6",
  },
  optionPillText: {
    color: "#023047",
    fontSize: 13,
    fontWeight: "700",
  },
  optionPillTextActive: {
    color: "#0A6F88",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2E2EE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    color: "#023047",
    fontSize: 15,
  },
  helperText: {
    color: "#60707D",
    fontSize: 12,
    marginTop: -4,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D2E2EE",
  },
  secondaryButtonText: {
    color: "#023047",
    fontWeight: "800",
  },
  outlineButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#023047",
    backgroundColor: "#fff",
  },
  outlineButtonText: {
    color: "#023047",
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    minWidth: 120,
    flexGrow: 1,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0EAF1",
    padding: 12,
    gap: 6,
  },
  statLabel: {
    color: "#60707D",
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    color: "#123042",
    fontSize: 18,
    fontWeight: "800",
  },
  infoList: {
    gap: 6,
  },
  infoLine: {
    color: "#123042",
  },
  linkText: {
    color: "#175CD3",
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  messageCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0EAF1",
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 6,
  },
  messageCardLabel: {
    color: "#60707D",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  messageCardText: {
    color: "#123042",
    lineHeight: 20,
  },
});
