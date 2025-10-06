import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRoute } from "@react-navigation/native";
import { db } from "../services/firebaseConfig";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { globalStyles } from "../styles/theme";
import {RootStackParamList} from "../../src/types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterClient">;


export default function RegisterClientScreen({ route, navigation }: Props) {
  const { empresaId } = route.params ?? {}; 
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!empresaId) {
        console.error("empresaId no proporcionado");
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "empresas", empresaId);
        const snap = await getDoc(ref);
        if (snap.exists()) setEmpresa(snap.data());
        else console.warn("Empresa no encontrada");
      } catch (err) {
        console.error("Error al cargar empresa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [empresaId]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );

  if (!empresa)
    return (
      <View style={{ padding: 20 }}>
        <Text>Empresa no encontrada o enlace inválido.</Text>
      </View>
    );

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>
        Registro de Cliente - {empresa.nombre ?? "Empresa"}
      </Text>
      {/* Aquí irá el formulario */}
    </View>
  );
}