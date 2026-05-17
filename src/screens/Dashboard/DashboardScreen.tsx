import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ScrollView,
  Platform,
  View,
  useWindowDimensions,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import DashboardMenu from "./DashboardMenu";
import DashboardTopBar from "../../components/dashboard/DashboardTopBar";
import DashboardContentPrincipal from "./content/DashboardContentPrincipal";
import DashboardContentClientes from "./content/DashboardContentClientes";
import DashboardContentEscanear from "./content/DashboardContentEscanear";
import DashboardContentAjustes from "./content/DashboardContentAjustes";
import AdminHomeScreen from "../admin/AdminHomeScreen";
import AdminLogsScreen from "../logs/AdminLogsScreen";
import AdminCompaniesScreen from "../admin/AdminCompaniesScreen";
import NotificationHistoryScreen from "../notifications/NotificationHistoryScreen";
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

type ClientesNotificationDraft = {
  clientIds: string[];
  message?: string;
  key: number;
};

export default function Dashboard({ navigation }: any) {
  const [selected, setSelected] = useState("Principal");
  const [isAdmin, setIsAdmin] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [clientesNotificationDraft, setClientesNotificationDraft] =
    useState<ClientesNotificationDraft | null>(null);
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS === "android" || Platform.OS === "ios";
  const isCompactWeb = Platform.OS === "web" && width < 900;
  const isMobileLayout = isNativeMobile || isCompactWeb;

  const getPageTitle = () => {
    switch (selected) {
      case "Principal":
        return "Principal";
      case "Clientes":
        return "Clientes";
      case "Escanear":
        return "Escanear QR";
      case "HistorialNotificaciones":
        return isMobileLayout ? "Historial" : "Historial notificaciones";
      case "Ajustes":
        return "Ajustes de Empresa";
      case "Admin":
        return "Admin";
      case "Logs":
        return "Logs";
      case "EmpresasAdmin":
        return "Empresas";
      default:
        return "";
    }
  };

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
          setCompanyName(typeof data?.nombre === "string" ? data.nombre.trim() : "");
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

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  const handleOpenSupport = async () => {
    setSupportModalOpen(true);
  };

  const handleOpenFaq = () => {
    setFaqModalOpen(true);
  };

  const handleOpenNotifications = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert("Pronto veras aqui las novedades y mejoras de Passio.");
    }
  };

  const renderContent = () => {
    switch (selected) {
      case "Principal":
        return (
          <DashboardContentPrincipal
            goToClientes={() => setSelected("Clientes")}
            companyName={companyName}
            onOpenBirthdayGreeting={(clientIds, message) => {
              setClientesNotificationDraft({
                clientIds,
                message,
                key: Date.now(),
              });
              setSelected("Clientes");
            }}
            onOpenNotificationHistory={() => setSelected("HistorialNotificaciones")}
            onOpenNotificationComposer={() => setSelected("Clientes")}
          />
        );
      case "Clientes":
        return (
          <DashboardContentClientes
            onOpenNotificationHistory={() => setSelected("HistorialNotificaciones")}
            companyName={companyName}
            notificationDraft={clientesNotificationDraft}
            onConsumeNotificationDraft={() => setClientesNotificationDraft(null)}
          />
        );
      case "Escanear":
        return <DashboardContentEscanear companyName={companyName} />;
      case "HistorialNotificaciones":
        return <NotificationHistoryScreen onBack={() => setSelected("Clientes")} companyName={companyName} />;
      case "Ajustes":
        return <DashboardContentAjustes navigation={navigation} onOpenSupport={handleOpenSupport} />;
      case "Admin":
        return (
          <AdminHomeScreen
            onOpenLogs={() => setSelected("Logs")}
            onOpenCompanies={() => setSelected("EmpresasAdmin")}
            companyName={companyName}
          />
        );
      case "Logs":
        return <AdminLogsScreen onBack={() => setSelected("Admin")} companyName={companyName} />;
      case "EmpresasAdmin":
        return <AdminCompaniesScreen onBack={() => setSelected("Admin")} companyName={companyName} />;
      default:
        return null;
    }
  };

  const isListScreen =
    selected === "Clientes" ||
    selected === "Logs" ||
    selected === "HistorialNotificaciones" ||
    selected === "EmpresasAdmin";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
      <View style={{ flex: 1, flexDirection: isMobileLayout ? "column" : "row" }}>
        {!isMobileLayout ? (
          <DashboardMenu
            selected={selected}
            setSelected={setSelected}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        ) : null}

        <View style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
          {isListScreen ? (
            <View style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
              <DashboardTopBar
                pageTitle={getPageTitle()}
                companyName={companyName}
                isAdmin={isAdmin}
                onOpenSupport={handleOpenSupport}
                onOpenFaq={handleOpenFaq}
                onOpenNotifications={handleOpenNotifications}
              />
              <View
                style={[
                  isMobileLayout ? styles.contentContainerMobile : styles.contentContainer,
                  { flex: 1, minHeight: 0 },
                ]}
              >
                {renderContent()}
              </View>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingBottom: isMobileLayout ? 72 : 28 }}
              style={{ flex: 1, backgroundColor: "#F6FAFF" }}
            >
              <DashboardTopBar
                pageTitle={getPageTitle()}
                companyName={companyName}
                isAdmin={isAdmin}
                onOpenSupport={handleOpenSupport}
                onOpenFaq={handleOpenFaq}
                onOpenNotifications={handleOpenNotifications}
              />
              <View style={isMobileLayout ? styles.contentContainerMobile : styles.contentContainer}>
                {renderContent()}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {isMobileLayout ? (
        <DashboardMenu
          selected={selected}
          setSelected={setSelected}
          isMobile
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />
      ) : null}

      <Modal
        visible={supportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(13, 25, 34, 0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              paddingHorizontal: 24,
              paddingVertical: 24,
              borderWidth: 1,
              borderColor: "#E2ECF1",
              gap: 18,
            }}
          >
            <Text style={{ color: "#123042", fontSize: 22, fontWeight: "800" }}>
              Ayuda y soporte
            </Text>
            <Text style={{ color: "#51616F", fontSize: 16, lineHeight: 24 }}>
              Si tienes errores, sugerencias o problemas, escríbenos a{" "}
              <Text style={{ fontWeight: "700", color: "#123042" }}>hola@passio.cl</Text>
            </Text>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await Linking.openURL("mailto:hola@passio.cl");
                  } catch (err) {
                    console.log("No se pudo abrir soporte:", err);
                  }
                }}
                style={{
                  backgroundColor: "#2196F3",
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Escribir a soporte</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSupportModalOpen(false)}
                style={{
                  backgroundColor: "#FFFFFF",
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#D7E3EC",
                }}
              >
                <Text style={{ color: "#123042", fontWeight: "700" }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={faqModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFaqModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(13, 25, 34, 0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              paddingHorizontal: 24,
              paddingVertical: 24,
              borderWidth: 1,
              borderColor: "#E2ECF1",
              gap: 16,
            }}
          >
            <Text style={{ color: "#123042", fontSize: 22, fontWeight: "800" }}>
              Preguntas frecuentes
            </Text>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
                  ¿Cómo registro clientes?
                </Text>
                <Text style={{ color: "#51616F", fontSize: 15, lineHeight: 22 }}>
                  Comparte tu link de registro o muestra el QR para que cada cliente complete el formulario.
                </Text>
              </View>

              <View>
                <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
                  ¿Cómo envío notificaciones?
                </Text>
                <Text style={{ color: "#51616F", fontSize: 15, lineHeight: 22 }}>
                  Ve a Clientes, selecciona uno o varios destinatarios y usa la opción de enviar notificación.
                </Text>
              </View>

              <View>
                <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
                  ¿Dónde veo mi wallet?
                </Text>
                <Text style={{ color: "#51616F", fontSize: 15, lineHeight: 22 }}>
                  En Ajustes de Empresa encontrarás la configuración actual de tu wallet y sus recursos.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setFaqModalOpen(false)}
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#2196F3",
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
