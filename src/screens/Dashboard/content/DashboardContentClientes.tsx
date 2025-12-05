import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../services/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
} from "firebase/firestore";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { clientesStyles as cStyles } from "../../../styles/ClientesStyles";
import { mapDoc, filterItems, sortItems, Cliente } from "../../../utils/clientesHelpers";

const PAGE_SIZE = 20;
const IS_WEB = Platform.OS === "web";

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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [sending, setSending] = useState(false);

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

  const toggleSort = () => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allIds = sortedItems.map((it) => it.id);
      const next = new Set(prev);
      const allSelected = allIds.every((id) => next.has(id));
      if (allSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const allVisibleSelected = sortedItems.length > 0 && sortedItems.every((it) => selectedIds.has(it.id));

  const handleSendEmail = async () => {
    if (!selectedCount) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailStatus("Asunto y cuerpo son obligatorios.");
      return;
    }
    setSending(true);
    setEmailStatus("Enviando (placeholder)...");
    // TODO: conectar con backend de correo (Resend/Cloud Function)
    setTimeout(() => {
      setSending(false);
      setEmailStatus(`Enviado a ${selectedCount} clientes (simulado).`);
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
    }, 800);
  };

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <View style={[cStyles.checkbox, checked && cStyles.checkboxChecked]}>
      {checked ? <Ionicons name="checkmark" size={14} color="#2e7d32" /> : null}
    </View>
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

  const HeaderWeb = () => (
    <View style={cStyles.headerRow}>
      <TouchableOpacity onPress={toggleSelectAll} style={cStyles.checkboxHitbox}>
        <Checkbox checked={allVisibleSelected} />
      </TouchableOpacity>
      <TouchableOpacity style={{ flex: 2 }} onPress={toggleSort}>
        <Text style={cStyles.headerText}>Nombre</Text>
      </TouchableOpacity>
      <Text style={[cStyles.headerText, { flex: 2 }]}>Email</Text>
      <Text style={[cStyles.headerText, { flex: 1.4 }]}>Telefono</Text>
      <Text style={[cStyles.headerText, { flex: 1, textAlign: "center" }]}>SO</Text>
      <TouchableOpacity style={{ flex: 1.2 }} onPress={toggleSort}>
        <Text style={[cStyles.headerText, { textAlign: "right" }]}>
          Última visita {sortOrder === "desc" ? "↓" : "↑"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const RowWeb = ({ item }: { item: Cliente }) => {
    const selected = selectedIds.has(item.id);
    const fecha = item.ultimaVisita || item.creadoEn;
    return (
      <View style={[cStyles.row, selected && cStyles.cardSelected]}>
        <TouchableOpacity onPress={() => toggleSelect(item.id)} style={cStyles.checkboxHitbox}>
          <Checkbox checked={selected} />
        </TouchableOpacity>
        <Text style={{ flex: 2 }} numberOfLines={1} ellipsizeMode="tail">
          {item.nombreCompleto || "--"}
        </Text>
        <Text style={{ flex: 2 }} numberOfLines={1} ellipsizeMode="tail">
          {item.email || "--"}
        </Text>
        <Text style={{ flex: 1.4 }} numberOfLines={1} ellipsizeMode="tail">
          {item.telefono || "--"}
        </Text>
        <Text style={{ flex: 1, textAlign: "center" }}>
          {item.so || "--"}
        </Text>
        <Text style={{ flex: 1.2, textAlign: "right" }}>
          {fecha ? fecha.toLocaleDateString() : "--"}
        </Text>
      </View>
    );
  };

  const CardMobile = ({ item }: { item: Cliente }) => (
    <TouchableOpacity onPress={() => toggleSelect(item.id)} activeOpacity={0.9}>
      <View
        style={[
          cStyles.card,
          selectedIds.has(item.id) && cStyles.cardSelected,
        ]}
      >
        <View style={cStyles.cardHeader}>
          <Checkbox checked={selectedIds.has(item.id)} />
          <Text style={{ fontWeight: "bold", flex: 1 }} numberOfLines={1}>
            {item.nombreCompleto || "--"}
          </Text>
        </View>

        <Text style={cStyles.cardSub} numberOfLines={1} ellipsizeMode="tail">
          {item.email || "--"}
        </Text>

        <View style={cStyles.cardFooter}>
          <Text style={cStyles.cardFooterText} numberOfLines={1} ellipsizeMode="tail">
            {item.telefono || "--"}
          </Text>
          <View style={{ flexDirection: "column", alignItems: "flex-end", flex: 1 }}>
            <Text style={cStyles.cardFooterText}>{item.so || "--"}</Text>
            <Text style={cStyles.cardFooterText}>
              {(item.ultimaVisita || item.creadoEn)
                ? (item.ultimaVisita || item.creadoEn)?.toLocaleDateString()
                : "--"}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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

        <TouchableOpacity
          onPress={() => setShowFilter(true)}
          style={cStyles.filterButton}
        >
          <Text style={cStyles.filterButtonText}>Filtro</Text>
        </TouchableOpacity>
      </View>

      {(search.trim() || filterOS !== "all") && (
        <View style={cStyles.chipsRow}>
          <Text style={cStyles.chipsLabel}>Filtros aplicados:</Text>

          {search.trim() ? (
            <View style={cStyles.chip}>
              <Text style={cStyles.chipText}>Busca “{search.trim()}”</Text>
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

      <TouchableOpacity
        onPress={() => setShowEmailModal(true)}
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

            <TouchableOpacity
              onPress={() => setShowFilter(false)}
              style={cStyles.modalClose}
            >
              <Text style={{ color: "#555" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de enviar correo */}
      <Modal visible={showEmailModal} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, { maxWidth: 420 }]}>
            <Text style={cStyles.modalTitle}>
              Enviar correo ({selectedCount} destinatarios)
            </Text>
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
            {emailStatus ? (
              <Text style={{ color: "#023047" }}>{emailStatus}</Text>
            ) : null}
            <View style={cStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Text style={{ color: "#555" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendEmail}
                disabled={sending}
                style={[
                  cStyles.modalPrimaryButton,
                  sending && { opacity: 0.7 },
                ]}
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
          {items.length === 0
            ? "No hay clientes registrados aun."
            : "No se encontraron coincidencias."}
        </Text>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={IS_WEB ? <HeaderWeb /> : null}
          renderItem={({ item }) =>
            IS_WEB ? <RowWeb item={item} /> : <CardMobile item={item} />
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
