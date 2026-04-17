import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../styles/theme";
import type { PaqueteSellosWallet } from "../../types/walletOnboarding";
import { buildStampPreviewUrl, STAMP_PACK_OPTIONS } from "../../utils/walletOnboarding/stampPacks";
import { clampVisitasPorPremio } from "../../utils/walletOnboarding/validators";

type Props = {
  value: PaqueteSellosWallet;
  visitasPorPremio: number;
  onChange: (value: PaqueteSellosWallet) => void;
};

export default function WalletStampPackSelector({ value, visitasPorPremio, onChange }: Props) {
  const [previewPackId, setPreviewPackId] = useState<PaqueteSellosWallet | null>(null);
  const safeVisits = clampVisitasPorPremio(visitasPorPremio);
  const previewUrls = useMemo(() => {
    if (!previewPackId) return null;
    return {
      before: buildStampPreviewUrl(previewPackId, safeVisits, safeVisits - 1),
      after: buildStampPreviewUrl(previewPackId, safeVisits, safeVisits),
    };
  }, [previewPackId, safeVisits]);
  const [beforeUnavailable, setBeforeUnavailable] = useState(false);
  const [afterUnavailable, setAfterUnavailable] = useState(false);

  useEffect(() => {
    setBeforeUnavailable(false);
    setAfterUnavailable(false);
  }, [previewUrls?.before, previewUrls?.after]);

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 }}>
        Pack de sellos
      </Text>
      <Text style={{ color: "#51616F", marginBottom: 12 }}>
        Elige uno de los packs de sellos disponibles para mostrar el avance de visitas.
      </Text>

      <View style={{ gap: 12 }}>
        {STAMP_PACK_OPTIONS.map((option) => {
          const selected = value === option.id;

          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onChange(option.id)}
              style={{
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? COLORS.primary : "#D5E2E8",
                backgroundColor: selected ? "#F1FAFD" : "#fff",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: COLORS.textDark }}>{option.title}</Text>
                <TouchableOpacity
                  onPress={() => setPreviewPackId(option.id)}
                  style={{
                    backgroundColor: COLORS.primary,
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Ver ejemplo</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: "#51616F" }}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={Boolean(previewPackId && previewUrls)} transparent animationType="fade" onRequestClose={() => setPreviewPackId(null)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(2, 48, 71, 0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: "#DDE8EE",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.textDark, marginBottom: 8 }}>
              Vista previa de sellos
            </Text>
            <Text style={{ color: "#51616F", lineHeight: 22, marginBottom: 18 }}>
              Asi se veria el pack cuando el cliente este cerca de completar el premio y cuando ya alcance la meta.
            </Text>

            {previewUrls ? (
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={{ color: COLORS.textDark, fontWeight: "700", marginBottom: 8 }}>Casi completo</Text>
                  {!beforeUnavailable ? (
                    <Image
                      source={{ uri: previewUrls.before }}
                      style={{ width: "100%", height: 120, borderRadius: 14 }}
                      resizeMode="contain"
                      onError={() => setBeforeUnavailable(true)}
                    />
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        minHeight: 120,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#DDE8EE",
                        backgroundColor: "#F7FAFC",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                      }}
                    >
                      <Text style={{ color: "#51616F", textAlign: "center", fontWeight: "700" }}>
                        Vista del pack disponible proximamente
                      </Text>
                    </View>
                  )}
                </View>

                <View>
                  <Text style={{ color: COLORS.textDark, fontWeight: "700", marginBottom: 8 }}>Premio completado</Text>
                  {!afterUnavailable ? (
                    <Image
                      source={{ uri: previewUrls.after }}
                      style={{ width: "100%", height: 120, borderRadius: 14 }}
                      resizeMode="contain"
                      onError={() => setAfterUnavailable(true)}
                    />
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        minHeight: 120,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#DDE8EE",
                        backgroundColor: "#F7FAFC",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                      }}
                    >
                      <Text style={{ color: "#51616F", textAlign: "center", fontWeight: "700" }}>
                        Vista del pack disponible proximamente
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => setPreviewPackId(null)}
              style={{
                marginTop: 20,
                backgroundColor: COLORS.primary,
                minHeight: 46,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
