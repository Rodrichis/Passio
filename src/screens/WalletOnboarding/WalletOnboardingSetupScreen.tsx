import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import WalletColorField from "../../components/wallet-onboarding/WalletColorField";
import WalletIconUploadField from "../../components/wallet-onboarding/WalletIconUploadField";
import WalletStampPackSelector from "../../components/wallet-onboarding/WalletStampPackSelector";
import WalletVisitsField from "../../components/wallet-onboarding/WalletVisitsField";
import WalletPreviewCard from "../../components/wallet-onboarding/WalletPreviewCard";
import { auth } from "../../services/firebaseConfig";
import { getWalletConfig } from "../../services/walletOnboarding/getWalletConfig";
import { syncAndroidWalletClass } from "../../services/apiWallet";
import { saveWalletConfig } from "../../services/walletOnboarding/saveWalletConfig";
import { uploadWalletIcon } from "../../services/walletOnboarding/uploadWalletIcon";
import { COLORS } from "../../styles/theme";
import { RootStackParamList } from "../../types/navigation";
import type { PaqueteSellosWallet, TipoSellosWallet, WalletIconAsset } from "../../types/walletOnboarding";
import { clampVisitasPorPremio, isPngAsset, isValidHexColor, normalizeHexColor } from "../../utils/walletOnboarding/validators";
import OnboardingNextButton from "../../components/wallet-onboarding/OnboardingNextButton";

type Props = NativeStackScreenProps<RootStackParamList, "WalletOnboardingSetup">;

