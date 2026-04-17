import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { auth } from "../services/firebaseConfig";
import { globalStyles } from "../styles/theme";
import { RootStackParamList } from "../types/navigation";
import { getWalletConfig } from "../services/walletOnboarding/getWalletConfig";

type Props = NativeStackScreenProps<RootStackParamList, "CompanyGate">;

export default function CompanyGateScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);

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
