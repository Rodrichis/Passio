import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../../services/firebaseConfig";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

// Solo navigation, route no es necesario
type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Dashboard">;
};

export default function DashboardContentAjustes({ navigation }: Props) {
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace("Login");
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  return (
    <View>
      <Text style={{ marginBottom: 10 }}>Opciones de configuración aquí...</Text>
      <TouchableOpacity style={styles.smallLogoutButton} onPress={handleLogout}>
        <Ionicons
          name="log-out-outline"
          size={18}
          color="#fff"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
