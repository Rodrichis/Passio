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
  "O’Higgins",
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
  const [direccion, setDireccion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

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
    const direccionTrim = direccion.trim();

    if (!empresaTrim || !emailTrim || !passwordTrim || !telefonoTrim || !regionTrim || !ciudadTrim || !direccionTrim) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
      setError("Correo invalido.");
      return;
    }

    if (passwordTrim.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
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
        console.warn("No se pudo enviar verificacion de correo:", e);
      }

      await setDoc(doc(db, "Empresas", user.uid), {
        uid: user.uid,
        nombre: empresaTrim,
        Mail: emailTrim,
        telefono: telefonoTrim,
        region: regionTrim,
        ciudad: ciudadTrim,
        direccion: direccionTrim,
        Descripcion: "",
        ColorPrincipal: "#A99985",
        LinkRegistro: `https://passio.cl/register/${user.uid}`,
        Activo: true,
        FechaRegistro: new Date(),
      });

      // La navegacion depende de onAuthStateChanged en App.tsx
    } catch (err: any) {
      console.error("Error al registrar empresa:", err);
      setError(err.message || "No se pudo registrar.");
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    empresa.trim().length > 0 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim().toLowerCase()) &&
    password.trim().length >= 6 &&
    telefono.trim().length > 0 &&
    region.trim().length > 0 &&
    ciudad.trim().length > 0 &&
    direccion.trim().length > 0;

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
            onChangeText={setEmpresa}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Correo electronico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Contrasena"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={globalStyles.input}
                placeholder="Telefono"
                value={telefono}
                onChangeText={(v) => setTelefono(v.slice(0, 15))}
                keyboardType="phone-pad"
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
              />
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
                placeholder="Ciudad"
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
                placeholder="Direccion"
                value={direccion}
                onChangeText={setDireccion}
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
