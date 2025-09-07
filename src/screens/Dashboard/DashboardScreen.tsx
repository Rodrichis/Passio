import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, flexDirection: isMobile ? "column" : "row" }}>
          {!isMobile && (
            <DashboardMenu selected={selected} setSelected={setSelected} />
          )}
          <View style={styles.contentContainer}>{renderContent()}</View>
        </View>
      </ScrollView>

      {isMobile && (
        <DashboardMenu selected={selected} setSelected={setSelected} isMobile />
      )}
    </SafeAreaView>
  );
}
