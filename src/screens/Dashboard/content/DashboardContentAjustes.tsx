import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ESTADO_WALLET } from "../../../constants/empresa";
import { auth, db } from "../../../services/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { getPlanByName, PlanInfo } from "../../../services/plansService";
import RegistrationQrModal from "../../../components/registration/RegistrationQrModal";
import { buildRegistrationUrl } from "../../../utils/publicUrls";
import {
  formatPlanName,
  formatSubscriptionStatus,
  getEmpresaSuscripcion,
} from "../../../utils/subscription";
import {
  isGenericStampPack,
  resolveStampPackLabel,
} from "../../../utils/walletOnboarding/stampPacks";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  WalletOnboardingSetup: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Dashboard">;
  onOpenSupport?: () => void;
  onOpenSubscription?: () => void;
};

function formatExpiryDate(value: any) {
  if (!value) return "--";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "--";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "--";
  }
}

export default function DashboardContentAjustes({ navigation, onOpenSupport, onOpenSubscription }: Props) {
  const [empresa, setEmpresa] = useState<any>(null);
  const [planData, setPlanData] = useState<PlanInfo | null>(null);
  const [contadores, setContadores] = useState<any>(null);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { width } = useWindowDimensions();

  const uid = auth.currentUser?.uid;
  const registroURL = empresa?.LinkRegistro || buildRegistrationUrl(uid);
  const isDesktop = Platform.OS === "web" && width >= 900;
  const showExpiryInline = Platform.OS === "web" && width >= 1180;
  const showInlineSupport = !isDesktop;
  const showInlineLogout = !isDesktop;
  const compactMetricLayout = !isDesktop;
  const twoColumnLayout = width >= 1024;
  const companyInfoTwoColumns = width >= 760;
  const suscripcion = useMemo(() => getEmpresaSuscripcion(empresa), [empresa]);

  useEffect(() => {
    if (!copiedLink) return;
    const timer = setTimeout(() => setCopiedLink(false), 1800);
    return () => clearTimeout(timer);
  }, [copiedLink]);

  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        if (!uid) return;
        const ref = doc(db, "Empresas", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setEmpresa(data);

          const suscripcion = getEmpresaSuscripcion(data);
          setPlanData(await getPlanByName(suscripcion.nombrePlan));

          try {
            const contColl = await getDocs(collection(db, "Empresas", uid, "Contador"));
            const first = contColl.docs[0];
            if (first) {
              setContadores(first.data());
            }
          } catch (e) {
            console.log("No se pudo leer contadores:", e);
          }

          try {
            const clientesSnap = await getDocs(collection(db, "Empresas", uid, "Clientes"));
            const activos = clientesSnap.docs.filter(
              (clientDoc) => (clientDoc.data() as any)?.activo !== false
            ).length;
            setActiveUsersCount(activos);
          } catch (e) {
            console.log("No se pudo leer clientes activos:", e);
          }
        } else {
          console.warn("No se encontró información de la empresa");
        }
      } catch (err) {
        console.error("Error al cargar empresa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [uid]);

  const handleSave = async () => {
    if (!uid || !empresa) return;
    setSaving(true);
    try {
      const ref = doc(db, "Empresas", uid);
      await setDoc(
        ref,
        {
          Descripcion: empresa.Descripcion || "",
          telefono: empresa.telefono || "",
          LinkRegistro: buildRegistrationUrl(uid),
        },
        { merge: true }
      );
      alert("Cambios guardados correctamente");
    } catch (err: any) {
      console.error("Error al guardar cambios:", err);
      alert("No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  const handleCopyRegistrationLink = async () => {
    if (!registroURL) return;

    try {
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        (navigator as any).clipboard?.writeText
      ) {
        await (navigator as any).clipboard.writeText(registroURL);
      } else {
        await Clipboard.setStringAsync(registroURL);
      }

      setCopiedLink(true);
    } catch (e) {
      console.log("No se pudo copiar el link:", e);
    }
  };

  const planInfo: PlanInfo = useMemo(
    () => ({
      nombrePlan: planData?.nombrePlan || suscripcion.nombrePlan,
      limiteUsuarios: planData?.limiteUsuarios ?? empresa?.limiteUsuarios,
      limiteNotificacion:
        planData?.limiteNotificacion ?? empresa?.limiteNotificacion,
      limiteCorreo: planData?.limiteCorreo ?? empresa?.limiteCorreo,
      precio: planData?.precio ?? empresa?.precio,
    }),
    [empresa, planData, suscripcion.nombrePlan]
  );

  const usados = {
    usuarios: activeUsersCount,
    notificaciones: contadores?.notificacionesMes ?? 0,
    correos: contadores?.correosMes ?? 0,
  };

  const limiteUsuarios = planInfo.limiteUsuarios;
  const atUserLimit =
    typeof limiteUsuarios === "number" && usados.usuarios >= limiteUsuarios;
  const rawStampPack =
    typeof empresa?.paqueteSellosWallet === "string" &&
    empresa.paqueteSellosWallet.trim().length > 0
      ? empresa.paqueteSellosWallet.trim()
      : "generico1";
  const tipoSellosWallet =
    empresa?.tipoSellosWallet === "generico" ||
    empresa?.tipoSellosWallet === "personalizado"
      ? empresa.tipoSellosWallet
      : isGenericStampPack(rawStampPack)
      ? "generico"
      : "personalizado";
  const stampPackLabel = resolveStampPackLabel(rawStampPack, tipoSellosWallet);

  const stats = [
    {
      key: "usuarios",
      label: "Usuarios",
      value: `${usados.usuarios} / ${planInfo.limiteUsuarios ?? "-"}`,
      icon: "people-outline" as const,
    },
    {
      key: "notificaciones",
      label: "Notificaciones (mes)",
      value: `${usados.notificaciones} / ${planInfo.limiteNotificacion ?? "-"}`,
      icon: "notifications-outline" as const,
    },
    {
      key: "correos",
      label: "Correos (mes)",
      value: `${usados.correos} / ${planInfo.limiteCorreo ?? "-"}`,
      icon: "mail-outline" as const,
    },
  ];

  if (loading) {
    return (
      <View style={ajustesStyles.loadingWrap}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={ajustesStyles.loadingText}>Cargando información...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        ajustesStyles.container,
        { paddingBottom: showInlineLogout ? 110 : 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          ajustesStyles.gridRow,
          twoColumnLayout ? ajustesStyles.gridRowDesktop : ajustesStyles.gridRowMobile,
        ]}
      >
        <View
          style={[
            ajustesStyles.card,
            twoColumnLayout ? ajustesStyles.halfCard : ajustesStyles.fullCard,
          ]}
        >
          <View style={ajustesStyles.cardHeader}>
            <View style={[ajustesStyles.iconBox, { backgroundColor: "#E8F3F7" }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#0A6F88" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ajustesStyles.planTitle}>
                Plan actual:{" "}
                <Text style={ajustesStyles.planTitleAccent}>
                  {formatPlanName(planInfo?.nombrePlan)}
                </Text>
              </Text>
              <Text style={ajustesStyles.planSubtitle}>
                Estado suscripción:{" "}
                {formatSubscriptionStatus(suscripcion.estadoSuscripcion)}
              </Text>
              <Text
                style={[
                  ajustesStyles.planSubtitle,
                  showExpiryInline && ajustesStyles.planSubtitleRight,
                ]}
              >
                Expira el: {formatExpiryDate(suscripcion.expiraEl)}
              </Text>
            </View>

            {showInlineSupport ? (
              <TouchableOpacity
                onPress={onOpenSupport}
                style={ajustesStyles.inlineSupportButtonCard}
              >
                <Ionicons name="help-circle-outline" size={16} color="#0A6F88" />
                <Text style={ajustesStyles.inlineSupportText}>Ayuda y soporte</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={ajustesStyles.divider} />

          <View style={ajustesStyles.metricRow}>
            {stats.map((item) => (
              <View key={item.key} style={ajustesStyles.metricCard}>
                <Text style={ajustesStyles.metricLabel}>{item.label}</Text>
                {compactMetricLayout ? (
                  <View style={ajustesStyles.metricCompactRow}>
                    <Text style={ajustesStyles.metricValue}>{item.value}</Text>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color="#B8C5CE"
                    />
                  </View>
                ) : (
                  <>
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color="#B8C5CE"
                      style={{ marginBottom: 10 }}
                    />
                    <Text style={ajustesStyles.metricValue}>{item.value}</Text>
                  </>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={onOpenSubscription}
            style={ajustesStyles.subscriptionButton}
          >
            <View style={ajustesStyles.subscriptionButtonIcon}>
              <Ionicons name="card-outline" size={18} color="#023047" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ajustesStyles.subscriptionButtonTitle}>Gestionar suscripción</Text>
              <Text style={ajustesStyles.subscriptionButtonSubtitle}>
                Revisa tu plan, paga con Mercado Pago o cancela la renovación.
              </Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color="#023047" />
          </TouchableOpacity>

          {atUserLimit ? (
            <View style={ajustesStyles.warningBox}>
              <Ionicons name="warning-outline" size={16} color="#C62828" />
              <Text style={ajustesStyles.warningText}>
                Alcanzaste tu límite de usuarios registrados. Mejora tu plan.
              </Text>
            </View>
          ) : null}

          {!planData ? (
            <Text style={ajustesStyles.errorHint}>
              No pudimos leer los límites del plan. Revisa la colección Planes y
              los permisos de lectura.
            </Text>
          ) : null}
        </View>

        <View
          style={[
            ajustesStyles.card,
            twoColumnLayout ? ajustesStyles.halfCard : ajustesStyles.fullCard,
          ]}
        >
          <View style={ajustesStyles.simpleHeader}>
            <Ionicons name="link-outline" size={22} color="#0A6F88" />
            <Text style={ajustesStyles.simpleTitle}>Link de registro</Text>
          </View>

          <View style={ajustesStyles.linkBox}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              selectable={Platform.OS === "web"}
              style={ajustesStyles.linkText}
            >
              {registroURL}
            </Text>

            <TouchableOpacity
              onPress={handleCopyRegistrationLink}
              style={ajustesStyles.copyIconButton}
            >
              <Ionicons name="copy-outline" size={22} color="#0A6F88" />
            </TouchableOpacity>
          </View>

          {copiedLink ? <Text style={ajustesStyles.copyFeedback}>Copiado</Text> : null}

          <View style={ajustesStyles.divider} />

          <View style={ajustesStyles.actionRow}>
            <TouchableOpacity
              onPress={() => registroURL && Linking.openURL(registroURL)}
              style={ajustesStyles.primaryWideButton}
            >
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={ajustesStyles.primaryWideButtonText}>
                Abrir en navegador
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowQrModal(true)}
              style={ajustesStyles.secondaryWideButton}
            >
              <Ionicons name="qr-code-outline" size={18} color="#6C4B00" />
              <Text style={ajustesStyles.secondaryWideButtonText}>Ver QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <RegistrationQrModal
        visible={showQrModal}
        value={registroURL}
        fileName={`qr-registro-${uid || "empresa"}.png`}
        onClose={() => setShowQrModal(false)}
      />

      <View style={[ajustesStyles.card, ajustesStyles.fullCard, ajustesStyles.walletCard]}>
        <View style={ajustesStyles.walletGlow} />
        <View style={ajustesStyles.simpleHeader}>
          <Ionicons name="wallet-outline" size={22} color="#0A6F88" />
          <Text style={ajustesStyles.simpleTitle}>Wallet</Text>
        </View>

        <View style={ajustesStyles.walletRow}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={ajustesStyles.walletState}>
              Estado wallet:{" "}
              <Text style={ajustesStyles.walletStateAccent}>
                {empresa?.walletConfigurado
                  ? empresa?.estadoWallet || ESTADO_WALLET.PENDIENTE
                  : "sin configurar"}
              </Text>
            </Text>
            <Text style={ajustesStyles.walletMeta}>
              Visitas por premio: {empresa?.visitasPorPremio ?? 6}
            </Text>
            <Text style={ajustesStyles.walletMeta}>
              Tipo de sellos: {stampPackLabel}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate("WalletOnboardingSetup")}
            style={ajustesStyles.primaryWideButton}
          >
            <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            <Text style={ajustesStyles.primaryWideButtonText}>Configurar wallet</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[ajustesStyles.card, ajustesStyles.fullCard]}>
        <View style={ajustesStyles.simpleHeader}>
          <Ionicons name="business-outline" size={22} color="#0A6F88" />
          <Text style={ajustesStyles.simpleTitle}>Información de la empresa</Text>
        </View>

        <View
          style={[
            ajustesStyles.infoForm,
            companyInfoTwoColumns ? ajustesStyles.infoFormDesktop : ajustesStyles.infoFormMobile,
          ]}
        >
          <View style={[ajustesStyles.fieldGroup, companyInfoTwoColumns ? { flex: 0.6 } : null]}>
            <Text style={ajustesStyles.fieldLabel}>Nombre empresa</Text>
            <TextInput
              style={[ajustesStyles.fieldInput, ajustesStyles.fieldInputDisabled]}
              value={empresa?.nombre || ""}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>

          <View style={[ajustesStyles.fieldGroup, companyInfoTwoColumns ? { flex: 0.4 } : null]}>
            <Text style={ajustesStyles.fieldLabel}>Teléfono</Text>
            <TextInput
              style={ajustesStyles.fieldInput}
              value={empresa?.telefono || ""}
              onChangeText={(t) => setEmpresa({ ...empresa, telefono: t })}
              placeholder="+56 9 ..."
              placeholderTextColor="#90A4AE"
            />
          </View>
        </View>

        <View style={ajustesStyles.fieldGroup}>
          <Text style={ajustesStyles.fieldLabel}>Descripción</Text>
          <TextInput
            style={[ajustesStyles.fieldInput, ajustesStyles.textArea]}
            multiline
            numberOfLines={4}
            value={empresa?.Descripcion || ""}
            onChangeText={(t) => setEmpresa({ ...empresa, Descripcion: t })}
            placeholder="Describe brevemente tu empresa..."
            placeholderTextColor="#90A4AE"
          />
        </View>

        <View style={ajustesStyles.divider} />

        <View style={ajustesStyles.footerActionRow}>
          <TouchableOpacity
            style={[ajustesStyles.primaryWideButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={ajustesStyles.primaryWideButtonText}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {showInlineLogout ? (
        <TouchableOpacity style={ajustesStyles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={ajustesStyles.logoutButtonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const ajustesStyles = StyleSheet.create({
  container: {
    gap: 22,
  },
  loadingWrap: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#4F6470",
    fontSize: 15,
  },
  inlineSupportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  inlineSupportButtonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    marginLeft: "auto",
  },
  inlineSupportText: {
    color: "#0A6F88",
    fontWeight: "700",
    fontSize: 15,
  },
  gridRow: {
    gap: 22,
  },
  gridRowDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  gridRowMobile: {
    flexDirection: "column",
  },
  fullCard: {
    width: "100%",
  },
  halfCard: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#DDE8F0",
    shadowColor: "#103B5C",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    gap: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  simpleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  simpleTitle: {
    color: "#102A43",
    fontSize: 18,
    fontWeight: "800",
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planTitle: {
    color: "#102A43",
    fontSize: 17,
    fontWeight: "800",
  },
  planTitleAccent: {
    color: "#0A6F88",
  },
  planSubtitle: {
    color: "#5F6F7A",
    fontSize: 15,
    marginTop: 2,
  },
  planSubtitleRight: {
    position: "absolute",
    right: 0,
    top: 24,
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: "#E7EFF5",
  },
  primaryActionButton: {
    backgroundColor: "#219EBC",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D5E3EC",
  },
  secondaryActionText: {
    color: "#123042",
    fontSize: 14,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#F6FAFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0EAF2",
    padding: 18,
  },
  metricCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  metricLabel: {
    color: "#50636F",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  metricValue: {
    color: "#102A43",
    fontSize: 18,
    fontWeight: "800",
  },
  subscriptionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#FFFCF2",
    borderWidth: 1,
    borderColor: "#F3C27A",
  },
  subscriptionButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFB703",
  },
  subscriptionButtonTitle: {
    color: "#023047",
    fontSize: 15,
    fontWeight: "900",
  },
  subscriptionButtonSubtitle: {
    color: "#6C4B00",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 17,
  },
  warningBox: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "#FFD2D2",
  },
  warningText: {
    color: "#C62828",
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorHint: {
    color: "#B71C1C",
    fontSize: 12,
    lineHeight: 17,
  },
  linkBox: {
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DFE8F0",
    backgroundColor: "#F6FAFF",
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    overflow: "hidden",
  },
  linkText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: "#2B3F4E",
    fontSize: 15,
    lineHeight: 22,
  },
  copyIconButton: {
    padding: 6,
    borderRadius: 10,
    alignSelf: "center",
  },
  copyFeedback: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "600",
    marginTop: -4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  primaryWideButton: {
    backgroundColor: "#219EBC",
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryWideButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryWideButton: {
    backgroundColor: "#FFB703",
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryWideButtonText: {
    color: "#6C4B00",
    fontSize: 15,
    fontWeight: "800",
  },
  walletCard: {
    position: "relative",
    overflow: "hidden",
  },
  walletGlow: {
    position: "absolute",
    top: -10,
    right: -30,
    width: 180,
    height: 180,
    backgroundColor: "rgba(142, 202, 230, 0.14)",
    borderRadius: 999,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 18,
  },
  walletState: {
    color: "#102A43",
    fontSize: 17,
    fontWeight: "800",
  },
  walletStateAccent: {
    color: "#0A6F88",
  },
  walletMeta: {
    color: "#5F6F7A",
    fontSize: 15,
    marginTop: 6,
  },
  infoForm: {
    gap: 18,
  },
  infoFormDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoFormMobile: {
    flexDirection: "column",
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: "#102A43",
    fontSize: 15,
    fontWeight: "700",
  },
  fieldInput: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6E1EA",
    backgroundColor: "#F3F7FB",
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#102A43",
    fontSize: 16,
  },
  fieldInputDisabled: {
    color: "#607D8B",
    backgroundColor: "#EEF3F6",
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: "top",
  },
  footerActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  logoutButton: {
    backgroundColor: "#C91919",
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});

