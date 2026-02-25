import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { auth, db } from "../../../services/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { dashboardStyles as styles } from "../../../styles/DashboardStyles";
import { APP_BASE_URL } from "@env";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Dashboard">;
};

type PlanInfo = {
  nombrePlan?: string;
  limiteUsuarios?: number;
  limiteNotificacion?: number;
  limiteCorreo?: number;
  precio?: number;
};

export default function DashboardContentAjustes({ navigation }: Props) {
  const [empresa, setEmpresa] = useState<any>(null);
  const [planData, setPlanData] = useState<PlanInfo | null>(null);
  const [contadores, setContadores] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = auth.currentUser?.uid;
  const baseURL = APP_BASE_URL || "http://localhost:8081";
  const registroURL = `${baseURL}/register/${uid}`;

  useEffect(() => {
    const fetchEmpresa = async () => {
      try {
        if (!uid) return;
        const ref = doc(db, "Empresas", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setEmpresa(data);

          // Traer límites del plan (colección Planes) para mostrarlos
          if (data?.plan) {
            const q = query(
              collection(db, "Planes"),
              where("nombrePlan", "==", data.plan)
            );
            const res = await getDocs(q);
            const first = res.docs[0];
            if (first) {
              setPlanData(first.data() as PlanInfo);
            } else {
              // Fallback: buscar insensible a mayúsculas si el nombre no matchea exacto
              const all = await getDocs(collection(db, "Planes"));
              const lower = String(data.plan || "").toLowerCase();
              const match = all.docs.find(
                (d) => String(d.data().nombrePlan || "").toLowerCase() === lower
              );
              if (match) setPlanData(match.data() as PlanInfo);
            }
          }

          // Traer contadores de la empresa (colección "Contador")
          try {
            const contColl = await getDocs(collection(db, "Empresas", uid, "Contador"));
            const first = contColl.docs[0];
            if (first) {
              setContadores(first.data());
            }
          } catch (e) {
            console.log("No se pudo leer contadores:", e);
          }
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
        { merge: true }
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

  const planInfo: PlanInfo = {
    nombrePlan: planData?.nombrePlan || empresa?.plan,
    limiteUsuarios: planData?.limiteUsuarios ?? empresa?.limiteUsuarios,
    limiteNotificacion: planData?.limiteNotificacion ?? empresa?.limiteNotificacion,
    limiteCorreo: planData?.limiteCorreo ?? empresa?.limiteCorreo,
    precio: planData?.precio ?? empresa?.precio,
  };

  const usados = {
    usuarios: contadores?.totalUsuarios ?? 0,
    notificaciones: contadores?.notificacionesMes ?? 0,
    correos: contadores?.correosMes ?? 0,
  };

  return (
    <ScrollView style={{ paddingHorizontal: 10 }}>
      <Text style={styles.sectionTitle}>Ajustes de Empresa</Text>

      {/* Plan actual */}
      <View
        style={{
          borderWidth: 1,
          borderColor: "#e0e0e0",
          borderRadius: 10,
          padding: 12,
          backgroundColor: "#f7f9fb",
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0d47a1" }}>
              Plan actual: {planInfo?.nombrePlan || "No definido"}
            </Text>
          </View>
          <TouchableOpacity
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: "#2196F3",
            }}
            onPress={() => alert("Próximamente podrás mejorar tu plan")}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Mejorar plan</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={{ color: "#455a64" }}>
            Usuarios: {usados.usuarios} / {planInfo.limiteUsuarios ?? "-"}
          </Text>
          <Text style={{ color: "#455a64" }}>
            Notificaciones (mes): {usados.notificaciones} / {planInfo.limiteNotificacion ?? "-"}
          </Text>
          <Text style={{ color: "#455a64" }}>
            Correos (mes): {usados.correos} / {planInfo.limiteCorreo ?? "-"}
          </Text>
          {!planData && (
            <Text style={{ color: "#b71c1c", fontSize: 12 }}>
              No pudimos leer los límites del plan. Revisa la colección "Planes" y los permisos de lectura.
            </Text>
          )}
        </View>
      </View>

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
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Abrir en navegador</Text>
          </TouchableOpacity>

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
        <Text style={styles.logoutText}>{saving ? "Guardando..." : "Guardar cambios"}</Text>
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
