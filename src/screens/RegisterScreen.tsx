import React, { useState } from "react";
import { View, TextInput, Text, ScrollView, TouchableOpacity } from "react-native";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
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

export default function RegisterScreen({ navigation }: Props) {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const empresaTrim = empresa.trim();
    const emailTrim = email.trim().toLowerCase();
    const passwordTrim = password.trim();

    if (!empresaTrim || !emailTrim || !passwordTrim) {
      setError("Por favor completa todos los campos.");
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
      setError("Correo inválido.");
      return;
    }

    if (passwordTrim.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
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
        telefono: "",
        Descripcion: "",
        ColorPrincipal: "#A99985",
        LinkRegistro: `https://passio.cl/register/${user.uid}`,
        Activo: true,
        FechaRegistro: new Date(),
      });

      // La navegación depende de onAuthStateChanged en App.tsx
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
    password.trim().length >= 6;

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
            placeholder="Correo electrónico"
            value={email}
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
            onChangeText={setPassword}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />

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
    </ScrollView>
  );
}
