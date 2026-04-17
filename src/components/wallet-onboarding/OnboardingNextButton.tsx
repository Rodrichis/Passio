import React from "react";
import { Text, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../styles/theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  iconName?: "arrow-forward" | "arrow-back";
  iconPosition?: "left" | "right";
  variant?: "primary" | "secondary";
};

export default function OnboardingNextButton({
  label,
  onPress,
  disabled,
  style,
  iconName = "arrow-forward",
  iconPosition = "right",
  variant = "primary",
}: Props) {
  const isPrimary = variant === "primary";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: isPrimary ? COLORS.primary : "#EDF5F8",
          minHeight: 48,
          borderRadius: 999,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.6 : 1,
          borderWidth: isPrimary ? 0 : 1,
          borderColor: isPrimary ? "transparent" : "#D5E2E8",
          flexShrink: 1,
        },
        style,
      ]}
    >
      {iconPosition === "left" ? <Ionicons name={iconName} size={18} color={isPrimary ? "#fff" : COLORS.textDark} /> : null}
      <Text style={{ color: isPrimary ? "#fff" : COLORS.textDark, fontSize: 15, fontWeight: "700", textAlign: "center", flexShrink: 1 }}>
        {label}
      </Text>
      {iconPosition === "right" ? <Ionicons name={iconName} size={18} color={isPrimary ? "#fff" : COLORS.textDark} /> : null}
    </TouchableOpacity>
  );
}
