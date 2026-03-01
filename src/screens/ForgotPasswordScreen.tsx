import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { globalStyles } from "../styles/theme";
import RootStackParamList from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);

  const handleReset = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrim)) {
      setError("Ingresa un correo válido.");
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

  return (
    <ScrollView contentContainerStyle={globalStyles.scrollContainer}>
      <View style={globalStyles.container}>
        <Text style={globalStyles.header}>Passio</Text>

        <View style={globalStyles.card}>
          <Text style={globalStyles.title}>Restablece tu contraseña</Text>

          <TextInput
            style={globalStyles.input}
            placeholder="Correo electrónico"
            value={email}
            placeholderTextColor="#607d8b"
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />

          {error ? <Text style={globalStyles.error}>{error}</Text> : null}
          {status ? <Text style={{ color: "#023047", marginBottom: 10 }}>{status}</Text> : null}

          <TouchableOpacity
            style={[
              globalStyles.primaryButton,
              cooldown > 0 && { opacity: 0.6 },
            ]}
            onPress={handleReset}
            disabled={cooldown > 0}
          >
            <Text style={globalStyles.buttonText}>
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Enviar link de restablecimiento"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={globalStyles.secondaryButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={globalStyles.buttonTextSecondary}>Volver a login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
