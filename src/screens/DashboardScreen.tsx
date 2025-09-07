import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../services/firebaseConfig";
import { dashboardStyles as styles } from "../styles/DashboardStyles";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export default function DashboardScreen({ navigation }: Props) {
  const [selected, setSelected] = useState("Resumen");
  const isMobile = Platform.OS === "android" || Platform.OS === "ios";

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace("Login");
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  const menuItems = [
    { name: "Resumen", icon: "home-outline" },
    { name: "Clientes", icon: "people-outline" },
    { name: "Promociones", icon: "pricetag-outline" },
    { name: "Ajustes", icon: "settings-outline" },
  ];

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Dashboard</Text>

      {menuItems.map((item) => (
        <TouchableOpacity
          key={item.name}
          onPress={() => setSelected(item.name)}
          style={[
            styles.menuButton,
            {
              backgroundColor:
                selected === item.name ? "#8ecae6" : "#cfd8dc",
            },
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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, flexDirection: isMobile ? "column" : "row" }}>
          {!isMobile && renderSidebar()}

          <View style={styles.contentContainer}>
            <Text style={styles.contentTitle}>{selected}</Text>

            {selected === "Ajustes" ? (
              <View>
                <Text style={{ marginBottom: 10 }}>
                  Opciones de configuración aquí...
                </Text>
                <TouchableOpacity
                  style={styles.smallLogoutButton}
                  onPress={handleLogout}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text>
                Contenido de {selected}. Aquí se mostrará la información según
                la opción seleccionada.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 📱 Menú inferior en mobile */}
      {isMobile && (
        <SafeAreaView style={styles.mobileBottomMenuContainer}>
          <View style={styles.mobileBottomMenu}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.name}
                onPress={() => setSelected(item.name)}
                style={[
                  styles.bottomMenuButton,
                  {
                    backgroundColor:
                      selected === item.name ? "#8ecae6" : "#cfd8dc",
                  },
                ]}
              >
                <Ionicons name={item.icon as any} size={22} color="#023047" />
                <Text style={styles.menuText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}
