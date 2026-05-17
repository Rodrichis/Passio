import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendPasswordResetEmail } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../services/firebaseConfig";
import RootStackParamList from "../types/navigation";
import { AUTH_WEB_INPUT_RESET, authStyles } from "../styles/authStyles";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const year = useMemo(() => new Date().getFullYear(), []);

  const handleReset = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
      setError("Ingresa un correo valido.");
      return;
    }
    try {
      setError("");
      setStatus("Enviando correo...");
      auth.languageCode = "es";
      await sendPasswordResetEmail(auth, emailTrim);
      setStatus("Revisa tu correo para restablecer la contraseña.");
      setCooldown(60);
    } catch (e: any) {
      setStatus("");
      setError("No se pudo enviar el correo. Intenta nuevamente.");
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleBackToLogin = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (!auth.currentUser) {
      navigation.navigate("Login");
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
                maxWidth: 520,
                paddingHorizontal: isCompact ? 20 : 30,
                paddingVertical: isCompact ? 24 : 30,
                borderRadius: isCompact ? 24 : 28,
              },
            ]}
          >
            <View style={authStyles.headerBlock}>
              <Text style={[authStyles.title, { fontSize: isCompact ? 18 : 22 }]}>
                Restablece tu contraseña
              </Text>
              <Text style={authStyles.subtitle}>
                Ingresa tu correo y te enviaremos un enlace para recuperar el acceso.
              </Text>
            </View>

            <View style={authStyles.formBlock}>
              <View style={authStyles.fieldBlock}>
                <Text style={authStyles.label}>Correo electrónico</Text>
                <View
                  style={[
                    authStyles.inputShell,
                    focused && authStyles.inputShellFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#A5B3BE"
                    style={authStyles.inputIcon}
                  />
                  <TextInput
                    style={[authStyles.input, AUTH_WEB_INPUT_RESET]}
                    placeholder="ejemplo@empresa.com"
                    placeholderTextColor="#A5B3BE"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="done"
                    underlineColorAndroid="transparent"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </View>
              </View>

              {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
              {status ? <Text style={authStyles.successText}>{status}</Text> : null}

              <TouchableOpacity
                style={[authStyles.primaryButton, cooldown > 0 && authStyles.buttonDisabled]}
                onPress={handleReset}
                disabled={cooldown > 0}
              >
                <Text style={authStyles.primaryButtonText}>
                  {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Enviar enlace"}
                </Text>
                <Ionicons name="send-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={authStyles.secondaryButton}
                onPress={handleBackToLogin}
              >
                <Text style={authStyles.secondaryButtonText}>Volver a login</Text>
                <Ionicons name="arrow-back-outline" size={20} color="#6C4B00" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={authStyles.footer}>© {year} Passio. Todos los derechos reservados.</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
