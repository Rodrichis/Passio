import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";

type Props = {
  onOpenLogs: () => void;
  onOpenCompanies: () => void;
};

type AdminCardProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  onPress: () => void;
};

function AdminCard({ icon, iconColor, iconBg, title, description, onPress }: AdminCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: "100%",
        maxWidth: 340,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#D7E2E8",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: "#60707D", marginTop: 4 }}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminHomeScreen({ onOpenLogs, onOpenCompanies }: Props) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Admin</Text>
      <Text style={{ color: "#51616F", marginBottom: 16 }}>
        Herramientas internas de administración.
      </Text>

      <View style={{ gap: 12 }}>
        <AdminCard
          icon="business-outline"
          iconColor="#7C2D12"
          iconBg="#FFF1E8"
          title="Empresas"
          description="Monitorear empresas, contadores y datos clave."
          onPress={onOpenCompanies}
        />

        <AdminCard
          icon="document-text-outline"
          iconColor="#0D47A1"
          iconBg="#E3F2FD"
          title="Logs"
          description="Ver eventos y errores registrados."
          onPress={onOpenLogs}
        />
      </View>
    </View>
  );
}
