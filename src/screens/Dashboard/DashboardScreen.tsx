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

// ...imports
export default function Dashboard({ navigation }: Props) {
  const [selected, setSelected] = useState("Resumen");
  const isMobile = Platform.OS === "android" || Platform.OS === "ios";

  const renderContent = () => {
    switch (selected) {
      case "Resumen":
        return <DashboardContentResumen />;
      case "Clientes":
        return <DashboardContentClientes />; // <- FlatList manejará el scroll
      case "Promociones":
        return <DashboardContentPromociones />;
      case "Ajustes":
        return <DashboardContentAjustes navigation={navigation} />;
      default:
        return null;
    }
  };

  const isClientes = selected === "Clientes";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <View style={{ flex: 1, flexDirection: isMobile ? "column" : "row" }}>
        {!isMobile && (
          <DashboardMenu selected={selected} setSelected={setSelected} />
        )}

        {/* 👉 Para Clientes NO usamos ScrollView */}
        {isClientes ? (
          <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
            <View style={styles.contentContainer}>{renderContent()}</View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: isMobile ? 60 : 0 }}
            style={{ flex: 1, backgroundColor: "#f5f5f5" }}
          >
            <View style={styles.contentContainer}>{renderContent()}</View>
          </ScrollView>
        )}
      </View>

      {isMobile && (
        <DashboardMenu selected={selected} setSelected={setSelected} isMobile />
      )}
    </SafeAreaView>
  );
}

