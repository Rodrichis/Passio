import React, { useState } from "react";
import { View, TextInput, Text, ScrollView, TouchableOpacity } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { globalStyles } from "../styles/theme";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError(""); // Limpia errores previos
      await signInWithEmailAndPassword(auth, email, password);
      navigation.replace("Dashboard");
    } catch {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <ScrollView contentContainerStyle={globalStyles.scrollContainer}>
      <View style={globalStyles.container}>
        <Text style={globalStyles.header}>Passio</Text>

        <View style={globalStyles.card}>
          <Text style={globalStyles.title}>Login Empresa</Text>

          <TextInput
            style={globalStyles.input}
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            returnKeyType="done"
            autoCapitalize="none"   //Desactiva mayúsculas automáticas
            autoCorrect={false}     //Desactiva autocorrección
            onSubmitEditing={handleLogin} // 🔹 Enter hace login
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            autoCapitalize="none"   //Desactiva mayúsculas automáticas
            autoCorrect={false}     //Desactiva autocorrección
            onSubmitEditing={handleLogin} // 🔹 Enter hace login
          />

          {/* 🔹 Mensaje de error justo debajo del formulario */}
          {error ? <Text style={globalStyles.error}>{error}</Text> : null}

          <TouchableOpacity style={globalStyles.primaryButton} onPress={handleLogin}>
            <Text style={globalStyles.buttonText}>Iniciar sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={globalStyles.secondaryButton}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={globalStyles.buttonTextSecondary}>Registrar nueva empresa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
