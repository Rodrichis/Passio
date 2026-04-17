import React from "react";
import { Text, TextInput, View } from "react-native";
import { COLORS } from "../../styles/theme";
import { normalizeHexColor } from "../../utils/walletOnboarding/validators";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function WalletColorField({ value, onChange }: Props) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textDark, marginBottom: 8 }}>
        Color del wallet
      </Text>
      <Text style={{ color: "#51616F", marginBottom: 12 }}>
        Elige un color HEX para el fondo principal de tu wallet.
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: normalizeHexColor(value),
            borderWidth: 1,
            borderColor: "#D5E2E8",
          }}
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          autoCapitalize="characters"
          placeholder="#A99985"
          placeholderTextColor="#7A8A98"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#D5E2E8",
            backgroundColor: "#fff",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: COLORS.textDark,
          }}
        />
      </View>
    </View>
  );
}
