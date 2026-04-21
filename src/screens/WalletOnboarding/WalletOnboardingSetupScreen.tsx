import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
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
import type { PaqueteSellosWallet, WalletIconAsset } from "../../types/walletOnboarding";
import { clampVisitasPorPremio, isPngAsset, normalizeHexColor } from "../../utils/walletOnboarding/validators";
import OnboardingNextButton from "../../components/wallet-onboarding/OnboardingNextButton";

type Props = NativeStackScreenProps<RootStackParamList, "WalletOnboardingSetup">;

export default function WalletOnboardingSetupScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [colorWallet, setColorWallet] = useState("#A99985");
  const [visitasPorPremio, setVisitasPorPremio] = useState(6);
  const [paqueteSellosWallet, setPaqueteSellosWallet] = useState<PaqueteSellosWallet>("generico1");
  const [urlIconoWallet, setUrlIconoWallet] = useState("");
  const [walletClassId, setWalletClassId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [iconAsset, setIconAsset] = useState<WalletIconAsset | null>(null);
  const { width } = useWindowDimensions();
  const isNarrow = width < 620;

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

        setColorWallet(config.colorWallet);
        setVisitasPorPremio(config.visitasPorPremio);
        setPaqueteSellosWallet(config.paqueteSellosWallet);
        setUrlIconoWallet(config.urlIconoWallet);
        setWalletClassId(config.walletClassId);
        setCompanyName(config.companyName || "");
      } catch (loadError) {
        console.error("Error cargando configuracion de wallet:", loadError);
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

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      return;
    }

    const normalizedColor = normalizeHexColor(colorWallet);
    const safeVisitas = clampVisitasPorPremio(visitasPorPremio);
    const safeWalletClassId = walletClassId.trim();

    if (!safeWalletClassId) {
      setError("Falta el identificador wallet-class-id de la empresa.");
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

    try {
      setSaving(true);
      setError("");

      let nextIconUrl = urlIconoWallet;
      if (iconAsset) {
        nextIconUrl = await uploadWalletIcon(safeWalletClassId, iconAsset);
      }

      const syncClassResponse = await syncAndroidWalletClass({
        walletClassId: safeWalletClassId,
        nombreEmpresa: companyName || safeWalletClassId,
        paqueteSellosWallet,
        visitasPorPremio: safeVisitas,
        colorWallet: normalizedColor,
      });

      if (!syncClassResponse.ok) {
        throw new Error(syncClassResponse.errorText || "No pudimos sincronizar la clase del wallet Android.");
      }

      await saveWalletConfig(user.uid, {
        walletConfigurado: true,
        estadoWallet: "pendiente",
        colorWallet: normalizedColor,
        visitasPorPremio: safeVisitas,
        urlIconoWallet: nextIconUrl,
        paqueteSellosWallet,
        walletClassId: safeWalletClassId,
      });

      navigation.replace("WalletOnboardingDone");
    } catch (saveError) {
      console.error("Error guardando configuracion de wallet:", saveError);
      setError(saveError instanceof Error ? saveError.message : "No pudimos guardar tu configuracion. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
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
            Esta configuracion sera la base de tu programa de fidelizacion.
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
              <WalletVisitsField value={visitasPorPremio} onChange={setVisitasPorPremio} />
              <WalletStampPackSelector value={paqueteSellosWallet} visitasPorPremio={visitasPorPremio} onChange={setPaqueteSellosWallet} />
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
                  label={saving ? "Guardando..." : "Guardar configuracion"}
                  onPress={handleSave}
                  disabled={saving}
                  style={{ width: isNarrow ? "100%" : undefined, minWidth: isNarrow ? 0 : 220 }}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
