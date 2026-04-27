import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Platform, View, useWindowDimensions } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import DashboardMenu from "./DashboardMenu";
import DashboardContentPrincipal from "./content/DashboardContentPrincipal";
import DashboardContentClientes from "./content/DashboardContentClientes";
import DashboardContentEscanear from "./content/DashboardContentEscanear";
import DashboardContentAjustes from "./content/DashboardContentAjustes";
import AdminHomeScreen from "../logs/AdminHomeScreen";
import AdminLogsScreen from "../logs/AdminLogsScreen";
import { auth, db } from "../../services/firebaseConfig";
import { getWalletConfig } from "../../services/walletOnboarding/getWalletConfig";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  ForgotPassword: undefined;
  RegisterClient: { empresaId: string };
  VerifyEmail: { email?: string };
};

export default function Dashboard({ navigation }: any) {
  const [selected, setSelected] = useState("Principal");
  const [isAdmin, setIsAdmin] = useState(false);
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS === "android" || Platform.OS === "ios";
  const isCompactWeb = Platform.OS === "web" && width < 900;
  const isMobileLayout = isNativeMobile || isCompactWeb;

  useEffect(() => {
    let active = true;
    const user = auth.currentUser;

    if (user && !user.emailVerified) {
      navigation.replace("VerifyEmail", { email: user.email || "" });
      return () => {
        active = false;
      };
    }

    const loadAccess = async () => {
      if (!user || !user.emailVerified) return;

      try {
        const empresaSnap = await getDoc(doc(db, "Empresas", user.uid));
        if (active && empresaSnap.exists()) {
          const data = empresaSnap.data() as any;
          setIsAdmin(data?.esAdmin === true);
        }
      } catch (accessError) {
        console.error("Error verificando acceso admin:", accessError);
      }
    };

    const ensureWalletConfigured = async () => {
      if (!user || !user.emailVerified) return;

      try {
        const walletConfig = await getWalletConfig(user.uid);
        if (!active) return;

        if (!walletConfig.walletConfigurado) {
          navigation.replace("WalletOnboardingIntro");
        }
      } catch (walletError) {
        console.error("Error verificando onboarding de wallet:", walletError);
      }
    };

    loadAccess();
    ensureWalletConfigured();
    return () => {
      active = false;
    };
  }, [navigation]);

  const renderContent = () => {
    switch (selected) {
      case "Principal":
        return <DashboardContentPrincipal goToClientes={() => setSelected("Clientes")} />;
      case "Clientes":
        return <DashboardContentClientes />;
      case "Escanear":
        return <DashboardContentEscanear />;
      case "Ajustes":
        return <DashboardContentAjustes navigation={navigation} />;
      case "Admin":
        return <AdminHomeScreen onOpenLogs={() => setSelected("Logs")} />;
      case "Logs":
        return <AdminLogsScreen onBack={() => setSelected("Admin")} />;
      default:
        return null;
    }
  };

  const isListScreen = selected === "Clientes" || selected === "Logs";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <View style={{ flex: 1, flexDirection: isMobileLayout ? "column" : "row" }}>
        {!isMobileLayout && <DashboardMenu selected={selected} setSelected={setSelected} isAdmin={isAdmin} />}

        {isListScreen ? (
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

      {isMobileLayout && <DashboardMenu selected={selected} setSelected={setSelected} isMobile isAdmin={isAdmin} />}
    </SafeAreaView>
  );
}
