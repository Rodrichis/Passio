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
import {
  fetchOfferings,
  getCustomerInfoSafe,
  hasProEntitlement,
  presentRCPlaywall,
  openRevenueCatCustomerCenter,
  isRevenueCatAvailable,
  hasRevenueCatApiKey,
  isRevenueCatCustomerCenterAvailable,
} from "../../../services/revenuecat";
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
  const [upgrading, setUpgrading] = useState(false);

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

          if (data?.plan) {
            const q = query(collection(db, "Planes"), where("nombrePlan", "==", data.plan));
            const res = await getDocs(q);
            const first = res.docs[0];
            if (first) {
              setPlanData(first.data() as PlanInfo);
            } else {
              const all = await getDocs(collection(db, "Planes"));
              const lower = String(data.plan || "").toLowerCase();
              const match = all.docs.find(
                (d) => String(d.data().nombrePlan || "").toLowerCase() === lower
              );
              if (match) setPlanData(match.data() as PlanInfo);
            }
          }

          // Contadores (colección "Contador")
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

  const loadPlanDataByName = async (planName?: string) => {
    if (!planName) return;

    const q = query(collection(db, "Planes"), where("nombrePlan", "==", planName));
    const res = await getDocs(q);
    const first = res.docs[0];
    if (first) {
      setPlanData(first.data() as PlanInfo);
      return;
    }

    const all = await getDocs(collection(db, "Planes"));
    const lower = String(planName || "").toLowerCase();
    const match = all.docs.find(
      (d) => String(d.data().nombrePlan || "").toLowerCase() === lower
    );
    if (match) setPlanData(match.data() as PlanInfo);
  };

  const applyPlanState = async (hasPro: boolean) => {
    if (!uid) return;

    const nextPlan = hasPro ? "Pro" : "Free";
    const nextState = hasPro ? "activa" : "inactiva";

    await setDoc(
      doc(db, "Empresas", uid),
      { plan: nextPlan, estadoSuscripcion: nextState },
      { merge: true }
    );

    setEmpresa((prev: any) => ({
      ...prev,
      plan: nextPlan,
      estadoSuscripcion: nextState,
    }));

    await loadPlanDataByName(nextPlan);
  };

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
      const parent = navigation.getParent();
      if (parent) {
        parent.reset({
          index: 0,
          routes: [{ name: "Login" as any }],
        });
      } else {
        navigation.navigate("Login" as any);
      }
    } catch (err) {
      console.log("Error al cerrar sesión:", err);
    }
  };

  const handleUpgrade = async () => {
    console.log("handleUpgrade start", {
      rcAvailable: isRevenueCatAvailable(),
      rcApiKey: hasRevenueCatApiKey(),
      uid,
    });

    const rcAvailable = isRevenueCatAvailable();
    const rcApiKey = hasRevenueCatApiKey();
    const isAlreadyPro = String(empresa?.plan || "").toLowerCase() === "pro";

    if (!rcAvailable || !rcApiKey) {
      const reason = !rcAvailable
        ? "El modulo nativo de RevenueCat no esta disponible en esta build."
        : "REVENUECAT_API_KEY no se cargo en runtime.";

      alert(
        `${reason}\n\nChecks:\n1) Recompila APK release despues de editar .env\n2) Ejecuta prebuild --clean\n3) Usa la Public SDK Key Android (prefijo goog_) en RevenueCat`
      );
      return;
    }

    if (isAlreadyPro) {
      alert("Tu cuenta ya tiene plan Pro. Usa 'Gestionar suscripcion' para administrarla.");
      return;
    }

    if (!uid) return;

    setUpgrading(true);
    try {
      const offering = await fetchOfferings();
      if (!offering) {
        alert("No encontramos ofertas disponibles. Revisa Offerings/Packages en RevenueCat.");
        return;
      }

      const paywallResult = await presentRCPlaywall(offering || undefined);
      const info = await getCustomerInfoSafe();
      const hasPro = hasProEntitlement(info);

      if (hasPro) {
        await applyPlanState(true);
        alert("Suscripcion Pro activada correctamente.");
      } else {
        console.log("Paywall result:", paywallResult);
        alert("No se completo la compra. Si cancelaste el pago, tu plan sigue igual.");
      }
    } catch (e) {
      console.log("Paywall error:", e);
      alert("No se pudo completar el flujo de pago. Intenta de nuevo.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    const rcAvailable = isRevenueCatAvailable();
    const rcApiKey = hasRevenueCatApiKey();

    if (!rcAvailable || !rcApiKey) {
      alert("RevenueCat no esta disponible para gestionar la suscripcion en esta build.");
      return;
    }

    setUpgrading(true);
    try {
      if (isRevenueCatCustomerCenterAvailable()) {
        await openRevenueCatCustomerCenter();
      } else if (Platform.OS === "android") {
        await Linking.openURL("https://play.google.com/store/account/subscriptions");
      }

      const info = await getCustomerInfoSafe();
      if (info) {
        await applyPlanState(hasProEntitlement(info));
      }
    } catch (e) {
      console.log("Customer center error:", e);
      if (Platform.OS === "android") {
        try {
          await Linking.openURL("https://play.google.com/store/account/subscriptions");
          return;
        } catch {
          // no-op
        }
      }
      alert("No se pudo abrir la gestion de suscripcion.");
    } finally {
      setUpgrading(false);
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

  const limiteUsuarios = planInfo.limiteUsuarios;
  const atUserLimit = typeof limiteUsuarios === "number" && usados.usuarios >= limiteUsuarios;
  const isProPlan = String(planInfo?.nombrePlan || empresa?.plan || "").toLowerCase() === "pro";

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
          {isProPlan ? (
            <TouchableOpacity
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: "#2e7d32",
              }}
              onPress={handleManageSubscription}
              disabled={upgrading}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {upgrading ? "Abriendo..." : "Gestionar suscripcion"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: "#2196F3",
              }}
              onPress={handleUpgrade}
              disabled={upgrading}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {upgrading ? "Abriendo..." : "Mejorar plan"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={{ color: "#455a64" }}>
            Usuarios: {usados.usuarios} / {planInfo.limiteUsuarios ?? "-"}
          </Text>
          <Text style={{ color: "#455a64" }}>
            Estado suscripcion: {empresa?.estadoSuscripcion || (isProPlan ? "activa" : "inactiva")}
          </Text>
          {atUserLimit && (
            <View
              style={{
                marginTop: 6,
                padding: 8,
                borderRadius: 8,
                backgroundColor: "#fff4f4",
                borderWidth: 1,
                borderColor: "#ffcdd2",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="warning-outline" size={16} color="#c62828" />
              <Text style={{ color: "#c62828", flex: 1 }}>
                Alcanzaste tu límite de usuarios registrados. Mejora tu plan.
              </Text>
            </View>
          )}
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
          <Text style={styles.label}>Nombre empresa</Text>
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
            placeholderTextColor="#607d8b"
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
        placeholderTextColor="#607d8b"
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




























