import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../../services/firebaseConfig";
import { updateAndroidGeoReference, updateAppleGeoReference } from "../../../services/apiWallet";
import GeoMapPicker, { GeoPoint } from "../../../components/geo/GeoMapPicker";
import { Cliente, mapDoc } from "../../../utils/clientesHelpers";

type Props = {
  clientIds: string[];
  onBack: () => void;
};

type SendResult = {
  total: number;
  sent: number;
  failed: number;
};

const BATCH_SIZE = 5;
const IS_WEB = Platform.OS === "web";

function normalizeOS(so?: string) {
  return String(so || "").trim().toLowerCase();
}

async function runInBatches<T>(items: T[], batchSize: number, task: (item: T) => Promise<boolean>) {
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          return await task(item);
        } catch (error) {
          console.log("No se pudo enviar georeferencia:", error);
          return false;
        }
      })
    );

    sent += results.filter(Boolean).length;
    failed += results.filter((ok) => !ok).length;
  }

  return { sent, failed };
}

export default function DashboardContentGeoNotificacion({ clientIds, onBack }: Props) {
  const uid = auth.currentUser?.uid;
  const { width, height } = useWindowDimensions();
  const estimatedContentWidth = Math.max(0, width - (IS_WEB && width >= 900 ? 336 : 32));
  const compact = estimatedContentWidth < 820;
  const tiny = estimatedContentWidth < 420;
  const shortViewport = height < 760;
  const mapHeight = compact
    ? tiny
      ? 210
      : shortViewport
        ? 230
        : 270
    : shortViewport
      ? 300
      : estimatedContentWidth < 980
        ? 360
        : 430;
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const trimmedMessage = message.trim();
  const selectedCount = clients.length;
  const appleCount = useMemo(
    () => clients.filter((client) => normalizeOS(client.so) === "ios").length,
    [clients]
  );
  const androidCount = useMemo(
    () => clients.filter((client) => normalizeOS(client.so) === "android").length,
    [clients]
  );
  const canSend = IS_WEB && !!uid && !!point && trimmedMessage.length > 0 && selectedCount > 0 && !sending;

  useEffect(() => {
    let active = true;

    const loadClients = async () => {
      if (!uid) {
        setLoading(false);
        setLoadError("Debes iniciar sesión para usar esta función.");
        return;
      }

      const ids = Array.from(new Set(clientIds.filter(Boolean)));
      if (!ids.length) {
        setClients([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const docs = await Promise.all(
          ids.map((clientId) => getDoc(doc(db, "Empresas", uid, "Clientes", clientId)))
        );
        if (!active) return;
        setClients(docs.filter((snap) => snap.exists()).map(mapDoc));
      } catch (error) {
        console.log("No se pudieron cargar clientes para georeferencia:", error);
        if (!active) return;
        setLoadError("No se pudieron cargar los clientes seleccionados.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadClients();
    return () => {
      active = false;
    };
  }, [clientIds, uid]);

  const saveHistory = useCallback(
    async (sendResult: SendResult) => {
      if (!uid || !point) return;

      try {
        await addDoc(collection(db, "Empresas", uid, "HistorialNotificaciones"), {
          tipo: "georeferencia",
          mensaje: trimmedMessage,
          latitude: point.latitude,
          longitude: point.longitude,
          totalClientes: sendResult.total,
          totalEnviados: sendResult.sent,
          totalFallidos: sendResult.failed,
          estado:
            sendResult.failed === 0 ? "completada" : sendResult.sent > 0 ? "parcial" : "fallida",
          fechaEnvio: serverTimestamp(),
          creadoEn: serverTimestamp(),
        });
      } catch (error) {
        console.log("No se pudo guardar historial de georeferencia:", error);
      }
    },
    [point, trimmedMessage, uid]
  );

  const handleSend = useCallback(async () => {
    if (!uid) {
      setStatus("Debes iniciar sesión para continuar.");
      return;
    }
    if (!point) {
      setStatus("Selecciona un punto en el mapa antes de enviar.");
      return;
    }
    if (!trimmedMessage) {
      setStatus("Escribe el mensaje para Apple Wallet antes de enviar.");
      return;
    }
    if (!clients.length) {
      setStatus("Selecciona al menos un cliente antes de enviar.");
      return;
    }

    setSending(true);
    setStatus("Enviando notificación georeferenciada...");
    setResult(null);

    const sendResult = await runInBatches(clients, BATCH_SIZE, async (client) => {
      const so = normalizeOS(client.so);

      if (so === "ios") {
        const response = await updateAppleGeoReference({
          idUsuario: client.id,
          latitude: point.latitude,
          longitude: point.longitude,
          mensaje: trimmedMessage,
        });
        return response.ok;
      }

      if (so === "android") {
        const response = await updateAndroidGeoReference({
          idUsuario: client.id,
          latitude: point.latitude,
          longitude: point.longitude,
        });
        return response.ok;
      }

      return false;
    });

    const finalResult = {
      total: clients.length,
      sent: sendResult.sent,
      failed: sendResult.failed,
    };

    await saveHistory(finalResult);

    setResult(finalResult);
    setStatus(
      finalResult.failed === 0
        ? "Notificación georeferenciada enviada."
        : `Envío parcial: ${finalResult.sent} enviados y ${finalResult.failed} fallidos.`
    );
    setSending(false);
  }, [clients, point, saveHistory, trimmedMessage, uid]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!IS_WEB || !("geolocation" in navigator)) {
      setStatus("Tu navegador no permite obtener la ubicación actual.");
      return;
    }

    setLocating(true);
    setStatus("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        });
        setLocating(false);
      },
      () => {
        setStatus("No se pudo obtener tu ubicación actual. Revisa los permisos del navegador.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        compact && styles.scrollContentCompact,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#2196F3" />
          <Text style={styles.loadingText}>Cargando clientes seleccionados...</Text>
        </View>
      ) : null}

      {loadError ? <Text style={styles.errorBanner}>{loadError}</Text> : null}

      {!loading ? (
        <View style={[styles.workspace, compact && styles.workspaceCompact]}>
          <View
            style={[
              styles.mapPanel,
              compact && styles.mapPanelCompact,
              compact ? { height: mapHeight } : { minHeight: mapHeight },
            ]}
          >
            <GeoMapPicker
              value={point}
              onChange={setPoint}
              disabled={sending}
              height="100%"
            />

            <View style={styles.mapControls}>
              <TouchableOpacity
                onPress={handleUseCurrentLocation}
                disabled={sending || locating}
                style={[styles.locationButton, (sending || locating) && styles.locationButtonDisabled]}
                accessibilityLabel="Usar ubicación actual"
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#2196F3" />
                ) : (
                  <Ionicons name="navigate-outline" size={17} color="#2196F3" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.mapHint}>Haz clic en el mapa o arrastra el punto.</Text>
          </View>

          <View style={[styles.actionPanel, compact && styles.actionPanelCompact]}>
            <View style={styles.summaryRow}>
              <TouchableOpacity onPress={onBack} style={styles.summaryBackButton} accessibilityLabel="Volver a clientes">
                <Ionicons name="arrow-back-outline" size={17} color="#023047" />
              </TouchableOpacity>
              <View style={styles.summaryChip}>
                <Ionicons name="people-outline" size={16} color="#023047" />
                <Text style={styles.summaryText}>{`${selectedCount} destinatarios`}</Text>
              </View>
              <View style={styles.summaryChipMuted}>
                <Ionicons name="logo-apple" size={15} color="#111827" />
                <Text style={styles.summaryMutedText}>{appleCount}</Text>
              </View>
              <View style={styles.summaryChipMuted}>
                <Ionicons name="logo-android" size={15} color="#2E7D32" />
                <Text style={styles.summaryMutedText}>{androidCount}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setInfoOpen(true)}
                style={styles.infoButton}
                accessibilityLabel="Información sobre georeferencia"
              >
                <Ionicons name="bulb-outline" size={17} color="#A86D00" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Mensaje para Apple Wallet</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ejemplo: Estás cerca de nuestro local. Ven por tu beneficio."
              placeholderTextColor="#8AA0AE"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
              editable={!sending}
              maxLength={180}
            />
            <Text style={styles.counterText}>{`${message.length}/180`}</Text>

            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={18} color="#D97706" />
              <Text style={styles.disclaimerText}>
                El mensaje personalizado solo se mostrará en Apple Wallet. En Google Wallet se mostrará un mensaje predeterminado por Google.
              </Text>
            </View>

            <View style={styles.statusCard}>
              {status ? (
                <Text
                  style={[
                    styles.statusText,
                    result && result.failed === 0 ? styles.statusSuccess : null,
                    result && result.failed > 0 ? styles.statusWarning : null,
                  ]}
                >
                  {status}
                </Text>
              ) : (
                <Text style={styles.statusText}>Completa la ubicación y el mensaje para enviar.</Text>
              )}

              {result ? (
                <View style={styles.resultBox}>
                  <Text style={styles.resultText}>{`Enviados: ${result.sent}`}</Text>
                  <Text style={styles.resultText}>{`Fallidos: ${result.failed}`}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSend}
                disabled={!canSend}
                style={[styles.primaryButton, !canSend && styles.primaryButtonDisabled]}
              >
                {sending ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.primaryButtonText}>{sending ? "Enviando..." : "Enviar georeferencia"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalDismissLayer} activeOpacity={1} onPress={() => setInfoOpen(false)} />
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>Notificación por georeferencia</Text>
              <TouchableOpacity onPress={() => setInfoOpen(false)} style={styles.infoModalClose}>
                <Ionicons name="close" size={18} color="#023047" />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalText}>
              Puedes generar una notificación por georeferencia. Selecciona un punto en el mapa; cuando un cliente pase por ahí, el sistema le enviará la notificación.
            </Text>
            <TouchableOpacity onPress={() => setInfoOpen(false)} style={styles.infoModalButton}>
              <Text style={styles.infoModalButtonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F6FAFF",
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 18,
  },
  scrollContentCompact: {
    gap: 12,
    paddingBottom: 88,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8E4EE",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#023047",
    fontWeight: "700",
  },
  workspace: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 16,
    width: "100%",
  },
  workspaceCompact: {
    flexDirection: "column",
  },
  mapPanel: {
    flex: 1.7,
    minWidth: 0,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4EE",
    position: "relative",
    shadowColor: "#0A2A43",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  mapPanelCompact: {
    flex: 0,
    width: "100%",
  },
  mapControls: {
    position: "absolute",
    top: 14,
    right: 14,
    alignItems: "flex-end",
    gap: 8,
    zIndex: 1200,
    elevation: 12,
  },
  locationButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#D6E4ED",
    shadowColor: "#0A2A43",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
  mapHint: {
    position: "absolute",
    left: 14,
    bottom: 14,
    maxWidth: 280,
    color: "#023047",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#D6E4ED",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: "800",
    zIndex: 1200,
    elevation: 12,
    overflow: "hidden",
  },
  actionPanel: {
    flex: 1,
    minWidth: 0,
    maxWidth: 410,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E4EE",
    padding: 16,
    alignSelf: "stretch",
    shadowColor: "#0A2A43",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  actionPanelCompact: {
    maxWidth: undefined,
    width: "100%",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  summaryBackButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FBFF",
    borderWidth: 1,
    borderColor: "#D6E4ED",
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#EAF5FB",
  },
  summaryChipMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DDEAF2",
    backgroundColor: "#F7FBFF",
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF6D8",
    borderWidth: 1,
    borderColor: "#FFE2A3",
    shadowColor: "#A86D00",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  summaryText: {
    color: "#023047",
    fontWeight: "900",
    fontSize: 13,
  },
  summaryMutedText: {
    color: "#023047",
    fontWeight: "900",
    fontSize: 12,
  },
  fieldLabel: {
    color: "#023047",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D2E2EE",
    borderRadius: 18,
    backgroundColor: "#FAFCFE",
    color: "#023047",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 150,
  },
  counterText: {
    alignSelf: "flex-end",
    color: "#8AA0AE",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFE0B2",
    backgroundColor: "#FFF8E1",
    marginBottom: 12,
  },
  disclaimerText: {
    flex: 1,
    minWidth: 0,
    color: "#6D4C41",
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
  },
  statusCard: {
    marginTop: "auto",
    borderTopWidth: 1,
    borderTopColor: "#E8F0F5",
    paddingTop: 12,
  },
  statusText: {
    color: "#607D8B",
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 12,
  },
  statusSuccess: {
    color: "#2E7D32",
  },
  statusWarning: {
    color: "#B45309",
  },
  resultBox: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  resultText: {
    color: "#023047",
    fontWeight: "800",
    backgroundColor: "#F7FBFF",
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#DDEAF2",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#2196F3",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: "#C8D8E4",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 24, 39, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  infoModalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E4ED",
    padding: 18,
    shadowColor: "#0A2A43",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  infoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  infoModalTitle: {
    flex: 1,
    minWidth: 0,
    color: "#023047",
    fontSize: 18,
    fontWeight: "900",
  },
  infoModalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D6E4ED",
    backgroundColor: "#F7FBFF",
  },
  infoModalText: {
    color: "#4C6575",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    marginBottom: 16,
  },
  infoModalButton: {
    alignSelf: "flex-end",
    borderRadius: 14,
    backgroundColor: "#2196F3",
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  infoModalButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  errorBanner: {
    color: "#B42318",
    backgroundColor: "#FEF3F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    fontWeight: "800",
  },
});
