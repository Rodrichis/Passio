import React, { useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ScrollView, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import DashboardMenu from "./DashboardMenu";

import DashboardContentResumen from "./content/DashboardContentResumen";
import DashboardContentClientes from "./content/DashboardContentClientes";
import DashboardContentPromociones from "./content/DashboardContentPromociones";
import DashboardContentAjustes from "./content/DashboardContentAjustes";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export default function Dashboard({ navigation }: Props) {
  const [selected, setSelected] = useState("Resumen");
  const isMobile = Platform.OS === "android" || Platform.OS === "ios";
  const insets = useSafeAreaInsets();

  const renderContent = () => {
    switch (selected) {
      case "Resumen":
        return <DashboardContentResumen />;
      case "Clientes":
        return <DashboardContentClientes />;
      case "Promociones":
        return <DashboardContentPromociones />;
      case "Ajustes":
        return <DashboardContentAjustes navigation={navigation} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <View style={{ flex: 1, flexDirection: isMobile ? "column" : "row" }}>
        {/* Sidebar en web / tablet */}
        {!isMobile && (
          <DashboardMenu selected={selected} setSelected={setSelected} />
        )}

        {/* Contenedor de contenido scrollable */}
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: isMobile ? 60 : 0, // espacio para menú mobile
          }}
          style={{ flex: 1, backgroundColor: "#f5f5f5" }} // mismo fondo que el contenido
        >
          <View style={styles.contentContainer}>{renderContent()}</View>
        </ScrollView>
      </View>

      {/* Menú fijo en mobile */}
      {isMobile && (
        <DashboardMenu
          selected={selected}
          setSelected={setSelected}
          isMobile
        />
      )}
    </SafeAreaView>
  );
}
