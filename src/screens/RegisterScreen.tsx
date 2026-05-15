import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  ScrollView as RNScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ESTADO_SUSCRIPCION, ESTADO_WALLET, PLAN } from "../constants/empresa";
import { auth, db } from "../services/firebaseConfig";
import { globalStyles } from "../styles/theme";
import { RootStackParamList } from "../types/navigation";
import { buildRegistrationUrl } from "../utils/publicUrls";
import { resolveWalletClassIdFromName } from "../utils/walletOnboarding/walletClassId";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
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
  const [touched, setTouched] = useState(EMPTY_TOUCHED);

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
    email: !emailTrim ? "Ingresa un correo electrónico." : emailValido ? "" : "Ingresa un correo válido.",
    password: !passwordTrim
      ? "Ingresa una contraseña."
      : passwordValida
      ? ""
      : "Usa al menos 8 caracteres con letras y números.",
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
    ? "Usa al menos 8 caracteres con letras y números."
    : "Contraseña fuerte.";
  const passwordHintColor = fieldErrors.password ? "#fb8500" : "#2e7d32";
  const inlineErrorStyle = { marginTop: -10, marginBottom: 10, color: "#fb8500" };

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
        console.warn("No se pudo enviar verificación de correo:", verificationError);
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
        Dirección: direccionTrim,
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

      // La navegación depende de onAuthStateChanged en App.tsx
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

  return (
    <ScrollView contentContainerStyle={globalStyles.scrollContainer}>
      <View style={globalStyles.container}>
        <Text style={globalStyles.header}>Passio</Text>

        <View style={globalStyles.card}>
          <Text style={globalStyles.title}>Registrar empresa</Text>

          <TextInput
            style={globalStyles.input}
            placeholder="Nombre de la empresa"
            value={empresa}
            placeholderTextColor="#607d8b"
            onChangeText={(value) => {
              setEmpresa(value);
              setError("");
              markTouched("empresa");
            }}
            onBlur={() => markTouched("empresa")}
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
          />
          {touched.empresa && fieldErrors.empresa ? <Text style={inlineErrorStyle}>{fieldErrors.empresa}</Text> : null}

          <TextInput
            style={globalStyles.input}
            placeholder="Correo electrónico"
            value={email}
            placeholderTextColor="#607d8b"
            onChangeText={(value) => {
              setEmail(value);
              setError("");
              markTouched("email");
            }}
            onBlur={() => markTouched("email")}
            keyboardType="email-address"
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {touched.email && fieldErrors.email ? <Text style={inlineErrorStyle}>{fieldErrors.email}</Text> : null}

          <TextInput
            style={globalStyles.input}
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            placeholderTextColor="#607d8b"
            onChangeText={(value) => {
              setPassword(value);
              setError("");
              markTouched("password");
            }}
            onBlur={() => markTouched("password")}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {passwordHint ? (
            <Text style={{ marginTop: -8, marginBottom: 10, color: passwordHintColor }}>
              {passwordHint}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  globalStyles.input,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 12,
                  },
                ]}
              >
                <Text style={{ color: "#555", marginRight: 6 }}>+56</Text>
                <TextInput
                  style={{ flex: 1, paddingVertical: 0, paddingHorizontal: 0, outlineStyle: "none" as any }}
                  placeholder="Teléfono"
                  placeholderTextColor="#607d8b"
                  value={telefono}
                  onChangeText={(value) => {
                    const digits = value.replace(/\D/g, "");
                    setTelefono(digits.slice(0, 15));
                    setError("");
                    markTouched("telefono");
                  }}
                  onBlur={() => markTouched("telefono")}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={15}
                />
              </View>
              {touched.telefono && fieldErrors.telefono ? <Text style={inlineErrorStyle}>{fieldErrors.telefono}</Text> : null}
            </View>

            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowRegionPicker(true);
                  markTouched("region");
                }}
                style={[
                  globalStyles.input,
                  { justifyContent: "center", paddingVertical: 12 },
                ]}
              >
                <Text style={{ color: region ? "#000" : "#777" }}>
                  {region || "Selecciona región"}
                </Text>
              </TouchableOpacity>
              {touched.region && fieldErrors.region ? <Text style={inlineErrorStyle}>{fieldErrors.region}</Text> : null}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={globalStyles.input}
                placeholder="Comuna"
                value={ciudad}
                placeholderTextColor="#607d8b"
                onChangeText={(value) => {
                  setCiudad(value);
                  setError("");
                  markTouched("ciudad");
                }}
                onBlur={() => markTouched("ciudad")}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
              />
              {touched.ciudad && fieldErrors.ciudad ? <Text style={inlineErrorStyle}>{fieldErrors.ciudad}</Text> : null}
            </View>

            <View style={{ flex: 1 }}>
              <TextInput
                style={globalStyles.input}
                placeholder="Dirección"
                value={direccion}
                placeholderTextColor="#607d8b"
                onChangeText={(value) => {
                  setDireccion(value);
                  setError("");
                  markTouched("direccion");
                }}
                onBlur={() => markTouched("direccion")}
                returnKeyType="done"
                autoCapitalize="sentences"
                autoCorrect={false}
              />
              {touched.direccion && fieldErrors.direccion ? <Text style={inlineErrorStyle}>{fieldErrors.direccion}</Text> : null}
            </View>
          </View>

          {hasTouchedField && !isValid ? (
            <Text style={[globalStyles.error, { marginTop: -4 }]}>
              Revisa los campos marcados para continuar.
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              globalStyles.primaryButton,
              (!isValid || loading) && { opacity: 0.6 },
            ]}
            onPress={handleRegister}
            disabled={!isValid || loading}
          >
            <Text style={globalStyles.buttonText}>
              {loading ? "Registrando..." : "Registrar"}
            </Text>
          </TouchableOpacity>

          {error ? <Text style={globalStyles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={globalStyles.secondaryButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={globalStyles.buttonTextSecondary}>Ya tengo cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showRegionPicker} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              width: "100%",
              maxWidth: 380,
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 10 }}>
              Selecciona tu región
            </Text>
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
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "#eee",
                  }}
                >
                  <Text style={{ color: "#023047" }}>{regionItem}</Text>
                </TouchableOpacity>
              ))}
            </RNScrollView>
            <TouchableOpacity
              onPress={() => setShowRegionPicker(false)}
              style={{
                marginTop: 10,
                alignSelf: "flex-end",
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: "#023047" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
