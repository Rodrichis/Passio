import React from "react";
import { Text, TextInput, View } from "react-native";
import { COLORS } from "../../styles/theme";
import { isValidHexColor, normalizeHexColor } from "../../utils/walletOnboarding/validators";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function WalletColorField({ value, onChange }: Props) {
  const isValid = isValidHexColor(value);

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
          onChangeText={(nextValue) => {
            const cleaned = nextValue.toUpperCase().replace(/[^#A-F0-9]/g, "");
            const withoutHashes = cleaned.replace(/#/g, "");
            const withHash = cleaned.startsWith("#") ? cleaned : "#" + withoutHashes;
            onChange(withHash.slice(0, 7));
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="#A99985"
          placeholderTextColor="#7A8A98"
          maxLength={7}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: isValid ? "#D5E2E8" : "#C62828",
            backgroundColor: "#fff",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: COLORS.textDark,
          }}
        />
      </View>
      {!isValid ? (
        <Text style={{ marginTop: 8, color: "#C62828" }}>Usa un color HEX valido con formato #RRGGBB.</Text>
      ) : null}
    </View>
  );
}