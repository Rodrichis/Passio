import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

const ACTION_THEME: Record<ScanAction, { label: string; title: string; color: string; soft: string; border: string }> = {
  visita: {
    label: "Contar visita",
    title: "Modo visita",
    color: "#0D7A52",
    soft: "#E8F7EF",
    border: "#BFE3CF",
  },
  premio: {
    label: "Canjear premio",
    title: "Modo premio",
    color: "#B84F2D",
    soft: "#FFF0EA",
    border: "#F0C3B3",
  },
};

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

export default function DashboardContentEscanear() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState<string>("Selecciona una accion para comenzar.");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ScanAction | null>(null);
  const [walletConfig, setWalletConfig] = useState<Awaited<ReturnType<typeof getWalletConfig>> | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const processingRef = useRef(false);

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
        setStatus("Permiso de camara denegado. Activalo para escanear.");
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
        console.error("Error cargando configuracion de wallet para escaner:", error);
      }
    };

    loadWalletConfig();
    return () => {
      active = false;
    };
  }, []);

  const resetToChooser = useCallback((nextFeedback: Feedback | null = null) => {
    processingRef.current = false;
    setLoading(false);
    setScanned(false);
    setPendingConfirmation(null);
    setSelectedAction(null);
    setStatus("Selecciona una accion para comenzar.");
    setFeedback(nextFeedback);
  }, []);

  const startAction = useCallback((action: ScanAction) => {
    processingRef.current = false;
    setFeedback(null);
    setPendingConfirmation(null);
    setScanned(false);
    setSelectedAction(action);
    setStatus(action === "premio" ? "Escanea el QR para canjear un premio." : "Escanea el QR para registrar una visita.");
  }, []);

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

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!selectedAction || scanned || processingRef.current) return;

      processingRef.current = true;
      setScanned(true);
      setLoading(true);
      setFeedback(null);
      setStatus("Validando cliente...");

      const releaseValidation = () => {
        processingRef.current = false;
        setLoading(false);
      };

      const empresaId = auth.currentUser?.uid;
      if (!empresaId) {
        resetToChooser({ type: "error", message: "Debes iniciar sesion para escanear." });
        return;
      }

      if (!walletConfig) {
        resetToChooser({ type: "error", message: "No se pudo cargar la configuracion del wallet." });
        return;
      }

      const visitasPorPremio = walletConfig.visitasPorPremio;
      const payload = parseData(data);
      if (!payload.idUsuario) {
        resetToChooser({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        return;
      }

      if (payload.empresaId && payload.empresaId !== empresaId) {
        resetToChooser({ type: "error", message: "Esta tarjeta no pertenece a tu empresa." });
        return;
      }

      let clienteDoc: any = null;
      try {
        const ref = doc(db, "Empresas", empresaId, "Clientes", payload.idUsuario);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          resetToChooser({ type: "error", message: "Esta tarjeta no pertenece a tu empresa." });
          return;
        }

        clienteDoc = snap.data() as any;
        const activo = clienteDoc.activo ?? true;
        if (!activo) {
          resetToChooser({ type: "error", message: "Este usuario esta desactivado. No se puede continuar." });
          return;
        }
      } catch (error) {
        console.error("Error validando tarjeta:", error);
        resetToChooser({ type: "error", message: "No se pudo validar la tarjeta. Intenta nuevamente." });
        return;
      }

      const nombreCliente = clienteDoc?.nombreCompleto || clienteDoc?.nombre || "Cliente";
      const soCliente = (clienteDoc?.so || "").toLowerCase();
      const visitasTotalesPrev = normalizeNonNegativeInt(clienteDoc?.visitasTotales);
      const cicloPrev = normalizeCycleValue(clienteDoc?.cicloVisitas, visitasPorPremio);
      const premiosDispPrev = normalizeNonNegativeInt(clienteDoc?.premiosDisponibles);
      const premiosCanjPrev = normalizeNonNegativeInt(clienteDoc?.premiosCanjeados);

      if (selectedAction === "premio" && premiosDispPrev <= 0) {
        resetToChooser({ type: "error", message: `${nombreCliente} no tiene premios disponibles.` });
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

      setPendingConfirmation({
        action: selectedAction,
        idUsuario: payload.idUsuario,
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
      releaseValidation();
    },
    [resetToChooser, scanned, selectedAction, walletConfig]
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingConfirmation || !walletConfig) return;

    const empresaId = auth.currentUser?.uid;
    if (!empresaId) {
      resetToChooser({ type: "error", message: "Debes iniciar sesion para escanear." });
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
        resetToChooser({ type: "error", message: "No pudimos actualizar el wallet. Intenta nuevamente." });
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
              message: `Premio canjeado para ${pendingConfirmation.nombreCliente}. Premios restantes: ${pendingConfirmation.premiosDisponiblesNext}`,
            }
          : {
              type: "success",
              action: "visita",
              message: `Visita registrada para ${pendingConfirmation.nombreCliente}. Ciclo actual: ${pendingConfirmation.cicloVisitasNext}`,
            }
      );
    } catch (error) {
      console.error("Error al confirmar escaneo:", error);
      resetToChooser({ type: "error", message: "No pudimos completar la accion. Intenta nuevamente." });
    }
  }, [pendingConfirmation, resetToChooser, walletConfig]);

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#023047" />
        <Text style={{ marginTop: 8 }}>Solicitando permiso de camara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Escanear</Text>
        <Text style={styles.text}>Permiso de camara denegado.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Otorgar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const theme = selectedAction ? ACTION_THEME[selectedAction] : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escanear QR</Text>
      <Text style={styles.text}>{status}</Text>

      {selectedAction === null ? (
        <View style={styles.chooserCard}>
          <Text style={styles.chooserTitle}>Elige la accion a realizar</Text>
          <Text style={styles.chooserText}>Selecciona primero la accion y luego escanea el QR del cliente.</Text>

          <View style={styles.chooserButtons}>
            <TouchableOpacity
              onPress={() => startAction("visita")}
              style={[styles.modeButton, { backgroundColor: ACTION_THEME.visita.color }]}
            >
              <Text style={styles.modeButtonText}>{ACTION_THEME.visita.label}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => startAction("premio")}
              style={[styles.modeButton, { backgroundColor: ACTION_THEME.premio.color }]}
            >
              <Text style={styles.modeButtonText}>{ACTION_THEME.premio.label}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.modeBanner, { backgroundColor: theme?.soft, borderColor: theme?.border }]}> 
            <View style={[styles.modeBadge, { backgroundColor: theme?.color }]}>
              <Text style={styles.modeBadgeText}>{theme?.title}</Text>
            </View>
            <Text style={styles.modeBannerText}>
              {selectedAction === "premio" ? "Escanea el QR y confirma el canje del premio." : "Escanea el QR y confirma la visita antes de guardar."}
            </Text>
          </View>

          <View style={[styles.scannerBox, { borderColor: theme?.color || "#023047" }]}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              autofocus="off"
              onBarcodeScanned={selectedAction && !scanned ? handleBarCodeScanned : undefined}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            />
            {loading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => resetToChooser(null)} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </>
      )}

      {feedback && (
        <View style={[styles.resultBox, feedback.type === "success" ? styles.resultSuccess : styles.resultError]}>
          <Text style={styles.resultTitle}>
            {feedback.type === "success"
              ? feedback.action === "premio"
                ? "Premio canjeado"
                : "Visita registrada"
              : "No se pudo completar la accion"}
          </Text>
          <Text style={styles.resultText}>{feedback.message}</Text>
        </View>
      )}

      <Modal visible={Boolean(pendingConfirmation)} transparent animationType="fade" onRequestClose={() => (!loading ? resetToChooser(null) : undefined)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              pendingConfirmation ? { borderColor: ACTION_THEME[pendingConfirmation.action].border } : null,
            ]}
          >
            {pendingConfirmation ? (
              <>
                <View style={[styles.modalHeader, { backgroundColor: ACTION_THEME[pendingConfirmation.action].color }]}>
                  <Text style={styles.modalHeaderText}>{ACTION_THEME[pendingConfirmation.action].label}</Text>
                </View>

                <Text style={styles.modalTitle}>
                  {pendingConfirmation.action === "premio"
                    ? `Desea canjear premio para ${pendingConfirmation.nombreCliente}?`
                    : `Desea sumar visita para ${pendingConfirmation.nombreCliente}?`}
                </Text>

                <View style={styles.summaryBox}>
                  {pendingConfirmation.action === "visita" ? (
                    <>
                      <Text style={styles.summaryText}>Visitas totales: {pendingConfirmation.visitasTotalesPrev}{" -> "}{pendingConfirmation.visitasTotalesNext}</Text>
                      <Text style={styles.summaryText}>Ciclo actual: {pendingConfirmation.cicloPrev}{" -> "}{pendingConfirmation.cicloVisitasNext}</Text>
                      <Text style={styles.summaryText}>Premios disponibles: {pendingConfirmation.premiosDisponiblesPrev}{" -> "}{pendingConfirmation.premiosDisponiblesNext}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.summaryText}>Premios disponibles: {pendingConfirmation.premiosDisponiblesPrev}{" -> "}{pendingConfirmation.premiosDisponiblesNext}</Text>
                      <Text style={styles.summaryText}>Premios canjeados: {pendingConfirmation.premiosCanjeadosPrev}{" -> "}{pendingConfirmation.premiosCanjeadosNext}</Text>
                      <Text style={styles.summaryText}>Visitas totales: {pendingConfirmation.visitasTotalesPrev}</Text>
                    </>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelButton} onPress={() => resetToChooser(null)} disabled={loading}>
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmButton, { backgroundColor: ACTION_THEME[pendingConfirmation.action].color, opacity: loading ? 0.7 : 1 }]}
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
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#023047",
  },
  text: {
    fontSize: 14,
    color: "#44535F",
    marginBottom: 14,
  },
  chooserCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE8EE",
    padding: 18,
  },
  chooserTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#023047",
    marginBottom: 6,
  },
  chooserText: {
    fontSize: 14,
    color: "#51616F",
    lineHeight: 21,
    marginBottom: 16,
  },
  chooserButtons: {
    gap: 12,
  },
  modeButton: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modeBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  modeBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  modeBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  modeBannerText: {
    color: "#44535F",
    lineHeight: 21,
  },
  scannerBox: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 320,
    borderWidth: 3,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: "#023047",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 14,
    backgroundColor: "#EDF5F8",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D5E2E8",
  },
  secondaryButtonText: {
    color: "#023047",
    fontSize: 15,
    fontWeight: "700",
  },
  resultBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: "#E8F5E9",
    borderColor: "#C8E6C9",
  },
  resultError: {
    backgroundColor: "#FFEBEE",
    borderColor: "#FFCDD2",
  },
  resultTitle: {
    fontWeight: "800",
    marginBottom: 6,
    color: "#023047",
  },
  resultText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
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
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalHeaderText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#023047",
    lineHeight: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  summaryBox: {
    marginTop: 16,
    marginHorizontal: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F7FAFC",
    gap: 8,
  },
  summaryText: {
    color: "#44535F",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
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
  modalConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
});
