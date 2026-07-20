import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Animated,
  ActivityIndicator,
  ScrollView,
  Platform,
  View,
  useWindowDimensions,
  Linking,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
} from "react-native";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { dashboardStyles as styles } from "../../styles/DashboardStyles";
import DashboardMenu from "./DashboardMenu";
import DashboardTopBar from "../../components/dashboard/DashboardTopBar";
import DashboardContentPrincipal from "./content/DashboardContentPrincipal";
import DashboardContentClientes from "./content/DashboardContentClientes";
import DashboardContentEscanear from "./content/DashboardContentEscanear";
import DashboardContentAjustes from "./content/DashboardContentAjustes";
import DashboardContentGeoNotificacion from "./content/DashboardContentGeoNotificacion";
import DashboardContentEstadisticas from "./content/DashboardContentEstadisticas";
import DashboardContentSuscripcion from "./content/DashboardContentSuscripcion";
import AdminHomeScreen from "../admin/AdminHomeScreen";
import AdminLogsScreen from "../logs/AdminLogsScreen";
import AdminCompaniesScreen from "../admin/AdminCompaniesScreen";
import NotificationHistoryScreen from "../notifications/NotificationHistoryScreen";
import { auth, db } from "../../services/firebaseConfig";
import { getWalletConfig } from "../../services/walletOnboarding/getWalletConfig";
import {
  EMPTY_SUBSCRIPTION_BLOCK,
  getSubscriptionBlockCopy,
  resolveSubscriptionBlock,
  SubscriptionBlockState,
} from "../../utils/subscriptionGate";

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

type ClientesGeoNotificationDraft = {
  clientIds: string[];
};

const FAQ_ITEMS = [
  {
    question: "\u00BFC\u00F3mo registro clientes?",
    answer:
      "Comparte tu link de registro o muestra el c\u00F3digo QR para que cada cliente complete el formulario.",
  },
  {
    question: "\u00BFC\u00F3mo env\u00EDo notificaciones?",
    answer:
      "Ve a Clientes, selecciona uno o varios destinatarios y usa la opci\u00F3n de enviar notificaci\u00F3n.",
  },
  {
    question: "\u00BFD\u00F3nde veo mi wallet?",
    answer:
      "En Ajustes de Empresa encontrar\u00E1s la configuraci\u00F3n actual de tu wallet y sus recursos.",
  },
];

const DASHBOARD_NEWS_VERSION = "2026-05-17-ui-refresh";
const DASHBOARD_NEWS_STORAGE_PREFIX = "passio_dashboard_news_seen";
const DASHBOARD_NEWS_ITEMS = [
  {
    id: "principal-refresh",
    title: "Mejoramos visualmente Passio",
    description:
      "Renovamos la estética general del dashboard para que la experiencia se sienta más clara y moderna.",
    tag: "Nuevo",
  },
  {
    id: "scanner-updates",
    title: "Mejoramos el escaneo",
    description:
      "Compactamos la vista, ordenamos los modos y controlamos mejor los errores y permisos en móvil.",
    tag: "Escanear",
  },
  {
    id: "forms-updates",
    title: "Mejoramos los formularios",
    description:
      "Ajustamos validaciones, mensajes informativos y comportamiento en iPhone para evitar zoom molesto al escribir.",
    tag: "Formularios",
  },
] as const;

