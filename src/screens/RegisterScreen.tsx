import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  ScrollView as RNScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { ESTADO_SUSCRIPCION, ESTADO_WALLET, PLAN } from "../constants/empresa";
import { auth, db } from "../services/firebaseConfig";
import { RootStackParamList } from "../types/navigation";
import { buildRegistrationUrl } from "../utils/publicUrls";
import { resolveWalletClassIdFromName } from "../utils/walletOnboarding/walletClassId";
import { AUTH_WEB_INPUT_RESET, authStyles } from "../styles/authStyles";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapaca",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaiso",
  "Metropolitana",
  "O'Higgins",
  "Maule",
  "Nuble",
  "Biobio",
  "La Araucania",
  "Los Rios",
  "Los Lagos",
  "Aysen",
  "Magallanes",
];

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const EMPTY_TOUCHED = {
  empresa: false,
  email: false,
  password: false,
  telefono: false,
  region: false,
  ciudad: false,
  direccion: false,
};

export default function RegisterScreen({ navigation }: Props) {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [region, setRegion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(EMPTY_TOUCHED);
  const [focusedField, setFocusedField] = useState<keyof typeof EMPTY_TOUCHED | null>(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const isWideForm = width >= 760;
  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    if (auth.currentUser) {
      signOut(auth).catch(() => {});
    }
  }, []);

  const markTouched = (field: keyof typeof EMPTY_TOUCHED) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const markAllTouched = () => {
    setTouched({
      empresa: true,
      email: true,
      password: true,
      telefono: true,
      region: true,
      ciudad: true,
      direccion: true,
    });
  };

  const empresaTrim = empresa.trim();
  const emailTrim = email.trim().toLowerCase();
  const passwordTrim = password.trim();
  const telefonoTrim = telefono.trim();
  const regionTrim = region.trim();
  const ciudadTrim = ciudad.trim();
  const direccionTrim = direccion.trim();

  const emailValido = EMAIL_REGEX.test(emailTrim);
  const passwordHasLetter = /[A-Za-z]/.test(passwordTrim);
  const passwordHasNumber = /\d/.test(passwordTrim);
  const passwordValida = passwordTrim.length >= 8 && passwordHasLetter && passwordHasNumber;

  const fieldErrors = {
    empresa: empresaTrim ? "" : "Ingresa el nombre de la empresa.",
    email: !emailTrim ? "Ingresa un correo electrónico." : emailValido ? "" : "Ingresa un correo valido.",
    password: !passwordTrim
      ? "Ingresa una contraseña."
      : passwordValida
      ? ""
      : "Usa al menos 8 caracteres con letras y numeros.",
    telefono: telefonoTrim ? "" : "Ingresa un teléfono.",
    region: regionTrim ? "" : "Selecciona una región.",
    ciudad: ciudadTrim ? "" : "Ingresa una comuna.",
    direccion: direccionTrim ? "" : "Ingresa una dirección.",
  };

  const isValid = Object.values(fieldErrors).every((value) => !value);
  const hasTouchedField = Object.values(touched).some(Boolean);
  const passwordHint = !passwordTrim
    ? ""
    : fieldErrors.password
    ? "Usa al menos 8 caracteres con letras y numeros."
    : "Contraseña fuerte.";

  const handleRegister = async () => {
    if (!isValid) {
      markAllTouched();
      setError("Revisa los campos marcados para continuar.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      auth.languageCode = "es";
      const userCredential = await createUserWithEmailAndPassword(auth, emailTrim, passwordTrim);
      const user = userCredential.user;
      const walletClassId = resolveWalletClassIdFromName(empresaTrim, user.uid);

      try {
        await sendEmailVerification(user);
      } catch (verificationError) {
        console.warn("No se pudo enviar verificacion de correo:", verificationError);
      }

      const now = new Date();
      const expira = new Date(now.getTime());
      expira.setDate(expira.getDate() + 14);

      await setDoc(doc(db, "Empresas", user.uid), {
        uid: user.uid,
        nombre: empresaTrim,
        Mail: emailTrim,
        telefono: telefonoTrim,
        region: regionTrim,
        ciudad: ciudadTrim,
        Direccion: direccionTrim,
        Descripcion: "",
        ColorPrincipal: "#A99985",
        LinkRegistro: buildRegistrationUrl(user.uid),
        Activo: true,
        FechaRegistro: now,
        plan: PLAN.FREE,
        estadoSuscripcion: ESTADO_SUSCRIPCION.PRUEBA,
        expiraEl: Timestamp.fromDate(expira),
        walletConfigurado: false,
        estadoWallet: ESTADO_WALLET.PENDIENTE,
        colorWallet: "#A99985",
        visitasPorPremio: 6,
        urlIconoWallet: "",
        paqueteSellosWallet: "generico1",
        "wallet-class-id": walletClassId,
      });
    } catch (err: any) {
      console.error("Error al registrar empresa:", err);
      if (err?.code === "auth/email-already-in-use") {
        setError("Este correo ya se encuentra registrado. Intenta con otro o inicia sesión.");
      } else {
        setError(err.message || "No se pudo registrar.");
      }
    } finally {
      setLoading(false);
    }
  };

  const rowStyle = isWideForm ? authStyles.row : { gap: 16 };
  const inlineErrorStyle = authStyles.warningText;

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
                maxWidth: 760,
                paddingHorizontal: isCompact ? 20 : 30,
                paddingVertical: isCompact ? 24 : 30,
                borderRadius: isCompact ? 24 : 28,
              },
            ]}
          >
            <View style={authStyles.headerBlock}>
              <Text style={[authStyles.title, { fontSize: isCompact ? 18 : 22 }]}>
                Registrar empresa
              </Text>
              <Text style={authStyles.subtitle}>
                Crea tu cuenta, configura tu empresa y comienza a usar Passio.
              </Text>
            </View>

            <View style={authStyles.formBlock}>
              <View style={authStyles.fieldBlock}>
                <Text style={authStyles.label}>Nombre de la empresa</Text>
                <View
                  style={[
                    authStyles.inputShell,
                    focusedField === "empresa" && authStyles.inputShellFocused,
                  ]}
                >
                  <Ionicons
                    name="business-outline"
                    size={20}
                    color="#A5B3BE"
                    style={authStyles.inputIcon}
                  />
                  <TextInput
                    style={[authStyles.input, AUTH_WEB_INPUT_RESET]}
                    placeholder="Nombre de la empresa"
                    value={empresa}
                    placeholderTextColor="#A5B3BE"
                    onChangeText={(value) => {
                      setEmpresa(value);
                      setError("");
                      markTouched("empresa");
                    }}
                    onBlur={() => {
                      markTouched("empresa");
                      setFocusedField((prev) => (prev === "empresa" ? null : prev));
                    }}
                    onFocus={() => setFocusedField("empresa")}
                    returnKeyType="done"
                    autoCapitalize="words"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                  />
                </View>
                {touched.empresa && fieldErrors.empresa ? (
                  <Text style={inlineErrorStyle}>{fieldErrors.empresa}</Text>
                ) : null}
              </View>

              <View style={authStyles.fieldBlock}>
                <Text style={authStyles.label}>Correo electrónico</Text>
                <View
                  style={[
                    authStyles.inputShell,
                    focusedField === "email" && authStyles.inputShellFocused,
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
                    value={email}
                    placeholderTextColor="#A5B3BE"
                    onChangeText={(value) => {
                      setEmail(value);
                      setError("");
                      markTouched("email");
                    }}
                    onBlur={() => {
                      markTouched("email");
                      setFocusedField((prev) => (prev === "email" ? null : prev));
                    }}
                    onFocus={() => setFocusedField("email")}
                    keyboardType="email-address"
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    underlineColorAndroid="transparent"
                  />
                </View>
                {touched.email && fieldErrors.email ? (
                  <Text style={inlineErrorStyle}>{fieldErrors.email}</Text>
                ) : null}
              </View>

              <View style={authStyles.fieldBlock}>
                <Text style={authStyles.label}>Contraseña</Text>
                <View
                  style={[
                    authStyles.inputShell,
                    focusedField === "password" && authStyles.inputShellFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#A5B3BE"
                    style={authStyles.inputIcon}
                  />
                  <TextInput
                    style={[authStyles.input, AUTH_WEB_INPUT_RESET]}
                    placeholder="........"
                    secureTextEntry={!showPassword}
                    value={password}
                    placeholderTextColor="#A5B3BE"
                    onChangeText={(value) => {
                      setPassword(value);
                      setError("");
                      markTouched("password");
                    }}
                    onBlur={() => {
                      markTouched("password");
                      setFocusedField((prev) => (prev === "password" ? null : prev));
                    }}
                    onFocus={() => setFocusedField("password")}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={authStyles.visibilityButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#7D8F9A"
                    />
                  </TouchableOpacity>
                </View>
                {passwordHint ? (
                  <Text
                    style={
                      fieldErrors.password ? authStyles.warningText : authStyles.successText
                    }
                  >
                    {passwordHint}
                  </Text>
                ) : null}
              </View>

              <View style={rowStyle as any}>
                <View style={authStyles.rowItem}>
                  <View style={authStyles.fieldBlock}>
                    <Text style={authStyles.label}>Teléfono</Text>
                    <View
                      style={[
                        authStyles.inputShell,
                        focusedField === "telefono" && authStyles.inputShellFocused,
                      ]}
                    >
                      <Ionicons
                        name="call-outline"
                        size={20}
                        color="#A5B3BE"
                        style={authStyles.inputIcon}
                      />
                      <TextInput
                        style={[authStyles.input, AUTH_WEB_INPUT_RESET]}
                        placeholder="9 123456789"
                        placeholderTextColor="#A5B3BE"
                        value={telefono}
                        onChangeText={(value) => {
                          const digits = value.replace(/\D/g, "");
                          setTelefono(digits.slice(0, 15));
                          setError("");
                          markTouched("telefono");
                        }}
                        onBlur={() => {
                          markTouched("telefono");
                          setFocusedField((prev) => (prev === "telefono" ? null : prev));
                        }}
                        onFocus={() => setFocusedField("telefono")}
                        keyboardType="phone-pad"
                        returnKeyType="done"
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={15}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                    {touched.telefono && fieldErrors.telefono ? (
                      <Text style={inlineErrorStyle}>{fieldErrors.telefono}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={authStyles.rowItem}>
                  <View style={authStyles.fieldBlock}>
                    <Text style={authStyles.label}>Región</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowRegionPicker(true);
                        markTouched("region");
                      }}
                      style={authStyles.inputShell}
                    >
                      <Ionicons
                        name="map-outline"
                        size={20}
                        color="#A5B3BE"
                        style={authStyles.inputIcon}
                      />
                      <Text style={[authStyles.input, { color: region ? "#102A43" : "#A5B3BE", paddingVertical: 0 }]}>
                        {region || "Selecciona región"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#7D8F9A" />
                    </TouchableOpacity>
                    {touched.region && fieldErrors.region ? (
                      <Text style={inlineErrorStyle}>{fieldErrors.region}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={rowStyle as any}>
                <View style={authStyles.rowItem}>
                  <View style={authStyles.fieldBlock}>
                    <Text style={authStyles.label}>Comuna</Text>
                    <View
                      style={[
                        authStyles.inputShell,
                        focusedField === "ciudad" && authStyles.inputShellFocused,
                      ]}
                    >
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#A5B3BE"
                        style={authStyles.inputIcon}
                      />
                      <TextInput
                        style={[authStyles.input, AUTH_WEB_INPUT_RESET]}
                        placeholder="Comuna"
                        value={ciudad}
                        placeholderTextColor="#A5B3BE"
                        onChangeText={(value) => {
                          setCiudad(value);
                          setError("");
                          markTouched("ciudad");
                        }}
                        onBlur={() => {
                          markTouched("ciudad");
                          setFocusedField((prev) => (prev === "ciudad" ? null : prev));
                        }}
                        onFocus={() => setFocusedField("ciudad")}
                        returnKeyType="done"
                        autoCapitalize="words"
                        autoCorrect={false}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                    {touched.ciudad && fieldErrors.ciudad ? (
                      <Text style={inlineErrorStyle}>{fieldErrors.ciudad}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={authStyles.rowItem}>
                  <View style={authStyles.fieldBlock}>
                    <Text style={authStyles.label}>Dirección</Text>
                    <View
                      style={[
                        authStyles.inputShell,
                        focusedField === "direccion" && authStyles.inputShellFocused,
                      ]}
                    >
                      <Ionicons
                        name="home-outline"
                        size={20}
                        color="#A5B3BE"
                        style={authStyles.inputIcon}
                      />
                      <TextInput
                        style={[authStyles.input, AUTH_WEB_INPUT_RESET]}
                        placeholder="Dirección"
                        value={direccion}
                        placeholderTextColor="#A5B3BE"
                        onChangeText={(value) => {
                          setDireccion(value);
                          setError("");
                          markTouched("direccion");
                        }}
                        onBlur={() => {
                          markTouched("direccion");
                          setFocusedField((prev) => (prev === "direccion" ? null : prev));
                        }}
                        onFocus={() => setFocusedField("direccion")}
                        returnKeyType="done"
                        autoCapitalize="sentences"
                        autoCorrect={false}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                    {touched.direccion && fieldErrors.direccion ? (
                      <Text style={inlineErrorStyle}>{fieldErrors.direccion}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {hasTouchedField && !isValid ? (
                <Text style={authStyles.errorText}>Revisa los campos marcados para continuar.</Text>
              ) : null}

              <TouchableOpacity
                style={[authStyles.primaryButton, (!isValid || loading) && authStyles.buttonDisabled]}
                onPress={handleRegister}
                disabled={!isValid || loading}
              >
                <Text style={authStyles.primaryButtonText}>
                  {loading ? "Registrando..." : "Registrar empresa"}
                </Text>
                <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

              <View style={authStyles.dividerRow}>
                <View style={authStyles.dividerLine} />
                <Text style={authStyles.dividerText}>o</Text>
                <View style={authStyles.dividerLine} />
              </View>

              <TouchableOpacity
                style={authStyles.secondaryButton}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={authStyles.secondaryButtonText}>Ya tengo cuenta</Text>
                <Ionicons name="log-in-outline" size={20} color="#6C4B00" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={authStyles.footer}>© {year} Passio. Todos los derechos reservados.</Text>
        </ScrollView>

        <Modal visible={showRegionPicker} transparent animationType="fade">
          <View style={authStyles.modalBackdrop}>
            <View style={authStyles.modalCard}>
              <Text style={authStyles.modalTitle}>Selecciona tu región</Text>
              <RNScrollView>
                {REGIONES_CHILE.map((regionItem) => (
                  <TouchableOpacity
                    key={regionItem}
                    onPress={() => {
                      setRegion(regionItem);
                      setError("");
                      markTouched("region");
                      setShowRegionPicker(false);
                    }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#EEF3F6",
                    }}
                  >
                    <Text style={{ color: "#102A43" }}>{regionItem}</Text>
                  </TouchableOpacity>
                ))}
              </RNScrollView>
              <TouchableOpacity
                onPress={() => setShowRegionPicker(false)}
                style={[authStyles.ghostButton, { marginTop: 16 }]}
              >
                <Text style={authStyles.ghostButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
