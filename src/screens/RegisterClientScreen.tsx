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
import { doc, getDoc, addDoc, collection, serverTimestamp, deleteDoc } from "firebase/firestore";
import { createAndSignWallet, createApplePass } from "../services/apiWallet";

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
  const [walletFriendlyError, setWalletFriendlyError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthInputWeb, setBirthInputWeb] = useState("");

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
    setWalletError(null);
    setWalletFriendlyError(null);
    if (!nombreCompleto.trim() || !email.trim() || !telefono.trim()) {
      setFormError("Completa nombre, email y telefono.");
      return;
    }
    if (!so) {
      setFormError("Selecciona tu sistema: iPhone o Android.");
      return;
    }
    if (!birthDate) {
      setFormError("Selecciona tu fecha de nacimiento.");
      return;
    }
    setSaving(true);
    setWalletStep("idle");
    setWalletLink(null);
    setWalletError(null);
    setShowForm(true);

    try {
      // Pre-generar ID sin escribir en Firestore
      const newDocRef = doc(collection(db, "Empresas", empresaId, "Clientes"));
      const clientId = newDocRef.id;

      // Generar y firmar wallet
      setWalletStep("creating");
      let walletOk = false;
      let walletLinkLocal: string | null = null;

      if (so === "ios") {
        const parts = nombreCompleto.trim().split(/\s+/);
        const nombre = parts.shift() || "";
        const apellido = parts.join(" ") || "Passio";
        const appleRes = await createApplePass({
          idUsuario: clientId,
          cantidad: 0,
          premiosDisponibles: 0,
          nombre,
          apellido,
          codigoQR: clientId,
        });
        if (appleRes.ok) {
          walletOk = true;
          walletLinkLocal = null; // se maneja la descarga del pkpass aparte
        } else {
          throw new Error(appleRes.errorText || "No se pudo generar la tarjeta (Apple).");
        }
      } else {
        const { create, sign } = await createAndSignWallet({
          idUsuario: clientId,
          nombreUsuario: nombreCompleto.trim(),
        });
        if (create.ok && sign?.ok) {
          walletOk = true;
          walletLinkLocal = extractLink(sign.data) || extractLink(create.data);
        } else {
          throw new Error(sign?.errorText || create.errorText || "No se pudo generar la tarjeta (Android).");
        }
      }

      // Solo si el wallet fue OK escribimos el cliente en Firestore
      if (walletOk) {
        await setDoc(newDocRef, {
          nombreCompleto: nombreCompleto.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim(),
          empresaUid: empresaId,
          creadoEn: serverTimestamp(),
          so,
          fechaNacimiento: birthDate,
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
        setBirthDate(null);
        setBirthInputWeb("");

        setWalletLink(walletLinkLocal);
        setWalletStep("success");
        setWalletFriendlyError(null);
        setShowForm(false);
      }
    } catch (e: any) {
      console.error("Error registrando cliente:", e);
      setWalletStep("error");
      setWalletFriendlyError("No pudimos generar tu tarjeta en este momento. Intenta nuevamente o contáctanos.");
      setWalletError(String(e?.message || e));
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

            <Text>Fecha de nacimiento</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={birthInputWeb}
                onChange={(e) => {
                  const val = e.target.value;
                  setBirthInputWeb(val);
                  const d = val ? new Date(val) : null;
                  setBirthDate(d && !isNaN(d.getTime()) ? d : null);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: "#fff",
                  marginBottom: 16,
                }}
                disabled={saving || walletStep === "creating"}
              />
            ) : (
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: "#fff",
                  marginBottom: 16,
                }}
                placeholder="AAAA-MM-DD"
                value={birthInputWeb}
                onChangeText={(val) => {
                  setBirthInputWeb(val);
                  const d = val ? new Date(val) : null;
                  setBirthDate(d && !isNaN(d.getTime()) ? d : null);
                }}
                editable={!saving && walletStep !== "creating"}
              />
            )}

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
              {walletError ? (
                <Text selectable style={{ marginTop: 8, color: "#c62828" }}>
                  {walletError}
                </Text>
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

      {walletStep === "error" && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.45)",
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
              width: "85%",
              maxWidth: 360,
              gap: 10,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 16, color: "#c62828" }}>
              No se pudo crear tu wallet
            </Text>
            <Text style={{ color: "#444" }}>
              {walletFriendlyError || "Ocurrió un problema al generar tu tarjeta. Intenta nuevamente en unos segundos."}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setWalletStep("idle");
                // Dejamos walletError y walletFriendlyError para depurar
              }}
              style={{
                marginTop: 4,
                alignSelf: "flex-end",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#cfd8dc",
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ color: "#023047", fontWeight: "700" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