export default function Dashboard({ navigation }: any) {
  const [selected, setSelected] = useState("Principal");
  const [principalView, setPrincipalView] = useState<"home" | "stats">("home");
  const [isAdmin, setIsAdmin] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyReady, setCompanyReady] = useState(false);
  const [subscriptionBlock, setSubscriptionBlock] = useState<SubscriptionBlockState>(
    EMPTY_SUBSCRIPTION_BLOCK
  );
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqExpandedIndex, setFaqExpandedIndex] = useState<number | null>(null);
  const [clientesNotificationDraft, setClientesNotificationDraft] =
    useState<ClientesNotificationDraft | null>(null);
  const [clientesGeoNotificationDraft, setClientesGeoNotificationDraft] =
    useState<ClientesGeoNotificationDraft | null>(null);
  const { width } = useWindowDimensions();
  const isNativeMobile = Platform.OS === "android" || Platform.OS === "ios";
  const isCompactWeb = Platform.OS === "web" && width < 900;
  const isMobileLayout = isNativeMobile || isCompactWeb;
  const uid = auth.currentUser?.uid || "";

  const getPageTitle = () => {
    switch (selected) {
      case "Principal":
        return principalView === "stats" ? "Estadísticas" : "Principal";
      case "Clientes":
        return "Clientes";
      case "Escanear":
        return "Escanear QR";
      case "HistorialNotificaciones":
        return isMobileLayout ? "Historial" : "Historial notificaciones";
      case "GeoNotificacion":
        return isMobileLayout ? "Georeferencia" : "Notificación georeferenciada";
      case "Ajustes":
        return "Ajustes de Empresa";
      case "Suscripcion":
        return "Suscripción";
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
    let unsubscribeEmpresa: (() => void) | null = null;
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
        unsubscribeEmpresa = onSnapshot(
          doc(db, "Empresas", user.uid),
          (empresaSnap) => {
            if (!active) return;

            if (!empresaSnap.exists()) {
              setIsAdmin(false);
              setCompanyName("");
              setSubscriptionBlock(EMPTY_SUBSCRIPTION_BLOCK);
              setCompanyReady(true);
              return;
            }

            const data = empresaSnap.data() as any;
            const adminEnabled = data?.esAdmin === true;

            setIsAdmin(adminEnabled);
            setCompanyName(typeof data?.nombre === "string" ? data.nombre.trim() : "");
            setSubscriptionBlock(adminEnabled ? EMPTY_SUBSCRIPTION_BLOCK : resolveSubscriptionBlock(data));
            setCompanyReady(true);
          },
          (accessError) => {
            console.error("Error verificando acceso admin:", accessError);
            if (!active) return;
            setCompanyReady(true);
          }
        );
      } catch (accessError) {
        console.error("Error verificando acceso admin:", accessError);
        if (!active) return;
        setCompanyReady(true);
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
      unsubscribeEmpresa?.();
    };
  }, [navigation]);

  useEffect(() => {
    let active = true;

    const loadSeenNews = async () => {
      if (!uid) {
        if (active) setHasUnreadNotifications(false);
        return;
      }

      try {
        const storageKey = `${DASHBOARD_NEWS_STORAGE_PREFIX}:${uid}`;
        const seenVersion = await AsyncStorage.getItem(storageKey);
        if (!active) return;
        setHasUnreadNotifications(seenVersion !== DASHBOARD_NEWS_VERSION);
      } catch (storageError) {
        console.log("No se pudo leer estado de novedades:", storageError);
        if (!active) return;
        setHasUnreadNotifications(true);
      }
    };

    loadSeenNews();
    return () => {
      active = false;
    };
  }, [uid]);

  const subscriptionBlockCopy = getSubscriptionBlockCopy(subscriptionBlock);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  const handleOpenSupportEmail = async () => {
    try {
      await Linking.openURL("mailto:hola@passio.cl");
    } catch (err) {
      console.log("No se pudo abrir soporte:", err);
    }
  };

  const handleOpenSupport = () => {
    setSupportModalOpen(true);
  };

  const handleOpenFaq = () => {
    setFaqExpandedIndex(null);
    setFaqModalOpen(true);
  };

  const handleToggleFaq = (index: number) => {
    setFaqExpandedIndex((prev) => (prev === index ? null : index));
  };

  const handleOpenNotifications = () => {
    setHasUnreadNotifications(false);

    if (!uid) return;

    const storageKey = `${DASHBOARD_NEWS_STORAGE_PREFIX}:${uid}`;
    AsyncStorage.setItem(storageKey, DASHBOARD_NEWS_VERSION).catch((storageError) => {
      console.log("No se pudo guardar estado de novedades:", storageError);
    });
  };

  const handleSelectMenu = (nextSelected: string) => {
    setSelected(nextSelected);
    setPrincipalView("home");
  };

  const renderContent = () => {
    switch (selected) {
      case "Principal":
        if (principalView === "stats") {
          return <DashboardContentEstadisticas onBack={() => setPrincipalView("home")} />;
        }

        return (
          <DashboardContentPrincipal
            goToClientes={() => setSelected("Clientes")}
            companyName={companyName}
            onOpenStats={() => setPrincipalView("stats")}
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
            topBarProps={{
              pageTitle: getPageTitle(),
              companyName,
              isAdmin,
              onOpenSupport: handleOpenSupport,
              onOpenFaq: handleOpenFaq,
              onOpenNotifications: handleOpenNotifications,
              notificationItems: [...DASHBOARD_NEWS_ITEMS],
              hasUnreadNotifications,
            }}
            notificationDraft={clientesNotificationDraft}
            onConsumeNotificationDraft={() => setClientesNotificationDraft(null)}
            onOpenGeoNotification={(clientIds) => {
              setClientesGeoNotificationDraft({
                clientIds,
              });
              setSelected("GeoNotificacion");
            }}
          />
        );
      case "GeoNotificacion":
        return (
          <DashboardContentGeoNotificacion
            clientIds={clientesGeoNotificationDraft?.clientIds || []}
            onBack={() => setSelected("Clientes")}
          />
        );
      case "Escanear":
        return <DashboardContentEscanear companyName={companyName} />;
      case "HistorialNotificaciones":
        return <NotificationHistoryScreen onBack={() => setSelected("Clientes")} companyName={companyName} />;
      case "Ajustes":
        return (
          <DashboardContentAjustes
            navigation={navigation}
            onOpenSupport={handleOpenSupport}
            onOpenSubscription={() => setSelected("Suscripcion")}
          />
        );
      case "Suscripcion":
        return <DashboardContentSuscripcion onBack={() => setSelected("Ajustes")} />;
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
    selected === "GeoNotificacion" ||
    selected === "Logs" ||
    selected === "HistorialNotificaciones" ||
    selected === "EmpresasAdmin";
  const usesEmbeddedTopBar = selected === "Clientes";

  if (!companyReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            gap: 12,
          }}
        >
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={{ color: "#123042", fontSize: 16, fontWeight: "700" }}>
            Cargando tu empresa...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (subscriptionBlock.blocked && selected !== "Suscripcion") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 32,
            backgroundColor: "#F6FAFF",
          }}
        >
          <View style={[overlayStyles.card, { maxWidth: 520 }]}>
            <View style={[overlayStyles.infoBox, { gap: 10 }]}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: "#FFF4E5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="alert-circle-outline" size={28} color="#D97706" />
              </View>
              <Text style={overlayStyles.title}>{subscriptionBlockCopy.title}</Text>
              <Text style={overlayStyles.description}>{subscriptionBlockCopy.description}</Text>
            </View>

            <View style={overlayStyles.infoBox}>
              <Text style={overlayStyles.infoLabel}>Estado de suscripción</Text>
              <Text style={overlayStyles.infoValue}>{subscriptionBlockCopy.statusLabel}</Text>
            </View>

            <View style={overlayStyles.actions}>
              <TouchableOpacity onPress={handleLogout} style={overlayStyles.secondaryButton}>
                <Text style={overlayStyles.secondaryButtonText}>Cerrar sesión</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleOpenSupportEmail} style={overlayStyles.primaryButton}>
                <Text style={overlayStyles.primaryButtonText}>Contactar soporte</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelected("Suscripcion")}
                style={[overlayStyles.primaryButton, { backgroundColor: "#FFB703" }]}
              >
                <Text style={[overlayStyles.primaryButtonText, { color: "#023047" }]}>
                  Gestionar suscripción
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
      <View style={{ flex: 1, flexDirection: isMobileLayout ? "column" : "row" }}>
        {!isMobileLayout ? (
          <DashboardMenu
            selected={selected}
            setSelected={handleSelectMenu}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        ) : null}

        <View style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
          {isListScreen ? (
            <View style={{ flex: 1, backgroundColor: "#F6FAFF" }}>
              {!usesEmbeddedTopBar ? (
                <DashboardTopBar
                  pageTitle={getPageTitle()}
                  companyName={companyName}
                  isAdmin={isAdmin}
                  onOpenSupport={handleOpenSupport}
                  onOpenFaq={handleOpenFaq}
                  onOpenNotifications={handleOpenNotifications}
                  notificationItems={[...DASHBOARD_NEWS_ITEMS]}
                  hasUnreadNotifications={hasUnreadNotifications}
                />
              ) : null}
              <View
                style={
                  usesEmbeddedTopBar
                    ? { flex: 1, minHeight: 0 }
                    : [
                        isMobileLayout ? styles.contentContainerMobile : styles.contentContainer,
                        { flex: 1, minHeight: 0 },
                      ]
                }
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
                notificationItems={[...DASHBOARD_NEWS_ITEMS]}
                hasUnreadNotifications={hasUnreadNotifications}
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
          setSelected={handleSelectMenu}
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
        <View style={overlayStyles.backdrop}>
          <Pressable style={overlayStyles.dismissLayer} onPress={() => setSupportModalOpen(false)} />
          <View style={overlayStyles.card}>
            <View style={overlayStyles.headerRow}>
              <Text style={overlayStyles.title}>Ayuda y soporte</Text>
              <TouchableOpacity
                onPress={() => setSupportModalOpen(false)}
                style={overlayStyles.closeButton}
              >
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            <Text style={overlayStyles.description}>
              {"Si tienes errores, sugerencias o problemas, escr\u00EDbenos y te ayudaremos a la brevedad."}
            </Text>

            <View style={overlayStyles.infoBox}>
              <Text style={overlayStyles.infoLabel}>Correo de soporte</Text>
              <Text style={overlayStyles.infoValue}>hola@passio.cl</Text>
            </View>

            <View style={overlayStyles.actions}>
              <TouchableOpacity
                onPress={() => setSupportModalOpen(false)}
                style={overlayStyles.secondaryButton}
              >
                <Text style={overlayStyles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await Linking.openURL("mailto:hola@passio.cl");
                  } catch (err) {
                    console.log("No se pudo abrir soporte:", err);
                  }
                }}
                style={overlayStyles.primaryButton}
              >
                <Text style={overlayStyles.primaryButtonText}>Escribir a soporte</Text>
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
        <View style={overlayStyles.backdrop}>
          <Pressable style={overlayStyles.dismissLayer} onPress={() => setFaqModalOpen(false)} />
          <View style={[overlayStyles.card, { maxWidth: 560 }]}>
            <View style={overlayStyles.headerRow}>
              <Text style={overlayStyles.title}>Preguntas frecuentes</Text>
              <TouchableOpacity
                onPress={() => setFaqModalOpen(false)}
                style={overlayStyles.closeButton}
              >
                <Ionicons name="close" size={20} color="#51616F" />
              </TouchableOpacity>
            </View>
            <Text style={overlayStyles.description}>
              {"Respuestas r\u00E1pidas para las dudas m\u00E1s comunes de tu equipo."}
            </Text>

            <View style={{ gap: 12 }}>
              {FAQ_ITEMS.map((item, index) => {
                const expanded = faqExpandedIndex === index;

                return (
                  <FAQAccordionItem
                    key={item.question}
                    question={item.question}
                    answer={item.answer}
                    expanded={expanded}
                    onPress={() => handleToggleFaq(index)}
                  />
                );
              })}
            </View>

            <View style={overlayStyles.actions}>
              <TouchableOpacity
                onPress={() => setFaqModalOpen(false)}
                style={overlayStyles.primaryButton}
              >
                <Text style={overlayStyles.primaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function FAQAccordionItem({
  question,
  answer,
  expanded,
  onPress,
}: {
  question: string;
  answer: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const progress = React.useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [expanded, progress]);

  const animatedBodyStyle = {
    maxHeight: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 120],
    }),
    opacity: progress,
    marginTop: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 4],
    }),
  };

  return (
    <View style={overlayStyles.accordionCard}>
      <TouchableOpacity onPress={onPress} style={overlayStyles.accordionTrigger}>
        <Text style={overlayStyles.accordionQuestion}>{question}</Text>
        <Ionicons
          name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
          size={18}
          color="#51616F"
        />
      </TouchableOpacity>

      <Animated.View style={[overlayStyles.accordionBody, animatedBodyStyle]}>
        <Text style={overlayStyles.accordionAnswer}>{answer}</Text>
      </Animated.View>
    </View>
  );
}

