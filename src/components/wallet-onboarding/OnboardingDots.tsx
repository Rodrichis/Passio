import React from "react";
import { View } from "react-native";
import { COLORS } from "../../styles/theme";

type Props = {
  total: number;
  activeIndex: number;
};

export default function OnboardingDots({ total, activeIndex }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {Array.from({ length: total }).map((_, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={{
              width: active ? 24 : 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: active ? COLORS.primary : "#D7E3EA",
            }}
          />
        );
      })}
    </View>
  );
}
