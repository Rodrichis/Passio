import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import { clientesStyles as cStyles } from "../../styles/ClientesStyles";

type LogSeverity = "error" | "warning" | "info";

type LogItem = {
  id: string;
  timestamp: Date | null;
  event: string;
  severity: LogSeverity;
  empresaUid: string;
  clientId: string;
  walletClassId: string;
  service: string;
  status: string;
  message: string;
};

type Props = {
  onBack: () => void;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSeverity(value: unknown): LogSeverity {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "error" || normalized === "warning") return normalized;
  return "info";
}

function mapLog(docSnap: any): LogItem {
  const data = docSnap.data() || {};
  const rawTimestamp = data.timestamp;
  const timestamp = rawTimestamp instanceof Timestamp ? rawTimestamp.toDate() : rawTimestamp instanceof Date ? rawTimestamp : null;

  return {
    id: docSnap.id,
    timestamp,
    event: normalizeString(data.event) || "sin_evento",
    severity: normalizeSeverity(data.severity),
    empresaUid: normalizeString(data.empresaUid),
    clientId: normalizeString(data.clientId),
    walletClassId: normalizeString(data.walletClassId),
    service: normalizeString(data.service),
    status: normalizeString(data.status),
    message: normalizeString(data.message),
  };
}

function formatDate(value: Date | null) {
  if (!value) return "--";
  try {
    return value.toLocaleString();
  } catch {
    return "--";
  }
}

function severityColors(severity: LogSeverity) {
  if (severity === "error") {
    return { bg: "#FDECEC", border: "#F5C2C2", text: "#B42318" };
  }
  if (severity === "warning") {
    return { bg: "#FFF4E5", border: "#FFD39B", text: "#B54708" };
  }
  return { bg: "#E8F4FD", border: "#B8DCF7", text: "#175CD3" };
}

export default function AdminLogsScreen({ onBack }: Props) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | LogSeverity>("all");

  const loadLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const logsQuery = query(collection(db, "Logs"), orderBy("timestamp", "desc"), limit(100));
      const snap = await getDocs(logsQuery);
      setLogs(snap.docs.map(mapLog));
    } catch (e) {
      console.error("Error cargando logs:", e);
      setError("No se pudieron cargar los logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (severityFilter !== "all" && log.severity !== severityFilter) {
        return false;
      }

      if (!needle) return true;

      const haystack = [
        log.id,
        log.event,
        log.empresaUid,
        log.clientId,
        log.walletClassId,
        log.service,
        log.status,
        log.message,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [logs, search, severityFilter]);

  if (loading) {
    return (
      <View style={{ marginTop: 20, alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text style={{ marginTop: 10 }}>Cargando logs...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
        <View>
          <Text style={styles.sectionTitle}>Logs</Text>
          <Text style={{ color: "#51616F" }}>Eventos internos del sistema.</Text>
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
          placeholder="Buscar por empresaUid, event, service, clientId..."
          placeholderTextColor="#607d8b"
          style={cStyles.searchInput}
        />
      </View>

      <View style={cStyles.chipsRow}>
        {[
          { key: "all", label: "Todos" },
          { key: "error", label: "Error" },
          { key: "warning", label: "Warning" },
          { key: "info", label: "Info" },
        ].map((item) => {
          const active = severityFilter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setSeverityFilter(item.key as any)}
              style={[
                cStyles.chip,
                active && { backgroundColor: "#023047" },
              ]}
            >
              <Text style={[cStyles.chipText, active && { color: "#fff" }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ color: "#60707D", marginBottom: 10 }}>
        {filteredLogs.length} registro(s)
      </Text>

      {error ? <Text style={{ color: "#C62828", marginBottom: 8 }}>{error}</Text> : null}

      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLogs(true)} />}
        ListEmptyComponent={<Text style={{ color: "#60707D" }}>No hay logs registrados aun.</Text>}
        renderItem={({ item }) => {
          const severity = severityColors(item.severity);
          return (
            <View
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#E0E6EA",
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700" }}>{item.event}</Text>
                  <Text style={{ color: "#60707D", marginTop: 4 }}>{item.message || "Sin mensaje"}</Text>
                </View>
                <View
                  style={{
                    backgroundColor: severity.bg,
                    borderColor: severity.border,
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ color: severity.text, fontWeight: "700", textTransform: "uppercase", fontSize: 12 }}>
                    {item.severity}
                  </Text>
                </View>
              </View>

              <Text style={{ color: "#023047", fontSize: 12 }}>Fecha: {formatDate(item.timestamp)}</Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {item.empresaUid ? <Text style={cStyles.chipText}>empresaUid: {item.empresaUid}</Text> : null}
                {item.clientId ? <Text style={cStyles.chipText}>clientId: {item.clientId}</Text> : null}
                {item.walletClassId ? <Text style={cStyles.chipText}>walletClassId: {item.walletClassId}</Text> : null}
                {item.service ? <Text style={cStyles.chipText}>service: {item.service}</Text> : null}
                {item.status ? <Text style={cStyles.chipText}>status: {item.status}</Text> : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
