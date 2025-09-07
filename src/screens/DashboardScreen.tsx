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

  const menuItems = ["Resumen", "Clientes", "Promociones"];

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Dashboard</Text>
      {menuItems.map((item) => (
        <TouchableOpacity
          key={item}
          onPress={() => setSelected(item)}
          style={[
            styles.menuButton,
            { backgroundColor: selected === item ? "#8ecae6" : "#cfd8dc" },
          ]}
        >
          <Text style={styles.menuText}>{item}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, flexDirection: isMobile ? "column" : "row" }}>
          {!isMobile && renderSidebar()}

          <View style={styles.contentContainer}>
            <Text style={styles.contentTitle}>{selected}</Text>
            <Text>
              Contenido de {selected}. Aquí se mostrará la información según la
              opción seleccionada.
            </Text>
          </View>
        </View>
      </ScrollView>

      {isMobile && (
        <SafeAreaView style={styles.mobileBottomMenuContainer}>
          <View style={styles.mobileBottomMenu}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setSelected(item)}
                style={[
                  styles.bottomMenuButton,
                  { backgroundColor: selected === item ? "#8ecae6" : "#cfd8dc" },
                ]}
              >
                <Text style={styles.menuText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}
