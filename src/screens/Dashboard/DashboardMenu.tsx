import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import { COLORS } from "../../styles/theme";

type Props = {
  selected: string;
  setSelected: (val: string) => void;
  isMobile?: boolean;
  isAdmin?: boolean;
};

export default function DashboardMenu({ selected, setSelected, isMobile, isAdmin = false }: Props) {
  const menuItems = [
    { name: "Principal", icon: "home-outline" },
    { name: "Clientes", icon: "people-outline" },
    { name: "Escanear", icon: "qr-code-outline" },
    { name: "Ajustes", icon: "settings-outline" },
    ...(isAdmin ? [{ name: "Admin", icon: "shield-checkmark-outline" }] : []),
  ];

  const activeKey =
    selected === "Logs" || selected === "EmpresasAdmin"
      ? "Admin"
      : selected === "HistorialNotificaciones"
        ? "Clientes"
        : selected;

  const getItemColors = (isActive: boolean) => ({
    backgroundColor: isActive ? COLORS.secondary : "transparent",
    contentColor: isActive ? "#284b55" : "#ffffff",
  });

  if (isMobile) {
    return (
      <View style={styles.mobileBottomMenu}>
        {menuItems.map((item) => {
          const isActive = activeKey === item.name;
          const { backgroundColor, contentColor } = getItemColors(isActive);

          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => setSelected(item.name)}
              style={[styles.bottomMenuButton, { backgroundColor }]}
            >
              <Ionicons name={item.icon as any} size={22} color={contentColor} />
              <Text style={[styles.menuText, { color: contentColor }]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Dashboard</Text>
      {menuItems.map((item) => {
        const isActive = activeKey === item.name;
        const { backgroundColor, contentColor } = getItemColors(isActive);

        return (
          <TouchableOpacity
            key={item.name}
            onPress={() => setSelected(item.name)}
            style={[styles.menuButton, { backgroundColor }]}
          >
            <Ionicons
              name={item.icon as any}
              size={20}
              color={contentColor}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.menuText, { color: contentColor }]}>{item.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
