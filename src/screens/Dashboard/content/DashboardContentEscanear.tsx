import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { updateAndroidWalletState, updateApplePass, type WalletApiResponse } from "../../../services/apiWallet";
import { auth, db } from "../../../services/firebaseConfig";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getWalletConfig } from "../../../services/walletOnboarding/getWalletConfig";

type ParsedPayload = {
  idUsuario?: string;
  empresaId?: string;
};

type ScanAction = "visita" | "premio";

type Feedback = { type: "success" | "error"; message: string; action?: ScanAction };

type PendingConfirmation = {
  action: ScanAction;
  idUsuario: string;
  nombreCliente: string;
  soCliente: string;
  visitasTotalesPrev: number;
  visitasTotalesNext: number;
  cicloPrev: number;
  cicloVisitasNext: number;
  premiosDisponiblesPrev: number;
  premiosDisponiblesNext: number;
  premiosCanjeadosPrev: number;
  premiosCanjeadosNext: number;
};

type Props = {
  companyName?: string;
};

type ActionTheme = {
  label: string;
  title: string;
  description: string;
  color: string;
  soft: string;
  border: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const ACTION_THEME: Record<ScanAction, ActionTheme> = {
  visita: {
    label: "Contar visita",
    title: "Modo visita",
    description: "Suma una visita y actualiza el ciclo del cliente.",
    color: "#2196F3",
    soft: "#E3F2FD",
    border: "#BBDEFB",
    icon: "add-circle-outline",
  },
  premio: {
    label: "Canjear premio",
    title: "Modo premio",
    description: "Descuenta un premio disponible y confirma el canje.",
    color: "#FB8500",
    soft: "#FFF4E8",
    border: "#FFD2A6",
    icon: "gift-outline",
  },
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

const normalizeCycleValue = (value: unknown, maxCycle: number) => {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, maxCycle);
};

const normalizeNonNegativeInt = (value: unknown) => {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const sanitizeClientId = (rawValue: unknown) => {
  const value = String(rawValue ?? "").trim();
  if (!value) return null;
  if (value.includes("/")) return null;
  if (value.length > 180) return null;
  return value;
};

const getWalletErrorDetail = (response: WalletApiResponse) => {
  const candidates = [
    response.errorText,
    typeof response.data === "object" && response.data ? String((response.data as any).message || "") : "",
    response.rawText,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const detail = candidates.find((value) => !value.startsWith("<!DOCTYPE") && !value.startsWith("<html"));
  if (!detail) return "";
  const normalizedDetail = detail.toLowerCase();
  if (
    normalizedDetail.includes("failed to fetch") ||
    normalizedDetail.includes("network request failed") ||
    normalizedDetail.includes("typeerror") ||
    response.status === 0
  ) {
    return "";
  }
  return detail.length > 140 ? `${detail.slice(0, 137)}...` : detail;
};

export default function DashboardContentEscanear({ companyName: _companyName }: Props) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 980;
  const isCompactWeb = Platform.OS === "web" && width < 900;
  const isAndroid = Platform.OS === "android";

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState<string>("Selecciona una acción para comenzar.");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ScanAction | null>(null);
  const [walletConfig, setWalletConfig] = useState<Awaited<ReturnType<typeof getWalletConfig>> | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const processingRef = useRef(false);

  const getStatusForAction = useCallback((action: ScanAction | null) => {
    if (action === "premio") {
      return "Escanea el QR del cliente para validar y confirmar el canje.";
    }
    if (action === "visita") {
      return "Escanea el QR del cliente para registrar la visita.";
    }
    return "Selecciona una acción para comenzar.";
  }, []);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    const current = permission?.granted;
    if (current !== undefined) {
      setHasPermission(current);
      if (!current) {
        setStatus("Permiso de cámara denegado. Actívalo para escanear.");
      }
    }
  }, [permission]);

  useEffect(() => {
    let active = true;

    const loadWalletConfig = async () => {
      const empresaId = auth.currentUser?.uid;
      if (!empresaId) return;

      try {
        const config = await getWalletConfig(empresaId);
        if (active) {
          setWalletConfig(config);
        }
      } catch (error) {
        console.error("Error cargando configuración de wallet para escáner:", error);
      }
    };

    loadWalletConfig();
    return () => {
      active = false;
    };
  }, []);

  const resetToChooser = useCallback(
    (nextFeedback: Feedback | null = null) => {
      processingRef.current = false;
      setLoading(false);
      setScanned(false);
      setPendingConfirmation(null);
      setSelectedAction(null);
      setStatus(getStatusForAction(null));
      setFeedback(nextFeedback);
      setScanError(null);
    },
    [getStatusForAction]
  );

  const showRecoverableError = useCallback(
    (message: string) => {
      processingRef.current = false;
      setLoading(false);
      setScanned(false);
      setPendingConfirmation(null);
      setFeedback(null);
      setScanError(message);
      setStatus(getStatusForAction(selectedAction));
    },
    [getStatusForAction, selectedAction]
  );

  const startAction = useCallback(
    (action: ScanAction) => {
      processingRef.current = false;
      setFeedback(null);
      setScanError(null);
      setPendingConfirmation(null);
      setScanned(false);
      setSelectedAction(action);
      setStatus(getStatusForAction(action));
    },
    [getStatusForAction]
  );

  const parseData = (raw: string): ParsedPayload => {
    try {
      const parsed = JSON.parse(raw);
      return {
        idUsuario: parsed.idUsuario || parsed.userId,
        empresaId: parsed.empresaId || parsed.empresaUid,
      };
    } catch {
      return { idUsuario: raw };
    }
  };

  const handleRequestCameraPermission = useCallback(async () => {
    try {
      setScanError(null);
      setHasPermission(null);
      let granted = false;
      const result = await requestPermission();
      granted = Boolean(result?.granted);

      if (!granted && Platform.OS === "web" && typeof navigator !== "undefined") {
        try {
          const stream = await navigator.mediaDevices?.getUserMedia?.({
            video: { facingMode: "environment" },
          });
          stream?.getTracks?.().forEach((track) => track.stop());
          const retry = await requestPermission();
          granted = Boolean(retry?.granted);
        } catch {
          granted = false;
        }
      }

      setHasPermission(granted);
      if (!granted) {
        setStatus("Permiso de cámara denegado. Actívalo para escanear.");
        setScanError(
          Platform.OS === "web"
            ? "El navegador sigue bloqueando la cámara. Habilita el permiso del sitio y luego vuelve a intentarlo."
            : "No pudimos obtener permiso para la cámara. Revisa los permisos de la aplicación e inténtalo nuevamente."
        );
      } else {
        setScanError(null);
      }
    } catch (error) {
      console.error("Error solicitando permiso de cámara:", error);
      setScanError("No pudimos solicitar el permiso de cámara. Inténtalo nuevamente.");
    }
  }, [requestPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!selectedAction || scanned || processingRef.current) return;

      processingRef.current = true;
      setScanned(true);
      setLoading(true);
      setFeedback(null);
      setScanError(null);
      setStatus("Validando cliente...");

      const empresaId = auth.currentUser?.uid;
      if (!empresaId) {
        showRecoverableError("Debes iniciar sesión para escanear.");
        return;
      }

      if (!walletConfig) {
        showRecoverableError("No se pudo cargar la configuración del wallet.");
        return;
      }

      const visitasPorPremio = walletConfig.visitasPorPremio;
      const payload = parseData(data);
      const clientId = sanitizeClientId(payload.idUsuario);

      if (!clientId) {
        showRecoverableError("El QR escaneado no corresponde a una tarjeta válida de Passio.");
        return;
      }

      if (payload.empresaId && payload.empresaId !== empresaId) {
        showRecoverableError("Esta tarjeta no pertenece a tu empresa.");
        return;
      }

      let clienteDoc: any = null;
      try {
        const ref = doc(db, "Empresas", empresaId, "Clientes", clientId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          showRecoverableError("Esta tarjeta no pertenece a tu empresa.");
          return;
        }

        clienteDoc = snap.data() as any;
        const activo = clienteDoc.activo ?? true;
        if (!activo) {
          showRecoverableError("Este usuario está desactivado. No se puede continuar.");
          return;
        }
      } catch (error) {
        console.error("Error validando tarjeta:", error);
        showRecoverableError("No se pudo validar la tarjeta. Intenta nuevamente.");
        return;
      }

      const nombreCliente = clienteDoc?.nombreCompleto || clienteDoc?.nombre || "Cliente";
      const soCliente = (clienteDoc?.so || "").toLowerCase();
      const visitasTotalesPrev = normalizeNonNegativeInt(clienteDoc?.visitasTotales);
      const cicloPrev = normalizeCycleValue(clienteDoc?.cicloVisitas, visitasPorPremio);
      const premiosDispPrev = normalizeNonNegativeInt(clienteDoc?.premiosDisponibles);
      const premiosCanjPrev = normalizeNonNegativeInt(clienteDoc?.premiosCanjeados);

      if (selectedAction === "premio" && premiosDispPrev <= 0) {
        showRecoverableError(`${nombreCliente} no tiene premios disponibles.`);
        return;
      }

      let visitasTotalesNext = visitasTotalesPrev;
      let cicloVisitasNext = cicloPrev;
      let premiosDisponiblesNext = premiosDispPrev;
      let premiosCanjeadosNext = premiosCanjPrev;

      if (selectedAction === "visita") {
        visitasTotalesNext = visitasTotalesPrev + 1;

        if (cicloPrev >= visitasPorPremio) {
          cicloVisitasNext = 1;
        } else {
          cicloVisitasNext = cicloPrev + 1;
          if (cicloVisitasNext === visitasPorPremio) {
            premiosDisponiblesNext += 1;
          }
        }
      } else {
        premiosDisponiblesNext = Math.max(0, premiosDispPrev - 1);
        premiosCanjeadosNext = premiosCanjPrev + 1;
      }

      cicloVisitasNext = normalizeCycleValue(cicloVisitasNext, visitasPorPremio);
      premiosDisponiblesNext = normalizeNonNegativeInt(premiosDisponiblesNext);
      premiosCanjeadosNext = normalizeNonNegativeInt(premiosCanjeadosNext);

      processingRef.current = false;
      setLoading(false);
      setPendingConfirmation({
        action: selectedAction,
        idUsuario: clientId,
        nombreCliente,
        soCliente,
        visitasTotalesPrev,
        visitasTotalesNext,
        cicloPrev,
        cicloVisitasNext,
        premiosDisponiblesPrev: premiosDispPrev,
        premiosDisponiblesNext,
        premiosCanjeadosPrev: premiosCanjPrev,
        premiosCanjeadosNext,
      });
      setStatus(selectedAction === "premio" ? "Confirma el canje del premio." : "Confirma la visita para continuar.");
    },
    [scanned, selectedAction, showRecoverableError, walletConfig]
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingConfirmation || !walletConfig) return;

    const empresaId = auth.currentUser?.uid;
    if (!empresaId) {
      showRecoverableError("Debes iniciar sesión para escanear.");
      return;
    }

    setLoading(true);

    try {
      const walletResp: WalletApiResponse =
        pendingConfirmation.soCliente === "ios"
          ? await updateApplePass({
              idUsuario: pendingConfirmation.idUsuario,
              cantidad: pendingConfirmation.cicloVisitasNext,
              premiosDisponibles: pendingConfirmation.premiosDisponiblesNext,
              empresaUid: empresaId,
              walletClassId: walletConfig.walletClassId,
              nombreEmpresa: walletConfig.companyName,
              paqueteSellosWallet: walletConfig.paqueteSellosWallet,
              visitasPorPremio: walletConfig.visitasPorPremio,
              colorWallet: walletConfig.colorWallet,
              urlIconoWallet: walletConfig.urlIconoWallet,
            })
          : await updateAndroidWalletState({
              idUsuario: pendingConfirmation.idUsuario,
              cantidad: pendingConfirmation.cicloVisitasNext,
              premiosDisponibles: pendingConfirmation.premiosDisponiblesNext,
              walletClassId: walletConfig.walletClassId,
              paqueteSellosWallet: walletConfig.paqueteSellosWallet,
              visitasPorPremio: walletConfig.visitasPorPremio,
            });

      if (!walletResp.ok) {
        const detail = getWalletErrorDetail(walletResp);
        console.error("Error actualizando wallet desde escáner:", {
          platform: pendingConfirmation.soCliente,
          status: walletResp.status,
          detail,
          response: walletResp.data,
        });
        showRecoverableError(
          detail
            ? `No pudimos actualizar el wallet. ${detail}`
            : "No pudimos actualizar el wallet. Intenta nuevamente."
        );
        return;
      }

      const ref = doc(db, "Empresas", empresaId, "Clientes", pendingConfirmation.idUsuario);
      await updateDoc(ref, {
        visitasTotales: pendingConfirmation.visitasTotalesNext,
        cicloVisitas: pendingConfirmation.cicloVisitasNext,
        premiosDisponibles: pendingConfirmation.premiosDisponiblesNext,
        premiosCanjeados: pendingConfirmation.premiosCanjeadosNext,
        ultimaVisita: serverTimestamp(),
      });

      resetToChooser(
        pendingConfirmation.action === "premio"
          ? {
              type: "success",
              action: "premio",
              message: `Premio canjeado para ${pendingConfirmation.nombreCliente}. Premios restantes: ${pendingConfirmation.premiosDisponiblesNext}.`,
            }
          : {
              type: "success",
              action: "visita",
              message: `Visita registrada para ${pendingConfirmation.nombreCliente}. Ciclo actual: ${pendingConfirmation.cicloVisitasNext}.`,
            }
      );
    } catch (error) {
      console.error("Error al confirmar escaneo:", error);
      showRecoverableError("No pudimos completar la acción. Intenta nuevamente.");
    }
  }, [pendingConfirmation, resetToChooser, showRecoverableError, walletConfig]);

  if (hasPermission === null) {
    return (
      <View style={styles.screen}>
        <View style={[styles.stateCard, ELEVATED_CARD]}>
          <View style={styles.stateIcon}>
            <Ionicons name="camera-outline" size={24} color="#023047" />
          </View>
          <Text style={styles.stateTitle}>Preparando cámara</Text>
          <Text style={styles.stateText}>Solicitando permiso para acceder a la cámara del dispositivo.</Text>
          <ActivityIndicator size="large" color="#023047" style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.screen}>
        <View style={[styles.stateCard, ELEVATED_CARD]}>
          <View style={styles.stateIcon}>
            <Ionicons name="camera-outline" size={24} color="#023047" />
          </View>
          <Text style={styles.stateTitle}>Permiso de cámara denegado</Text>
          <Text style={styles.stateText}>Activa el permiso para poder escanear códigos QR desde esta pantalla.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRequestCameraPermission}>
            <Text style={styles.primaryButtonText}>Otorgar permiso</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={Boolean(scanError)} transparent animationType="fade" onRequestClose={() => setScanError(null)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, ELEVATED_CARD, { maxWidth: 460 }]}>
              <View style={[styles.modalHeader, { backgroundColor: "#FFF4E8" }]}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: "#FB8500" }]}>
                  <Ionicons name="warning-outline" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalHeaderLabel, { color: "#FB8500" }]}>Permisos</Text>
                  <Text style={styles.modalHeaderTitle}>No se pudo habilitar la cámara</Text>
                </View>
              </View>

              <View style={styles.singleMessageBox}>
                <Text style={styles.singleMessageText}>{scanError}</Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalConfirmButtonNeutral} onPress={() => setScanError(null)}>
                  <Text style={styles.modalConfirmText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const theme = selectedAction ? ACTION_THEME[selectedAction] : null;

  return (
    <View style={styles.screen}>
      {selectedAction === null ? (
        <View style={[styles.heroCard, ELEVATED_CARD]}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="scan-outline" size={22} color="#023047" />
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Escaneo rápido para visitas y premios</Text>
            <Text style={styles.heroText}>Elige una acción y luego apunta el QR del cliente para continuar.</Text>
          </View>
        </View>
      ) : null}

      {selectedAction === null ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Modos</Text>
          </View>

          <View style={styles.actionGrid}>
            {(["visita", "premio"] as ScanAction[]).map((action) => {
              const actionTheme = ACTION_THEME[action];

              return (
                <Pressable
                  key={action}
                  onPress={() => startAction(action)}
                  style={({ pressed }) => [
                    styles.actionCard,
                    ELEVATED_CARD,
                    {
                      backgroundColor: actionTheme.soft,
                      borderColor: actionTheme.border,
                      opacity: pressed ? 0.95 : 1,
                    },
                  ]}
                >
                  <View style={styles.actionCardTop}>
                    <View style={styles.actionTitleWrap}>
                      <View style={styles.actionIconWrap}>
                        <Ionicons name={actionTheme.icon} size={18} color={actionTheme.color} />
                      </View>
                      <Text style={[styles.actionCardTitle, { color: actionTheme.color }]}>{actionTheme.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={actionTheme.color} />
                  </View>

                  <Text style={styles.actionCardText}>{actionTheme.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={[styles.activeModeCard, ELEVATED_CARD]}>
            <View style={styles.activeModeTop}>
              <View style={[styles.activeModeBadge, { backgroundColor: theme?.soft, borderColor: theme?.border }]}>
                <Ionicons name={theme?.icon} size={16} color={theme?.color} />
                <Text style={[styles.activeModeBadgeText, { color: theme?.color }]}>{theme?.title}</Text>
              </View>

              <TouchableOpacity style={styles.ghostButton} onPress={() => resetToChooser(null)} disabled={loading}>
                <Text style={styles.ghostButtonText}>Cambiar modo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.activeModeText}>{status}</Text>
          </View>

          <View style={[styles.scanLayout, isCompactLayout && styles.scanLayoutStack]}>
            <View style={[styles.scannerCard, ELEVATED_CARD]}>
              <View style={styles.scannerHeader}>
                <Text style={styles.scannerTitle}>Apunta el QR dentro del marco</Text>
                <Text style={styles.scannerText}>Validaremos la tarjeta antes de mostrar la confirmación.</Text>
              </View>

              <View
                style={[
                  styles.scannerStage,
                  {
                    borderColor: theme?.color || "#023047",
                    height: isCompactWeb ? 272 : isAndroid ? 320 : isCompactLayout ? 290 : 340,
                  },
                ]}
              >
                <View style={styles.scannerViewport}>
                  <CameraView
                    style={styles.cameraView}
                    facing="back"
                    autofocus="on"
                    onBarcodeScanned={selectedAction && !scanned ? handleBarCodeScanned : undefined}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                  />
                </View>

                <View pointerEvents="none" style={styles.scanGuide}>
                  <View style={[styles.scanCorner, styles.scanCornerTopLeft, { borderColor: theme?.color }]} />
                  <View style={[styles.scanCorner, styles.scanCornerTopRight, { borderColor: theme?.color }]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomLeft, { borderColor: theme?.color }]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomRight, { borderColor: theme?.color }]} />
                </View>

                {loading && (
                  <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.loaderText}>Procesando lectura...</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.infoCard, ELEVATED_CARD, isCompactWeb && styles.infoCardCompactWeb]}>
              <Text style={styles.infoCardTitle}>Qué pasará</Text>

              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#023047" />
                </View>
                <Text style={styles.infoItemText}>Validaremos que la tarjeta pertenezca a tu empresa.</Text>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoItemIcon}>
                  <Ionicons name="person-outline" size={16} color="#023047" />
                </View>
                <Text style={styles.infoItemText}>Antes de guardar verás el nombre y el resumen del cliente.</Text>
              </View>

              <View style={styles.infoItem}>
                <View style={[styles.infoItemIcon, { backgroundColor: theme?.soft }]}>
                  <Ionicons name={theme?.icon} size={16} color={theme?.color} />
                </View>
                <Text style={styles.infoItemText}>
                  {selectedAction === "premio"
                    ? "Si confirmas el canje, se descontará un premio disponible."
                    : "Si confirmas la visita, se actualizará el ciclo y podría liberarse un premio."}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {feedback && (
        <View
          style={[
            styles.feedbackCard,
            ELEVATED_CARD,
            feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <View
            style={[
              styles.feedbackIconWrap,
              feedback.type === "success" ? styles.feedbackIconSuccess : styles.feedbackIconError,
            ]}
          >
            <Ionicons
              name={feedback.type === "success" ? "checkmark-circle" : "close-circle"}
              size={20}
              color={feedback.type === "success" ? "#1B7F4C" : "#C62828"}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.feedbackTitle}>
              {feedback.type === "success"
                ? feedback.action === "premio"
                  ? "Premio canjeado"
                  : "Visita registrada"
                : "No se pudo completar la acción"}
            </Text>
            <Text style={styles.feedbackText}>{feedback.message}</Text>
          </View>
        </View>
      )}

      <Modal
        visible={Boolean(scanError)}
        transparent
        animationType="fade"
        onRequestClose={() => setScanError(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, ELEVATED_CARD, { maxWidth: 460 }]}>
            <View style={[styles.modalHeader, { backgroundColor: "#FFF4E8" }]}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: "#FB8500" }]}>
                <Ionicons name="warning-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalHeaderLabel, { color: "#FB8500" }]}>Escaneo</Text>
                <Text style={styles.modalHeaderTitle}>No pudimos completar la lectura</Text>
              </View>
            </View>

            <View style={styles.singleMessageBox}>
              <Text style={styles.singleMessageText}>{scanError}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalConfirmButtonNeutral} onPress={() => setScanError(null)}>
                <Text style={styles.modalConfirmText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(pendingConfirmation)}
        transparent
        animationType="fade"
        onRequestClose={() => (!loading ? resetToChooser(null) : undefined)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              ELEVATED_CARD,
              pendingConfirmation ? { borderColor: ACTION_THEME[pendingConfirmation.action].border } : null,
            ]}
          >
            {pendingConfirmation ? (
              <>
                {!loading ? (
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => resetToChooser(null)}>
                    <Ionicons name="close" size={22} color="#617786" />
                  </TouchableOpacity>
                ) : null}

                <View
                  style={[
                    styles.modalHeader,
                    { backgroundColor: ACTION_THEME[pendingConfirmation.action].soft },
                  ]}
                >
                  <View
                    style={[
                      styles.modalHeaderIcon,
                      { backgroundColor: ACTION_THEME[pendingConfirmation.action].color },
                    ]}
                  >
                    <Ionicons name={ACTION_THEME[pendingConfirmation.action].icon} size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.modalHeaderLabel,
                        { color: ACTION_THEME[pendingConfirmation.action].color },
                      ]}
                    >
                      {ACTION_THEME[pendingConfirmation.action].label}
                    </Text>
                    <Text style={styles.modalHeaderTitle}>
                      {pendingConfirmation.action === "premio"
                        ? `¿Deseas canjear premio para ${pendingConfirmation.nombreCliente}?`
                        : `¿Deseas sumar una visita para ${pendingConfirmation.nombreCliente}?`}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryBox}>
                  {pendingConfirmation.action === "visita" ? (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Visitas totales</Text>
                        <Text style={styles.summaryValue}>
                          {pendingConfirmation.visitasTotalesPrev} {"->"} {pendingConfirmation.visitasTotalesNext}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Ciclo actual</Text>
                        <Text style={styles.summaryValue}>
                          {pendingConfirmation.cicloPrev} {"->"} {pendingConfirmation.cicloVisitasNext}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Premios disponibles</Text>
                        <Text style={styles.summaryValue}>
                          {pendingConfirmation.premiosDisponiblesPrev} {"->"} {pendingConfirmation.premiosDisponiblesNext}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Premios disponibles</Text>
                        <Text style={styles.summaryValue}>
                          {pendingConfirmation.premiosDisponiblesPrev} {"->"} {pendingConfirmation.premiosDisponiblesNext}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Premios canjeados</Text>
                        <Text style={styles.summaryValue}>
                          {pendingConfirmation.premiosCanjeadosPrev} {"->"} {pendingConfirmation.premiosCanjeadosNext}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Visitas totales</Text>
                        <Text style={styles.summaryValue}>{pendingConfirmation.visitasTotalesPrev}</Text>
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => resetToChooser(null)}
                    disabled={loading}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalConfirmButton,
                      {
                        backgroundColor: ACTION_THEME[pendingConfirmation.action].color,
                        opacity: loading ? 0.7 : 1,
                      },
                    ]}
                    onPress={handleConfirm}
                    disabled={loading}
                  >
                    <Text style={styles.modalConfirmText}>{loading ? "Confirmando..." : "Confirmar"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 14,
  },
  heroCard: {
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EAF4FB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 4,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#526977",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#023047",
  },
  actionGrid: {
    flexDirection: "column",
    gap: 12,
  },
  actionCard: {
    width: "100%",
    minHeight: 128,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  actionCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  actionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actionCardTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  actionCardText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#4D6472",
  },
  activeModeCard: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  activeModeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  activeModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeModeBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  ghostButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F6FA",
    borderWidth: 1,
    borderColor: "#D7E3EB",
  },
  ghostButtonText: {
    color: "#023047",
    fontSize: 13,
    fontWeight: "700",
  },
  activeModeText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#526977",
  },
  scanLayout: {
    flexDirection: "row",
    gap: 14,
    alignItems: "stretch",
  },
  scanLayoutStack: {
    flexDirection: "column",
  },
  scannerCard: {
    flex: 1.55,
    borderRadius: 22,
    padding: 16,
  },
  scannerHeader: {
    marginBottom: 10,
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 4,
  },
  scannerText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#526977",
  },
  scannerStage: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#000000",
    borderWidth: 3,
    position: "relative",
    width: "100%",
  },
  scannerViewport: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: 18,
  },
  cameraView: {
    width: "100%",
    height: "100%",
  },
  scanGuide: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanCorner: {
    position: "absolute",
    width: 48,
    height: 48,
    borderWidth: 5,
    borderRadius: 16,
  },
  scanCornerTopLeft: {
    top: 22,
    left: 22,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerTopRight: {
    top: 22,
    right: 22,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerBottomLeft: {
    bottom: 22,
    left: 22,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  scanCornerBottomRight: {
    bottom: 22,
    right: 22,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loaderText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
  },
  infoCardCompactWeb: {
    marginTop: 4,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  infoItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#EEF5FA",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#4D6472",
  },
  feedbackCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  feedbackSuccess: {
    borderColor: "#CFE8D7",
    backgroundColor: "#F4FBF6",
  },
  feedbackError: {
    borderColor: "#F3D0D0",
    backgroundColor: "#FFF7F7",
  },
  feedbackIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  feedbackIconSuccess: {
    backgroundColor: "#E7F6ED",
  },
  feedbackIconError: {
    backgroundColor: "#FDECEC",
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#4D6472",
  },
  stateCard: {
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EAF4FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#023047",
    marginBottom: 8,
    textAlign: "center",
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#526977",
    textAlign: "center",
    maxWidth: 520,
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#023047",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 25, 36, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
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
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modalHeaderLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: "#023047",
    paddingRight: 24,
  },
  singleMessageBox: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  singleMessageText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4D6472",
  },
  summaryBox: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F7FAFC",
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 14,
    color: "#526977",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#023047",
    textAlign: "right",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF5F8",
    borderWidth: 1,
    borderColor: "#D5E2E8",
  },
  modalCancelText: {
    color: "#023047",
    fontWeight: "700",
    fontSize: 15,
  },
  modalConfirmButtonNeutral: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#023047",
  },
  modalConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