export default function WalletOnboardingSetupScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveCompleted, setSaveCompleted] = useState(false);
  const [saveStep, setSaveStep] = useState("");
  const [error, setError] = useState("");
  const [walletConfigurado, setWalletConfigurado] = useState(false);
  const [colorWallet, setColorWallet] = useState("#A99985");
  const [visitasPorPremio, setVisitasPorPremio] = useState(6);
  const [initialVisitasPorPremio, setInitialVisitasPorPremio] = useState(6);
  const [paqueteSellosWallet, setPaqueteSellosWallet] = useState<PaqueteSellosWallet>("generico1");
  const [tipoSellosWallet, setTipoSellosWallet] = useState<TipoSellosWallet>("generico");
  const [urlIconoWallet, setUrlIconoWallet] = useState("");
  const [walletClassId, setWalletClassId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [iconAsset, setIconAsset] = useState<WalletIconAsset | null>(null);
  const { width } = useWindowDimensions();
  const isNarrow = width < 620;
  const visitsLockedByCustomStamps = tipoSellosWallet === "personalizado";
  const visitsWereChanged = clampVisitasPorPremio(visitasPorPremio) !== clampVisitasPorPremio(initialVisitasPorPremio);

  useEffect(() => {
    let active = true;

    const loadConfig = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          return;
        }

        const config = await getWalletConfig(user.uid);
        if (!active) return;

        setWalletConfigurado(config.walletConfigurado);
        setColorWallet(config.colorWallet);
        setVisitasPorPremio(config.visitasPorPremio);
        setInitialVisitasPorPremio(config.visitasPorPremio);
        setPaqueteSellosWallet(config.paqueteSellosWallet);
        setTipoSellosWallet(config.tipoSellosWallet);
        setUrlIconoWallet(config.urlIconoWallet);
        setWalletClassId(config.walletClassId);
        setCompanyName(config.companyName || "");
      } catch (loadError) {
        console.error("Error cargando configuración de wallet:", loadError);
        if (!active) return;
        setError("No pudimos cargar la configuracion inicial del wallet.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadConfig();
    return () => {
      active = false;
    };
  }, [navigation]);

  const executeSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      return;
    }

    const normalizedColor = normalizeHexColor(colorWallet);
    const safeVisitas = clampVisitasPorPremio(visitasPorPremio);
    const safeWalletClassId = walletClassId.trim();

    try {
      setSaving(true);
      setSaveCompleted(false);
      setSaveStep("Preparando configuración del wallet...");
      setError("");

      let nextIconUrl = urlIconoWallet;
      if (iconAsset) {
        setSaveStep("Subiendo logo de tu empresa...");
        const uploadedIconUrl = await uploadWalletIcon(safeWalletClassId, iconAsset);
        const cacheBust = `v=${Date.now()}`;
        nextIconUrl = `${uploadedIconUrl}${uploadedIconUrl.includes("?") ? "&" : "?"}${cacheBust}`;
      }

      setSaveStep("Aplicando configuración del wallet...");
      const syncClassResponse = await syncAndroidWalletClass({
        walletClassId: safeWalletClassId,
        nombreEmpresa: companyName || safeWalletClassId,
        paqueteSellosWallet,
        visitasPorPremio: safeVisitas,
        colorWallet: normalizedColor,
        urlIconoWallet: nextIconUrl,
      });

      if (!syncClassResponse.ok) {
        throw new Error(syncClassResponse.errorText || "No pudimos sincronizar la clase del wallet Android.");
      }

      setSaveStep("Guardando configuración final...");
      await saveWalletConfig(user.uid, {
        walletConfigurado: true,
        estadoWallet: "listo",
        colorWallet: normalizedColor,
        visitasPorPremio: safeVisitas,
        urlIconoWallet: nextIconUrl,
        paqueteSellosWallet,
        tipoSellosWallet,
        walletClassId: safeWalletClassId,
      });

      setInitialVisitasPorPremio(safeVisitas);
      setWalletConfigurado(true);
      setSaveCompleted(true);
      setSaveStep("Se guardo correctamente la configuración del wallet.");
    } catch (saveError) {
      console.error("Error guardando configuración de wallet:", saveError);
      setError(saveError instanceof Error ? saveError.message : "No pudimos guardar tu configuración. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const safeWalletClassId = walletClassId.trim();

    if (!safeWalletClassId) {
      setError("Falta el identificador wallet-class-id de la empresa.");
      return;
    }

    if (!isValidHexColor(colorWallet)) {
      setError("El color del wallet debe tener formato #RRGGBB.");
      return;
    }

    if (!iconAsset && !urlIconoWallet) {
      setError(
        Platform.OS === "web"
          ? "Debes subir el icono PNG de tu empresa para continuar."
          : "Por ahora la carga del icono se realiza desde navegador web."
      );
      return;
    }

    if (iconAsset && !isPngAsset(iconAsset)) {
      setError("El icono debe estar en formato PNG.");
      return;
    }

    if (!walletConfigurado || !visitsWereChanged) {
      void executeSave();
      return;
    }

    const warningMessage = "Cambiar las visitas por premio afectara el progreso de clientes ya registrados.";

    if (Platform.OS === "web") {
      const confirmed = typeof globalThis.confirm === "function" ? globalThis.confirm(warningMessage) : true;
      if (!confirmed) return;
      void executeSave();
      return;
    }

    Alert.alert("Cambiar visitas por premio", warningMessage, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Continuar",
        onPress: () => {
          void executeSave();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F5F8FA",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: "#51616F" }}>Cargando configuracion de wallet...</Text>
      </View>
    );
  }

  return (
    <>
      <Modal visible={saving || saveCompleted} transparent animationType="fade" onRequestClose={() => undefined}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(14, 25, 34, 0.45)",
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
              paddingVertical: 28,
              borderWidth: 1,
              borderColor: "#E2ECF1",
              alignItems: "center",
            }}
          >
            {!saveCompleted ? <ActivityIndicator size="large" color={COLORS.primary} /> : null}

            <Text
              style={{
                marginTop: saveCompleted ? 0 : 18,
                color: COLORS.textDark,
                fontSize: 22,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              {saveCompleted ? "Configuracion guardada" : "Guardando wallet"}
            </Text>

            <Text
              style={{
                marginTop: 10,
                color: "#51616F",
                fontSize: 16,
                lineHeight: 24,
                textAlign: "center",
              }}
            >
              {saveCompleted ? "Se guardo correctamente la configuración de tu wallet." : saveStep}
            </Text>

            {saveCompleted ? (
              <TouchableOpacity
                onPress={() => {
                  setSaveCompleted(false);
                  setSaveStep("");
                  navigation.replace("WalletOnboardingDone");
                }}
                style={{
                  marginTop: 22,
                  minWidth: 180,
                  backgroundColor: COLORS.primary,
                  borderRadius: 14,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "800",
                    textAlign: "center",
                  }}
                >
                  Aceptar
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#F5F8FA", paddingHorizontal: isNarrow ? 14 : 20, paddingVertical: 28 }}>
          <View
            style={{
              width: "100%",
              maxWidth: 760,
              alignSelf: "center",
              backgroundColor: "#FFFFFF",
              borderRadius: 28,
              paddingHorizontal: isNarrow ? 16 : 24,
              paddingVertical: 28,
              borderWidth: 1,
              borderColor: "#E2ECF1",
            }}
          >
            <Text
              style={{
                color: COLORS.textDark,
                fontSize: isNarrow ? 28 : 30,
                fontWeight: "800",
                marginBottom: 10,
              }}
            >
              Configura tu wallet
            </Text>

            <Text style={{ color: "#51616F", fontSize: 16, lineHeight: 24, marginBottom: 24 }}>
              Define el color principal, el pack de sellos, las visitas por premio y sube el icono PNG de tu empresa.
              Esta configuración sera la base de tu programa de fidelizacion.
            </Text>

            <View style={{ flexDirection: isNarrow ? "column" : "row", alignItems: "flex-start", gap: 18 }}>
              {!isNarrow ? (
                <View style={{ width: 300 }}>
                  <WalletPreviewCard
                    companyName={companyName}
                    walletClassId={walletClassId}
                    colorWallet={colorWallet}
                    urlIconoWallet={urlIconoWallet}
                    iconAsset={iconAsset}
                    paqueteSellosWallet={paqueteSellosWallet}
                    visitasPorPremio={visitasPorPremio}
                  />
                </View>
              ) : null}

              <View style={{ flex: 1, width: "100%" }}>
                <WalletColorField value={colorWallet} onChange={setColorWallet} />
                <WalletVisitsField
                  value={visitasPorPremio}
                  onChange={setVisitasPorPremio}
                  disabled={visitsLockedByCustomStamps}
                  helperText={
                    visitsLockedByCustomStamps
                      ? "Estas usando sellos personalizados, por eso no puedes cambiar las visitas por premio desde aqui."
                      : null
                  }
                />
                {!visitsLockedByCustomStamps && walletConfigurado && visitsWereChanged ? (
                  <View
                    style={{
                      marginTop: -8,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: "#F6C56C",
                      backgroundColor: "#FFF7E8",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: "#7A4A00", lineHeight: 20 }}>
                      Cambiar las visitas por premio afectara el progreso de clientes ya registrados.
                    </Text>
                  </View>
                ) : null}
                <WalletStampPackSelector
                  value={paqueteSellosWallet}
                  visitasPorPremio={visitasPorPremio}
                  tipoSellosWallet={tipoSellosWallet}
                  onChange={setPaqueteSellosWallet}
                />
                <WalletIconUploadField
                  currentUrl={urlIconoWallet}
                  asset={iconAsset}
                  onSelectAsset={setIconAsset}
                  helperText={error && error.toLowerCase().includes("icono") ? error : null}
                />

                {isNarrow ? (
                  <View style={{ marginBottom: 18 }}>
                    <WalletPreviewCard
                      companyName={companyName}
                      walletClassId={walletClassId}
                      colorWallet={colorWallet}
                      urlIconoWallet={urlIconoWallet}
                      iconAsset={iconAsset}
                      paqueteSellosWallet={paqueteSellosWallet}
                      visitasPorPremio={visitasPorPremio}
                    />
                  </View>
                ) : null}

                {walletClassId ? (
                  <Text style={{ color: "#51616F", marginTop: -12, marginBottom: 18 }}>
                    Clase wallet: {walletClassId}
                  </Text>
                ) : null}

                {error && !error.toLowerCase().includes("icono") ? (
                  <Text style={{ color: "#C62828", marginBottom: 16 }}>{error}</Text>
                ) : null}

                <View
                  style={{
                    flexDirection: isNarrow ? "column-reverse" : "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <OnboardingNextButton
                    label="Atras"
                    onPress={() => navigation.goBack()}
                    iconName="arrow-back"
                    iconPosition="left"
                    variant="secondary"
                    style={{ width: isNarrow ? "100%" : undefined, minWidth: isNarrow ? 0 : 132 }}
                  />

                  <OnboardingNextButton
                    label={saving ? "Guardando..." : "Guardar configuración"}
                    onPress={handleSave}
                    disabled={saving || saveCompleted}
                    style={{ width: isNarrow ? "100%" : undefined, minWidth: isNarrow ? 0 : 220 }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}


