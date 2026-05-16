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
  DocumentReference,
  serverTimestamp,
  getDocs,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
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
    // Safari en iPad puede reportar "MacIntel" pero con touchpoints
    if (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1) return "ios";
  } catch {}
  return null;
}

function formatLocalDateForInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [walletSuccessMessage, setWalletSuccessMessage] = useState<string | null>(null);
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
  const inputFontSize = 16;
  const placeholderColor = "#90A4AE";
  const todayInputMax = formatLocalDateForInput(new Date());

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
    setWalletSuccessMessage(null);
    setShowForm(true);

    try {
      // Traer limites del plan solo si vamos a crear un cliente nuevo
      const normalizedEmail = email.trim().toLowerCase();
      const clientesRef = collection(db, "Empresas", empresaId, "Clientes");

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
        console.log("No se pudieron leer los limites del plan:", planErr);
      }

      const clientRef = doc(clientesRef) as DocumentReference;
      const clientId = clientRef.id;
      const walletCantidad = 1;
      const walletPremios = 0;
      const walletNombre = nombre.trim();
      const walletApellido = apellido.trim();
      const walletNombreUsuario = [walletNombre, walletApellido].filter(Boolean).join(" ");
      const walletClassId =
        typeof empresa?.["wallet-class-id"] === "string" && empresa["wallet-class-id"].trim().length > 0
          ? empresa["wallet-class-id"].trim()
          : "";
      const paqueteSellosWallet =
        typeof empresa?.paqueteSellosWallet === "string" && empresa.paqueteSellosWallet.trim().length > 0
          ? empresa.paqueteSellosWallet.trim()
          : "generico1";
      const visitasPorPremio =
        typeof empresa?.visitasPorPremio === "number" && Number.isFinite(empresa.visitasPorPremio)
          ? Math.min(10, Math.max(6, Math.trunc(empresa.visitasPorPremio)))
          : 6;
      const nombreEmpresa =
        typeof empresa?.nombre === "string" && empresa.nombre.trim().length > 0 ? empresa.nombre.trim() : "Passio";
      const colorWallet =
        typeof empresa?.colorWallet === "string" && empresa.colorWallet.trim().length > 0
          ? empresa.colorWallet.trim()
          : typeof empresa?.ColorPrincipal === "string" && empresa.ColorPrincipal.trim().length > 0
            ? empresa.ColorPrincipal.trim()
            : "#A99985";
      const urlIconoWallet =
        typeof empresa?.urlIconoWallet === "string" && empresa.urlIconoWallet.trim().length > 0
          ? empresa.urlIconoWallet.trim()
          : walletClassId
            ? `https://storage.googleapis.com/passio-wallet-bucket/${walletClassId}/icon.png`
            : "";
      // Generar y firmar wallet
      setWalletStep("creating");
      let walletOk = false;
      let walletLinkLocal: string | null = null;

      if (so === "ios") {
        const walletQuery = new URLSearchParams({
          idUsuario: clientId,
          cantidad: String(walletCantidad),
          premiosDisponibles: String(walletPremios),
          nombre: walletNombre,
          apellido: walletApellido,
          codigoQR: clientId,
          empresaUid: empresaId,
          walletClassId,
          nombreEmpresa,
          paqueteSellosWallet,
          visitasPorPremio: String(visitasPorPremio),
          colorWallet,
          urlIconoWallet,
        }).toString();
        const directUrl = EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL + "/v1/crearPasses?" + walletQuery;
        walletOk = true;
        walletLinkLocal = directUrl;
      } else {
        if (!walletClassId) {
          throw new Error("La empresa no tiene wallet-class-id configurado.");
        }

        const { create, sign } = await createAndSignWallet({
          walletClassId,
          paqueteSellosWallet,
          visitasPorPremio,
          idUsuario: clientId,
          nombreUsuario: walletNombreUsuario,
          nombre: walletNombre,
          apellido: walletApellido,
          codigoQR: clientId,
          cantidad: walletCantidad,
          premios: walletPremios,
        });
        const signUrl = typeof sign?.data?.url === "string" ? sign.data.url : null;
        if (create.ok && sign?.ok) {
          walletOk = true;
          walletLinkLocal = extractLink(sign.data) || extractLink(create.data) || signUrl;
        } else {
          throw new Error(sign?.errorText || create.errorText || "No se pudo generar la tarjeta (Android).");
        }
      }

      // Solo si el wallet fue OK escribimos el cliente en Firestore
      if (walletOk) {
        const clientData = {
          nombre: walletNombre,
          apellido: walletApellido,
          email: normalizedEmail,
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

        // Transaccion: valida limite y crea cliente + incrementa contador
        // Contador de usuarios: intenta coleccion "Contador" (singular) y luego "Contadores" (plural)
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
          console.log("No se pudo leer coleccion Contador/Contadores, se usara contador:", e);
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
            const mesKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
            const storedMes = contData.mesConteo as string | undefined;
            const resetMonthly = storedMes !== mesKey;
            const nextNoti = resetMonthly ? 0 : currentNoti;
            const nextMail = resetMonthly ? 0 : currentMail;

            if (limiteUsuarios != null && current >= limiteUsuarios) {
              throw new Error("LIMIT_REACHED");
            }

            tx.set(clientRef, clientData);
            tx.set(
              contRefToUse,
              {
                totalUsuarios: current + 1,
                notificacionesMes: nextNoti,
                correosMes: nextMail,
                mesConteo: mesKey,
                actualizadoEl: serverTimestamp(),
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

        setWalletSuccessMessage("Tarjeta creada correctamente.");
        setNombre("");        setNombre("");
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
                      fontSize: inputFontSize,
                    }}
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Tu nombre"
                    placeholderTextColor={placeholderColor}
                    autoComplete="given-name"
                    textContentType="givenName"
                    importantForAutofill="yes"
                    returnKeyType="next"
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
                      fontSize: inputFontSize,
                    }}
                    value={apellido}
                    onChangeText={setApellido}
                    placeholder="Tu apellido"
                    placeholderTextColor={placeholderColor}
                    autoComplete="family-name"
                    textContentType="familyName"
                    importantForAutofill="yes"
                    returnKeyType="next"
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
                  fontSize: inputFontSize,
                }}
                value={email}
                onChangeText={setEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={placeholderColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                importantForAutofill="yes"
                returnKeyType="next"
                editable={!saving && walletStep !== "creating"}
              />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text>Telefono</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 10,
                    backgroundColor: "#fff",
                    width: "100%",
                    height: 42,
                    fontSize: inputFontSize,
                  }}
                  value={telefono}
                  onChangeText={(val) => {
                    const digitsOnly = val.replace(/\D+/g, "");
                    setTelefono(digitsOnly);
                  }}
                  placeholder="9 123456789"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  importantForAutofill="yes"
                  returnKeyType="next"
                  editable={!saving && walletStep !== "creating"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text>Fecha de nacimiento</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={birthInputWeb}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  const safeValue = rawValue && rawValue > todayInputMax ? todayInputMax : rawValue;
                  if (safeValue !== rawValue) {
                    e.currentTarget.value = safeValue;
                  }
                  setBirthInputWeb(safeValue);
                  const d = safeValue ? new Date(`${safeValue}T00:00:00`) : null;
                  setBirthDate(d && !isNaN(d.getTime()) ? d : null);
                }}
                max={todayInputMax}
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
                  fontSize: inputFontSize,
                }}
                autoComplete="bday"
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
                      fontSize: inputFontSize,
                    }}
                    placeholder="AAAA-MM-DD"
                    value={birthInputWeb}
                    onChangeText={(val) => {
                      setBirthInputWeb(val);
                      const d = val ? new Date(val) : null;
                      setBirthDate(d && !isNaN(d.getTime()) ? d : null);
                    }}
                    placeholderTextColor={placeholderColor}
                    autoComplete="birthdate-full"
                    importantForAutofill="yes"
                    returnKeyType="done"
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

              {/*
              Botones de prueba ocultos para la beta.

              Botones de prueba con payload de ejemplo
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
              */}

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
                  <Text style={{ color: "#2e7d32", fontWeight: "700" }}>{walletSuccessMessage || "Tarjeta creada correctamente."}</Text>
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
              Este comercio alcanzo el lí­mite de registros disponible.
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
