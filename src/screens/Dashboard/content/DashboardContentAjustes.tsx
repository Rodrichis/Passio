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
import ColorPicker from "react-native-color-picker-wheel";
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
  const [mostrarColorPicker, setMostrarColorPicker] = useState(false);

  const uid = auth.currentUser?.uid;
const baseURL =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : (APP_BASE_URL || "http://192.168.100.162:8082"); // ⬅️ pon tu IP:PUERTO en dev si no usas .env

const registroURL = `${baseURL}/register/${uid}`;

  // 🔹 Cargar información de la empresa desde Firestore
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

  // 🔹 Guardar cambios en Firestore
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
        ColorPrincipal: empresa.ColorPrincipal || "#A99985",
      },
      { merge: true } // 🔹 asegura que actualice sin borrar nada
    );
    alert("✅ Cambios guardados correctamente");
    console.log("✅ Empresa actualizada:", empresa);
  } catch (err: any) {
    console.error(" Error al guardar cambios:", err);
    alert("❌ No se pudo guardar. Intenta nuevamente.");
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
      {/* 🔗 Link de registro (dev/prod) */}
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


      {/* 🔹 Nombre + Teléfono en una fila */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 0.6, marginRight: 8 }}>
          <Text style={styles.label}>Nombre</Text>
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

      {/* 🔹 Descripción con textarea */}
      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: "top" }]}
        multiline
        numberOfLines={4}
        value={empresa?.Descripcion || ""}
        onChangeText={(t) => setEmpresa({ ...empresa, Descripcion: t })}
        placeholder="Describe brevemente tu empresa..."
      />

      {/* 🔹 Selector de color con input HEX */}
      <Text style={styles.label}>Color principal</Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 10,
          backgroundColor: "#fff",
          marginBottom: 10,
        }}
      >
        {/* Vista previa e input HEX */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => setMostrarColorPicker(!mostrarColorPicker)}
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                marginRight: 10,
                backgroundColor: empresa?.ColorPrincipal || "#A99985",
                borderWidth: 1,
                borderColor: "#999",
              }}
            />
            <Text style={{ fontWeight: "bold", color: "#333" }}>
              {empresa?.ColorPrincipal || "#A99985"}
            </Text>
          </TouchableOpacity>

          {/* Input manual HEX */}
          <TextInput
            style={[
              styles.input,
              {
                flex: 0.6,
                height: 40,
                marginLeft: 10,
                textAlign: "center",
              },
            ]}
            placeholder="#A99985"
            value={empresa?.ColorPrincipal || ""}
            onChangeText={(color) =>
              setEmpresa({ ...empresa, ColorPrincipal: color })
            }
            autoCapitalize="none"
          />
        </View>

        {/* Picker visual */}
        {/* Picker visual */}
{mostrarColorPicker && (
  <View style={{ height: 220 }}>
    <ColorPicker
      // 🔹 Usa "color" en vez de "initialColor"
      color={
        empresa?.ColorPrincipal && /^#[0-9A-Fa-f]{6}$/.test(empresa.ColorPrincipal)
          ? empresa.ColorPrincipal
          : "#000000"
      }
      onColorChange={(val: any) => {
        const hex =
          typeof val === "string" ? val : (val?.hex as string | undefined);
        if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
          // 🔹 Solo cambia el estado local (texto/preview)
          setEmpresa((prev: any) => ({ ...prev, ColorPrincipal: hex }));
        }
      }}
      style={{ flex: 1 }}
    />

    {/* 🔹 Texto que refleja el color en vivo */}
    <Text
      style={{
        textAlign: "center",
        marginTop: 10,
        fontWeight: "bold",
        color: empresa?.ColorPrincipal || "#333",
      }}
    >
      {empresa?.ColorPrincipal || ""}
    </Text>
  </View>
)}


      </View>

      {/* 🔹 Botón guardar */}
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

      {/* 🔹 Logout */}
      <TouchableOpacity style={styles.smallLogoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
