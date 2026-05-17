import React, { useMemo, useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendEmailVerification } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../services/firebaseConfig";
import RootStackParamList from "../types/navigation";
import { authStyles } from "../styles/authStyles";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyEmail">;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const [status, setStatus] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);
  const email = route.params?.email || auth.currentUser?.email || "";
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const year = useMemo(() => new Date().getFullYear(), []);

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
      setStatus("Correo de verificacion enviado.");
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
      navigation.replace("CompanyGate");
    } else {
      setStatus("Aún no esta verificado. Revisa tu correo.");
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } finally {
      // App.tsx cambia automaticamente al stack publico al cerrar sesión.
    }
  };

  return (
    <KeyboardAvoidingView
      style={authStyles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={authStyles.screen}>
        <View style={[authStyles.glow, authStyles.glowTop]} />
        <View style={[authStyles.glow, authStyles.glowBottom]} />

        <ScrollView
          contentContainerStyle={[
            authStyles.scrollContent,
            { paddingHorizontal: isCompact ? 16 : 28, paddingVertical: isCompact ? 28 : 48 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.brandWrap}>
            <Text style={[authStyles.brand, { fontSize: isCompact ? 34 : 44 }]}>Passio</Text>
          </View>

          <View
            style={[
              authStyles.card,
              {
                maxWidth: 560,
                paddingHorizontal: isCompact ? 20 : 30,
                paddingVertical: isCompact ? 24 : 30,
                borderRadius: isCompact ? 24 : 28,
              },
            ]}
          >
            <View style={authStyles.headerBlock}>
              <Text style={[authStyles.title, { fontSize: isCompact ? 18 : 22 }]}>
                Confirma tu cuenta
              </Text>
              <Text style={authStyles.subtitle}>
                Enviamos un correo de verificación a la dirección asociada a tu empresa.
              </Text>
            </View>

            <View style={authStyles.formBlock}>
              <View style={authStyles.infoBox}>
                <Text style={authStyles.infoBoxText}>{email || "tu correo"}</Text>
              </View>

              {status ? (
                <Text
                  style={[
                    authStyles.helperText,
                    status.toLowerCase().includes("no se pudo") || status.toLowerCase().includes("aun")
                      ? authStyles.warningText
                      : authStyles.successText,
                  ]}
                >
                  {status}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[authStyles.primaryButton, cooldown > 0 && authStyles.buttonDisabled]}
                onPress={handleResend}
                disabled={cooldown > 0}
              >
                <Text style={authStyles.primaryButtonText}>
                  {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar correo"}
                </Text>
                <Ionicons name="mail-unread-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity style={authStyles.secondaryButton} onPress={handleCheck}>
                <Text style={authStyles.secondaryButtonText}>Ya verifiqué</Text>
                <Ionicons name="checkmark-circle-outline" size={20} color="#6C4B00" />
              </TouchableOpacity>

              <TouchableOpacity
                style={authStyles.ghostButton}
                onPress={handleLogout}
              >
                <Text style={authStyles.ghostButtonText}>Cambiar correo / salir</Text>
                <Ionicons name="log-out-outline" size={20} color="#123042" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={authStyles.footer}>© {year} Passio. Todos los derechos reservados.</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
