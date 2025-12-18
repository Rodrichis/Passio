import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { updateWalletPoints, type WalletApiResponse } from "../../../services/apiWallet";
import { auth, db } from "../../../services/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

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
  const [loading, setLoading] = useState(false);
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
      setStatus("Procesando...");

      const empresaId = auth.currentUser?.uid;
      if (!empresaId) {
        setStatus("Debes iniciar sesion para escanear.");
        setLoading(false);
        return;
      }

      const payload = parseData(data);
      if (!payload.idUsuario) {
        setStatus("No se encontró idUsuario en el QR.");
        setLoading(false);
        return;
      }

      if (payload.empresaId && payload.empresaId !== empresaId) {
        setStatus("Esta tarjeta no pertenece a tu empresa.");
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "Empresas", empresaId, "Clientes", payload.idUsuario);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setStatus("Esta tarjeta no pertenece a tu empresa.");
          setLoading(false);
          return;
        }
        const cliente = snap.data() as any;
        const activo = cliente.activo ?? true;
        if (!activo) {
          setStatus("Este usuario esta desactivado. No se puede registrar la visita.");
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Error validando tarjeta:", e);
        setStatus("No se pudo validar la tarjeta. Intenta nuevamente.");
        setLoading(false);
        return;
      }

      const puntos = Number(payload.cantidadPuntos ?? 3);

      try {
        const res = await updateWalletPoints({
          idUsuario: payload.idUsuario,
          cantidadPuntos: Number.isFinite(puntos) ? puntos : 1,
        });
        setResult(res);
        setStatus(res.ok ? "Actualización OK" : "Error al actualizar");
      } catch (err) {
        setStatus(`Error: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [scanned]
  );

  const resetScan = () => {
    setScanned(false);
    setResult(null);
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

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Respuesta</Text>
          <Text style={styles.resultText} selectable>
            {JSON.stringify(result, null, 2)}
          </Text>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
});
