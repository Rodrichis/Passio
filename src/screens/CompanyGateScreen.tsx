import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../services/firebaseConfig";
import { globalStyles } from "../styles/theme";
import { RootStackParamList } from "../types/navigation";
import { getWalletConfig } from "../services/walletOnboarding/getWalletConfig";
import {
  EMPTY_SUBSCRIPTION_BLOCK,
  getSubscriptionBlockCopy,
  resolveSubscriptionBlock,
  SubscriptionBlockState,
} from "../utils/subscriptionGate";

type Props = NativeStackScreenProps<RootStackParamList, "CompanyGate">;

export default function CompanyGateScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [subscriptionBlock, setSubscriptionBlock] = useState<SubscriptionBlockState>(
    EMPTY_SUBSCRIPTION_BLOCK
  );

  useEffect(() => {
    let active = true;

    const resolveNextScreen = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          return;
        }

        if (!user.emailVerified) {
          navigation.replace("VerifyEmail", { email: user.email || "" });
          return;
        }

        const empresaSnap = await getDoc(doc(db, "Empresas", user.uid));
        if (!active) return;

        if (empresaSnap.exists()) {
          const empresaData = empresaSnap.data() as any;
          const adminEnabled = empresaData?.esAdmin === true;
          const nextBlock = adminEnabled
            ? EMPTY_SUBSCRIPTION_BLOCK
            : resolveSubscriptionBlock(empresaData);

          if (nextBlock.blocked) {
            setSubscriptionBlock(nextBlock);
            return;
          }
        }

        const walletConfig = await getWalletConfig(user.uid);
        if (!active) return;

        navigation.replace(walletConfig.walletConfigurado ? "Dashboard" : "WalletOnboardingIntro");
      } catch (nextError) {
        console.error("Error resolviendo onboarding:", nextError);
        if (!active) return;
        setError("No pudimos cargar la configuracion del wallet.");
      }
    };

    resolveNextScreen();
    return () => {
      active = false;
    };
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (logoutError) {
      console.log("Error al cerrar sesi\u00F3n:", logoutError);
    }
  };

  const handleOpenSupportEmail = async () => {
    try {
      await Linking.openURL("mailto:hola@passio.cl");
    } catch (supportError) {
      console.log("No se pudo abrir soporte:", supportError);
    }
  };

  const subscriptionBlockCopy = getSubscriptionBlockCopy(subscriptionBlock);

  if (subscriptionBlock.blocked) {
    return (
      <View style={[globalStyles.container, { backgroundColor: "#F6FAFF" }]}>
        <View
          style={{
            width: "100%",
            maxWidth: 520,
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
          }}
        >
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#E3EDF5",
              backgroundColor: "#F8FBFE",
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 10,
            }}
          >
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

            <Text style={{ color: "#123042", fontSize: 24, fontWeight: "800" }}>
              {subscriptionBlockCopy.title}
            </Text>
            <Text style={{ color: "#51616F", fontSize: 15, lineHeight: 23 }}>
              {subscriptionBlockCopy.description}
            </Text>
          </View>

          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#E3EDF5",
              backgroundColor: "#F8FBFE",
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 6,
            }}
          >
            <Text
              style={{
                color: "#607381",
                fontSize: 13,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Estado de suscripci\u00F3n
            </Text>
            <Text style={{ color: "#123042", fontSize: 18, fontWeight: "800" }}>
              {subscriptionBlockCopy.statusLabel}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={handleLogout}
              style={[
                globalStyles.secondaryButton,
                {
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#D7E3EC",
                  marginBottom: 0,
                },
              ]}
            >
              <Text style={{ color: "#123042", fontWeight: "700" }}>Cerrar sesi\u00F3n</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenSupportEmail}
              style={[globalStyles.primaryButton, { marginBottom: 0, paddingHorizontal: 18 }]}
            >
              <Text style={globalStyles.buttonText}>Contactar soporte</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.replace("Dashboard")}
              style={[
                globalStyles.primaryButton,
                {
                  marginBottom: 0,
                  paddingHorizontal: 18,
                  backgroundColor: "#FFB703",
                },
              ]}
            >
              <Text style={[globalStyles.buttonText, { color: "#023047" }]}>
                Gestionar suscripción
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>
      <View style={globalStyles.card}>
        {error ? (
          <>
            <Text style={globalStyles.title}>Ocurrio un problema</Text>
            <Text style={{ textAlign: "center", color: "#425466", marginBottom: 16 }}>{error}</Text>
            <TouchableOpacity style={globalStyles.primaryButton} onPress={() => navigation.replace("CompanyGate")}>
              <Text style={globalStyles.buttonText}>Reintentar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 16, textAlign: "center", color: "#425466" }}>
              Revisando la configuracion de tu cuenta...
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
