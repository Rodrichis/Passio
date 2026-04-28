import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "qrcode";

type Props = {
  visible: boolean;
  value: string;
  fileName?: string;
  onClose: () => void;
};

export default function RegistrationQrModal({
  visible,
  value,
  fileName = "qr-registro.png",
  onClose,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const generateQr = async () => {
      if (!visible || !value) {
        setQrDataUrl(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const dataUrl = await QRCode.toDataURL(value, {
          width: 960,
          margin: 1,
          color: {
            dark: "#0F172A",
            light: "#FFFFFF",
          },
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error("Error al generar QR:", err);
        if (!cancelled) {
          setQrDataUrl(null);
          setError("No se pudo generar el QR.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    generateQr();

    return () => {
      cancelled = true;
    };
  }, [value, visible]);

  const handleDownload = React.useCallback(() => {
    if (!qrDataUrl) return;

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const link = document.createElement("a");
      link.href = qrDataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    alert("La descarga del QR est\u00E1 disponible en la versi\u00F3n web.");
  }, [fileName, qrDataUrl]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(13, 25, 34, 0.45)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            paddingHorizontal: 24,
            paddingVertical: 24,
            borderWidth: 1,
            borderColor: "#E2ECF1",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#123042",
              fontSize: 22,
              fontWeight: "800",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {"C\u00F3digo QR de registro"}
          </Text>

          <View
            style={{
              width: 260,
              height: 260,
              borderRadius: 18,
              backgroundColor: "#F8FBFD",
              borderWidth: 1,
              borderColor: "#E2ECF1",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#2196F3" />
            ) : qrDataUrl ? (
              <Image
                source={{ uri: qrDataUrl }}
                style={{ width: 240, height: 240 }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ color: "#C62828", textAlign: "center", paddingHorizontal: 16 }}>
                {error || "No se pudo generar el QR."}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <TouchableOpacity
              onPress={handleDownload}
              disabled={!qrDataUrl}
              style={{
                backgroundColor: qrDataUrl ? "#fb8500" : "#B0BEC5",
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Descargar QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: "#E3F2FD",
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#0D47A1", fontWeight: "700" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
