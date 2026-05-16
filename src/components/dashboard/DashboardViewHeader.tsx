import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";

type Props = {
  title: string;
  subtitle?: string;
  companyName?: string;
  rightSlot?: React.ReactNode;
};

export default function DashboardViewHeader({ title, subtitle, companyName, rightSlot }: Props) {
  const safeCompanyName = typeof companyName === "string" ? companyName.trim() : "";

  return (
    <View style={{ marginBottom: 14, gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={[styles.sectionTitle, { marginBottom: subtitle ? 4 : 0 }]}>{title}</Text>
          {subtitle ? <Text style={{ color: "#51616F" }}>{subtitle}</Text> : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {safeCompanyName ? (
            <View
              style={{
                maxWidth: 260,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: "#D7E2E8",
                backgroundColor: "#F7FAFC",
                borderRadius: 999,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="business-outline" size={15} color="#284b55" />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: "#284b55", fontWeight: "700", maxWidth: 210 }}
              >
                {safeCompanyName}
              </Text>
            </View>
          ) : null}

          {rightSlot}
        </View>
      </View>
    </View>
  );
}
