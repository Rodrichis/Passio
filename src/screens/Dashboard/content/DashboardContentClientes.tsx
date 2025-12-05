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

type Cliente = {
  id: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  so?: "ios" | "android" | string;
  creadoEn?: Date | null;
  activo?: boolean;
};

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

  const mapDoc = (d: any): Cliente => {
    const data = d.data() || {};
    const nombre =
      data.nombreCompleto ?? data["Nombre completo"] ?? data.nombre ?? "";
    const so = data.so ?? data.SO ?? undefined;
    const creado =
      data.creadoEn?.toDate?.() ??
      data.fechaRegistro?.toDate?.() ??
      null;

    return {
      id: d.id,
      nombreCompleto: nombre,
      email: data.email ?? "",
      telefono: data.telefono ?? "",
      so,
      creadoEn: creado,
      activo: data.activo ?? true,
    };
  };

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

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((it) => {
      const termMatch =
        !term ||
        (it.nombreCompleto || "").toLowerCase().includes(term) ||
        (it.email || "").toLowerCase().includes(term) ||
        (it.id || "").toLowerCase().includes(term);

      const osMatch =
        filterOS === "all" ||
        (it.so || "").toLowerCase() === filterOS;

      return termMatch && osMatch;
    });
  }, [items, search, filterOS]);

  const sortedItems = useMemo(() => {
    const copy = filteredItems.slice();
    copy.sort((a, b) => {
      const aTime = a.creadoEn instanceof Date ? a.creadoEn.getTime() : 0;
      const bTime = b.creadoEn instanceof Date ? b.creadoEn.getTime() : 0;
      return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
    });
    return copy;
  }, [filteredItems, sortOrder]);

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
    // Aquí conectarás con tu backend (Resend/Node/Cloud Function)
    setTimeout(() => {
      setSending(false);
      setEmailStatus(`Enviado a ${selectedCount} clientes (simulado).`);
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
    }, 800);
  };

  // ---- UI components ----
  const Checkbox = ({ checked }: { checked: boolean }) => (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#023047",
        backgroundColor: checked ? "#2196F3" : "transparent",
      }}
    />
  );

  if (!uid) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Clientes</Text>
        <Text>Debes iniciar sesión para ver tus clientes.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Clientes</Text>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text>Cargando clientes…</Text>
      </View>
    );
  }

  const HeaderWeb = () => (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#e3f2fd",
        borderWidth: 1,
        borderColor: "#cfd8dc",
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 8,
        marginBottom: 8,
        alignItems: "center",
        gap: 8,
      }}
    >
      <TouchableOpacity onPress={toggleSelectAll} style={{ padding: 4 }}>
        <Checkbox checked={allVisibleSelected} />
      </TouchableOpacity>
      <TouchableOpacity style={{ flex: 2 }} onPress={toggleSort}>
        <Text style={{ fontWeight: "bold", color: "#023047" }}>Nombre</Text>
      </TouchableOpacity>
      <Text style={{ flex: 2, fontWeight: "bold", color: "#023047" }}>Email</Text>
      <Text style={{ flex: 1.4, fontWeight: "bold", color: "#023047" }}>Teléfono</Text>
      <TouchableOpacity style={{ flex: 1.2 }} onPress={toggleSort}>
        <Text style={{ fontWeight: "bold", color: "#023047", textAlign: "right" }}>
          SO / Fecha {sortOrder === "desc" ? "↓" : "↑"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const RowWeb = ({ item }: { item: Cliente }) => (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e0e0e0",
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 8,
        marginBottom: 8,
        alignItems: "center",
        gap: 8,
      }}
    >
      <TouchableOpacity onPress={() => toggleSelect(item.id)} style={{ padding: 4 }}>
        <Checkbox checked={selectedIds.has(item.id)} />
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
      <Text style={{ flex: 1.2, textAlign: "right" }}>
        {(item.so || "--") +
          (item.creadoEn ? ` · ${item.creadoEn.toLocaleDateString()}` : "")}
      </Text>
    </View>
  );

  const CardMobile = ({ item }: { item: Cliente }) => (
    <TouchableOpacity onPress={() => toggleSelect(item.id)} activeOpacity={0.9}>
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: selectedIds.has(item.id) ? "#2196F3" : "#e0e0e0",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 }}>
          <Checkbox checked={selectedIds.has(item.id)} />
          <Text style={{ fontWeight: "bold", flex: 1 }} numberOfLines={1}>
            {item.nombreCompleto || "--"}
          </Text>
        </View>

        <Text style={{ color: "#555", marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
          {item.email || "--"}
        </Text>

        <View
          style={{
            marginTop: 6,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ color: "#666", flex: 1 }} numberOfLines={1} ellipsizeMode="tail">
            {item.telefono || "--"}
          </Text>
          <Text style={{ color: "#666", textAlign: "right", flex: 1 }}>
            {(item.so || "--") +
              (item.creadoEn ? ` · ${item.creadoEn.toLocaleDateString()}` : "")}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>Clientes</Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <TextInput
          placeholder="Buscar por nombre, email o ID"
          value={search}
          onChangeText={setSearch}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 10,
            backgroundColor: "#fff",
          }}
        />

        <TouchableOpacity
          onPress={() => setShowFilter(true)}
          style={{
            paddingHorizontal: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#cfd8dc",
            backgroundColor: "#e3f2fd",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#023047", fontWeight: "600" }}>Filtro</Text>
        </TouchableOpacity>
      </View>

      {(search.trim() || filterOS !== "all") && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <Text style={{ color: "#023047", fontSize: 13, fontWeight: "600" }}>
            Filtros aplicados:
          </Text>

          {search.trim() ? (
            <View
              style={{
                backgroundColor: "#e3f2fd",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#023047", fontSize: 12 }}>
                Busca “{search.trim()}”
              </Text>
            </View>
          ) : null}

          {filterOS !== "all" ? (
            <View
              style={{
                backgroundColor: "#e8f5e9",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#2e7d32", fontSize: 12 }}>
                SO: {filterOS === "ios" ? "Apple (iOS)" : "Android"}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Botón de envío de correo */}
      <TouchableOpacity
        onPress={() => setShowEmailModal(true)}
        disabled={selectedCount === 0}
        style={{
          alignSelf: "flex-start",
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: selectedCount ? "#2196F3" : "#cfd8dc",
          marginBottom: 10,
        }}
      >
        <Text style={{ color: selectedCount ? "#fff" : "#777", fontWeight: "600" }}>
          Enviar correo ({selectedCount})
        </Text>
      </TouchableOpacity>

      {/* Modal de filtros */}
      <Modal visible={showFilter} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              padding: 16,
              width: "100%",
              maxWidth: 320,
              gap: 10,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#023047" }}>
              Filtrar por sistema operativo
            </Text>
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
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: filterOS === opt.value ? "#2196F3" : "#e0e0e0",
                  backgroundColor: filterOS === opt.value ? "#E3F2FD" : "#f9f9f9",
                }}
              >
                <Text style={{ color: "#023047", fontWeight: "600" }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowFilter(false)}
              style={{
                marginTop: 4,
                alignSelf: "flex-end",
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: "#555" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de enviar correo */}
      <Modal visible={showEmailModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              padding: 16,
              width: "100%",
              maxWidth: 420,
              gap: 10,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#023047" }}>
              Enviar correo ({selectedCount} destinatarios)
            </Text>
            <TextInput
              placeholder="Asunto"
              value={emailSubject}
              onChangeText={setEmailSubject}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 10,
                backgroundColor: "#fff",
              }}
            />
            <TextInput
              placeholder="Cuerpo del correo"
              value={emailBody}
              onChangeText={setEmailBody}
              multiline
              numberOfLines={4}
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 10,
                backgroundColor: "#fff",
                minHeight: 100,
                textAlignVertical: "top",
              }}
            />
            {emailStatus ? (
              <Text style={{ color: "#023047" }}>{emailStatus}</Text>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Text style={{ color: "#555" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendEmail}
                disabled={sending}
                style={{
                  backgroundColor: "#2196F3",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  opacity: sending ? 0.7 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
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
            ? "No hay clientes registrados aún."
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
              <TouchableOpacity
                onPress={loadMore}
                style={{
                  alignSelf: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: "#8ecae6",
                  marginTop: 6,
                }}
              >
                <Text style={{ color: "#023047", fontWeight: "bold" }}>
                  {loadingMore ? "Cargando…" : "Cargar más"}
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
