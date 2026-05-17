import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";

type Props = {
  title: string;
  subtitle?: string;
  companyName?: string;
  rightSlot?: React.ReactNode;
};

export default function DashboardViewHeader({ title, subtitle, companyName, rightSlot }: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const shouldRender = Boolean(subtitle || rightSlot);

  if (!shouldRender) {
    return null;
  }

  return (
    <View style={{ marginBottom: isCompact ? 16 : 18, gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 180 }}>
          {subtitle ? <Text style={{ color: "#5C6F7B", fontSize: isCompact ? 14 : 16 }}>{subtitle}</Text> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {rightSlot}
        </View>
      </View>
    </View>
  );
}
