import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../styles/theme";
import type { WalletOnboardingSlideData } from "../../types/walletOnboarding";

type Props = {
  slide: WalletOnboardingSlideData;
};

export default function OnboardingSlide({ slide }: Props) {
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: "#EAF6F9",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Ionicons name={slide.iconName as any} size={44} color={COLORS.primary} />
      </View>

      <Text
        style={{
          fontSize: 26,
          fontWeight: "800",
          color: COLORS.textDark,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        {slide.title}
      </Text>

      <Text
        style={{
          fontSize: 16,
          lineHeight: 24,
          color: "#425466",
          textAlign: "center",
          maxWidth: 520,
        }}
      >
        {slide.description}
      </Text>
    </View>
  );
}
