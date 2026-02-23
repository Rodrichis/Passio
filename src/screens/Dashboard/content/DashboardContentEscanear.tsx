import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  updateWalletPoints,
  updateApplePass,
  type WalletApiResponse,
} from "../../../services/apiWallet";
import { auth, db } from "../../../services/firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

type ParsedPayload = {
  idUsuario?: string;
  cantidadPuntos?: number;
  empresaId?: string;
};

export default function DashboardContentEscanear() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState<string>("Apunta al código QR");
  const [result, setResult] = useState<WalletApiResponse | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<"visita" | "premio">("visita");
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // solicitamos permiso al montar si aún no se pidió
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

  const parseData = (raw: string): ParsedPayload => {
    try {
      const parsed = JSON.parse(raw);
      return {
        idUsuario: parsed.idUsuario || parsed.userId,
        cantidadPuntos: parsed.cantidadPuntos ?? parsed.puntos ?? parsed.points,
        empresaId: parsed.empresaId || parsed.empresaUid,
      };
    } catch {
      // fallback: si viene un id plano, lo usamos y puntos = 1
      return { idUsuario: raw, cantidadPuntos: 1 };
    }
  };

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);
      setLoading(true);
      setFeedback(null);
      setStatus(scanMode === "premio" ? "Procesando (premio)..." : "Procesando (visita)...");

      const empresaId = auth.currentUser?.uid;
      if (!empresaId) {
        setStatus("Debes iniciar sesión para escanear.");
        setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        setLoading(false);
        return;
      }

      const payload = parseData(data);
      if (!payload.idUsuario) {
        setStatus("No se encontró idUsuario en el QR.");
        setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        setLoading(false);
        return;
      }

      if (payload.empresaId && payload.empresaId !== empresaId) {
        setStatus("Esta tarjeta no pertenece a tu empresa.");
        setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        setLoading(false);
        return;
      }

      let clienteDoc: any = null;
      try {
        const ref = doc(db, "Empresas", empresaId, "Clientes", payload.idUsuario);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setStatus("Esta tarjeta no pertenece a tu empresa.");
          setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
          setLoading(false);
          return;
        }
        clienteDoc = snap.data() as any;
        const activo = clienteDoc.activo ?? true;
        if (!activo) {
          setStatus("Este usuario está desactivado. No se puede registrar la visita.");
          setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Error validando tarjeta:", e);
        setStatus("No se pudo validar la tarjeta. Intenta nuevamente.");
        setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        setLoading(false);
        return;
      }

      const nombreCliente = clienteDoc?.nombreCompleto || clienteDoc?.nombre || "--";
      const soCliente = (clienteDoc?.so || "").toLowerCase();
      const visitasTotalesPrev = Number(clienteDoc?.visitasTotales ?? 0);
      const cicloPrev = Number(clienteDoc?.cicloVisitas ?? 0);
      const premiosDispPrev = Number(clienteDoc?.premiosDisponibles ?? 0);
      const premiosCanjPrev = Number(clienteDoc?.premiosCanjeados ?? 0);

      if (scanMode === "premio" && premiosDispPrev <= 0) {
        setStatus("No tiene premios disponibles.");
        setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        setLoading(false);
        return;
      }

      let visitasTotales = visitasTotalesPrev;
      let cicloVisitas = cicloPrev;
      let premiosDisponibles = premiosDispPrev;
      let premiosCanjeados = premiosCanjPrev;

      if (scanMode === "visita") {
        visitasTotales = visitasTotalesPrev + 1;
        cicloVisitas = cicloPrev + 1;
        if (cicloVisitas > 10) {
          cicloVisitas = 1;
          premiosDisponibles += 1;
        }
      } else {
        // canje premio
        premiosDisponibles = Math.max(0, premiosDispPrev - 1);
        premiosCanjeados = premiosCanjPrev + 1;
      }

      const puntos = Number(payload.cantidadPuntos ?? 1);
      const basePoints = Number.isFinite(puntos) ? puntos : 1;
      const finalPoints = scanMode === "premio" ? -Math.abs(basePoints) : basePoints;

      try {
        // Actualizamos wallet según SO
        if (soCliente === "ios") {
          await updateApplePass({
            idUsuario: payload.idUsuario,
            cantidad: cicloVisitas || 0,
            premiosDisponibles,
          });
        } else {
          await updateWalletPoints({
            idUsuario: payload.idUsuario,
            cantidadPuntos: finalPoints,
          });
        }

        // Actualizamos Firestore
        const ref = doc(db, "Empresas", empresaId, "Clientes", payload.idUsuario);
        await updateDoc(ref, {
          visitasTotales,
          cicloVisitas,
          premiosDisponibles,
          premiosCanjeados,
          ultimaVisita: serverTimestamp(),
        });

        setResult({
          ok: true,
          status: 200,
          data: { visitasTotales, cicloVisitas, premiosDisponibles, premiosCanjeados },
        });
        setFeedback({
          type: "success",
          message: `Visita otorgada a ${nombreCliente}. Ciclo: ${cicloVisitas} | Visitas totales: ${visitasTotales} | Premios: ${premiosDisponibles}`,
        });
        setStatus(
          scanMode === "premio" ? "Premio registrado" : "Visita registrada"
        );
      } catch (err) {
        console.error("Error al actualizar pase:", err);
        setFeedback({ type: "error", message: "No pudimos leer el pase. Escanea nuevamente." });
        setStatus("No pudimos leer el pase. Escanea nuevamente.");
      } finally {
        setLoading(false);
      }
    },
    [scanned, scanMode]
  );

  const resetScan = () => {
    setScanned(false);
    setResult(null);
    setFeedback(null);
    setStatus("Apunta al código QR");
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#023047" />
        <Text style={{ marginTop: 8 }}>Solicitando permiso de cámara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Escanear</Text>
        <Text style={styles.text}>Permiso de cámara denegado.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Otorgar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escanear QR</Text>
      <Text style={styles.text}>{status}</Text>

      <View style={styles.scannerBox}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => setScanMode("visita")}
          style={[
            styles.actionButton,
            scanMode === "visita" && styles.actionButtonActive,
          ]}
          disabled={loading}
        >
          <Text
            style={[
              styles.actionButtonText,
              scanMode === "visita" && styles.actionButtonTextActive,
            ]}
          >
            Contar visita
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setScanMode("premio")}
          style={[
            styles.actionButton,
            scanMode === "premio" && styles.actionButtonActive,
          ]}
          disabled={loading}
        >
          <Text
            style={[
              styles.actionButtonText,
              scanMode === "premio" && styles.actionButtonTextActive,
            ]}
          >
            Reclamar premio
          </Text>
        </TouchableOpacity>
      </View>

      {feedback && (
        <View
          style={[
            styles.resultBox,
            feedback.type === "success" ? styles.resultSuccess : styles.resultError,
          ]}
        >
          <Text style={styles.resultTitle}>
            {feedback.type === "success" ? "Visita registrada" : "No pudimos leer el pase"}
          </Text>
          <Text style={styles.resultText}>{feedback.message}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={resetScan} disabled={loading}>
        <Text style={styles.buttonText}>Escanear de nuevo</Text>
      </TouchableOpacity>
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
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#023047",
  },
  text: {
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  scannerBox: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 280,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultBox: {
    marginTop: 16,
    backgroundColor: "#e0f2f1",
    padding: 12,
    borderRadius: 8,
  },
  resultSuccess: {
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  resultError: {
    backgroundColor: "#ffebee",
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  resultTitle: {
    fontWeight: "700",
    marginBottom: 6,
    color: "#023047",
  },
  resultText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#333",
  },
  button: {
    marginTop: 16,
    backgroundColor: "#023047",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#e3f2fd",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfd8dc",
  },
  actionButtonActive: {
    backgroundColor: "#023047",
    borderColor: "#023047",
  },
  actionButtonText: {
    color: "#023047",
    fontWeight: "700",
  },
  actionButtonTextActive: {
    color: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
});






