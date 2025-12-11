import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { auth, db } from "../services/firebaseConfig";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { createAndSignWallet } from "../services/apiWallet";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterClient">;
type SO = "ios" | "android";

// Detect platform (web) for convenience
function detectarSO(): SO | null {
  try {
    const uaData = (navigator as any)?.userAgentData;
    const platform = uaData?.platform?.toLowerCase?.() || "";
    if (platform.includes("ios") || platform.includes("iphone") || platform.includes("ipad")) return "ios";
    if (platform.includes("android")) return "android";

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

  const [walletStep, setWalletStep] = useState<"idle" | "creating" | "success" | "error">("idle");
  const [walletLink, setWalletLink] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Anonymous auth to comply with security rules for public form
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch((e) => console.error("Auth anon failed:", e));
    });
    return unsub;
  }, []);

  // Detect OS on mount (web)
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
      setNeedsSelector(true);
    }
  }, []);

  // Load company data
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

  const extractLink = (data: any): string | null => {
    if (!data) return null;
    if (typeof data === "string" && data.startsWith("http")) return data;
    if (typeof data === "object") {
      return (
        data.addToGoogleWalletUrl ||
        data.saveUrl ||
        data.url ||
        data.link ||
        data.saveLink ||
        data.walletUrl ||
        null
      );
    }
    return null;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!nombreCompleto.trim() || !email.trim() || !telefono.trim()) {
      setFormError("Completa nombre, email y telefono.");
      return;
    }
    if (!so) {
      setFormError("Selecciona tu sistema: iPhone o Android.");
      return;
    }
    setSaving(true);
    setWalletStep("idle");
    setWalletLink(null);
    setWalletError(null);
    setShowForm(true);

    try {
      const docRef = await addDoc(collection(db, "Empresas", empresaId, "Clientes"), {
        nombreCompleto: nombreCompleto.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        empresaUid: empresaId,
        creadoEn: serverTimestamp(),
        so,
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

      // Generate and sign wallet pass
      setWalletStep("creating");
      const { create, sign } = await createAndSignWallet({
        idUsuario: docRef.id,
        nombreUsuario: nombreCompleto.trim(),
      });

      if (create.ok && sign?.ok) {
        const link = extractLink(sign.data) || extractLink(create.data);
        if (link) setWalletLink(link);
        setWalletStep("success");
        setShowForm(false);
      } else {
        setWalletStep("error");
        setWalletError(sign?.errorText || create.errorText || "No se pudo generar la tarjeta.");
        setShowForm(true);
      }

    } catch (e) {
      console.error("Error registrando cliente:", e);
      setWalletStep("error");
      setWalletError(String(e));
      setShowForm(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!empresa) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Empresa no encontrada o enlace invalido.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flex: 1 }}>
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
              Registrate para acumular visitas y beneficios
            </Text>
          </View>

          {showForm ? (
            <>
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
                editable={!saving && walletStep !== "creating"}
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
                editable={!saving && walletStep !== "creating"}
              />

              <Text>Telefono</Text>
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
                editable={!saving && walletStep !== "creating"}
              />

              {/* SO selector */}
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
                    disabled={saving || walletStep === "creating"}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#ccc",
                      opacity: saving || walletStep === "creating" ? 0.6 : 1,
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
                    disabled={saving || walletStep === "creating"}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: so === "ios" ? "#2196F3" : "#ccc",
                      backgroundColor: so === "ios" ? "#E3F2FD" : "#fff",
                      marginRight: 8,
                      alignItems: "center",
                      opacity: saving || walletStep === "creating" ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "bold" }}>Tengo iPhone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSo("android");
                      setNeedsSelector(false);
                    }}
                    disabled={saving || walletStep === "creating"}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: so === "android" ? "#2196F3" : "#ccc",
                      backgroundColor: so === "android" ? "#E3F2FD" : "#fff",
                      alignItems: "center",
                      opacity: saving || walletStep === "creating" ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "bold" }}>Tengo Android</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={saving || walletStep === "creating"}
                style={{
                  backgroundColor: "#2196F3",
                  padding: 14,
                  borderRadius: 8,
                  alignItems: "center",
                  opacity: saving || walletStep === "creating" ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  {saving ? "Registrando..." : "Registrarme"}
                </Text>
              </TouchableOpacity>

              {formError ? (
                <Text style={{ marginTop: 8, color: "#c62828" }}>{formError}</Text>
              ) : null}
            </>
          ) : (
            <>
              {walletStep === "success" && (
                <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#e8f5e9" }}>
                  <Text style={{ color: "#2e7d32", fontWeight: "700" }}>Tarjeta creada correctamente.</Text>
                  {walletLink ? (
                    <TouchableOpacity
                      onPress={() => walletLink && Linking.openURL(walletLink)}
                      style={{
                        marginTop: 10,
                        backgroundColor: "#023047",
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>Agregar a mi wallet</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ marginTop: 8, color: "#023047" }}>
                      No recibimos un link de tarjeta en la respuesta.
                    </Text>
                  )}
                </View>
              )}

              {walletStep === "error" && walletError ? (
                <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#ffebee" }}>
                  <Text style={{ color: "#c62828", fontWeight: "700" }}>No se pudo crear la tarjeta.</Text>
                  <Text style={{ color: "#c62828" }}>{walletError}</Text>
                </View>
              ) : null}
            </>
          )}

        </View>
      </ScrollView>

      {walletStep === "creating" && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 999,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              padding: 16,
              borderRadius: 12,
              width: "80%",
              maxWidth: 320,
              alignItems: "center",
              gap: 8,
            }}
          >
            <ActivityIndicator size="large" color="#023047" />
            <Text style={{ fontWeight: "700", color: "#023047", textAlign: "center" }}>
              Estamos generando la tarjeta...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
