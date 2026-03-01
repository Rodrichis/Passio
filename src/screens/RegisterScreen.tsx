import React, { useState, useEffect } from "react";
import { View, TextInput, Text, ScrollView, TouchableOpacity, Modal, ScrollView as RNScrollView } from "react-native";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { globalStyles } from "../styles/theme";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  VerifyEmail: { email?: string };
};

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

export default function RegisterScreen({ navigation }: Props) {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [region, setRegion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [Dirección, setDirección] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [passwordHint, setPasswordHint] = useState("");

  // Asegura que al entrar a registro no quedes logueado con otra cuenta previa
  useEffect(() => {
    if (auth.currentUser) {
      signOut(auth).catch(() => {});
    }
  }, []);

  const handleRegister = async () => {
    const empresaTrim = empresa.trim();
    const emailTrim = email.trim().toLowerCase();
    const passwordTrim = password.trim();
    const telefonoTrim = telefono.trim();
    const regionTrim = region.trim();
    const ciudadTrim = ciudad.trim();
    const DirecciónTrim = Dirección.trim();

    if (!empresaTrim || !emailTrim || !passwordTrim || !telefonoTrim || !regionTrim || !ciudadTrim || !DirecciónTrim) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
      setError("Correo inválido.");
      return;
    }

    const hasLetter = /[A-Za-z]/.test(passwordTrim);
    const hasNumber = /\d/.test(passwordTrim);
    if (passwordTrim.length < 8 || !hasLetter || !hasNumber) {
      setError("La Contraseña debe tener al menos 8 caracteres e incluir letras y números.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      auth.languageCode = "es";
      const userCredential = await createUserWithEmailAndPassword(auth, emailTrim, passwordTrim);
      const user = userCredential.user;

      try {
        await sendEmailVerification(user);
      } catch (e) {
        console.warn("No se pudo enviar verificación de correo:", e);
      }

      await setDoc(doc(db, "Empresas", user.uid), {
        uid: user.uid,
        nombre: empresaTrim,
        Mail: emailTrim,
        telefono: telefonoTrim,
        region: regionTrim,
        ciudad: ciudadTrim,
        Dirección: DirecciónTrim,
        Descripcion: "",
        ColorPrincipal: "#A99985",
        LinkRegistro: `https://passio.cl/register/${user.uid}`,
        Activo: true,
        FechaRegistro: new Date(),
      });

      // La navegacion depende de onAuthStateChanged en App.tsx
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

  const isValid =
    empresa.trim().length > 0 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase()) &&
    password.trim().length >= 8 &&
    /[A-Za-z]/.test(password.trim()) &&
    /\d/.test(password.trim()) &&
    telefono.trim().length > 0 &&
    region.trim().length > 0 &&
    ciudad.trim().length > 0 &&
    Dirección.trim().length > 0;

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
            onChangeText={setEmpresa}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Correo electrónico"
            value={email}
            placeholderTextColor="#607d8b"
            onChangeText={setEmail}
            keyboardType="email-address"
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            placeholderTextColor="#607d8b"
            onChangeText={(v) => {
              setPassword(v);
              const hasLetter = /[A-Za-z]/.test(v);
              const hasNumber = /\d/.test(v);
              if (v.length === 0) {
                setPasswordHint("");
              } else if (v.length < 8 || !hasLetter || !hasNumber) {
                setPasswordHint("Usa al menos 8 caracteres con letras y números.");
              } else {
                setPasswordHint("ContraseÃ±a fuerte.");
              }
            }}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {passwordHint ? (
            <Text style={{ marginTop: -8, marginBottom: 10, color: passwordHint.includes("fuerte") ? "#2e7d32" : "#fb8500" }}>
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
                  placeholder=""
                  value={telefono}
                  onChangeText={(v) => {
                    const digits = v.replace(/\D/g, "");
                    setTelefono(digits.slice(0, 15));
                  }}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={15}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => setShowRegionPicker(true)}
                style={[
                  globalStyles.input,
                  { justifyContent: "center", paddingVertical: 12 },
                ]}
              >
                <Text style={{ color: region ? "#000" : "#777" }}>
                  {region || "Selecciona región"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={globalStyles.input}
                placeholder="Comuna"
                value={ciudad}
                onChangeText={setCiudad}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                style={globalStyles.input}
                placeholder="Dirección"
                value={Dirección}
                onChangeText={setDirección}
                returnKeyType="done"
                autoCapitalize="sentences"
                autoCorrect={false}
              />
            </View>
          </View>

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
              {REGIONES_CHILE.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => {
                    setRegion(r);
                    setShowRegionPicker(false);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "#eee",
                  }}
                >
                  <Text style={{ color: "#023047" }}>{r}</Text>
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



