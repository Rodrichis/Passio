import React, { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../styles/theme";
import type { PaqueteSellosWallet, WalletIconAsset } from "../../types/walletOnboarding";
import { buildStampPreviewUrl } from "../../utils/walletOnboarding/stampPacks";
import { clampVisitasPorPremio, normalizeHexColor } from "../../utils/walletOnboarding/validators";

type Props = {
  companyName: string;
  walletClassId: string;
  colorWallet: string;
  urlIconoWallet: string;
  iconAsset: WalletIconAsset | null;
  paqueteSellosWallet: PaqueteSellosWallet;
  visitasPorPremio: number;
};

function resolveTextColor(hexColor: string) {
  const safeColor = normalizeHexColor(hexColor).replace("#", "");
  const r = parseInt(safeColor.slice(0, 2), 16);
  const g = parseInt(safeColor.slice(2, 4), 16);
  const b = parseInt(safeColor.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#123042" : "#FFFFFF";
}

function QrPreview() {
  return (
    <View
      style={{
        width: 142,
        height: 142,
        backgroundColor: "#fff",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <MaterialCommunityIcons name="qrcode" size={104} color="#111" />
    </View>
  );
}

function resolveDisplayName(companyName: string, walletClassId: string) {
  if (companyName.trim()) return companyName;
  return walletClassId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function WalletPreviewCard({
  companyName,
  walletClassId,
  colorWallet,
  urlIconoWallet,
  iconAsset,
  paqueteSellosWallet,
  visitasPorPremio,
}: Props) {
  const safeColor = normalizeHexColor(colorWallet);
  const textColor = resolveTextColor(safeColor);
  const safeVisits = clampVisitasPorPremio(visitasPorPremio);
  const [iconUnavailable, setIconUnavailable] = useState(false);
  const iconUri = iconAsset?.previewUrl || (iconUnavailable ? "" : urlIconoWallet || "");
  const packPreviewUrl = useMemo(
    () => buildStampPreviewUrl(paqueteSellosWallet, safeVisits, safeVisits),
    [paqueteSellosWallet, safeVisits]
  );
  const displayName = resolveDisplayName(companyName, walletClassId);
  const [packPreviewUnavailable, setPackPreviewUnavailable] = useState(false);

  useEffect(() => {
    setPackPreviewUnavailable(false);
  }, [packPreviewUrl]);

  useEffect(() => {
    setIconUnavailable(false);
  }, [iconAsset?.previewUrl, urlIconoWallet]);

  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#DDE8EE",
        backgroundColor: "#FFFFFF",
        padding: 18,
      }}
    >
      <Text style={{ color: COLORS.textDark, fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Vista previa</Text>
      <Text style={{ color: "#51616F", lineHeight: 21, marginBottom: 14 }}>
        Maqueta referencial inspirada en el wallet Apple. Sirve para validar composicion, color e icono antes de guardar.
      </Text>

      <View
        style={{
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: safeColor,
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 18,
          minHeight: 430,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10 }}>
          <View style={{ width: 48, height: 48 }}>
            {iconUri ? (
              <Image
                source={{ uri: iconUri }}
                style={{ width: 48, height: 48 }}
                resizeMode="contain"
                onError={() => {
                  if (!iconAsset?.previewUrl) {
                    setIconUnavailable(true);
                  }
                }}
              />
            ) : null}
          </View>

          <View style={{ flex: 1, alignItems: "flex-end", paddingTop: 2 }}>
            <Text style={{ color: textColor, fontSize: 11, fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>
              Nombre cliente
            </Text>
            <Text style={{ color: textColor, fontSize: 15, fontWeight: "500" }}>Apellido cliente</Text>
          </View>
        </View>

        <View style={{ marginHorizontal: -14, marginBottom: 14 }}>
          {!packPreviewUnavailable ? (
            <Image
              source={{ uri: packPreviewUrl }}
              style={{ width: "100%", height: 136, alignSelf: "stretch" }}
              resizeMode="stretch"
              onError={() => setPackPreviewUnavailable(true)}
            />
          ) : (
            <View
              style={{
                width: "100%",
                minHeight: 110,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.28)",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <Text style={{ color: textColor, opacity: 0.92, textAlign: "center", fontWeight: "700" }}>
                Vista del pack disponible proximamente
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 22, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textColor, fontSize: 11, fontWeight: "700", opacity: 0.92, marginBottom: 4, textTransform: "uppercase" }}>
              Visitas
            </Text>
            <Text style={{ color: textColor, fontSize: 15, fontWeight: "500" }}>{safeVisits}</Text>
          </View>

          <View style={{ flex: 1, alignItems: "flex-end", paddingRight: 2 }}>
            <Text style={{ color: textColor, fontSize: 11, fontWeight: "700", opacity: 0.92, marginBottom: 4, textTransform: "uppercase", textAlign: "right" }}>
              Premios disponibles
            </Text>
            <Text style={{ color: textColor, fontSize: 15, fontWeight: "500", textAlign: "right" }}>1 premio</Text>
          </View>
        </View>

        <View style={{ alignItems: "center", justifyContent: "flex-end", flex: 1 }}>
          <QrPreview />
          <Text style={{ color: textColor, fontSize: 12, marginTop: 8, opacity: 0.95 }}>Desarrollado por Passio</Text>
        </View>
      </View>
    </View>
  );
}
