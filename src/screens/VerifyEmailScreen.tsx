import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { globalStyles } from "../styles/theme";
import RootStackParamList from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyEmail">;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const [status, setStatus] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);
  const email = route.params?.email || auth.currentUser?.email || "";

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      setStatus("Enviando correo...");
      await sendEmailVerification(user);
      setStatus("Correo de verificación enviado.");
      setCooldown(60);
    } catch (e) {
      setStatus("No se pudo enviar el correo. Intenta nuevamente.");
      console.error(e);
    }
  };

  const handleCheck = async () => {
    const user = auth.currentUser;
    if (!user) return;
    await user.reload();
    if (user.emailVerified) {
      navigation.replace("Dashboard");
    } else {
      setStatus("Aún no está verificado. Revisa tu correo.");
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } finally {
      navigation.replace("Login");
    }
  };

  return (
    <ScrollView contentContainerStyle={globalStyles.scrollContainer}>
      <View style={globalStyles.container}>
        <Text style={globalStyles.header}>Verifica tu correo</Text>
        <View style={globalStyles.card}>
          <Text style={globalStyles.title}>Confirma tu cuenta</Text>
          <Text style={{ marginBottom: 12, color: "#333", textAlign: "center" }}>
            Enviamos un correo de verificación a:
          </Text>
          <Text style={{ fontWeight: "bold", marginBottom: 16, textAlign: "center" }}>
            {email || "tu correo"}
          </Text>

          {status ? <Text style={{ color: "#023047", marginBottom: 12 }}>{status}</Text> : null}

          <TouchableOpacity
            style={[
              globalStyles.primaryButton,
              cooldown > 0 && { opacity: 0.6 },
            ]}
            onPress={handleResend}
            disabled={cooldown > 0}
          >
            <Text style={globalStyles.buttonText}>
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar correo"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={globalStyles.secondaryButton} onPress={handleCheck}>
            <Text style={globalStyles.buttonTextSecondary}>Ya verifiqué</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[globalStyles.secondaryButton, { backgroundColor: "#ccc" }]} onPress={handleLogout}>
            <Text style={globalStyles.buttonTextSecondary}>Cambiar correo / salir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