const overlayStyles = {
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 24,
  },
  dismissLayer: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    width: "100%" as const,
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#E2ECF1",
    shadowColor: "#0F3554",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 8,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#D8E4EC",
    backgroundColor: "#F8FBFD",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  title: {
    color: "#123042",
    fontSize: 24,
    fontWeight: "800" as const,
    flex: 1,
  },
  description: {
    color: "#51616F",
    fontSize: 15,
    lineHeight: 23,
  },
  infoBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EDF5",
    backgroundColor: "#F8FBFE",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  infoLabel: {
    color: "#607381",
    fontSize: 13,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  infoValue: {
    color: "#123042",
    fontSize: 18,
    fontWeight: "800" as const,
  },
  accordionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EDF5",
    backgroundColor: "#F8FBFE",
    overflow: "hidden" as const,
  },
  accordionTrigger: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 12,
  },
  accordionQuestion: {
    flex: 1,
    color: "#123042",
    fontSize: 16,
    fontWeight: "700" as const,
    lineHeight: 22,
  },
  accordionAnswer: {
    color: "#51616F",
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  accordionBody: {
    overflow: "hidden" as const,
  },
  actions: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    gap: 10,
    flexWrap: "wrap" as const,
    marginTop: 4,
  },
  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D7E3EC",
    backgroundColor: "#FFFFFF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondaryButtonText: {
    color: "#123042",
    fontWeight: "700" as const,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#2196F3",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700" as const,
    fontSize: 15,
  },
};
