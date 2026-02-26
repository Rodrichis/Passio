import React, { useEffect, useRef, useState } from "react";
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
import { EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL } from "@env";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { auth, db } from "../services/firebaseConfig";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  serverTimestamp,
  setDoc,
  getDocs,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
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
    // Safari en iPad puede reportar "MacIntel" pero con touchpoints
    if (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1) return "ios";
  } catch {}
  return null;
}

export default function RegisterClientScreen({ route }: Props) {
  const { empresaId } = route.params;

  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
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
  const [testAppleUrl, setTestAppleUrl] = useState<string | null>(null);
  const [testAppleMessage, setTestAppleMessage] = useState<string | null>(null);
  const [testAppleStatus, setTestAppleStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testAppleError, setTestAppleError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const openedWalletRef = useRef(false);

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

  useEffect(() => {
    if (showForm) {
      openedWalletRef.current = false;
    }
  }, [showForm]);

  useEffect(() => {
    if (!showForm && walletStep === "success" && walletLink && !openedWalletRef.current) {
      openedWalletRef.current = true;
      if (Platform.OS === "web") {
        window.location.href = walletLink;
      } else {
        Linking.openURL(walletLink);
      }
    }
  }, [showForm, walletStep, walletLink]);

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
    setShowLimitModal(false);
    if (!nombre.trim() || !apellido.trim() || !email.trim() || !telefono.trim()) {
      setFormError("Completa nombre, apellido, email y telefono.");
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
    const todayMax = new Date();
    todayMax.setHours(23, 59, 59, 999);
    if (birthDate.getTime() > todayMax.getTime()) {
      setFormError("La fecha de nacimiento no puede ser futura.");
      return;
    }
    setSaving(true);
    setWalletStep("idle");
    setWalletLink(null);
    setWalletError(null);
    setShowForm(true);

    try {
      // Traer límites del plan
      let limiteUsuarios: number | null = null;
      try {
        const planName = empresa?.plan;
        if (planName) {
          const planRes = await getDocs(
            query(collection(db, "Planes"), where("nombrePlan", "==", planName))
          );
          const planDoc = planRes.docs[0];
          if (planDoc) {
            const data = planDoc.data() as any;
            if (typeof data.limiteUsuarios === "number") {
              limiteUsuarios = data.limiteUsuarios;
            }
          }
        }
      } catch (planErr) {
        console.log("No se pudieron leer los límites del plan:", planErr);
      }

      // Pre-generar ID sin escribir en Firestore
      const newDocRef = doc(collection(db, "Empresas", empresaId, "Clientes"));
      const clientId = newDocRef.id;

      // Generar y firmar wallet
      setWalletStep("creating");
      let walletOk = false;
      let walletLinkLocal: string | null = null;

      if (so === "ios") {
        // Nuevo flujo: Apple expone GET directo con los parámetros
        const query = new URLSearchParams({
          idUsuario: clientId,
          cantidad: "1", // servicio no permite 0
          premiosDisponibles: "0",
          nombre,
          apellido,
          codigoQR: clientId,
        }).toString();
        const directUrl = `${EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL}/v1/crearPasses?${query}`;
        walletOk = true;
        walletLinkLocal = directUrl;
      } else {
        const { create, sign } = await createAndSignWallet({
          idUsuario: clientId,
          nombreUsuario: `${nombre.trim()} ${apellido.trim()}`,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          codigoQR: clientId,
          cantidad: 1,
          premios: 0,
        });
        const signUrl = typeof sign?.data?.url === "string" ? sign.data.url : null;
        if (create.ok && sign?.ok) {
          walletOk = true;
          walletLinkLocal = extractLink(sign.data) || extractLink(create.data) || signUrl;
        } else {
          throw new Error(sign?.errorText || create.errorText || "No se pudo generar la tarjeta (Android).");
        }
      }

      // Solo si el wallet fue OK escribimos el cliente en Firestore (con límite)
      if (walletOk) {
        const clientData = {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim(),
          applePassUrl: walletLinkLocal || null,
          empresaUid: empresaId,
          creadoEn: serverTimestamp(),
          ultimaVisita: serverTimestamp(),
          so,
          fechaNacimiento: birthDate,
          navegador:
            Platform.select({
              web: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
              default: "app",
            }) || "unknown",
          activo: true,
          visitasTotales: 1,
          cicloVisitas: 1,
          premiosDisponibles: 0,
          premiosCanjeados: 0,
        };

        // Transacción: valida límite y crea cliente + incrementa contador
        // Contador de usuarios: intenta colección "Contador" (singular) y luego "Contadores" (plural)
        let contRefToUse = doc(db, "Empresas", empresaId, "Contador", "contador");
        try {
          let contColl = await getDocs(collection(db, "Empresas", empresaId, "Contador"));
          if (!contColl.empty) {
            const first = contColl.docs[0];
            contRefToUse = doc(db, "Empresas", empresaId, "Contador", first.id);
          } else {
            contColl = await getDocs(collection(db, "Empresas", empresaId, "Contadores"));
            if (!contColl.empty) {
              const first = contColl.docs[0];
              contRefToUse = doc(db, "Empresas", empresaId, "Contadores", first.id);
            }
          }
        } catch (e) {
          console.log("No se pudo leer colección Contador/Contadores, se usará 'contador':", e);
        }

        try {
          await runTransaction(db, async (tx) => {
            const contSnap = await tx.get(contRefToUse);
            const contData = contSnap.exists() ? contSnap.data() || {} : {};
            const current = typeof contData.totalUsuarios === "number" ? contData.totalUsuarios : 0;
            const currentNoti =
              typeof contData.notificacionesMes === "number" ? contData.notificacionesMes : 0;
            const currentMail = typeof contData.correosMes === "number" ? contData.correosMes : 0;

            const now = new Date();
            const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const storedMes = contData.mesConteo as string | undefined;
            const resetMonthly = storedMes !== mesKey;
            const nextNoti = resetMonthly ? 0 : currentNoti;
            const nextMail = resetMonthly ? 0 : currentMail;

            if (limiteUsuarios != null && current >= limiteUsuarios) {
              throw new Error("LIMIT_REACHED");
            }

            tx.set(newDocRef, clientData);
            tx.set(
              contRefToUse,
              {
                totalUsuarios: current + 1,
                notificacionesMes: nextNoti,
                correosMes: nextMail,
                mesConteo: mesKey,
                actualizadoEl: serverTimestamp(),
                // preserva otros contadores si ya existen
              },
              { merge: true }
            );
          });
        } catch (txErr: any) {
          if (String(txErr?.message).includes("LIMIT_REACHED")) {
            setShowLimitModal(true);
            setWalletStep("idle");
            setSaving(false);
            return;
          }
          throw txErr;
        }

        setNombre("");
        setApellido("");
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
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text>Nombre</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: "#ccc",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Tu nombre"
                    editable={!saving && walletStep !== "creating"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text>Apellido</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: "#ccc",
                      borderRadius: 8,
                      padding: 10,
                      backgroundColor: "#fff",
                    }}
                    value={apellido}
                    onChangeText={setApellido}
                    placeholder="Tu apellido"
                    editable={!saving && walletStep !== "creating"}
                  />
                </View>
              </View>

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

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text>Telefono</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    backgroundColor: "#fff",
                    height: 42,
                    width: "100%",
                    paddingHorizontal: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: "#555", fontWeight: "600" }}>+56</Text>
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                    }}
                    value={telefono}
                    onChangeText={(val) => {
                      const digitsOnly = val.replace(/\D+/g, "");
                      setTelefono(digitsOnly);
                    }}
                    keyboardType="numeric"
                    editable={!saving && walletStep !== "creating"}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
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
                max={new Date().toISOString().slice(0, 10)}
                style={{
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 8,
                  padding: 10,
                      backgroundColor: "#fff",
                      width: "100%",
                      boxSizing: "border-box",
                      minWidth: 0,
                      height: 42,
                      appearance: "none",
                      WebkitAppearance: "none",
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
                      width: "100%",
                      height: 42,
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
              </View>
            </View>

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

              {/* Botones de prueba con payload de ejemplo */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setWalletError(null);
                    setWalletFriendlyError(null);
                    setTestAppleUrl(null);
                    setTestAppleMessage(null);
                    setTestAppleError(null);
                    setTestAppleStatus("loading");
                    if (!EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL) {
                      setWalletError("Base URL de Apple no configurada.");
                      setTestAppleError("Base URL de Apple no configurada.");
                      setTestAppleStatus("error");
                      return;
                    }
                    const query = new URLSearchParams({
                      idUsuario: "100",
                      cantidad: "1",
                      premiosDisponibles: "3",
                      nombre: "Ricardo",
                      apellido: "Riedman",
                      codigoQR: "QR-demo",
                    }).toString();
                    const directUrl = `${EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL}/v1/crearPasses?${query}`;
                    setTestAppleUrl(directUrl);
                    setTestAppleMessage("Estamos generando tu tarjeta...");
                    if (Platform.OS === "web") {
                      window.location.href = directUrl;
                    } else {
                      Linking.openURL(directUrl);
                    }
                    setTestAppleMessage("Tarjeta creada. Si no se descarga automaticamente, usa el boton de descarga.");
                    setTestAppleStatus("idle");
                  } catch (err) {
                    console.error("Test Apple error", err);
                    setWalletError("Test Apple error: " + String(err));
                    setTestAppleError(String(err));
                    setTestAppleStatus("error");
                    setWalletStep("idle");
                  }
                }}
                disabled={saving || walletStep === "creating"}
                style={{
                  marginTop: 10,
                  backgroundColor: "#455a64",
                  padding: 12,
                  borderRadius: 8,
                  alignItems: "center",
                  opacity: saving || walletStep === "creating" ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Test Apple (payload ejemplo)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    setWalletError(null);
                    setWalletFriendlyError(null);
                    setTestAppleMessage(null);
                    const { create, sign } = await createAndSignWallet({
                      idUsuario: "test-android-100",
                      nombreUsuario: "Ricardo Riedman",
                      nombre: "Ricardo",
                      apellido: "Riedman",
                      codigoQR: "QR-demo",
                      cantidad: 9,
                      premios: 4,
                    });
                    const payloadInfo = {
                      create: {
                        ok: create.ok,
                        status: create.status,
                        data: create.data,
                        error: create.errorText,
                      },
                      sign: sign
                        ? {
                            ok: sign.ok,
                            status: sign.status,
                            data: sign.data,
                            error: sign.errorText,
                          }
                        : null,
                    };
                    console.log("Test Android respuesta:", payloadInfo);
                    if (create.ok && sign?.ok) {
                      setWalletError(
                        "Test Android OK. Respuesta:\n" + JSON.stringify(payloadInfo, null, 2)
                      );
                    } else {
                      setWalletError(
                        "Test Android fallo:\n" +
                          (sign?.errorText || create.errorText || "sin detalle") +
                          "\n" +
                          JSON.stringify(payloadInfo, null, 2)
                      );
                    }
                  } catch (err) {
                    setWalletError("Test Android error: " + String(err));
                  }
                }}
                disabled={saving || walletStep === "creating"}
                style={{
                  marginTop: 10,
                  backgroundColor: "#2e7d32",
                  padding: 12,
                  borderRadius: 8,
                  alignItems: "center",
                  opacity: saving || walletStep === "creating" ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Test Android (payload ejemplo)</Text>
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
                      onPress={() => {
                        if (!walletLink) return;
                        if (Platform.OS === "web") {
                          window.location.href = walletLink;
                        } else {
                          Linking.openURL(walletLink);
                        }
                      }}
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

      {testAppleStatus === "loading" && (
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
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color="#023047" />
            <Text style={{ fontWeight: "800", fontSize: 16, color: "#023047", textAlign: "center" }}>
              Estamos generando la tarjeta...
            </Text>
          </View>
        </View>
      )}

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

      {showLimitModal && (
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
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 16, color: "#c62828", textAlign: "center" }}>
              No se pueden registrar más usuarios.
            </Text>
            <Text style={{ color: "#444", textAlign: "center" }}>
              Este comercio alcanzó el límite de registros disponible.
            </Text>
            <TouchableOpacity
              onPress={() => setShowLimitModal(false)}
              style={{
                marginTop: 4,
                alignSelf: "center",
                paddingVertical: 10,
                paddingHorizontal: 16,
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
