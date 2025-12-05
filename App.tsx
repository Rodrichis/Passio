import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import DashboardScreen from "./src/screens/Dashboard/DashboardScreen";
import RegisterClientScreen from "./src/screens/RegisterClientScreen";
import VerifyEmailScreen from "./src/screens/VerifyEmailScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import { RootStackParamList } from "./src/types/navigation";

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
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="RegisterClient" component={RegisterClientScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
