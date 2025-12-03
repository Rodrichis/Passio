import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";

type Props = {
  selected: string;
  setSelected: (val: string) => void;
  isMobile?: boolean;
};

const menuItems = [
  { name: "Resumen", icon: "home-outline" },
  { name: "Clientes", icon: "people-outline" },
  { name: "Promociones", icon: "pricetag-outline" },
  { name: "Escanear", icon: "qr-code-outline" },
  { name: "Test", icon: "flask-outline" },
  { name: "Ajustes", icon: "settings-outline" },
];

export default function DashboardMenu({ selected, setSelected, isMobile }: Props) {
  if (isMobile) {
    return (
      <View style={styles.mobileBottomMenu}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.name}
            onPress={() => setSelected(item.name)}
            style={[
              styles.bottomMenuButton,
              { backgroundColor: selected === item.name ? "#8ecae6" : "#cfd8dc" },
            ]}
          >
            <Ionicons name={item.icon as any} size={22} color="#023047" />
            <Text style={styles.menuText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // 🔹 escritorio o tablet
  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Dashboard</Text>
      {menuItems.map((item) => (
        <TouchableOpacity
          key={item.name}
          onPress={() => setSelected(item.name)}
          style={[
            styles.menuButton,
            { backgroundColor: selected === item.name ? "#8ecae6" : "#cfd8dc" },
          ]}
        >
          <Ionicons
            name={item.icon as any}
            size={20}
            color="#023047"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.menuText}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
