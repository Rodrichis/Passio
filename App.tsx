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
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsub;
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
