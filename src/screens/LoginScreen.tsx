import React, { useMemo, useState } from "react";
import {
  View,
  TextInput,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { COLORS } from "../styles/theme";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  ForgotPassword: undefined;
  RegisterClient: { empresaId: string };
  VerifyEmail: { email?: string };
};

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const webInputReset =
    Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
          outlineColor: "transparent",
          boxShadow: "none",
        } as any)
      : null;

  const handleLogin = async () => {
    const emailTrim = email.trim().toLowerCase();
    const passwordTrim = password.trim();

    if (!emailTrim || !passwordTrim) {
      setError("Ingresa correo y contraseña.");
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
      setError("Correo invalido.");
      return;
    }

    try {
      setError("");
      await signInWithEmailAndPassword(auth, emailTrim, passwordTrim);
    } catch {
      setError("Usuario o contraseña incorrectos");
    }
  };

  const isValid =
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase()) &&
    password.trim().length > 0;

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <KeyboardAvoidingView
      style={loginStyles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={loginStyles.screen}>
        <View style={[loginStyles.glow, loginStyles.glowTop]} />
        <View style={[loginStyles.glow, loginStyles.glowBottom]} />

        <ScrollView
          contentContainerStyle={[
            loginStyles.scrollContent,
            { paddingHorizontal: isCompact ? 16 : 28, paddingVertical: isCompact ? 28 : 48 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={loginStyles.brandWrap}>
            <Text style={[loginStyles.brand, { fontSize: isCompact ? 34 : 44 }]}>Passio</Text>
          </View>

          <View
            style={[
              loginStyles.card,
              {
                paddingHorizontal: isCompact ? 20 : 30,
                paddingVertical: isCompact ? 24 : 30,
                borderRadius: isCompact ? 24 : 28,
              },
            ]}
          >
            <View style={loginStyles.headerBlock}>
              <Text style={[loginStyles.title, { fontSize: isCompact ? 18 : 22 }]}>
                Login Empresa
              </Text>
              <Text style={loginStyles.subtitle}>
                Bienvenido de nuevo, accede a tu panel.
              </Text>
            </View>

            <View style={loginStyles.formBlock}>
              <View style={loginStyles.fieldBlock}>
                <Text style={loginStyles.label}>Correo electrónico</Text>
                <View
                  style={[
                    loginStyles.inputShell,
                    focusedField === "email" && loginStyles.inputShellFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#A5B3BE"
                    style={loginStyles.inputIcon}
                  />
                  <TextInput
                    style={[loginStyles.input, webInputReset]}
                    placeholder="ejemplo@empresa.com"
                    placeholderTextColor="#A5B3BE"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    underlineColorAndroid="transparent"
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField((prev) => (prev === "email" ? null : prev))}
                    onSubmitEditing={handleLogin}
                  />
                </View>
              </View>

              <View style={loginStyles.fieldBlock}>
                <Text style={loginStyles.label}>Contraseña</Text>
                <View
                  style={[
                    loginStyles.inputShell,
                    focusedField === "password" && loginStyles.inputShellFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#A5B3BE"
                    style={loginStyles.inputIcon}
                  />
                  <TextInput
                    style={[loginStyles.input, webInputReset]}
                    placeholder="........"
                    placeholderTextColor="#A5B3BE"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    underlineColorAndroid="transparent"
                    onFocus={() => setFocusedField("password")}
                    onBlur={() =>
                      setFocusedField((prev) => (prev === "password" ? null : prev))
                    }
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={loginStyles.visibilityButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#7D8F9A"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {error ? <Text style={loginStyles.error}>{error}</Text> : null}

              <TouchableOpacity
                onPress={() => navigation.navigate("ForgotPassword")}
                style={loginStyles.forgotButton}
              >
                <Text style={loginStyles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[loginStyles.primaryButton, !isValid && loginStyles.buttonDisabled]}
                onPress={handleLogin}
                disabled={!isValid}
              >
                <Text style={loginStyles.primaryButtonText}>Iniciar sesión</Text>
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={loginStyles.dividerRow}>
                <View style={loginStyles.dividerLine} />
                <Text style={loginStyles.dividerText}>o</Text>
                <View style={loginStyles.dividerLine} />
              </View>

              <TouchableOpacity
                style={loginStyles.secondaryButton}
                onPress={() => navigation.navigate("Register")}
              >
                <Text style={loginStyles.secondaryButtonText}>Registrar nueva empresa</Text>
                <Ionicons name="business-outline" size={20} color="#6C4B00" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={loginStyles.footer}>
            © {year} Passio. Todos los derechos reservados.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const loginStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#F6FAFF",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.5,
  },
  glowTop: {
    width: 300,
    height: 300,
    backgroundColor: "rgba(142, 202, 230, 0.35)",
    top: -80,
    left: -90,
  },
  glowBottom: {
    width: 360,
    height: 360,
    backgroundColor: "rgba(255, 183, 3, 0.16)",
    right: -120,
    bottom: -120,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  brandWrap: {
    marginBottom: 28,
    alignItems: "center",
  },
  brand: {
    color: "#0A6F88",
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(189, 200, 205, 0.36)",
    shadowColor: "#0F3554",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 36,
    elevation: 10,
  },
  headerBlock: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    color: "#102A43",
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#4F6470",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  formBlock: {
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    color: "#102A43",
    fontSize: 15,
    fontWeight: "700",
  },
  inputShell: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#D6E1EA",
    backgroundColor: "#F3F7FB",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputShellFocused: {
    borderColor: "#D6E1EA",
    shadowOpacity: 0,
    elevation: 0,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#102A43",
    fontSize: 16,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
    borderWidth: 0,
  },
  visibilityButton: {
    marginLeft: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  error: {
    color: "#C62828",
    fontSize: 14,
    fontWeight: "600",
    marginTop: -4,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -2,
  },
  forgotText: {
    color: "#0A6F88",
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#219ebc",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(110, 121, 125, 0.22)",
  },
  dividerText: {
    color: "#6E797D",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#6C4B00",
    fontSize: 17,
    fontWeight: "800",
  },
  footer: {
    marginTop: 24,
    color: "#6E7F8D",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 360,
  },
});
