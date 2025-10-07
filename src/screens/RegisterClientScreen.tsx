import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";

import { auth, db } from "../services/firebaseConfig";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterClient">;
type SO = "ios" | "android";

/** Detecta SO del cliente en navegador móvil; retorna null si no se puede */
function detectarSO(): SO | null {
  try {
    // Client Hints (Chrome modernos)
    const uaData = (navigator as any)?.userAgentData;
    const platform = uaData?.platform?.toLowerCase?.() || "";
    if (platform.includes("ios") || platform.includes("iphone") || platform.includes("ipad")) return "ios";
    if (platform.includes("android")) return "android";

    // userAgent clásico
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
  } catch {}
  return null;
}

export default function RegisterClientScreen({ route }: Props) {
  const { empresaId } = route.params;

  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [so, setSo] = useState<SO | null>(null);
  const [needsSelector, setNeedsSelector] = useState(false);

  // Auth anónima para cumplir reglas
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch((e) => console.error("Auth anónima falló:", e));
    });
    return unsub;
  }, []);

  // Detectar SO al montar (solo web)
  useEffect(() => {
    if (Platform.OS === "web") {
      const detected = detectarSO();
      if (detected) {
        setSo(detected);
        setNeedsSelector(false);
      } else {
        setNeedsSelector(true);
      }
    } else {
      // En app nativa no se usa este screen público, pero por si acaso:
      setNeedsSelector(true);
    }
  }, []);

  // Cargar empresa (OJO: "Empresas" en mayúscula)
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "Empresas", empresaId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("Empresa no encontrada");
        setEmpresa(snap.data());
      } catch (e) {
        console.error("Error al cargar empresa:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId]);

  const handleSubmit = async () => {
    if (!nombreCompleto.trim() || !email.trim() || !telefono.trim()) {
      alert("Completa nombre, email y teléfono.");
      return;
    }
    if (!so) {
      alert("Selecciona tu sistema: iPhone o Android.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "Empresas", empresaId, "Clientes"), {
        nombreCompleto: nombreCompleto.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        empresaUid: empresaId,
        creadoEn: serverTimestamp(),
        so, // "ios" | "android"
        navegador:
          Platform.select({
            web: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
            default: "app",
          }) || "unknown",
        activo: true,
      });
      setNombreCompleto("");
      setEmail("");
      setTelefono("");
      alert("✅ Registro completado");
    } catch (e) {
      console.error("Error registrando cliente:", e);
      alert("❌ No se pudo registrar. Revisa los datos o intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text>Cargando…</Text>
      </View>
    );
  }

  if (!empresa) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Empresa no encontrada o enlace inválido.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <View
        style={{
          backgroundColor: empresa?.ColorPrincipal || "#222",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 18 }}>
          {empresa?.nombre || "Comercio"}
        </Text>
        <Text style={{ color: "#fff", opacity: 0.85 }}>
          Regístrate para acumular visitas y beneficios
        </Text>
      </View>

      <Text>Nombre completo</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 10,
          backgroundColor: "#fff",
          marginBottom: 10,
        }}
        value={nombreCompleto}
        onChangeText={setNombreCompleto}
        placeholder="Tu nombre"
      />

      <Text>Email</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 10,
          backgroundColor: "#fff",
          marginBottom: 10,
        }}
        value={email}
        onChangeText={setEmail}
        placeholder="correo@ejemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text>Teléfono</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 10,
          backgroundColor: "#fff",
          marginBottom: 16,
        }}
        value={telefono}
        onChangeText={setTelefono}
        placeholder="+56 9 ..."
        keyboardType="phone-pad"
      />

      {/* SO: si se detectó automáticamente, lo mostramos; si no, pedimos elegir */}
      {so && !needsSelector ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text>
            Sistema detectado:{" "}
            <Text style={{ fontWeight: "bold" }}>
              {so === "ios" ? "iPhone (iOS)" : "Android"}
            </Text>
          </Text>
          <TouchableOpacity
            onPress={() => setNeedsSelector(true)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#ccc",
            }}
          >
            <Text>Cambiar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => {
              setSo("ios");
              setNeedsSelector(false);
            }}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: so === "ios" ? "#2196F3" : "#ccc",
              backgroundColor: so === "ios" ? "#E3F2FD" : "#fff",
              marginRight: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "bold" }}>Tengo iPhone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSo("android");
              setNeedsSelector(false);
            }}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: so === "android" ? "#2196F3" : "#ccc",
              backgroundColor: so === "android" ? "#E3F2FD" : "#fff",
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "bold" }}>Tengo Android</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={saving}
        style={{ backgroundColor: "#2196F3", padding: 14, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>
          {saving ? "Registrando..." : "Registrarme"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
