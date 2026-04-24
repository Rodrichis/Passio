import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../styles/theme";
import { clampVisitasPorPremio, MAX_VISITAS_POR_PREMIO, MIN_VISITAS_POR_PREMIO } from "../../utils/walletOnboarding/validators";

type Props = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  helperText?: string | null;
};

export default function WalletVisitsField({ value, onChange, disabled = false, helperText = null }: Props) {
  const safeValue = clampVisitasPorPremio(value);

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 }}>
        Visitas por premio
      </Text>
      <Text style={{ color: "#51616F", marginBottom: 12 }}>
        Define cuantas visitas necesita un cliente para ganar un premio. Rango disponible: {MIN_VISITAS_POR_PREMIO} a {MAX_VISITAS_POR_PREMIO}.
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onChange(clampVisitasPorPremio(safeValue - 1))}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: disabled ? "#F1F4F6" : "#EDF5F8",
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.textDark }}>-</Text>
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: disabled ? "#E0E7EB" : "#D5E2E8",
            backgroundColor: disabled ? "#F7FAFC" : "#fff",
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.textDark }}>{safeValue}</Text>
        </View>

        <TouchableOpacity
          disabled={disabled}
          onPress={() => onChange(clampVisitasPorPremio(safeValue + 1))}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: disabled ? "#F1F4F6" : "#EDF5F8",
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.textDark }}>+</Text>
        </TouchableOpacity>
      </View>

      {helperText ? <Text style={{ color: "#7A4A00", marginTop: 10, lineHeight: 20 }}>{helperText}</Text> : null}
    </View>
  );
}
