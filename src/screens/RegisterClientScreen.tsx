import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL } from "@env";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import LegalDocumentModal from "../components/legal/LegalDocumentModal";
import { RootStackParamList } from "../types/navigation";
import { auth, db } from "../services/firebaseConfig";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { createAndSignWallet } from "../services/apiWallet";
import { AUTH_WEB_INPUT_RESET } from "../styles/authStyles";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterClient">;
type SO = "ios" | "android";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function detectarSO(): SO | null {
  try {
    const uaData = (navigator as any)?.userAgentData;
    const platform = uaData?.platform?.toLowerCase?.() || "";
    if (platform.includes("ios") || platform.includes("iphone") || platform.includes("ipad")) return "ios";
    if (platform.includes("android")) return "android";

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
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

function extractLink(data: any): string | null {
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
}

export default function RegisterClientScreen({ route }: Props) {
  const { empresaId } = route.params;
  const { width } = useWindowDimensions();

  const isDesktop = width >= 980;
  const isTablet = width >= 720;
  const isCompactWeb = Platform.OS === "web" && width < 720;

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
  const [emailTouched, setEmailTouched] = useState(false);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthInputWeb, setBirthInputWeb] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const openedWalletRef = useRef(false);

  const inputFontSize = 16;
  const placeholderColor = "#90A4AE";
  const todayInputMax = formatLocalDateForInput(new Date());
  const normalizedEmail = email.trim().toLowerCase();
  const emailError = !normalizedEmail
    ? "Ingresa un correo electrónico."
    : EMAIL_REGEX.test(normalizedEmail)
      ? ""
      : "Ingresa un correo válido.";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch((e) => console.error("Auth anon failed:", e));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const styleId = "passio-register-client-no-zoom";
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const previousViewport = viewportMeta?.getAttribute("content") ?? null;
    const previousHtmlTextSizeAdjust = document.documentElement.style.webkitTextSizeAdjust;
    const previousBodyTextSizeAdjust = document.body.style.webkitTextSizeAdjust;

    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      styleTag.textContent = `
        html,
        body {
          -webkit-text-size-adjust: 100%;
        }

        input,
        textarea,
        select {
          font-size: 16px !important;
        }
      `;
      document.head.appendChild(styleTag);
    }

    if (viewportMeta) {
      viewportMeta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
      );
    }

    document.documentElement.style.webkitTextSizeAdjust = "100%";
    document.body.style.webkitTextSizeAdjust = "100%";

    return () => {
      styleTag?.remove();
      if (viewportMeta) {
        if (previousViewport) {
          viewportMeta.setAttribute("content", previousViewport);
        } else {
          viewportMeta.removeAttribute("content");
        }
      }
      document.documentElement.style.webkitTextSizeAdjust = previousHtmlTextSizeAdjust;
      document.body.style.webkitTextSizeAdjust = previousBodyTextSizeAdjust;
    };
  }, []);

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
  }, [showForm, walletLink, walletStep]);

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

  const openWalletLink = () => {
    if (!walletLink) return;
    if (Platform.OS === "web") {
      window.location.href = walletLink;
    } else {
      Linking.openURL(walletLink);
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    setWalletError(null);
    setWalletFriendlyError(null);
    setShowLimitModal(false);

    if (!nombre.trim() || !apellido.trim() || !email.trim() || !telefono.trim()) {
      setFormError("Completa nombre, apellido, email y teléfono.");
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setEmailTouched(true);
      setFormError("Ingresa un correo válido.");
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
        console.log("No se pudieron leer los límites del plan:", planErr);
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
        typeof empresa?.nombre === "string" && empresa.nombre.trim().length > 0
          ? empresa.nombre.trim()
          : "Passio";
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
        const directUrl = `${EXPO_PUBLIC_WALLET_APPLE_API_BASE_URL}/v1/crearPasses?${walletQuery}`;
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
          console.log("No se pudo leer la colección Contador/Contadores, se usará contador:", e);
        }

        try {
          await runTransaction(db, async (tx) => {
            const contSnap = await tx.get(contRefToUse);
            const contData = contSnap.exists() ? contSnap.data() || {} : {};
            const current = typeof contData.totalUsuarios === "number" ? contData.totalUsuarios : 0;
            const currentNoti = typeof contData.notificacionesMes === "number" ? contData.notificacionesMes : 0;
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
        setNombre("");
        setApellido("");
        setEmail("");
        setEmailTouched(false);
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
      <View style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#023047" />
          <Text style={styles.loadingText}>Cargando formulario...</Text>
        </View>
      </View>
    );
  }

  if (!empresa) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <Ionicons name="alert-circle-outline" size={26} color="#C62828" />
          <Text style={styles.loadingTitle}>Empresa no encontrada</Text>
          <Text style={styles.loadingText}>El enlace de registro no es válido o la empresa ya no está disponible.</Text>
        </View>
      </View>
    );
  }

  const companyColor = "#219EBC";

  return (
    <View style={styles.screen}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, isDesktop ? styles.cardDesktop : styles.cardCompact]}>
          <View
            style={[
              styles.hero,
              isCompactWeb ? styles.heroCompactWeb : null,
              { backgroundColor: companyColor },
            ]}
          >
            <View style={styles.heroPattern} />
            <View style={styles.heroContent}>
              <Text style={[styles.heroTitle, isCompactWeb ? styles.heroTitleCompactWeb : null]}>
                {empresa?.nombre || "Comercio"}
              </Text>
              <Text style={[styles.heroSubtitle, isCompactWeb ? styles.heroSubtitleCompactWeb : null]}>
                Regístrate para acumular visitas y beneficios
              </Text>
            </View>
          </View>

          <View style={[styles.formArea, isCompactWeb ? styles.formAreaCompactWeb : null]}>
            {showForm ? (
              <>
                <View style={[styles.row, !isTablet && !isCompactWeb && styles.rowStack]}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Nombre</Text>
                    <View style={styles.inputShell}>
                      <TextInput
                        style={[styles.input, AUTH_WEB_INPUT_RESET]}
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
                  </View>

                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Apellido</Text>
                    <View style={styles.inputShell}>
                      <TextInput
                        style={[styles.input, AUTH_WEB_INPUT_RESET]}
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
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="mail-outline" size={18} color="#9AA9B5" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, AUTH_WEB_INPUT_RESET]}
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        setFormError(null);
                        setEmailTouched(true);
                      }}
                      placeholder="correo@ejemplo.com"
                      placeholderTextColor={placeholderColor}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      importantForAutofill="yes"
                      returnKeyType="next"
                      onBlur={() => setEmailTouched(true)}
                      editable={!saving && walletStep !== "creating"}
                    />
                  </View>
                  {emailTouched && emailError ? <Text style={styles.inlineErrorText}>{emailError}</Text> : null}
                </View>

                <View style={[styles.row, !isTablet && !isCompactWeb && styles.rowStack]}>
                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Teléfono</Text>
                    <View style={styles.inputShell}>
                      <Ionicons name="call-outline" size={18} color="#9AA9B5" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, AUTH_WEB_INPUT_RESET]}
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
                  </View>

                  <View style={styles.rowItem}>
                    <Text style={styles.label}>Fecha de nacimiento</Text>
                    <View style={styles.inputShell}>
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
                            flex: 1,
                            width: "100%",
                            height: "100%",
                            minHeight: 54,
                            border: "0",
                            outline: "none",
                            background: "transparent",
                            fontSize: inputFontSize,
                            color: "#102A43",
                            boxSizing: "border-box",
                            padding: "0",
                            appearance: "none",
                            WebkitAppearance: "none",
                          }}
                          autoComplete="bday"
                          disabled={saving || walletStep === "creating"}
                        />
                      ) : (
                        <TextInput
                          style={[styles.input, AUTH_WEB_INPUT_RESET]}
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
                </View>

                {so && !needsSelector ? (
                  <View style={styles.systemCard}>
                    <View style={styles.systemInfo}>
                      <View style={styles.systemIconWrap}>
                        <Ionicons name="phone-portrait-outline" size={20} color="#008DB0" />
                      </View>
                      <Text style={styles.systemText}>
                        Sistema detectado:{" "}
                        <Text style={styles.systemTextStrong}>{so === "ios" ? "iPhone (iOS)" : "Android"}</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setNeedsSelector(true)}
                      disabled={saving || walletStep === "creating"}
                      style={[
                        styles.changeSystemButton,
                        saving || walletStep === "creating" ? styles.buttonDisabled : null,
                      ]}
                    >
                      <Text style={styles.changeSystemButtonText}>Cambiar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.systemSelectorRow, !isTablet && styles.rowStack]}>
                    <TouchableOpacity
                      onPress={() => {
                        setSo("ios");
                        setNeedsSelector(false);
                      }}
                      disabled={saving || walletStep === "creating"}
                      style={[
                        styles.systemOption,
                        so === "ios" ? styles.systemOptionActive : null,
                        saving || walletStep === "creating" ? styles.buttonDisabled : null,
                      ]}
                    >
                      <Ionicons name="logo-apple" size={18} color={so === "ios" ? "#0A6F88" : "#5C7382"} />
                      <Text style={[styles.systemOptionText, so === "ios" ? styles.systemOptionTextActive : null]}>
                        Tengo iPhone
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setSo("android");
                        setNeedsSelector(false);
                      }}
                      disabled={saving || walletStep === "creating"}
                      style={[
                        styles.systemOption,
                        so === "android" ? styles.systemOptionActive : null,
                        saving || walletStep === "creating" ? styles.buttonDisabled : null,
                      ]}
                    >
                      <Ionicons name="logo-android" size={18} color={so === "android" ? "#0A6F88" : "#5C7382"} />
                      <Text
                        style={[
                          styles.systemOptionText,
                          so === "android" ? styles.systemOptionTextActive : null,
                        ]}
                      >
                        Tengo Android
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={saving || walletStep === "creating"}
                  style={[styles.primaryButton, saving || walletStep === "creating" ? styles.buttonDisabled : null]}
                >
                  <Text style={styles.primaryButtonText}>{saving ? "Registrando..." : "Registrarme"}</Text>
                  {!saving ? <Ionicons name="arrow-forward" size={20} color="#FFFFFF" /> : null}
                </TouchableOpacity>

                <Text style={styles.footerText}>
                  {"Al registrarte, aceptas los "}
                  <Text style={styles.footerLinkText} onPress={() => setShowLegalModal(true)}>
                    {"T\u00E9rminos, Condiciones y Pol\u00EDtica de Privacidad"}
                  </Text>
                  {" de Passio."}
                </Text>
                {false ? (
                <Text style={styles.footerText}>
                  Al registrarte, aceptas nuestros términos y condiciones.
                </Text>

                ) : null}
                {formError && formError !== "Ingresa un correo válido." ? (
                  <Text style={styles.inlineErrorText}>{formError}</Text>
                ) : null}
                {walletError ? (
                  <Text selectable style={styles.inlineErrorText}>
                    {walletError}
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={styles.successState}>
                <View style={styles.successIconWrap}>
                  <Ionicons name="checkmark-circle" size={28} color="#2E7D32" />
                </View>
                <Text style={styles.successTitle}>Tarjeta creada correctamente</Text>
                <Text style={styles.successText}>
                  {walletSuccessMessage || "Ya puedes agregar tu tarjeta y comenzar a acumular visitas."}
                </Text>

                {walletLink ? (
                  <TouchableOpacity onPress={openWalletLink} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Agregar a mi wallet</Text>
                    <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.inlineHelperText}>No recibimos un enlace de tarjeta en la respuesta.</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={walletStep === "creating"} transparent animationType="fade">
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color="#023047" />
            <Text style={styles.overlayTitle}>Estamos generando tu tarjeta...</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={walletStep === "error"} transparent animationType="fade" onRequestClose={() => setWalletStep("idle")}>
        <View style={styles.overlayBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitleError}>No se pudo crear tu wallet</Text>
            <Text style={styles.modalMessage}>
              {walletFriendlyError || "Ocurrió un problema al generar tu tarjeta. Intenta nuevamente en unos segundos."}
            </Text>
            <TouchableOpacity
              onPress={() => setWalletStep("idle")}
              style={styles.modalSecondaryButton}
            >
              <Text style={styles.modalSecondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showLimitModal} transparent animationType="fade" onRequestClose={() => setShowLimitModal(false)}>
        <View style={styles.overlayBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitleError}>No se pueden registrar más usuarios</Text>
            <Text style={styles.modalMessage}>
              Este comercio alcanzó el límite de registros disponible.
            </Text>
            <TouchableOpacity
              onPress={() => setShowLimitModal(false)}
              style={styles.modalSecondaryButton}
            >
              <Text style={styles.modalSecondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LegalDocumentModal
        visible={showLegalModal}
        onClose={() => setShowLegalModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6FAFF",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.5,
  },
  glowTop: {
    width: 280,
    height: 280,
    backgroundColor: "rgba(142, 202, 230, 0.28)",
    top: -90,
    left: -80,
  },
  glowBottom: {
    width: 340,
    height: 340,
    backgroundColor: "rgba(255, 183, 3, 0.14)",
    right: -110,
    bottom: -120,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 860,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(189, 200, 205, 0.38)",
    shadowColor: "#0F3554",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 36,
    elevation: 10,
    overflow: "hidden",
  },
  cardDesktop: {
    borderRadius: 26,
  },
  cardCompact: {
    borderRadius: 22,
  },
  hero: {
    paddingHorizontal: 28,
    paddingVertical: 28,
    position: "relative",
    overflow: "hidden",
  },
  heroCompactWeb: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    backgroundColor: "transparent",
  },
  heroContent: {
    zIndex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitleCompactWeb: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    lineHeight: 24,
  },
  heroSubtitleCompactWeb: {
    fontSize: 14,
    lineHeight: 20,
  },
  formArea: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 16,
  },
  formAreaCompactWeb: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  fieldBlock: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  rowStack: {
    flexDirection: "column",
  },
  rowItem: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: "#102A43",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#D6E1EA",
    backgroundColor: "#F3F7FB",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#102A43",
    fontSize: 16,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
    borderWidth: 0,
  },
  systemCard: {
    marginTop: 2,
    borderRadius: 16,
    backgroundColor: "#DDEEFF",
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  systemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  systemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F7FBFF",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  systemText: {
    color: "#123042",
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  systemTextStrong: {
    fontWeight: "800",
  },
  changeSystemButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E3EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  changeSystemButtonText: {
    color: "#0A6F88",
    fontSize: 15,
    fontWeight: "700",
  },
  systemSelectorRow: {
    flexDirection: "row",
    gap: 12,
  },
  systemOption: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6E1EA",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
  },
  systemOptionActive: {
    borderColor: "#A8D7E6",
    backgroundColor: "#EAF6FB",
  },
  systemOptionText: {
    color: "#46606E",
    fontWeight: "700",
  },
  systemOptionTextActive: {
    color: "#0A6F88",
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: "#219EBC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#219EBC",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  footerText: {
    marginTop: 10,
    color: "#6E7F8D",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  footerLinkText: {
    color: "#0A6F88",
    fontWeight: "700",
  },
  inlineErrorText: {
    color: "#C62828",
    fontSize: 14,
    fontWeight: "600",
  },
  inlineHelperText: {
    color: "#102A43",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  successState: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
  },
  successIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#E7F6ED",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: "#102A43",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  successText: {
    color: "#4F6470",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 460,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F6FAFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2ECF1",
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  loadingTitle: {
    color: "#102A43",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  loadingText: {
    color: "#4F6470",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13, 25, 34, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2ECF1",
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
    gap: 10,
  },
  overlayTitle: {
    color: "#102A43",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2ECF1",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  modalTitleError: {
    color: "#C62828",
    fontSize: 18,
    fontWeight: "800",
  },
  modalMessage: {
    color: "#4F6470",
    fontSize: 14,
    lineHeight: 22,
  },
  modalSecondaryButton: {
    alignSelf: "flex-end",
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E3EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonText: {
    color: "#023047",
    fontWeight: "700",
  },
});
