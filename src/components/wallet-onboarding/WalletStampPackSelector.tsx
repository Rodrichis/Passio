import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../styles/theme";
import type { PaqueteSellosWallet, TipoSellosWallet } from "../../types/walletOnboarding";
import { buildStampPreviewUrl, resolveStampPackLabel, STAMP_PACK_OPTIONS } from "../../utils/walletOnboarding/stampPacks";
import { clampVisitasPorPremio } from "../../utils/walletOnboarding/validators";

type Props = {
  value: PaqueteSellosWallet;
  visitasPorPremio: number;
  tipoSellosWallet: TipoSellosWallet;
  onChange: (value: PaqueteSellosWallet) => void;
};

function ContactStampsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
            maxWidth: 420,
            backgroundColor: "#fff",
            borderRadius: 24,
            padding: 22,
            borderWidth: 1,
            borderColor: "#DDE8EE",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.textDark, marginBottom: 10 }}>
            Sellos personalizados
          </Text>
          <Text style={{ color: "#51616F", lineHeight: 22, marginBottom: 20 }}>
            Si necesitas sellos personalizados con tu logo, escribenos a hola@passio.cl
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={{
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
  );
}

export default function WalletStampPackSelector({ value, visitasPorPremio, tipoSellosWallet, onChange }: Props) {
  const [previewPackId, setPreviewPackId] = useState<PaqueteSellosWallet | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const safeVisits = clampVisitasPorPremio(visitasPorPremio);
  const previewVersion = useMemo(() => String(Date.now()), [previewPackId, safeVisits]);
  const previewUrls = useMemo(() => {
    if (!previewPackId) return null;
    return {
      before: buildStampPreviewUrl(previewPackId, safeVisits, safeVisits - 1, previewVersion),
      after: buildStampPreviewUrl(previewPackId, safeVisits, safeVisits, previewVersion),
    };
  }, [previewPackId, safeVisits, previewVersion]);
  const [beforeUnavailable, setBeforeUnavailable] = useState(false);
  const [afterUnavailable, setAfterUnavailable] = useState(false);

  useEffect(() => {
    setBeforeUnavailable(false);
    setAfterUnavailable(false);
  }, [previewUrls?.before, previewUrls?.after]);

  if (tipoSellosWallet === "personalizado") {
    return (
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 }}>
          Pack de sellos
        </Text>
        <Text style={{ color: "#51616F", marginBottom: 12 }}>
          Tu wallet usa sellos personalizados. El preview seguira mostrando tus sellos actuales.
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: "#D5E2E8",
            backgroundColor: "#F7FAFC",
            borderRadius: 16,
            padding: 16,
            gap: 12,
          }}
        >
          <View>
            <Text style={{ color: COLORS.textDark, fontSize: 16, fontWeight: "700" }}>{resolveStampPackLabel(value, tipoSellosWallet)}</Text>
            <Text style={{ color: "#51616F", marginTop: 6 }}>
              Si deseas cambiar tus sellos personalizados, contactanos.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setPreviewPackId(value)}
            style={{
              alignSelf: "flex-start",
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

        <TouchableOpacity onPress={() => setContactModalOpen(true)} style={{ marginTop: 14, alignSelf: "flex-start" }}>
          <Text style={{ color: COLORS.primary, fontWeight: "700" }}>¿Necesitas sellos personalizados?</Text>
        </TouchableOpacity>

        <ContactStampsModal visible={contactModalOpen} onClose={() => setContactModalOpen(false)} />

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
                Asi se veria tu pack personalizado cuando el cliente este cerca de completar el premio y cuando ya alcance la meta.
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

      <TouchableOpacity onPress={() => setContactModalOpen(true)} style={{ marginTop: 14, alignSelf: "flex-start" }}>
        <Text style={{ color: COLORS.primary, fontWeight: "700" }}>¿Necesitas sellos personalizados?</Text>
      </TouchableOpacity>

      <ContactStampsModal visible={contactModalOpen} onClose={() => setContactModalOpen(false)} />

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

