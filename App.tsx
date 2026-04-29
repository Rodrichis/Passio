import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import React from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { auth } from "./src/services/firebaseConfig";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DashboardScreen from "./src/screens/Dashboard/DashboardScreen";
import RegisterClientScreen from "./src/screens/RegisterClientScreen";
import VerifyEmailScreen from "./src/screens/VerifyEmailScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import CompanyGateScreen from "./src/screens/CompanyGateScreen";
import WalletOnboardingIntroScreen from "./src/screens/WalletOnboarding/WalletOnboardingIntroScreen";
import WalletOnboardingSetupScreen from "./src/screens/WalletOnboarding/WalletOnboardingSetupScreen";
import WalletOnboardingDoneScreen from "./src/screens/WalletOnboarding/WalletOnboardingDoneScreen";
import { configureRevenueCat, isRevenueCatAvailable, syncRevenueCatUser } from "./src/services/revenuecat";
import { RootStackParamList } from "./src/types/navigation";

const linking = {
  prefixes: [
    "passio://",
    "http://localhost:8081",
    "http://localhost:19006",
    "https://passio.cl/app",
    "https://www.passio.cl/app",
  ],
  config: {
    screens: {
      Login: "login",
      Register: "register-company",
      CompanyGate: "company-gate",
      Dashboard: "dashboard",
      VerifyEmail: "verify-email",
      ForgotPassword: "forgot-password",
      WalletOnboardingIntro: "wallet-onboarding",
      WalletOnboardingSetup: "wallet-onboarding/setup",
      WalletOnboardingDone: "wallet-onboarding/done",
      RegisterClient: "register/:empresaId",
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = React.useState<typeof auth.currentUser>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setLoading(true);

      void (async () => {
        try {
          if (nextUser && !nextUser.isAnonymous) {
            await nextUser.reload();
          }
        } catch (reloadError) {
          console.error("No se pudo refrescar el estado de verificacion del usuario:", reloadError);
        } finally {
          if (!active) return;
          setUser(auth.currentUser);
          setLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== "web" && isRevenueCatAvailable()) {
      configureRevenueCat(user?.uid || null);
      syncRevenueCatUser(user?.uid || null);
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Cargando sesion...</Text>
      </View>
    );
  }

  const effectiveUser = user && !user.isAnonymous ? user : null;
  const isPublicRegisterPath =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    /\/register\/[^/]+\/?$/.test(window.location.pathname);
  const isVerified = !!(effectiveUser && effectiveUser.emailVerified);

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="dark" backgroundColor="#ffffff" translucent={false} />
      {!effectiveUser || isPublicRegisterPath ? (
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="RegisterClient" component={RegisterClientScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName={isVerified ? "CompanyGate" : "VerifyEmail"} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="CompanyGate" component={CompanyGateScreen} />
          <Stack.Screen name="WalletOnboardingIntro" component={WalletOnboardingIntroScreen} />
          <Stack.Screen name="WalletOnboardingSetup" component={WalletOnboardingSetupScreen} />
          <Stack.Screen name="WalletOnboardingDone" component={WalletOnboardingDoneScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="RegisterClient" component={RegisterClientScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}




