import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../services/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Platform, Linking } from "react-native";
import { APP_BASE_URL } from "@env";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Dashboard">;
};

export default function DashboardContentAjustes({ navigation }: Props) {
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = auth.currentUser?.uid;
  const baseURL = APP_BASE_URL || "http://localhost:8081"; // link de registro local o .env

  const registroURL = `${baseURL}/register/${uid}`;

  // Cargar información de la empresa desde Firestore
  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        if (!uid) return;
        const ref = doc(db, "Empresas", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setEmpresa(snap.data());
        } else {
          console.warn("No se encontró información de la empresa");
        }
      } catch (err) {
        console.error("Error al cargar empresa:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [uid]);

  // Guardar cambios en Firestore
  const handleSave = async () => {
    if (!uid || !empresa) return;
    setSaving(true);
    try {
      const ref = doc(db, "Empresas", uid);
      await setDoc(
        ref,
        {
          nombre: empresa.nombre || "",
          Descripcion: empresa.Descripcion || "",
          telefono: empresa.telefono || "",
        },
        { merge: true } // asegura que actualice sin borrar nada
      );
      alert("Cambios guardados correctamente");
      console.log("Empresa actualizada:", empresa);
    } catch (err: any) {
      console.error("Error al guardar cambios:", err);
      alert("No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace("Login");
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  if (loading) {
    return (
      <View style={{ marginTop: 20, alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8ecae6" />
        <Text>Cargando información...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ paddingHorizontal: 10 }}>
      <Text style={styles.sectionTitle}>Ajustes de Empresa</Text>

      <Text style={styles.sectionTitle}>Link de registro</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e0e0e0",
          borderRadius: 8,
          padding: 12,
          backgroundColor: "#fff",
          marginBottom: 16,
        }}
      >
        <Text selectable style={{ color: "#333", marginBottom: 10 }}>
          {registroURL}
        </Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => Linking.openURL(registroURL)}
            style={{
              backgroundColor: "#2196F3",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              Abrir en navegador
            </Text>
          </TouchableOpacity>

          {/* Copiar solo en web (sin instalar libs) */}
          {Platform.OS === "web" &&
            typeof navigator !== "undefined" &&
            (navigator as any).clipboard && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await (navigator as any).clipboard.writeText(registroURL);
                    alert("Link copiado");
                  } catch (e) {
                    console.log(e);
                  }
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#2196F3",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: "#E3F2FD",
                }}
              >
                <Text style={{ color: "#0D47A1", fontWeight: "bold" }}>Copiar</Text>
              </TouchableOpacity>
            )}
        </View>
      </View>

      {/* Nombre + Teléfono en una fila */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 0.6, marginRight: 8 }}>
          <Text style={styles.label}>
            Nombre empresa{" "}
            <Text style={{ color: "#607d8b", fontSize: 12 }}>
              (aparecerá en el formulario de registro de clientes)
            </Text>
          </Text>
          <TextInput
            style={styles.input}
            value={empresa?.nombre || ""}
            onChangeText={(t) => setEmpresa({ ...empresa, nombre: t })}
          />
        </View>

        <View style={{ flex: 0.4 }}>
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={empresa?.telefono || ""}
            onChangeText={(t) => setEmpresa({ ...empresa, telefono: t })}
            placeholder="+56 9 ..."
          />
        </View>
      </View>

      {/* Descripción con textarea */}
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: "top" }]}
        multiline
        numberOfLines={4}
        value={empresa?.Descripcion || ""}
        onChangeText={(t) => setEmpresa({ ...empresa, Descripcion: t })}
        placeholder="Describe brevemente tu empresa..."
      />

      {/* Botón guardar */}
      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 20 }} />

      {/* Logout */}
      <TouchableOpacity style={styles.smallLogoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
