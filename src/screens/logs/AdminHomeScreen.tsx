import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";

type Props = {
  onOpenLogs: () => void;
};

export default function AdminHomeScreen({ onOpenLogs }: Props) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Admin</Text>
      <Text style={{ color: "#51616F", marginBottom: 16 }}>
        Herramientas internas de administracion.
      </Text>

      <TouchableOpacity
        onPress={onOpenLogs}
        style={{
          width: "100%",
          maxWidth: 320,
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
            backgroundColor: "#E3F2FD",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="document-text-outline" size={22} color="#0D47A1" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700" }}>Logs</Text>
          <Text style={{ color: "#60707D", marginTop: 4 }}>
            Ver eventos y errores registrados.
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
