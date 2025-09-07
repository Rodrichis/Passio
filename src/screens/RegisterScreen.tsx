import React, { useState } from "react";
import { View, TextInput, Text, ScrollView, TouchableOpacity } from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig"; // 🔹 Firebase clásico
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { globalStyles } from "../styles/theme";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    try {
      setError(""); // 🔹 Limpia errores previos
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "empresas", userCredential.user.uid), {
        empresa,
        email,
        createdAt: new Date(),
      });
      navigation.replace("Dashboard");
    } catch (err: any) {
      setError(err.message);
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
            onChangeText={setEmpresa}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleRegister}
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
            onSubmitEditing={handleRegister}
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
            onSubmitEditing={handleRegister}
          />

          <TouchableOpacity style={globalStyles.primaryButton} onPress={handleRegister}>
            <Text style={globalStyles.buttonText}>Registrar</Text>
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
