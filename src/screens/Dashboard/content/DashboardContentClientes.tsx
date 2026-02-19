import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Platform,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../services/firebaseConfig";
import { notifyApplePass, notifyAndroidPass } from "../../../services/apiWallet";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { clientesStyles as cStyles } from "../../../styles/ClientesStyles";
import { mapDoc, filterItems, sortItems, Cliente } from "../../../utils/clientesHelpers";

const PAGE_SIZE = 20;
const IS_WEB = Platform.OS === "web";

function osIconName(so?: string) {
  const s = (so || "").toLowerCase();
  if (s === "android") return "logo-android";
  if (s === "ios" || s === "iphone" || s === "apple") return "logo-apple";
  return "help-circle-outline";
}

function formatSO(so?: string) {
  const s = (so || "").toLowerCase();
  if (s === "ios") return "iOS";
  if (s === "android") return "Android";
  return so || "--";
}

function formatDate(d?: Date | null) {
  if (!d) return "--";
  try {
    return d.toLocaleDateString();
  } catch {
    return "--";
  }
}

export default function DashboardContentClientes() {
  const uid = auth.currentUser?.uid;

  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterOS, setFilterOS] = useState<"all" | "ios" | "android">("all");
  const [showFilter, setShowFilter] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Placeholder email modal (kept)
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [emailMode, setEmailMode] = useState<"bulk" | "single">("bulk");
  const [emailTarget, setEmailTarget] = useState<Cliente | null>(null);

  const [detailClient, setDetailClient] = useState<Cliente | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pushTarget, setPushTarget] = useState<Cliente | null>(null);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushBody, setPushBody] = useState("");
  const [pushStatus, setPushStatus] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pushSent, setPushSent] = useState(false);
  const [pushMode, setPushMode] = useState<"single" | "bulk">("single");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const closePushModal = () => {
    setShowPushModal(false);
    setPushTarget(null);
    setPushBody("");
    setPushStatus("");
    setSendingPush(false);
    setPushSent(false);
    setPushMode("single");
  };
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateDone, setDeactivateDone] = useState(false);

  const loadFirstPage = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "Empresas", uid, "Clientes"),
        orderBy("creadoEn", "desc"),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(mapDoc);
      setItems(list);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e: any) {
      console.error(e);
      setError("No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!uid || !hasMore || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "Empresas", uid, "Clientes"),
        orderBy("creadoEn", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const more = snap.docs.map(mapDoc);
      setItems((prev) => [...prev, ...more]);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [uid, hasMore, lastDoc, loadingMore]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const filteredItems = useMemo(
    () => filterItems(items, search, filterOS),
    [items, search, filterOS]
  );

  const sortedItems = useMemo(
    () => sortItems(filteredItems, sortOrder),
    [filteredItems, sortOrder]
  );

  const toggleSort = useCallback(
    () => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc")),
    []
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = sortedItems.map((it) => it.id);
      const next = new Set(prev);
      const allSelected = allIds.length > 0 && allIds.every((id) => next.has(id));
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  }, [sortedItems]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    sortedItems.length > 0 && sortedItems.every((it) => selectedIds.has(it.id));

  const openDetail = useCallback((client: Cliente) => {
    setDetailClient(client);
    setShowDetail(true);
    setConfirmDeactivate(false);
    setDeactivateError(null);
    setDeactivateDone(false);
  }, []);

  const openSingleEmail = useCallback((client: Cliente) => {
    setEmailMode("single");
    setEmailTarget(client);
    setEmailStatus("");
    setEmailSubject("");
    setEmailBody("");
    setShowEmailModal(true);
  }, []);

  const openPush = useCallback((client: Cliente) => {
    setPushTarget(client);
    setPushMode("single");
    setPushBody("");
    setPushStatus("");
    setPushSent(false);
    setSendingPush(false);
    setShowPushModal(true);
  }, []);

  const requestDeactivate = () => {
    setConfirmDeactivate(true);
    setDeactivateError(null);
    setDeactivateDone(false);
  };

  const cancelDeactivate = () => {
    setConfirmDeactivate(false);
    setDeactivateError(null);
  };

  const confirmDeactivateUser = useCallback(async () => {
    if (!uid || !detailClient?.id) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      const ref = doc(db, "Empresas", uid, "Clientes", detailClient.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setDeactivateError("No se encontro el cliente. Refresca e intenta nuevamente.");
        return;
      }
      await updateDoc(ref, {
        activo: false,
      });

      setItems((prev) =>
        prev.map((it) => (it.id === detailClient.id ? { ...it, activo: false } : it))
      );
      setDetailClient((prev) => (prev ? { ...prev, activo: false } : prev));
      setDeactivateDone(true);
      setConfirmDeactivate(false);
    } catch (e: any) {
      console.error("Error desactivando cliente:", e);
      setDeactivateError("No se pudo desactivar el usuario. Intenta nuevamente.");
    } finally {
      setDeactivating(false);
    }
  }, [uid, detailClient?.id]);

  const handleSendEmail = async () => {
    const recipientCount = emailMode === "single" ? (emailTarget ? 1 : 0) : selectedCount;
    if (!recipientCount) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailStatus("Asunto y cuerpo son obligatorios.");
      return;
    }
    setSending(true);
    setEmailStatus("Enviando (placeholder)...");
    setTimeout(() => {
      setSending(false);
      setEmailStatus(`Enviado a ${recipientCount} cliente(s) (simulado).`);
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
      setEmailTarget(null);
      setEmailMode("bulk");
    }, 800);
  };

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <View style={[cStyles.checkbox, checked && cStyles.checkboxChecked]}>
      {checked ? (
        <Ionicons name="checkmark" size={14} color="#2e7d32" />
      ) : null}
    </View>
  );

  const ActionIconButton = ({
    icon,
    label,
    onPress,
  }: {
    icon: any;
    label: string;
    onPress: () => void;
  }) => {
    const [hover, setHover] = useState(false);
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={cStyles.iconButton}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {IS_WEB && hover ? (
          <View style={cStyles.tooltip}>
            <Text style={cStyles.tooltipText}>{label}</Text>
          </View>
        ) : null}
        <Ionicons name={icon} size={18} color="#023047" />
      </Pressable>
    );
  };

  const StatBadge = ({
    icon,
    label,
    value,
  }: {
    icon: any;
    label: string;
    value: number;
  }) => {
    const [hover, setHover] = useState(false);
    return (
      <Pressable
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={cStyles.statBadge}
      >
        {IS_WEB && hover ? (
          <View style={cStyles.tooltip}>
            <Text style={cStyles.tooltipText}>{`${label}: ${value}`}</Text>
          </View>
        ) : null}
        <Ionicons name={icon} size={14} color="#023047" />
      </Pressable>
    );
  };

  const HeaderWeb = () => (
    <View style={cStyles.headerRow}>
      <TouchableOpacity onPress={toggleSelectAll} style={cStyles.checkboxHitbox}>
        <Checkbox checked={allVisibleSelected} />
      </TouchableOpacity>

      <TouchableOpacity style={{ flex: 2.8 }} onPress={toggleSort}>
        <Text style={cStyles.headerText}>Cliente</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
        onPress={toggleSort}
      >
        <Ionicons name="calendar-outline" size={16} color="#023047" />
        <Text style={[cStyles.headerText, { textAlign: "center" }]}>Ultima visita</Text>
        <Ionicons
          name={sortOrder === "desc" ? "chevron-down" : "chevron-up"}
          size={16}
          color="#023047"
        />
      </TouchableOpacity>

      {IS_WEB ? (
        <View style={{ width: 160, alignItems: "center", paddingRight: 8 }}>
          <Text style={[cStyles.headerText, { textAlign: "center" }]}>Estadisticas</Text>
        </View>
      ) : null}

      <Text style={[cStyles.headerText, { width: 170, textAlign: "center" }]}>
        Acciones
      </Text>
    </View>
  );

  const RowWebBase = ({
    item,
    index,
    selected,
  }: {
    item: Cliente;
    index: number;
    selected: boolean;
  }) => {
    const fecha = item.ultimaVisita || item.creadoEn;
    const icon = osIconName(item.so);
    const soText = formatSO(item.so);
    const visitasTotales = Number(item.visitasTotales ?? 0);
    const cicloVisitas = Number(item.cicloVisitas ?? 0);
    const premiosDisponibles = Number(item.premiosDisponibles ?? 0);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => toggleSelect(item.id)}
        style={[cStyles.row, index % 2 === 0 && cStyles.rowEven, selected && cStyles.cardSelected]}
      >
        <View style={cStyles.checkboxHitbox}>
          <Checkbox checked={selected} />
        </View>

        <View style={[cStyles.nameCell, { flex: 2.8 }]}>
          <Ionicons
            name={icon as any}
            size={16}
            color={soText === "Android" ? "#2e7d32" : soText === "iOS" ? "#111" : "#607d8b"}
          />
          <Text style={cStyles.nameText} numberOfLines={1} ellipsizeMode="tail">
            {item.nombreCompleto || "--"}
          </Text>
        </View>

        <Text style={{ flex: 1.4, textAlign: "center" }}>{formatDate(fecha)}</Text>

        {IS_WEB ? (
          <View style={{ width: 160, alignItems: "center", paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <StatBadge label="Visitas totales" value={visitasTotales} icon="footsteps-outline" />
              <StatBadge label="Ciclo visitas" value={cicloVisitas} icon="repeat-outline" />
              <StatBadge label="Premios disponibles" value={premiosDisponibles} icon="gift-outline" />
            </View>
          </View>
        ) : null}

        <View style={{ width: 170, alignItems: "flex-end", paddingLeft: 12 }}>
          <View style={cStyles.rowActions}>
            <ActionIconButton icon="notifications-outline" label="Enviar notificacion" onPress={() => openPush(item)} />
            <ActionIconButton icon="mail-outline" label="Enviar correo" onPress={() => openSingleEmail(item)} />
            <TouchableOpacity onPress={() => openDetail(item)} style={cStyles.detailsButton}>
              <Text style={cStyles.detailsButtonText}>Ver detalles</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const CardMobileBase = ({
    item,
    selected,
  }: {
    item: Cliente;
    selected: boolean;
  }) => {
    const fecha = item.ultimaVisita || item.creadoEn;
    const icon = osIconName(item.so);
    const soText = formatSO(item.so);
    const visitasTotales = Number(item.visitasTotales ?? 0);
    const cicloVisitas = Number(item.cicloVisitas ?? 0);
    const premiosDisponibles = Number(item.premiosDisponibles ?? 0);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => toggleSelect(item.id)}
        style={[cStyles.card, selected && cStyles.cardSelected]}
      >
        <View style={cStyles.cardHeader}>
          <Checkbox checked={selected} />
          <Ionicons
            name={icon as any}
            size={18}
            color={soText === "Android" ? "#2e7d32" : soText === "iOS" ? "#111" : "#607d8b"}
          />
          <Text style={{ fontWeight: "bold", flex: 1 }} numberOfLines={1}>
            {item.nombreCompleto || "--"}
          </Text>
        </View>

        <View style={cStyles.cardFooter}>
          <Text style={cStyles.cardFooterText}>Ultima visita: {formatDate(fecha)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Ionicons name="gift-outline" size={16} color="#023047" />
            <Text style={{ color: "#023047", fontWeight: "700" }}>{premiosDisponibles}</Text>
          </View>
          <View style={cStyles.rowActions}>
            <ActionIconButton icon="notifications-outline" label="Enviar notificacion" onPress={() => openPush(item)} />
            <ActionIconButton icon="mail-outline" label="Enviar correo" onPress={() => openSingleEmail(item)} />
            <TouchableOpacity onPress={() => openDetail(item)} style={cStyles.detailsButton}>
              <Text style={cStyles.detailsButtonText}>Ver detalles</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const RowWeb = useMemo(
    () =>
      React.memo(
        RowWebBase,
        (prev, next) =>
          prev.item === next.item && prev.selected === next.selected && prev.index === next.index
      ),
    [openDetail, openPush, openSingleEmail, toggleSelect]
  );

  const CardMobile = useMemo(
    () =>
      React.memo(
        CardMobileBase,
        (prev, next) => prev.item === next.item && prev.selected === next.selected
      ),
    [openDetail, openPush, openSingleEmail, toggleSelect]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Cliente; index: number }) => {
      const selected = selectedIds.has(item.id);
      return IS_WEB ? (
        <RowWeb item={item} index={index} selected={selected} />
      ) : (
        <CardMobile item={item} selected={selected} />
      );
    },
    [selectedIds, RowWeb, CardMobile]
  );

  if (!uid) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Clientes</Text>
        <Text>Debes iniciar sesion para ver tus clientes.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Clientes</Text>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text>Cargando clientes...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>Clientes</Text>

      <View style={cStyles.searchRow}>
        <TextInput
          placeholder="Buscar por nombre, email o ID"
          value={search}
          onChangeText={setSearch}
          style={cStyles.searchInput}
        />

        <TouchableOpacity onPress={() => setShowFilter(true)} style={cStyles.filterButton}>
          <Text style={cStyles.filterButtonText}>Filtro</Text>
        </TouchableOpacity>
      </View>

      {(search.trim() || filterOS !== "all") && (
        <View style={cStyles.chipsRow}>
          <Text style={cStyles.chipsLabel}>Filtros aplicados:</Text>

          {search.trim() ? (
            <View style={cStyles.chip}>
              <Text style={cStyles.chipText}>Busca "{search.trim()}"</Text>
            </View>
          ) : null}

          {filterOS !== "all" ? (
            <View style={[cStyles.chip, cStyles.chipGreen]}>
              <Text style={cStyles.chipGreenText}>
                SO: {filterOS === "ios" ? "Apple (iOS)" : "Android"}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={cStyles.metaRow}>
        <Text style={cStyles.metaText}>
          Total: {sortedItems.length}
          {selectedCount ? ` | Seleccionados: ${selectedCount}` : ""}
        </Text>
        <TouchableOpacity onPress={toggleSelectAll} style={cStyles.selectAllButton}>
          <Text style={cStyles.selectAllButtonText}>
            {allVisibleSelected ? "Quitar seleccion" : "Seleccionar todo"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
        <TouchableOpacity
          onPress={() => {
            setEmailMode("bulk");
            setEmailTarget(null);
            setEmailStatus("");
            setShowEmailModal(true);
          }}
          disabled={selectedCount === 0}
          style={[
            cStyles.sendButton,
            selectedCount === 0 && cStyles.sendButtonDisabled,
          ]}
        >
          <Text
            style={[
              cStyles.sendButtonText,
              selectedCount === 0 && cStyles.sendButtonTextDisabled,
            ]}
          >
            Enviar correo ({selectedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setPushMode("bulk");
            setPushTarget(null);
            setPushStatus("");
            setPushBody("");
            setPushSent(false);
            setSendingPush(false);
            setShowPushModal(true);
          }}
          disabled={selectedCount === 0}
          style={[
            cStyles.sendButton,
            selectedCount === 0 && cStyles.sendButtonDisabled,
          ]}
        >
          <Text
            style={[
              cStyles.sendButtonText,
              selectedCount === 0 && cStyles.sendButtonTextDisabled,
            ]}
          >
            Enviar notificacion ({selectedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de filtros */}
      <Modal visible={showFilter} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={cStyles.modalCard}>
            <Text style={cStyles.modalTitle}>Filtrar por sistema operativo</Text>
            {[
              { label: "Todos", value: "all" as const },
              { label: "Apple (iOS)", value: "ios" as const },
              { label: "Android", value: "android" as const },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  setFilterOS(opt.value);
                  setShowFilter(false);
                }}
                style={[
                  cStyles.optionItem,
                  filterOS === opt.value && cStyles.optionItemActive,
                ]}
              >
                <Text
                  style={[
                    cStyles.optionText,
                    filterOS === opt.value && cStyles.optionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setShowFilter(false)} style={cStyles.modalClose}>
              <Text style={{ color: "#555" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Detalle cliente */}
      <Modal visible={showDetail} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 420 }]}>
            <Text style={cStyles.modalTitle}>Detalle del cliente</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={cStyles.detailTitle}>
                {detailClient?.nombreCompleto || "--"}
              </Text>
              <Text style={cStyles.detailRow}>
                SO: {formatSO(detailClient?.so)}
              </Text>
              <Text style={cStyles.detailRow}>
                Email: {detailClient?.email || "--"}
              </Text>
              <Text style={cStyles.detailRow}>
                Telefono: {detailClient?.telefono || "--"}
              </Text>
              <Text style={cStyles.detailRow}>
                Creado: {formatDate(detailClient?.creadoEn || null)}
              </Text>
          <Text style={cStyles.detailRow}>
            Ultima visita: {formatDate(detailClient?.ultimaVisita || null)}
          </Text>
          <Text style={cStyles.detailRow}>
            Visitas totales: {Number(detailClient?.visitasTotales ?? 0)}
          </Text>
          <Text style={cStyles.detailRow}>
            Ciclo visitas: {Number(detailClient?.cicloVisitas ?? 0)}
          </Text>
          <Text style={cStyles.detailRow}>
            Premios disponibles: {Number(detailClient?.premiosDisponibles ?? 0)}
          </Text>

              <View style={cStyles.detailDivider} />

              {deactivateDone ? (
                <Text style={cStyles.successText}>Usuario desactivado.</Text>
              ) : null}

              {detailClient?.activo === false ? (
                <Text style={cStyles.detailRow}>Estado: Desactivado</Text>
              ) : (
                <Text style={cStyles.detailRow}>Estado: Activo</Text>
              )}

              {deactivateError ? (
                <Text style={cStyles.errorText}>{deactivateError}</Text>
              ) : null}

              {detailClient?.activo !== false && !confirmDeactivate ? (
                <TouchableOpacity
                  onPress={requestDeactivate}
                  style={[cStyles.dangerButton, deactivating && { opacity: 0.7 }]}
                  disabled={deactivating}
                >
                  <Text style={cStyles.dangerButtonText}>
                    Desactivar usuario
                  </Text>
                </TouchableOpacity>
              ) : null}

              {confirmDeactivate ? (
                <View style={cStyles.confirmBox}>
                  <Text style={cStyles.confirmText}>
                    Confirmas desactivar este usuario?
                  </Text>
                  <View style={cStyles.confirmActions}>
                    <TouchableOpacity onPress={cancelDeactivate} disabled={deactivating}>
                      <Text style={{ color: "#555" }}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={confirmDeactivateUser}
                      disabled={deactivating}
                      style={[cStyles.modalPrimaryButton, deactivating && { opacity: 0.7 }]}
                    >
                      <Text style={cStyles.modalPrimaryText}>
                        {deactivating ? "Desactivando..." : "Confirmar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={cStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Text style={{ color: "#555" }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Notificacion push individual (placeholder) */}
      <Modal visible={showPushModal} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 420 }]}>
            <Text style={cStyles.modalTitle}>Notificacion push</Text>
            <Text style={cStyles.detailRow}>
              {pushMode === "single"
                ? `Cliente: ${pushTarget?.nombreCompleto || "--"}`
                : `Destinatarios: ${selectedCount}`}
            </Text>
            {pushSent ? (
              <>
                <Text style={{ color: "#2e7d32", fontWeight: "700", marginTop: 8 }}>Notificacion enviada.</Text>
                <View style={cStyles.modalActions}>
                  <TouchableOpacity
                    onPress={closePushModal}
                    style={{
                      alignSelf: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
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
            ) : (
              <>
                <TextInput
                  placeholder="Mensaje de la notificacion"
                  value={pushBody}
                  onChangeText={setPushBody}
                  multiline
                  numberOfLines={3}
                  style={[cStyles.input, { minHeight: 80, textAlignVertical: "top" }]}
                />
                {pushStatus ? <Text style={{ color: "#023047", marginTop: 4 }}>{pushStatus}</Text> : null}
                <View style={cStyles.modalActions}>
                  <TouchableOpacity
                    onPress={closePushModal}
                    style={{
                      alignSelf: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#023047",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ color: "#023047", fontWeight: "700" }}>Cerrar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      const targets =
                        pushMode === "single" && pushTarget
                          ? [pushTarget]
                          : items.filter((it) => selectedIds.has(it.id));
                      if (targets.length === 0) {
                        setPushStatus("No hay destinatarios.");
                        return;
                      }
                      if (!pushBody.trim()) {
                        setPushStatus("Ingresa un mensaje.");
                        return;
                      }
                      try {
                        setSendingPush(true);
                        setPushStatus("Enviando...");
                        let okCount = 0;
                        for (const tgt of targets) {
                          const isIOS = tgt.so === "ios";
                          const resp = isIOS
                            ? await notifyApplePass({ idUsuario: tgt.id, notificacion: pushBody.trim() })
                            : await notifyAndroidPass({ idUsuario: tgt.id, notificacion: pushBody.trim() });
                          if (resp.ok) okCount += 1;
                        }
                        setPushStatus(`Enviadas ${okCount}/${targets.length}`);
                        setPushBody("");
                        setPushSent(true);
                      } catch (err) {
                        setPushStatus(`Error: ${String(err)}`);
                      } finally {
                        setSendingPush(false);
                      }
                    }}
                    style={[cStyles.modalPrimaryButton, sendingPush && { opacity: 0.7 }]}
                    disabled={sendingPush}
                  >
                    <Text style={cStyles.modalPrimaryText}>{sendingPush ? "Enviando..." : "Enviar"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de enviar correo */}
      <Modal visible={showEmailModal} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 420 }]}>
            <Text style={cStyles.modalTitle}>
              {emailMode === "single"
                ? "Enviar correo (1 destinatario)"
                : `Enviar correo (${selectedCount} destinatarios)`}
            </Text>
            {emailMode === "single" && emailTarget ? (
              <Text style={{ color: "#555" }}>
                Para: {emailTarget.nombreCompleto || "--"}
              </Text>
            ) : null}
            <TextInput
              placeholder="Asunto"
              value={emailSubject}
              onChangeText={setEmailSubject}
              style={cStyles.input}
            />
            <TextInput
              placeholder="Cuerpo del correo"
              value={emailBody}
              onChangeText={setEmailBody}
              multiline
              numberOfLines={4}
              style={[cStyles.input, { minHeight: 100, textAlignVertical: "top" }]}
            />
            {emailStatus ? <Text style={{ color: "#023047" }}>{emailStatus}</Text> : null}
            <View style={cStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Text style={{ color: "#555" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendEmail}
                disabled={sending}
                style={[cStyles.modalPrimaryButton, sending && { opacity: 0.7 }]}
              >
                <Text style={cStyles.modalPrimaryText}>
                  {sending ? "Enviando..." : "Enviar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}

      {sortedItems.length === 0 ? (
        <Text>
          {items.length === 0 ? "No hay clientes registrados aun." : "No se encontraron coincidencias."}
        </Text>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={IS_WEB ? <HeaderWeb /> : null}
          renderItem={renderItem as any}
          extraData={selectedIds}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === "android"}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity onPress={loadMore} style={cStyles.loadMoreButton}>
                <Text style={cStyles.loadMoreText}>
                  {loadingMore ? "Cargando..." : "Cargar mas"}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ textAlign: "center", color: "#777", marginTop: 8 }}>
                Fin de la lista
              </Text>
            )
          }
        />
      )}
    </View>
  );
}


