import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/services/firebaseConfig";
import { View, Text, ActivityIndicator } from "react-native";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DashboardScreen from "./src/screens/Dashboard/DashboardScreen";
import RegisterClientScreen from "./src/screens/RegisterClientScreen";
import VerifyEmailScreen from "./src/screens/VerifyEmailScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import { RootStackParamList } from "./src/types/navigation";
import { configureRevenueCat, syncRevenueCatUser, isRevenueCatAvailable } from "./src/services/revenuecat";
import { Platform } from "react-native";

// Linking para probar en web (Expo Web)
const linking = {
  prefixes: ["passio://", "http://localhost:8082"], // usa tu puerto web de Expo
  config: {
    screens: {
      Login: "login",
      Register: "register-company",
      Dashboard: "dashboard",
      VerifyEmail: "verify-email",
      ForgotPassword: "forgot-password",
      RegisterClient: "register/:empresaId",
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = React.useState<typeof auth.currentUser>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Configura RevenueCat al iniciar y cuando cambia el usuario
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
        <Text style={{ marginTop: 8 }}>Cargando sesión...</Text>
      </View>
    );
  }

  // Ignoramos usuarios anónimos (p.ej. del formulario público) para no redirigir
  // a VerifyEmail cuando abrimos la app de empresas.
  const effectiveUser = user && !user.isAnonymous ? user : null;
  const isVerified = !!(effectiveUser && effectiveUser.emailVerified);

  return (
    <NavigationContainer linking={linking}>
      {!effectiveUser ? (
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="RegisterClient" component={RegisterClientScreen} />
        </Stack.Navigator>
      ) : !isVerified ? (
        <Stack.Navigator initialRouteName="VerifyEmail" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="RegisterClient" component={RegisterClientScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="RegisterClient" component={RegisterClientScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
