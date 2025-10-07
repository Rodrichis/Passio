import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
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

  // --------- Vistas ---------
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
      }}
    >
      <Text style={{ flex: 2, fontWeight: "bold", color: "#023047" }}>Nombre</Text>
      <Text style={{ flex: 2, fontWeight: "bold", color: "#023047" }}>Email</Text>
      <Text style={{ flex: 1.4, fontWeight: "bold", color: "#023047" }}>Teléfono</Text>
      <Text style={{ flex: 1.2, fontWeight: "bold", color: "#023047", textAlign: "right" }}>
        SO / Fecha
      </Text>
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
      }}
    >
      <Text style={{ flex: 2 }} numberOfLines={1} ellipsizeMode="tail">
        {item.nombreCompleto || "—"}
      </Text>
      <Text style={{ flex: 2 }} numberOfLines={1} ellipsizeMode="tail">
        {item.email || "—"}
      </Text>
      <Text style={{ flex: 1.4 }} numberOfLines={1} ellipsizeMode="tail">
        {item.telefono || "—"}
      </Text>
      <Text style={{ flex: 1.2, textAlign: "right" }}>
        {(item.so || "—") +
          (item.creadoEn ? ` · ${item.creadoEn.toLocaleDateString()}` : "")}
      </Text>
    </View>
  );

  const CardMobile = ({ item }: { item: Cliente }) => (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#e0e0e0",
      }}
    >
      <Text style={{ fontWeight: "bold" }} numberOfLines={1}>
        {item.nombreCompleto || "—"}
      </Text>

      {/* Email debajo, ocupa toda la fila */}
      <Text style={{ color: "#555", marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
        {item.email || "—"}
      </Text>

      {/* Teléfono y SO/fecha en dos columnas */}
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
          {item.telefono || "—"}
        </Text>
        <Text style={{ color: "#666", textAlign: "right", flex: 1 }}>
          {(item.so || "—") +
            (item.creadoEn ? ` · ${item.creadoEn.toLocaleDateString()}` : "")}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>Clientes</Text>

      {error ? <Text style={{ color: "red", marginBottom: 8 }}>{error}</Text> : null}

      {items.length === 0 ? (
        <Text>No hay clientes registrados aún.</Text>
      ) : (
        <FlatList
          data={items}
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
