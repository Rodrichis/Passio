import React, { useState, useEffect } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ScrollView, Platform, useWindowDimensions } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import DashboardMenu from "./DashboardMenu";

import DashboardContentPrincipal from "./content/DashboardContentPrincipal";
import DashboardContentClientes from "./content/DashboardContentClientes";
import DashboardContentEscanear from "./content/DashboardContentEscanear";
import DashboardContentAjustes from "./content/DashboardContentAjustes";
import { auth } from "../../services/firebaseConfig";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  ForgotPassword: undefined;
  RegisterClient: { empresaId: string };
  VerifyEmail: { email?: string };
};

// relajamos tipos de navegación para evitar conflictos en web
export default function Dashboard({ navigation }: any) {
  const [selected, setSelected] = useState("Principal");
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS === "android" || Platform.OS === "ios";
  const isCompactWeb = Platform.OS === "web" && width < 900;
  const isMobileLayout = isNativeMobile || isCompactWeb;

  useEffect(() => {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      navigation.replace("VerifyEmail", { email: user.email || "" });
    }
  }, [navigation]);

  const renderContent = () => {
    switch (selected) {
      case "Principal":
        return <DashboardContentPrincipal goToClientes={() => setSelected("Clientes")} />;
      case "Clientes":
        return <DashboardContentClientes />; // <- FlatList manejará el scroll
      case "Escanear":
        return <DashboardContentEscanear />;
      case "Ajustes":
        return <DashboardContentAjustes navigation={navigation} />;
      default:
        return null;
    }
  };

  const isClientes = selected === "Clientes";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <View style={{ flex: 1, flexDirection: isMobileLayout ? "column" : "row" }}>
        {!isMobileLayout && (
          <DashboardMenu selected={selected} setSelected={setSelected} />
        )}

        {/* 👉 Para Clientes NO usamos ScrollView */}
        {isClientes ? (
          <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
            <View style={styles.contentContainer}>{renderContent()}</View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: isMobileLayout ? 60 : 0 }}
            style={{ flex: 1, backgroundColor: "#f5f5f5" }}
          >
            <View style={styles.contentContainer}>{renderContent()}</View>
          </ScrollView>
        )}
      </View>

      {isMobileLayout && (
        <DashboardMenu selected={selected} setSelected={setSelected} isMobile />
      )}
    </SafeAreaView>
  );
}

