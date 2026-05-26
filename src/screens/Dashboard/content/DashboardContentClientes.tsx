import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Platform,
  TextInput,
  Modal,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../../services/firebaseConfig";
import { notifyApplePass, notifyAndroidPass } from "../../../services/apiWallet";
import DashboardTopBar from "../../../components/dashboard/DashboardTopBar";
import {
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { clientesStyles as cStyles } from "../../../styles/ClientesStyles";
import { mapDoc, filterItems, sortItems, Cliente } from "../../../utils/clientesHelpers";

const PAGE_SIZE = 20;
const PUSH_BATCH_SIZE = 6;
const IS_WEB = Platform.OS === "web";

function osIconName(so?: string) {
  const s = (so || "").toLowerCase();
  if (s === "android") return "logo-android";
  if (s === "ios" || s === "iphone" || s === "apple") return "logo-apple";
  return "help-circle-outline";
}

function formatSO(so?: string) {
  const s = (so || "").toLowerCase();
  if (s === "ios") return "iOS";
  if (s === "android") return "Android";
  return so || "--";
}

function formatDate(d?: Date | null) {
  if (!d) return "--";
  try {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "--";
  }
}

type Props = {
  onOpenNotificationHistory: () => void;
  companyName?: string;
  topBarProps?: {
    pageTitle?: string;
    companyName?: string;
    isAdmin?: boolean;
    onOpenSupport?: () => void;
    onOpenFaq?: () => void;
    onOpenNotifications?: () => void;
    notificationItems?: Array<{
      id: string;
      title: string;
      description: string;
      tag?: string;
    }>;
    hasUnreadNotifications?: boolean;
  };
  notificationDraft?: {
    clientIds: string[];
    message?: string;
    key: number;
  } | null;
  onConsumeNotificationDraft?: () => void;
};

export default function DashboardContentClientes({
  onOpenNotificationHistory,
  companyName,
  topBarProps,
  notificationDraft,
  onConsumeNotificationDraft,
}: Props) {
  const uid = auth.currentUser?.uid;
  const { width } = useWindowDimensions();
  const useDesktopWebLayout = IS_WEB && width >= 980;
  const useCompactLayout = width < 560;
  const useCompactWebLayout = IS_WEB && width < 900;
  const isIOSWeb =
    IS_WEB && typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent || "");
  const useStaticSendingStatus = isIOSWeb && useCompactWebLayout;
  const contentPadding = useCompactLayout ? 16 : 28;

  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"lastVisit" | "visits">("lastVisit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterOS, setFilterOS] = useState<"all" | "ios" | "android">("all");
  const [filterPremios, setFilterPremios] = useState<"all" | "with" | "without">("all");
  const [showFilter, setShowFilter] = useState(false);
  const [showOSDropdown, setShowOSDropdown] = useState(false);
  const [showPremiosDropdown, setShowPremiosDropdown] = useState(false);
  const closeDropdowns = () => {
    setShowOSDropdown(false);
    setShowPremiosDropdown(false);
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [emailMode, setEmailMode] = useState<"bulk" | "single">("bulk");
  const [emailTarget, setEmailTarget] = useState<Cliente | null>(null);

  const [detailClient, setDetailClient] = useState<Cliente | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pushTarget, setPushTarget] = useState<Cliente | null>(null);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushBody, setPushBody] = useState("");
  const [pushStatus, setPushStatus] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pushSent, setPushSent] = useState(false);
  const [pushMode, setPushMode] = useState<"single" | "bulk">("single");
  const [limitePush, setLimitePush] = useState<number | null>(null);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const pushInputRef = useRef<TextInput | null>(null);
  const pushStatusRef = useRef<any>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateDone, setDeactivateDone] = useState(false);

  const closePushModal = () => {
    setShowPushModal(false);
    setPushTarget(null);
    setPushBody("");
    setPushStatus("");
    setSendingPush(false);
    setPushSent(false);
    setPushMode("single");
  };

  const blurPushInputBeforeSend = useCallback(async () => {
    if (!useStaticSendingStatus) return;

    pushInputRef.current?.blur();

    if (typeof document !== "undefined") {
      const activeElement = document.activeElement as HTMLElement | null;
      activeElement?.blur?.();
    }

    // Wait until iOS Safari finishes resizing the visual viewport after the keyboard closes.
    // If the status appears during that resize, Safari can leave stale paint fragments behind.
    await new Promise<void>((resolve) => {
      if (typeof window === "undefined") {
        resolve();
        return;
      }

      const visualViewport = window.visualViewport;
      let settledTimer = window.setTimeout(finish, 220);

      function finish() {
        window.clearTimeout(settledTimer);
        visualViewport?.removeEventListener("resize", scheduleFinish);
        visualViewport?.removeEventListener("scroll", scheduleFinish);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      }

      function scheduleFinish() {
        window.clearTimeout(settledTimer);
        settledTimer = window.setTimeout(finish, 120);
      }

      visualViewport?.addEventListener("resize", scheduleFinish);
      visualViewport?.addEventListener("scroll", scheduleFinish);
    });
  }, [useStaticSendingStatus]);

  useEffect(() => {
    if (
      !useStaticSendingStatus ||
      !pushStatus ||
      sendingPush ||
      typeof window === "undefined"
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const node = pushStatusRef.current as HTMLElement | null;
      if (!node || typeof node.getBoundingClientRect !== "function") return;

      const previousTransform = node.style.transform;
      const previousWebkitTransform = node.style.webkitTransform;

      node.style.transform = "translateZ(0)";
      node.style.webkitTransform = "translateZ(0)";
      node.getBoundingClientRect();

      window.requestAnimationFrame(() => {
        node.style.transform = previousTransform;
        node.style.webkitTransform = previousWebkitTransform;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pushStatus, sendingPush, useStaticSendingStatus]);

  const loadFirstPage = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "Empresas", uid, "Clientes"),
        orderBy("creadoEn", "desc"),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(mapDoc);
      setItems(list);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e: any) {
      console.error(e);
      setError("No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!uid || !hasMore || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "Empresas", uid, "Clientes"),
        orderBy("creadoEn", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const more = snap.docs.map(mapDoc);
      setItems((prev) => [...prev, ...more]);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [uid, hasMore, lastDoc, loadingMore]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    if (!notificationDraft) return;

    setSelectedIds(new Set(notificationDraft.clientIds.filter(Boolean)));
    setPushMode("bulk");
    setPushTarget(null);
    setPushStatus("");
    setPushBody(notificationDraft.message || "");
    setPushSent(false);
    setSendingPush(false);
    setShowPushModal(true);
    onConsumeNotificationDraft?.();
  }, [notificationDraft, onConsumeNotificationDraft]);

  useEffect(() => {
    if (!IS_WEB || !useCompactWebLayout || !isIOSWeb || !showPushModal || typeof document === "undefined") {
      return;
    }

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyPosition = bodyStyle.position;
    const previousBodyTop = bodyStyle.top;
    const previousBodyWidth = bodyStyle.width;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousHtmlOverflow = htmlStyle.overflow;

    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";

    return () => {
      bodyStyle.position = previousBodyPosition;
      bodyStyle.top = previousBodyTop;
      bodyStyle.width = previousBodyWidth;
      bodyStyle.overflow = previousBodyOverflow;
      htmlStyle.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [showPushModal, useCompactWebLayout, isIOSWeb]);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !useCompactWebLayout ||
      typeof document === "undefined" ||
      !isIOSWeb
    ) {
      return;
    }

    const styleId = "passio-clientes-no-zoom";
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
  }, [useCompactWebLayout, isIOSWeb]);

  const updatePushCounter = useCallback(
    async (sendCount: number) => {
      if (!uid) throw new Error("NO_UID");
      let contRef = doc(db, "Empresas", uid, "Contador", "contador");
      const coll = await getDocs(collection(db, "Empresas", uid, "Contador"));
      if (!coll.empty) {
        contRef = doc(db, "Empresas", uid, "Contador", coll.docs[0].id);
      }

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(contRef);
        const data = snap.exists() ? snap.data() || {} : {};
        const mesActual = new Date();
        const mesKey = `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2, "0")}`;
        let current = typeof data.notificacionesMes === "number" ? data.notificacionesMes : 0;
        const mesConteo = data.mesConteo as string | undefined;
        if (mesConteo !== mesKey) {
          current = 0;
        }
        const nuevoTotal = Math.max(0, current + sendCount);
        if (sendCount > 0 && limitePush != null && nuevoTotal > limitePush) {
          throw new Error("LIMIT_PUSH");
        }
        tx.set(
          contRef,
          {
            notificacionesMes: nuevoTotal,
            mesConteo: mesKey,
            actualizadoEl: serverTimestamp(),
          },
          { merge: true }
        );
      });
    },
    [uid, limitePush]
  );

  useEffect(() => {
    const loadLimitePush = async () => {
      if (!uid) return;
      try {
        const empSnap = await getDoc(doc(db, "Empresas", uid));
        const empresaData = empSnap.exists() ? (empSnap.data() as any) : null;
        const planName = empresaData?.plan ?? null;
        const nombreEmpresa = String(empresaData?.nombre || "").trim();
        setEmpresaNombre(nombreEmpresa);
        if (planName) {
          let planData: any = null;
          let planSnap = await getDocs(
            query(collection(db, "Planes"), where("nombrePlan", "==", planName))
          );
          if (planSnap.docs[0]) {
            planData = planSnap.docs[0].data();
          } else {
            planSnap = await getDocs(collection(db, "Planes"));
            const lower = String(planName).toLowerCase();
            const match = planSnap.docs.find(
              (d) => String(d.data().nombrePlan || "").toLowerCase() === lower
            );
            if (match) planData = match.data();
          }
          if (planData && typeof planData.limiteNotificacion === "number") {
            setLimitePush(planData.limiteNotificacion);
          }
        }
      } catch (e) {
        console.log("No se pudo cargar limite de notificaciones:", e);
      }
    };
    loadLimitePush();
  }, [uid]);

  const filteredItems = useMemo(
    () => filterItems(items, search, filterOS, filterPremios),
    [items, search, filterOS, filterPremios]
  );

  const androidNotificationHeader = useMemo(() => {
    const nombre = empresaNombre.trim();
    return nombre ? `${nombre} (Passio)` : "Passio";
  }, [empresaNombre]);

  const saveNotificationHistory = useCallback(
    async (mensaje: string, totalClientes: number, totalEnviados: number, totalFallidos: number) => {
      if (!uid || !mensaje.trim() || totalClientes <= 0) {
        return { ok: false as const, reason: "invalid_payload" as const };
      }

      const estado: "completada" | "parcial" | "erronea" =
        totalEnviados === 0
          ? "erronea"
          : totalFallidos > 0
            ? "parcial"
            : "completada";

      const payload = {
        mensaje: mensaje.trim(),
        totalClientes,
        totalEnviados,
        totalFallidos,
        estado,
        fechaEnvio: serverTimestamp(),
      };

      try {
        const ref = await addDoc(collection(db, "Empresas", uid, "HistorialNotificaciones"), payload);
        return { ok: true as const, id: ref.id, estado };
      } catch (historyError: any) {
        return {
          ok: false as const,
          reason: "write_failed" as const,
          errorMessage: String(historyError?.message || historyError || "unknown_error"),
        };
      }
    },
    [uid]
  );

  const sendPushNotifications = useCallback(
    async (targets: Cliente[], message: string) => {
      let okCount = 0;
      const failures: Array<{
        id: string;
        so?: string;
        status: number;
        errorText?: string;
      }> = [];

      for (let index = 0; index < targets.length; index += PUSH_BATCH_SIZE) {
        const batch = targets.slice(index, index + PUSH_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (target) => {
            const isIOS = target.so === "ios";
            return isIOS
              ? notifyApplePass({ idUsuario: target.id, notificacion: message })
              : notifyAndroidPass({
                  idUsuario: target.id,
                  notificacion: message,
                  cabecera: androidNotificationHeader,
                });
          })
        );

        okCount += batchResults.filter((response) => response.ok).length;
        batchResults.forEach((response, responseIndex) => {
          if (!response.ok) {
            const target = batch[responseIndex];
            failures.push({
              id: target.id,
              so: target.so,
              status: response.status,
              errorText: response.errorText,
            });
          }
        });

        if (targets.length > PUSH_BATCH_SIZE) {
          const processed = Math.min(index + batch.length, targets.length);
          if (!useStaticSendingStatus) {
            setPushStatus(`Enviando ${processed}/${targets.length}...`);
          }
        }
      }

      return { okCount, failures };
    },
    [androidNotificationHeader, useStaticSendingStatus]
  );

  const sortedItems = useMemo(
    () => sortItems(filteredItems, sortField, sortOrder),
    [filteredItems, sortField, sortOrder]
  );
  const toggleSortOrder = useCallback(
    () => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc")),
    []
  );
  const toggleSortField = useCallback(
    () => setSortField((prev) => (prev === "lastVisit" ? "visits" : "lastVisit")),
    []
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = sortedItems.map((it) => it.id);
      const next = new Set(prev);
      const allSelected = allIds.length > 0 && allIds.every((id) => next.has(id));
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  }, [sortedItems]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    sortedItems.length > 0 && sortedItems.every((it) => selectedIds.has(it.id));

  const openDetail = useCallback((client: Cliente) => {
    setDetailClient(client);
    setShowDetail(true);
    setConfirmDeactivate(false);
    setDeactivateError(null);
    setDeactivateDone(false);
  }, []);

  const openPush = useCallback((client: Cliente) => {
    setPushTarget(client);
    setPushMode("single");
    setPushBody("");
    setPushStatus("");
    setPushSent(false);
    setSendingPush(false);
    setShowPushModal(true);
  }, []);

  const requestDeactivate = () => {
    setConfirmDeactivate(true);
    setDeactivateError(null);
    setDeactivateDone(false);
  };

  const cancelDeactivate = () => {
    setConfirmDeactivate(false);
    setDeactivateError(null);
  };

  const confirmDeactivateUser = useCallback(async () => {
    if (!uid || !detailClient?.id) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      const ref = doc(db, "Empresas", uid, "Clientes", detailClient.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setDeactivateError("No se encontró el cliente. Refresca e intenta nuevamente.");
        return;
      }
      await updateDoc(ref, {
        activo: false,
      });

      setItems((prev) =>
        prev.map((it) => (it.id === detailClient.id ? { ...it, activo: false } : it))
      );
      setDetailClient((prev) => (prev ? { ...prev, activo: false } : prev));
      setDeactivateDone(true);
      setConfirmDeactivate(false);
    } catch (e: any) {
      console.error("Error desactivando cliente:", e);
      setDeactivateError("No se pudo desactivar el usuario. Intenta nuevamente.");
    } finally {
      setDeactivating(false);
    }
  }, [uid, detailClient?.id]);

  const handleSendEmail = async () => {
    const recipientCount = emailMode === "single" ? (emailTarget ? 1 : 0) : selectedCount;
    if (!recipientCount) return;
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailStatus("Asunto y cuerpo son obligatorios.");
      return;
    }
    setSending(true);
    setEmailStatus("Enviando (placeholder)...");
    setTimeout(() => {
      setSending(false);
      setEmailStatus(`Enviado a ${recipientCount} cliente(s) (simulado).`);
      setShowEmailModal(false);
      setEmailSubject("");
      setEmailBody("");
      setEmailTarget(null);
      setEmailMode("bulk");
    }, 800);
  };

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <View style={[cStyles.checkbox, checked && cStyles.checkboxChecked]}>
      {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
    </View>
  );

  const ActionIconButton = ({
    icon,
    label,
    onPress,
    disabled,
    tooltipText,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    tooltipText?: string;
  }) => {
    const [hover, setHover] = useState(false);
    const canPress = !disabled;
    return (
      <Pressable
        onPress={canPress ? onPress : undefined}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={[cStyles.iconButton, disabled && { opacity: 0.5 }]}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {IS_WEB && hover ? (
          <View style={cStyles.tooltip}>
            <Text style={cStyles.tooltipText}>{tooltipText || label}</Text>
          </View>
        ) : null}
        <Ionicons name={icon} size={18} color="#023047" />
      </Pressable>
    );
  };

  const StatBadge = ({
    icon,
    label,
    value,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: number;
  }) => {
    const [hover, setHover] = useState(false);
    return (
      <Pressable
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={cStyles.statBadge}
      >
        {IS_WEB && hover ? (
          <View style={cStyles.tooltip}>
            <Text style={cStyles.tooltipText}>{`${label}: ${value}`}</Text>
          </View>
        ) : null}
        <Ionicons name={icon} size={14} color="#023047" />
      </Pressable>
    );
  };

  const ModalHeader = ({
    icon,
    title,
    subtitle,
    onClose,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string | null;
    onClose: () => void;
  }) => (
    <View style={cStyles.modalHeader}>
      <View style={cStyles.modalTitleRow}>
        <View style={cStyles.modalIconBadge}>
          <Ionicons name={icon} size={18} color="#023047" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={cStyles.modalTitle}>{title}</Text>
          {subtitle ? (
            <Text style={cStyles.modalSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <TouchableOpacity onPress={onClose} style={cStyles.modalCloseIcon}>
        <Ionicons name="close" size={18} color="#023047" />
      </TouchableOpacity>
    </View>
  );

  const HeaderWeb = () => (
    <View style={cStyles.headerRow}>
      <TouchableOpacity onPress={toggleSelectAll} style={cStyles.checkboxHitbox}>
        <Checkbox checked={allVisibleSelected} />
      </TouchableOpacity>

      <View style={cStyles.headerNameCell}>
        <Text style={cStyles.headerText}>Cliente</Text>
      </View>

      <TouchableOpacity style={cStyles.headerDateCell} onPress={toggleSortOrder}>
        <Ionicons
          name={sortField === "lastVisit" ? "calendar-outline" : "footsteps-outline"}
          size={16}
          color="#023047"
        />
        <Text style={[cStyles.headerText, { textAlign: "center" }]}>
          {sortField === "lastVisit" ? "\u00DAltima visita" : "Visitas"}
        </Text>
        <Ionicons
          name={sortOrder === "desc" ? "chevron-down" : "chevron-up"}
          size={16}
          color="#023047"
        />
      </TouchableOpacity>

      {useDesktopWebLayout ? (
        <View style={cStyles.headerStatsCell}>
          <Text style={[cStyles.headerText, { textAlign: "center" }]}>Estadísticas</Text>
        </View>
      ) : null}

      <Text style={[cStyles.headerText, cStyles.headerActionsCell]}>Acciones</Text>
    </View>
  );

  const RowWebBase = ({
    item,
    index,
    selected,
  }: {
    item: Cliente;
    index: number;
    selected: boolean;
  }) => {
    const fecha = item.ultimaVisita || item.creadoEn;
    const icon = osIconName(item.so);
    const soText = formatSO(item.so);
    const visitasTotales = Number(item.visitasTotales ?? 0);
    const cicloVisitas = Number(item.cicloVisitas ?? 0);
    const premiosDisponibles = Number(item.premiosDisponibles ?? 0);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => toggleSelect(item.id)}
        style={[cStyles.row, index % 2 === 0 && cStyles.rowEven, selected && cStyles.cardSelected]}
      >
        <View style={cStyles.checkboxHitbox}>
          <Checkbox checked={selected} />
        </View>

        <View style={cStyles.rowIdentityCell}>
          <View style={cStyles.rowAvatar}>
            <Ionicons
              name={icon}
              size={16}
              color={soText === "Android" ? "#2e7d32" : soText === "iOS" ? "#111" : "#607d8b"}
            />
          </View>
          <View style={cStyles.rowIdentityText}>
            <Text style={cStyles.nameText} numberOfLines={1} ellipsizeMode="tail">
              {item.nombreCompleto || "--"}
            </Text>
            <Text style={cStyles.subtleRowText} numberOfLines={1} ellipsizeMode="tail">
              {item.email || item.id}
            </Text>
          </View>
        </View>

        <View style={cStyles.rowDateCell}>
          <Text style={cStyles.subtleLabel}>Última visita</Text>
          <Text style={cStyles.rowDateText}>{formatDate(fecha)}</Text>
        </View>

        {useDesktopWebLayout ? (
          <View style={cStyles.rowStatsCell}>
            <View style={cStyles.rowStatsWrap}>
              <View style={cStyles.rowStatPill}>
                <Ionicons name="gift-outline" size={15} color="#FB8500" />
                <Text style={cStyles.rowStatPillText}>{premiosDisponibles}</Text>
              </View>
              <StatBadge label="Ciclo visitas" value={cicloVisitas} icon="repeat-outline" />
              <StatBadge label="Visitas totales" value={visitasTotales} icon="footsteps-outline" />
            </View>
          </View>
        ) : null}

        <View style={cStyles.rowActionsCell}>
          <View style={cStyles.rowActions}>
            <ActionIconButton
              icon="notifications-outline"
              label="Enviar notificación"
              onPress={() => openPush(item)}
            />
            <ActionIconButton
              icon="mail-outline"
              label="Enviar correo"
              tooltipText="Próximamente"
              onPress={() => {}}
              disabled
            />
            <TouchableOpacity onPress={() => openDetail(item)} style={cStyles.detailsButton}>
              <Text style={cStyles.detailsButtonText}>Ver detalle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const CardMobileBase = ({
    item,
    selected,
  }: {
    item: Cliente;
    selected: boolean;
  }) => {
    const fecha = item.ultimaVisita || item.creadoEn;
    const icon = osIconName(item.so);
    const soText = formatSO(item.so);
    const visitasTotales = Number(item.visitasTotales ?? 0);
    const cicloVisitas = Number(item.cicloVisitas ?? 0);
    const premiosDisponibles = Number(item.premiosDisponibles ?? 0);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => toggleSelect(item.id)}
        style={[cStyles.card, selected && cStyles.cardSelected]}
      >
        <View style={cStyles.cardHeader}>
          <View style={cStyles.cardHeaderLeft}>
            <Checkbox checked={selected} />
            <View style={cStyles.rowAvatar}>
              <Ionicons
                name={icon}
                size={18}
                color={soText === "Android" ? "#2e7d32" : soText === "iOS" ? "#111" : "#607d8b"}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={cStyles.cardName} numberOfLines={1}>
                {item.nombreCompleto || "--"}
              </Text>
              <Text style={cStyles.cardSub} numberOfLines={1}>
                {item.email || item.id}
              </Text>
            </View>
          </View>
          <View style={cStyles.mobileStatusChip}>
            <Text style={cStyles.mobileStatusChipText}>
              {item.activo === false ? "Inactivo" : "Activo"}
            </Text>
          </View>
        </View>

        <View style={cStyles.mobileStatsStrip}>
          <View style={cStyles.mobileStatPill}>
            <Ionicons name="calendar-outline" size={15} color="#023047" />
            <Text style={cStyles.mobileStatPillText}>{`Visita: ${formatDate(fecha)}`}</Text>
          </View>
          <View style={cStyles.mobileStatPill}>
            <Ionicons name="gift-outline" size={15} color="#FB8500" />
            <Text style={cStyles.mobileStatPillText}>{premiosDisponibles}</Text>
          </View>
          <View style={cStyles.mobileStatPill}>
            <Ionicons name="repeat-outline" size={15} color="#219EBC" />
            <Text style={cStyles.mobileStatPillText}>{cicloVisitas}</Text>
          </View>
          <View style={cStyles.mobileStatPill}>
            <Ionicons name="footsteps-outline" size={15} color="#2E7D32" />
            <Text style={cStyles.mobileStatPillText}>{visitasTotales}</Text>
          </View>
        </View>

        <View style={cStyles.cardActionsRow}>
          <ActionIconButton
            icon="notifications-outline"
            label="Enviar notificación"
            onPress={() => openPush(item)}
          />
          <ActionIconButton
            icon="mail-outline"
            label="Enviar correo"
            tooltipText="Próximamente"
            onPress={() => {}}
            disabled
          />
          <TouchableOpacity onPress={() => openDetail(item)} style={cStyles.detailsButton}>
            <Text style={cStyles.detailsButtonText}>Ver detalle</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const RowWeb = useMemo(
    () =>
      React.memo(
        RowWebBase,
        (prev, next) =>
          prev.item === next.item && prev.selected === next.selected && prev.index === next.index
      ),
    [openDetail, openPush, toggleSelect]
  );

  const CardMobile = useMemo(
    () =>
      React.memo(
        CardMobileBase,
        (prev, next) => prev.item === next.item && prev.selected === next.selected
      ),
    [openDetail, openPush, toggleSelect]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Cliente; index: number }) => {
      const selected = selectedIds.has(item.id);
      return (
        <View style={{ paddingHorizontal: contentPadding }}>
          {useDesktopWebLayout ? (
            <RowWeb item={item} index={index} selected={selected} />
          ) : (
            <CardMobile item={item} selected={selected} />
          )}
        </View>
      );
    },
    [selectedIds, RowWeb, CardMobile, useDesktopWebLayout, contentPadding]
  );

  const listHeader = (
    <View style={{ zIndex: 80, elevation: 80, overflow: "visible" }}>
      {topBarProps ? (
        <View style={{ zIndex: 90, elevation: 90, overflow: "visible" }}>
          <DashboardTopBar {...topBarProps} />
        </View>
      ) : null}

      <View style={[cStyles.scrollSection, { paddingHorizontal: contentPadding, paddingTop: 16 }]}>
        <View style={cStyles.toolbarCard}>
          <View style={[cStyles.searchRow, useCompactLayout && cStyles.searchRowCompact]}>
            <View style={cStyles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color="#607d8b" />
              <TextInput
                placeholder="Buscar por nombre, correo o ID"
                placeholderTextColor="#607d8b"
                value={search}
                onChangeText={setSearch}
                style={cStyles.searchInput}
              />
            </View>

            <TouchableOpacity onPress={() => setShowFilter(true)} style={cStyles.filterButton}>
              <Ionicons name="options-outline" size={18} color="#023047" />
              <Text style={cStyles.filterButtonText}>Filtros</Text>
            </TouchableOpacity>
          </View>

          {(search.trim() || filterOS !== "all" || filterPremios !== "all") && (
            <View style={cStyles.chipsRow}>
              <Text style={cStyles.chipsLabel}>Filtros aplicados:</Text>

              {search.trim() ? (
                <View style={cStyles.chip}>
                  <Text style={cStyles.chipText}>{`Busca "${search.trim()}"`}</Text>
                </View>
              ) : null}

              {filterOS !== "all" ? (
                <View style={[cStyles.chip, cStyles.chipGreen]}>
                  <Text style={cStyles.chipGreenText}>
                    {`SO: ${filterOS === "ios" ? "Apple (iOS)" : "Android"}`}
                  </Text>
                </View>
              ) : null}

              {filterPremios !== "all" ? (
                <View style={[cStyles.chip, cStyles.chipGreen]}>
                  <Text style={cStyles.chipGreenText}>
                    {filterPremios === "with" ? "Con premios" : "Sin premios"}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={cStyles.toolbarFooter}>
            <View style={cStyles.selectionMetaWrap}>
              <Text style={cStyles.metaText}>{`Total cargados: ${items.length}`}</Text>
              <Text style={cStyles.metaDivider}>{"\u2022"}</Text>
              <Text style={cStyles.metaText}>
                {selectedCount ? `${selectedCount} seleccionados` : "Sin selección activa"}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleSortField} style={cStyles.selectAllButton}>
              <Text style={cStyles.selectAllButtonText}>
                {sortField === "lastVisit" ? "Orden: \u00FAltima visita" : "Orden: visitas"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSortOrder} style={cStyles.selectAllButton}>
              <Text style={cStyles.selectAllButtonText}>
                {sortField === "lastVisit"
                  ? sortOrder === "desc"
                    ? "M\u00E1s reciente"
                    : "M\u00E1s antigua"
                  : sortOrder === "desc"
                    ? "Mayor"
                    : "Menor"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSelectAll} style={cStyles.selectAllButton}>
              <Text style={cStyles.selectAllButtonText}>
                {allVisibleSelected ? "Quitar selección" : "Seleccionar todo"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={cStyles.bulkActionsRow}>
            <Text style={cStyles.bulkActionsLabel}>Acción masiva</Text>
            <TouchableOpacity
              onPress={() => {}}
              disabled
              style={[cStyles.massActionButton, cStyles.massActionButtonMuted]}
              accessibilityLabel={`Correo próximamente (${selectedCount})`}
            >
              <Ionicons name="mail-outline" size={18} color="#607d8b" />
              <View style={[cStyles.massActionCount, cStyles.massActionCountMuted]}>
                <Text style={cStyles.massActionCountTextMuted}>{selectedCount}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setPushMode("bulk");
                setPushTarget(null);
                setPushStatus("");
                setPushBody("");
                setPushSent(false);
                setSendingPush(false);
                setShowPushModal(true);
              }}
              disabled={selectedCount === 0}
              style={[
                cStyles.massActionButton,
                selectedCount === 0 && cStyles.massActionButtonDisabled,
              ]}
              accessibilityLabel={`Enviar notificación (${selectedCount})`}
            >
              <Ionicons
                name="notifications-outline"
                size={18}
                color={selectedCount === 0 ? "#8AA0AE" : "#fff"}
              />
              <View
                style={[
                  cStyles.massActionCount,
                  selectedCount === 0 && cStyles.massActionCountDisabled,
                ]}
              >
                <Text
                  style={[
                    cStyles.massActionCountText,
                    selectedCount === 0 && cStyles.massActionCountTextDisabled,
                  ]}
                >
                  {selectedCount}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onOpenNotificationHistory}
              style={cStyles.historyInlineButton}
            >
              <Ionicons name="time-outline" size={18} color="#023047" />
              <Text style={cStyles.historyInlineButtonText}>Historial</Text>
            </TouchableOpacity>
          </View>
        </View>

        {useDesktopWebLayout && sortedItems.length > 0 ? <HeaderWeb /> : null}
      </View>
    </View>
  );

  if (!uid) {
    return (
      <View style={{ flex: 1 }}>
        {topBarProps ? <DashboardTopBar {...topBarProps} /> : null}
        <View style={[cStyles.scrollSection, { paddingHorizontal: contentPadding, paddingTop: 16 }]}>
          <Text>Debes iniciar sesión para ver tus clientes.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        {topBarProps ? <DashboardTopBar {...topBarProps} /> : null}
        <View style={[cStyles.scrollSection, { paddingHorizontal: contentPadding, paddingTop: 16 }]}>
          <ActivityIndicator size="large" color="#8ecae6" />
          <Text style={{ marginTop: 10 }}>Cargando clientes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <Modal visible={showFilter} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          {(showOSDropdown || showPremiosDropdown) && (
            <Pressable
              onPress={closeDropdowns}
              style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
            />
          )}
          <View style={[cStyles.modalCard, cStyles.filterModalCard]}>
            <ModalHeader
              icon="options-outline"
              title="Filtros"
              subtitle="Ajusta la vista de clientes sin perder tu selección actual."
              onClose={() => setShowFilter(false)}
            />

            <Text style={cStyles.optionLabel}>Sistema operativo</Text>
            <View style={[cStyles.dropdownContainer, showOSDropdown && { zIndex: 50 }]}>
              <TouchableOpacity onPress={() => setShowOSDropdown((v) => !v)} style={cStyles.dropdown}>
                <Text style={cStyles.dropdownText}>
                  {filterOS === "all" ? "Todos" : filterOS === "ios" ? "Apple (iOS)" : "Android"}
                </Text>
                <Ionicons
                  name={showOSDropdown ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#023047"
                />
              </TouchableOpacity>
              {showOSDropdown && (
                <View style={cStyles.dropdownList}>
                  {[
                    { label: "Todos", value: "all" as const },
                    { label: "Apple (iOS)", value: "ios" as const },
                    { label: "Android", value: "android" as const },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        setFilterOS(opt.value);
                        setShowOSDropdown(false);
                      }}
                      style={[
                        cStyles.optionItem,
                        filterOS === opt.value && cStyles.optionItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          cStyles.optionText,
                          filterOS === opt.value && cStyles.optionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={cStyles.optionLabel}>Premios</Text>
            <View style={[cStyles.dropdownContainer, showPremiosDropdown && { zIndex: 45 }]}>
              <TouchableOpacity
                onPress={() => setShowPremiosDropdown((v) => !v)}
                style={cStyles.dropdown}
              >
                <Text style={cStyles.dropdownText}>
                  {filterPremios === "all"
                    ? "Todos"
                    : filterPremios === "with"
                      ? "Con premios disponibles"
                      : "Sin premios disponibles"}
                </Text>
                <Ionicons
                  name={showPremiosDropdown ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#023047"
                />
              </TouchableOpacity>
              {showPremiosDropdown && (
                <View style={cStyles.dropdownList}>
                  {[
                    { label: "Todos", value: "all" as const },
                    { label: "Con premios disponibles", value: "with" as const },
                    { label: "Sin premios disponibles", value: "without" as const },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        setFilterPremios(opt.value);
                        setShowPremiosDropdown(false);
                      }}
                      style={[
                        cStyles.optionItem,
                        filterPremios === opt.value && cStyles.optionItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          cStyles.optionText,
                          filterPremios === opt.value && cStyles.optionTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={cStyles.modalFooterActions}>
              <TouchableOpacity
                onPress={() => {
                  setFilterOS("all");
                  setFilterPremios("all");
                  closeDropdowns();
                }}
                style={cStyles.modalGhostButton}
              >
                <Text style={cStyles.modalGhostButtonText}>Restablecer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowFilter(false)} style={cStyles.modalPrimaryButton}>
                <Text style={cStyles.modalPrimaryText}>Listo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDetail} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, cStyles.detailModalCard]}>
            <ModalHeader
              icon="person-circle-outline"
              title="Detalle del cliente"
              subtitle={detailClient?.nombreCompleto || null}
              onClose={() => setShowDetail(false)}
            />
            <ScrollView style={{ maxHeight: 480 }}>
              <View style={cStyles.detailInfoCard}>
                <View style={cStyles.detailRowInline}>
                  <Text style={cStyles.detailKey}>Correo</Text>
                  <Text style={cStyles.detailValue}>{detailClient?.email || "--"}</Text>
                </View>
                <View style={cStyles.detailRowInline}>
                  <Text style={cStyles.detailKey}>Teléfono</Text>
                  <Text style={cStyles.detailValue}>{detailClient?.telefono || "--"}</Text>
                </View>
                <View style={cStyles.detailRowInline}>
                  <Text style={cStyles.detailKey}>Sistema</Text>
                  <Text style={cStyles.detailValue}>{formatSO(detailClient?.so)}</Text>
                </View>
                <View style={cStyles.detailRowInline}>
                  <Text style={cStyles.detailKey}>Creado</Text>
                  <Text style={cStyles.detailValue}>{formatDate(detailClient?.creadoEn || null)}</Text>
                </View>
                <View style={cStyles.detailRowInline}>
                  <Text style={cStyles.detailKey}>Estado</Text>
                  <Text style={cStyles.detailValue}>
                    {detailClient?.activo === false ? "Desactivado" : "Activo"}
                  </Text>
                </View>
              </View>

              <Text style={cStyles.detailSectionTitle}>Actividad</Text>
              <View style={cStyles.detailStatsGrid}>
                <View style={cStyles.detailStatCard}>
                  <Text style={cStyles.detailStatLabel}>Ciclo</Text>
                  <Text style={cStyles.detailStatValue}>{Number(detailClient?.cicloVisitas ?? 0)}</Text>
                </View>
                <View style={cStyles.detailStatCard}>
                  <Text style={cStyles.detailStatLabel}>Premios disponibles</Text>
                  <Text style={cStyles.detailStatValue}>{Number(detailClient?.premiosDisponibles ?? 0)}</Text>
                </View>
                <View style={cStyles.detailStatCard}>
                  <Text style={cStyles.detailStatLabel}>Premios canjeados</Text>
                  <Text style={cStyles.detailStatValue}>{Number(detailClient?.premiosCanjeados ?? 0)}</Text>
                </View>
                <View style={cStyles.detailStatCard}>
                  <Text style={cStyles.detailStatLabel}>Visitas totales</Text>
                  <Text style={cStyles.detailStatValue}>{Number(detailClient?.visitasTotales ?? 0)}</Text>
                </View>
              </View>

              <View style={cStyles.detailInfoCard}>
                <View style={cStyles.detailRowInline}>
                  <Text style={cStyles.detailKey}>Última visita</Text>
                  <Text style={cStyles.detailValue}>{formatDate(detailClient?.ultimaVisita || null)}</Text>
                </View>
              </View>

              {deactivateDone ? <Text style={cStyles.successText}>Usuario desactivado.</Text> : null}

              {deactivateError ? <Text style={cStyles.errorText}>{deactivateError}</Text> : null}

              {detailClient?.activo !== false && !confirmDeactivate ? (
                <TouchableOpacity
                  onPress={requestDeactivate}
                  style={[cStyles.dangerButton, deactivating && { opacity: 0.7 }]}
                  disabled={deactivating}
                >
                  <Text style={cStyles.dangerButtonText}>Desactivar usuario</Text>
                </TouchableOpacity>
              ) : null}

              {confirmDeactivate ? (
                <View style={cStyles.confirmBox}>
                  <Text style={cStyles.confirmText}>¿Confirmas desactivar este usuario?</Text>
                  <View style={cStyles.confirmActions}>
                    <TouchableOpacity onPress={cancelDeactivate} disabled={deactivating}>
                      <Text style={cStyles.confirmCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={confirmDeactivateUser}
                      disabled={deactivating}
                      style={[cStyles.modalPrimaryButton, deactivating && { opacity: 0.7 }]}
                    >
                      <Text style={cStyles.modalPrimaryText}>
                        {deactivating ? "Desactivando..." : "Confirmar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={[cStyles.modalActions, { justifyContent: "center", marginTop: 8 }]}>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={cStyles.modalGhostButton}>
                <Text style={cStyles.modalGhostButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPushModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          <View
            style={[
              cStyles.modalBackdrop,
              (Platform.OS === "ios" || (useCompactWebLayout && isIOSWeb)) &&
                cStyles.modalBackdropTopAligned,
            ]}
          >
          <View
            style={[
              cStyles.modalCard,
              cStyles.pushModalCard,
              IS_WEB && !useCompactWebLayout && cStyles.pushModalCardWide,
            ]}
          >
            <ModalHeader
              icon="notifications-outline"
              title="Enviar notificación"
              subtitle={
                pushMode === "single"
                  ? pushTarget?.nombreCompleto || null
                  : `${selectedCount} destinatarios seleccionados`
              }
              onClose={closePushModal}
            />
            <View style={cStyles.targetSummaryCard}>
              <Text style={cStyles.targetSummaryLabel}>
                {pushMode === "single" ? "Cliente" : "Destinatarios"}
              </Text>
              <Text style={cStyles.targetSummaryValue}>
                {pushMode === "single" ? pushTarget?.nombreCompleto || "--" : `${selectedCount}`}
              </Text>
            </View>
            {pushSent && !useStaticSendingStatus ? (
              <View>
                <Text style={cStyles.successText}>Notificación enviada.</Text>
                <View style={cStyles.modalActions}>
                  <TouchableOpacity onPress={closePushModal} style={cStyles.modalGhostButton}>
                    <Text style={cStyles.modalGhostButtonText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={cStyles.fieldLabel}>Mensaje</Text>
                <TextInput
                  ref={pushInputRef}
                  placeholder="Escribe la notificación que enviarás"
                  placeholderTextColor="#607d8b"
                  value={pushBody}
                  onChangeText={setPushBody}
                  autoCorrect={false}
                  spellCheck={false}
                  editable={!pushSent && !sendingPush}
                  multiline
                  numberOfLines={4}
                  style={[cStyles.input, cStyles.textareaInput]}
                />
                {pushSent ? (
                  <Text style={cStyles.successText}>Notificación enviada.</Text>
                ) : !sendingPush && (pushStatus || useStaticSendingStatus) ? (
                  <View
                    ref={pushStatusRef}
                    style={[
                      cStyles.inlineStatusBox,
                      !pushStatus && useStaticSendingStatus && cStyles.inlineStatusBoxHidden,
                    ]}
                    pointerEvents={pushStatus ? "auto" : "none"}
                  >
                    <Text style={cStyles.inlineStatus}>{pushStatus || " "}</Text>
                  </View>
                ) : null}
                <View style={cStyles.modalActions}>
                  <TouchableOpacity onPress={closePushModal} style={cStyles.modalGhostButton}>
                    <Text style={cStyles.modalGhostButtonText}>Cerrar</Text>
                  </TouchableOpacity>
                  {!pushSent ? (
                    <TouchableOpacity
                      onPress={async () => {
                        const targets =
                          pushMode === "single" && pushTarget
                            ? [pushTarget]
                            : items.filter((it) => selectedIds.has(it.id));
                        if (targets.length === 0) {
                          setPushStatus("No hay destinatarios.");
                          return;
                        }

                        const message = pushBody.trim();
                        if (!message) {
                          setPushStatus("Ingresa un mensaje.");
                          return;
                        }

                        let counterIncremented = false;

                        try {
                          await blurPushInputBeforeSend();
                          setSendingPush(true);
                          setPushStatus(
                            useStaticSendingStatus
                              ? ""
                              : targets.length > PUSH_BATCH_SIZE
                                ? `Enviando 0/${targets.length}...`
                                : "Enviando..."
                          );

                          try {
                            await updatePushCounter(1);
                            counterIncremented = true;
                          } catch (e: any) {
                            if (String(e?.message).includes("LIMIT_PUSH")) {
                              setPushStatus("Alcanzaste el límite de notificaciones de tu plan.");
                              setSendingPush(false);
                              return;
                            }
                            throw e;
                          }

                          const { okCount, failures } = await sendPushNotifications(targets, message);
                          const networkLikeFailures = failures.filter(
                            (failure) =>
                              failure.status === 0 ||
                              /failed to fetch|network request failed/i.test(String(failure.errorText || ""))
                          );

                          if (failures.length > 0) {
                            console.warn("[PushNotifications] Fallos al enviar:", {
                              origin:
                                IS_WEB && typeof window !== "undefined"
                                  ? window.location.origin
                                  : Platform.OS,
                              totalTargets: targets.length,
                              okCount,
                              failures,
                            });
                          }

                          let historyResult:
                            | { ok: true; id: string; estado: "completada" | "parcial" | "erronea" }
                            | { ok: false; reason: "invalid_payload" | "write_failed"; errorMessage?: string }
                            | null = null;

                          const failCount = Math.max(0, targets.length - okCount);

                          if (targets.length > 0) {
                            historyResult = await saveNotificationHistory(message, targets.length, okCount, failCount);
                          }

                          if (okCount === targets.length) {
                            if (!useStaticSendingStatus) {
                              setPushBody("");
                            }
                            setPushStatus("");
                            setPushSent(true);
                            return;
                          }

                          if (okCount === 0 && counterIncremented) {
                            try {
                              await updatePushCounter(-1);
                            } catch (rollbackError) {
                              console.warn("[PushNotifications] No se pudo revertir el contador:", rollbackError);
                            }
                          }

                          if (okCount > 0) {
                            setPushStatus(`Enviadas ${okCount}/${targets.length}. Algunas no pudieron enviarse.`);
                            return;
                          }

                          if (networkLikeFailures.length === failures.length && failures.length > 0) {
                            setPushStatus(
                              "No se pudo enviar la notificación desde este navegador. Revisa la conexión o el acceso permitido del sitio."
                            );
                          } else {
                            setPushStatus("No se pudo enviar la notificación. Intenta nuevamente.");
                          }
                        } catch (err) {
                          setPushStatus(`Error: ${String(err)}`);
                        } finally {
                          setSendingPush(false);
                        }
                      }}
                      style={[cStyles.modalPrimaryButton, sendingPush && { opacity: 0.7 }]}
                      disabled={sendingPush}
                    >
                      <Text style={cStyles.modalPrimaryText}>{sendingPush ? "Enviando..." : "Enviar"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showEmailModal} transparent animationType="fade">
        <View style={cStyles.modalBackdrop}>
          <View style={[cStyles.modalCard, cStyles.pushModalCard]}>
            <ModalHeader
              icon="mail-outline"
              title="Enviar correo"
              subtitle={
                emailMode === "single"
                  ? emailTarget?.nombreCompleto || null
                  : `${selectedCount} destinatarios seleccionados`
              }
              onClose={() => setShowEmailModal(false)}
            />
            <TextInput
              placeholder="Asunto"
              placeholderTextColor="#607d8b"
              value={emailSubject}
              onChangeText={setEmailSubject}
              style={cStyles.input}
            />
            <TextInput
              placeholder="Cuerpo del correo"
              placeholderTextColor="#607d8b"
              value={emailBody}
              onChangeText={setEmailBody}
              multiline
              numberOfLines={4}
              style={[cStyles.input, cStyles.textareaInput]}
            />
            {emailStatus ? <Text style={cStyles.inlineStatus}>{emailStatus}</Text> : null}
            <View style={cStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowEmailModal(false)} style={cStyles.modalGhostButton}>
                <Text style={cStyles.modalGhostButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendEmail}
                disabled={sending}
                style={[cStyles.modalPrimaryButton, sending && { opacity: 0.7 }]}
              >
                <Text style={cStyles.modalPrimaryText}>{sending ? "Enviando..." : "Enviar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {error ? <Text style={cStyles.errorBanner}>{error}</Text> : null}

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={cStyles.listContent}
        data={sortedItems}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={listHeader}
        renderItem={renderItem as any}
        extraData={selectedIds}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={[cStyles.scrollSection, { paddingHorizontal: contentPadding }]}>
            <View style={cStyles.emptyStateCard}>
              <View style={cStyles.emptyStateIcon}>
                <Ionicons name="people-outline" size={28} color="#023047" />
              </View>
              <Text style={cStyles.emptyStateTitle}>
                {items.length === 0 ? "Todavía no tienes clientes registrados" : "No encontramos coincidencias"}
              </Text>
              <Text style={cStyles.emptyStateDescription}>
                {items.length === 0
                  ? "Cuando una persona complete el registro aparecerá aquí para que puedas gestionarla."
                  : "Prueba con otra búsqueda o ajusta los filtros para volver a ver resultados."}
              </Text>
            </View>
          </View>
        }
        ListFooterComponent={
          sortedItems.length > 0 ? (
            <View style={[cStyles.scrollSection, { paddingHorizontal: contentPadding }]}>
              {hasMore ? (
                <TouchableOpacity onPress={loadMore} style={cStyles.loadMoreButton}>
                  <Text style={cStyles.loadMoreText}>{loadingMore ? "Cargando..." : "Cargar más"}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={cStyles.endOfListText}>Fin de la lista</Text>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}


