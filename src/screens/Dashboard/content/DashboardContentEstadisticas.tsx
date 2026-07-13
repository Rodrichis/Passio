import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { auth, db } from "../../../services/firebaseConfig";
import { mapDoc, Cliente } from "../../../utils/clientesHelpers";

type RangeKey = "7d" | "30d" | "custom" | "history";
type EventType = "visita" | "premio";
type CustomRange = {
  start: string;
  end: string;
};
type CalendarFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type CalendarTarget = "start" | "end";
type ExpandedModule =
  | "activity"
  | "hours"
  | "week"
  | "topVisits"
  | "topRewards"
  | "rewards"
  | "ages"
  | null;

type ClientForStats = Cliente & {
  fechaNacimiento?: Date | null;
};

type HistoryEvent = {
  id: string;
  tipo: EventType;
  clienteId: string;
  clienteNombre: string;
  clienteSo: string;
  fecha: Date | null;
  visitasTotalesAntes: number;
  visitasTotalesDespues: number;
  premiosDisponiblesAntes: number;
  premiosDisponiblesDespues: number;
  premiosCanjeadosAntes: number;
  premiosCanjeadosDespues: number;
};

type Props = {
  onBack?: () => void;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "custom", label: "Personalizado" },
  { key: "history", label: "Histórico" },
];

const CARD = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#DDEAF3",
  shadowColor: "#0C2340",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 24,
  elevation: 4,
} as const;

const WEEK_DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const PRIMARY = "#087C94";
const SECONDARY = "#FFB703";
const NAVY = "#023047";
const MUTED = "#607381";

export default function DashboardContentEstadisticas({ onBack }: Props) {
  const uid = auth.currentUser?.uid;
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const isVeryCompact = width < 520;
  const defaultCustomRange = React.useMemo(() => getDefaultCustomRange(), []);

  const [summaryRange, setSummaryRange] = React.useState<RangeKey>("30d");
  const [activityRange, setActivityRange] = React.useState<RangeKey>("30d");
  const [hoursRange, setHoursRange] = React.useState<RangeKey>("30d");
  const [weekRange, setWeekRange] = React.useState<RangeKey>("30d");
  const [topRange, setTopRange] = React.useState<RangeKey>("30d");
  const [summaryCustomRange, setSummaryCustomRange] = React.useState<CustomRange>(defaultCustomRange);
  const [activityCustomRange, setActivityCustomRange] = React.useState<CustomRange>(defaultCustomRange);
  const [hoursCustomRange, setHoursCustomRange] = React.useState<CustomRange>(defaultCustomRange);
  const [weekCustomRange, setWeekCustomRange] = React.useState<CustomRange>(defaultCustomRange);
  const [topCustomRange, setTopCustomRange] = React.useState<CustomRange>(defaultCustomRange);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeClients, setActiveClients] = React.useState<ClientForStats[]>([]);
  const [events, setEvents] = React.useState<HistoryEvent[]>([]);
  const [expandedModule, setExpandedModule] = React.useState<ExpandedModule>(null);

  React.useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      if (!uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const clientesSnap = await getDocs(collection(db, "Empresas", uid, "Clientes"));
        const clients = clientesSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() || {};
            return {
              ...mapDoc(docSnap),
              fechaNacimiento: toDate(data.fechaNacimiento),
            };
          })
          .filter((client) => client.activo !== false);

        const activeIds = new Set(clients.map((client) => client.id));
        const eventosSnap = await getDocs(collection(db, "Empresas", uid, "HistorialEventos"));
        const parsedEvents = eventosSnap.docs
          .map((docSnap) => mapHistoryEvent(docSnap.id, docSnap.data()))
          .filter((event): event is HistoryEvent => {
            return Boolean(event && event.fecha && activeIds.has(event.clienteId));
          });

        if (!mounted) return;
        setActiveClients(clients);
        setEvents(parsedEvents);
      } catch (loadError) {
        console.log("No se pudieron cargar estadísticas:", loadError);
        if (!mounted) return;
        setError("No se pudieron cargar las estadísticas. Revisa las reglas de Firestore e intenta nuevamente.");
        setEvents([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadStats();
    return () => {
      mounted = false;
    };
  }, [uid]);

  const summaryEvents = React.useMemo(
    () => filterEventsByRange(events, summaryRange, summaryCustomRange),
    [events, summaryRange, summaryCustomRange]
  );
  const activityEvents = React.useMemo(
    () => filterEventsByRange(events, activityRange, activityCustomRange),
    [events, activityRange, activityCustomRange]
  );
  const hourEvents = React.useMemo(
    () => filterEventsByRange(events, hoursRange, hoursCustomRange),
    [events, hoursRange, hoursCustomRange]
  );
  const weekEvents = React.useMemo(
    () => filterEventsByRange(events, weekRange, weekCustomRange),
    [events, weekRange, weekCustomRange]
  );
  const topEvents = React.useMemo(
    () => filterEventsByRange(events, topRange, topCustomRange),
    [events, topRange, topCustomRange]
  );

  const summary = buildSummary(summaryEvents, summaryRange, activeClients.length, summaryCustomRange);
  const activityBuckets = buildActivityBuckets(activityEvents, activityRange);
  const hourBuckets = buildHourBuckets(hourEvents);
  const weekBuckets = buildWeekBuckets(weekEvents);
  const topVisitsAll =
    topRange === "history"
      ? buildTopClientsFromCurrentTotals(activeClients, "visita")
      : buildTopClients(topEvents, "visita");
  const topRewardsAll =
    topRange === "history"
      ? buildTopClientsFromCurrentTotals(activeClients, "premio")
      : buildTopClients(topEvents, "premio");
  const topVisits = topVisitsAll.slice(0, 5);
  const topRewards = topRewardsAll.slice(0, 5);
  const ageRanges = buildAgeRanges(activeClients);
  const clientsWithRewards = activeClients.filter((client) => Number(client.premiosDisponibles ?? 0) > 0).length;
  const rewardsPercent =
    activeClients.length > 0 ? Math.round((clientsWithRewards / activeClients.length) * 100) : 0;
  const hasAnyEvents = events.length > 0;

  return (
    <View style={{ gap: 18 }}>
      {loading ? (
        <View style={{ ...CARD, borderRadius: 24, padding: 28, alignItems: "center", gap: 12 }}>
          <ActivityIndicator color="#2196F3" />
          <Text style={{ color: "#51616F", fontWeight: "700" }}>Cargando estadísticas...</Text>
        </View>
      ) : error ? (
        <InfoCard icon="alert-circle-outline" color="#D97706" title="Estadísticas no disponibles" text={error} />
      ) : (
        <>
          {!hasAnyEvents ? (
            <InfoCard
              icon="bar-chart-outline"
              color={PRIMARY}
              title="Aún no hay eventos registrados."
              text="Cuando se registren visitas o premios, aparecerán en este módulo."
            />
          ) : null}

          <SectionCard
            title="Panel de estadísticas"
            subtitle="Métricas históricas basadas en visitas y premios registrados."
            basis="100%"
            left={
              <TouchableOpacity
                onPress={onBack}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#DCEAF5",
                }}
              >
                <Ionicons name="arrow-back-outline" size={20} color="#0A4960" />
              </TouchableOpacity>
            }
            right={
              <RangeSelector
                value={summaryRange}
                onChange={setSummaryRange}
                customRange={summaryCustomRange}
                onCustomRangeChange={setSummaryCustomRange}
                compact={isVeryCompact}
              />
            }
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <MetricTile
                compact={isCompact}
                icon="pulse-outline"
                label="Visitas"
                value={String(summary.visits)}
                note={`Promedio diario: ${formatDecimal(summary.dailyAverage)}`}
                color={PRIMARY}
              />
              <MetricTile
                compact={isCompact}
                icon="gift-outline"
                label="Premios"
                value={String(summary.rewards)}
                note="Canjes confirmados"
                color={SECONDARY}
              />
              <MetricTile
                compact={isCompact}
                icon="people-outline"
                label="Clientes activos"
                value={String(activeClients.length)}
                note={`${summary.uniqueClients} con actividad`}
                color="#0A6F88"
              />
              <MetricTile
                compact={isCompact}
                icon="trending-up-outline"
                label="Eventos"
                value={String(summary.total)}
                note="Visitas + premios"
                color="#16A34A"
              />
            </View>
          </SectionCard>

          <SectionCard
            title="Actividad por día"
            subtitle={activityRange === "history" ? "Agrupado por mes" : "Visitas y premios por fecha"}
            basis="100%"
            onExpand={() => setExpandedModule("activity")}
            right={
              <RangeSelector
                value={activityRange}
                onChange={setActivityRange}
                customRange={activityCustomRange}
                onCustomRangeChange={setActivityCustomRange}
                compact={isVeryCompact}
              />
            }
          >
            <VerticalActivityChart buckets={activityBuckets} compact={isCompact} />
          </SectionCard>

          <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
            <SectionCard
              title="Horas más activas"
              basis={isCompact ? "100%" : "58%"}
              onExpand={() => setExpandedModule("hours")}
              right={
                <RangeSelector
                  value={hoursRange}
                  onChange={setHoursRange}
                  customRange={hoursCustomRange}
                  onCustomRangeChange={setHoursCustomRange}
                  compact
                />
              }
            >
              <HourlyBars buckets={hourBuckets} />
            </SectionCard>

            <SectionCard
              title="Días con más actividad"
              basis={isCompact ? "100%" : "38%"}
              onExpand={() => setExpandedModule("week")}
              right={
                <RangeSelector
                  value={weekRange}
                  onChange={setWeekRange}
                  customRange={weekCustomRange}
                  onCustomRangeChange={setWeekCustomRange}
                  compact
                />
              }
            >
              <WeekProgressList buckets={weekBuckets} />
            </SectionCard>
          </View>

          <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
            <SectionCard
              title="Top visitas"
              basis={isCompact ? "100%" : "31%"}
              onExpand={() => setExpandedModule("topVisits")}
              right={
                <RangeSelector
                  value={topRange}
                  onChange={setTopRange}
                  customRange={topCustomRange}
                  onCustomRangeChange={setTopCustomRange}
                  compact
                />
              }
            >
              <RankList items={topVisits} empty="Sin visitas en el período." tone="blue" />
            </SectionCard>

            <SectionCard title="Top premios" basis={isCompact ? "100%" : "31%"} onExpand={() => setExpandedModule("topRewards")}>
              <RankList items={topRewards} empty="Sin premios en el período." tone="gold" />
            </SectionCard>

            <RewardsDonutCard
              basis={isCompact ? "100%" : "31%"}
              percent={rewardsPercent}
              withRewards={clientsWithRewards}
              total={activeClients.length}
              onExpand={() => setExpandedModule("rewards")}
            />
          </View>

          <SectionCard title="Rangos etarios" subtitle="Distribución actual de clientes activos" onExpand={() => setExpandedModule("ages")}>
            <AgeDistribution ranges={ageRanges} />
          </SectionCard>

          <ExpandModal
            visible={expandedModule !== null}
            title={getExpandedTitle(expandedModule)}
            onClose={() => setExpandedModule(null)}
          >
            {expandedModule === "activity" ? (
              <VerticalActivityChart buckets={activityBuckets} compact={false} expanded />
            ) : null}
            {expandedModule === "hours" ? <HourlyBars buckets={hourBuckets} expanded /> : null}
            {expandedModule === "week" ? <WeekProgressList buckets={weekBuckets} expanded /> : null}
            {expandedModule === "topVisits" ? (
              <RankList items={topVisitsAll} empty="Sin visitas en el período." tone="blue" />
            ) : null}
            {expandedModule === "topRewards" ? (
              <RankList items={topRewardsAll} empty="Sin premios en el período." tone="gold" />
            ) : null}
            {expandedModule === "rewards" ? (
              <RewardsDetail percent={rewardsPercent} withRewards={clientsWithRewards} total={activeClients.length} />
            ) : null}
            {expandedModule === "ages" ? <AgeDistribution ranges={ageRanges} expanded /> : null}
          </ExpandModal>
        </>
      )}
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  basis = "100%",
  left,
  right,
  onExpand,
  children,
}: {
  title: string;
  subtitle?: string;
  basis?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onExpand?: () => void;
  children: React.ReactNode;
}) {
  const fullWidth = basis === "100%";

  return (
    <View
      style={{
        ...(fullWidth
          ? { width: "100%" as const }
          : {
              flexBasis: basis as any,
              flexGrow: 1,
            }),
        minWidth: 0,
        borderRadius: 22,
        padding: 18,
        ...CARD,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 180 }}>
          {left}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: NAVY, fontSize: 18, fontWeight: "900" }}>{title}</Text>
            {subtitle ? (
              <Text style={{ color: MUTED, fontSize: 13, fontWeight: "600", marginTop: 4 }}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {right}
          {onExpand ? <ExpandButton onPress={onExpand} /> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function ExpandButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 13,
        backgroundColor: "#F7FBFF",
        borderWidth: 1,
        borderColor: "#DCEAF5",
      }}
    >
      <Ionicons name="expand-outline" size={16} color="#0A4960" />
    </TouchableOpacity>
  );
}

function RangeSelector({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
  compact,
}: {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
  customRange: CustomRange;
  onCustomRangeChange: (value: CustomRange) => void;
  compact?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const calendarButtonRef = React.useRef<any>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [calendarFrame, setCalendarFrame] = React.useState<CalendarFrame | null>(null);
  const [draftStart, setDraftStart] = React.useState<Date | null>(() =>
    parseDateInput(customRange.start, "start")
  );
  const [draftEnd, setDraftEnd] = React.useState<Date | null>(() =>
    parseDateInput(customRange.end, "end")
  );
  const [draftTarget, setDraftTarget] = React.useState<CalendarTarget>("start");
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => startOfMonth(new Date()));

  React.useEffect(() => {
    const start = parseDateInput(customRange.start, "start");
    const end = parseDateInput(customRange.end, "end");
    setDraftStart(start);
    setDraftEnd(end);
    if (start) {
      setVisibleMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    }
  }, [customRange.start, customRange.end]);

  const applyCustomRange = () => {
    if (!draftStart) return;
    const end = draftEnd && draftEnd >= draftStart ? draftEnd : draftStart;
    onCustomRangeChange({
      start: formatDateInput(draftStart),
      end: formatDateInput(end),
    });
    onChange("custom");
    setCalendarOpen(false);
  };

  const cancelCustomRange = () => {
    setDraftStart(parseDateInput(customRange.start, "start"));
    setDraftEnd(parseDateInput(customRange.end, "end"));
    setCalendarOpen(false);
  };

  const openCalendar = () => {
    calendarButtonRef.current?.measureInWindow?.(
      (x: number, y: number, buttonWidth: number, buttonHeight: number) => {
        const selectedStart = value === "custom" ? parseDateInput(customRange.start, "start") : null;
        setCalendarFrame({ x, y, width: buttonWidth, height: buttonHeight });
        setDraftTarget("start");
        setVisibleMonth(
          selectedStart
            ? new Date(selectedStart.getFullYear(), selectedStart.getMonth(), 1)
            : startOfMonth(new Date())
        );
        setCalendarOpen(true);
      }
    );
  };

  const handleSelectDate = (date: Date) => {
    const selected = startOfDay(date);

    if (draftTarget === "start") {
      setDraftStart(selected);
      if (draftEnd && selected > draftEnd) {
        setDraftEnd(null);
      }
      setDraftTarget("end");
      return;
    }

    if (draftStart && selected < draftStart) {
      setDraftStart(selected);
      setDraftEnd(draftStart);
      return;
    }

    setDraftEnd(selected);
  };

  return (
    <View
      style={{
        alignItems: "flex-end",
        gap: 6,
        position: "relative",
        zIndex: calendarOpen ? 50 : 1,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "flex-end",
        }}
      >
        {RANGE_OPTIONS.map((option) => {
          const active = value === option.key;
          const isCalendar = option.key === "custom";
          return (
            <TouchableOpacity
              ref={isCalendar ? calendarButtonRef : undefined}
              key={option.key}
              onPress={() => {
                if (isCalendar) {
                  if (calendarOpen) {
                    setCalendarOpen(false);
                  } else {
                    openCalendar();
                  }
                  return;
                }
                setCalendarOpen(false);
                onChange(option.key);
              }}
              style={{
                paddingVertical: compact ? 7 : 8,
                paddingHorizontal: isCalendar ? 10 : compact ? 9 : 12,
                borderRadius: 999,
                backgroundColor: active || (isCalendar && calendarOpen) ? PRIMARY : "#F7FBFF",
                borderWidth: 1,
                borderColor: active || (isCalendar && calendarOpen) ? PRIMARY : "#DCEAF5",
                minWidth: isCalendar ? 38 : undefined,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isCalendar ? (
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={active || calendarOpen ? "#FFFFFF" : "#0A4960"}
                />
              ) : (
                <Text
                  style={{
                    color: active ? "#FFFFFF" : "#0A4960",
                    fontSize: compact ? 11 : 12,
                    fontWeight: "900",
                  }}
                >
                  {option.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <CalendarDropdown
        visible={calendarOpen}
        frame={calendarFrame}
        screenWidth={width}
        screenHeight={height}
        visibleMonth={visibleMonth}
        startDate={draftStart}
        endDate={draftEnd}
        activeTarget={draftTarget}
        onSelectTarget={setDraftTarget}
        onPrevMonth={() => setVisibleMonth(addMonths(visibleMonth, -1))}
        onNextMonth={() => setVisibleMonth(addMonths(visibleMonth, 1))}
        onSelectDate={handleSelectDate}
        onCancel={cancelCustomRange}
        onApply={applyCustomRange}
      />
    </View>
  );
}

function MetricTile({
  compact,
  icon,
  label,
  value,
  note,
  color,
}: {
  compact: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <View
      style={{
        flexBasis: compact ? "47%" : "23%",
        flexGrow: 1,
        minWidth: compact ? 0 : 170,
        borderRadius: 18,
        padding: compact ? 14 : 16,
        backgroundColor: "#F8FCFF",
        borderWidth: 1,
        borderColor: "#E1EDF6",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: "#506878", fontSize: 12, fontWeight: "900" }}>{label}</Text>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 13,
            backgroundColor: `${color}16`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={color} />
        </View>
      </View>
      <Text style={{ color: NAVY, fontSize: compact ? 26 : 30, fontWeight: "900", marginTop: 8 }}>
        {value}
      </Text>
      <Text numberOfLines={2} style={{ color: MUTED, fontSize: 12, fontWeight: "700", marginTop: 5 }}>
        {note}
      </Text>
    </View>
  );
}

function CalendarDropdown({
  visible,
  frame,
  screenWidth,
  screenHeight,
  visibleMonth,
  startDate,
  endDate,
  activeTarget,
  onSelectTarget,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  onCancel,
  onApply,
}: {
  visible: boolean;
  frame: CalendarFrame | null;
  screenWidth: number;
  screenHeight: number;
  visibleMonth: Date;
  startDate: Date | null;
  endDate: Date | null;
  activeTarget: CalendarTarget;
  onSelectTarget: (target: CalendarTarget) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: Date) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  if (!visible || !frame) return null;

  const panelWidth = Math.min(334, screenWidth - 24);
  const panelHeight = 432;
  const left = Math.max(12, Math.min(frame.x + frame.width - panelWidth, screenWidth - panelWidth - 12));
  const preferredTop = frame.y + frame.height + 8;
  const top =
    preferredTop + panelHeight > screenHeight
      ? Math.max(12, frame.y - panelHeight - 8)
      : preferredTop;
  const days = buildCalendarDays(visibleMonth);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ position: "absolute", inset: 0 } as any} onPress={onCancel} />
        <View
          style={{
            position: "absolute",
            top,
            left,
            width: panelWidth,
            borderRadius: 20,
            padding: 14,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#DCEAF5",
            shadowColor: "#0C2340",
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.18,
            shadowRadius: 28,
            elevation: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <TouchableOpacity onPress={onPrevMonth} style={calendarNavButtonStyle}>
              <Ionicons name="chevron-back" size={18} color="#0A4960" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: NAVY, fontSize: 16, fontWeight: "900" }}>
                {formatMonthName(visibleMonth)}
              </Text>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                Selecciona fecha inicio y fin
              </Text>
            </View>
            <TouchableOpacity onPress={onNextMonth} style={calendarNavButtonStyle}>
              <Ionicons name="chevron-forward" size={18} color="#0A4960" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", marginTop: 14, marginBottom: 6 }}>
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
              <Text
                key={`${day}-${index}`}
                style={{ flex: 1, textAlign: "center", color: MUTED, fontSize: 11, fontWeight: "900" }}
              >
                {day}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={{ width: `${100 / 7}%` as any, height: 42 }} />;
              }

              const selectedStart = Boolean(startDate && isSameDay(date, startDate));
              const selectedEnd = Boolean(endDate && isSameDay(date, endDate));
              const inRange = Boolean(startDate && endDate && date > startOfDay(startDate) && date < startOfDay(endDate));
              const selected = selectedStart || selectedEnd;

              return (
                <View key={date.toISOString()} style={{ width: `${100 / 7}%` as any, padding: 3 }}>
                  <TouchableOpacity
                    onPress={() => onSelectDate(date)}
                    style={{
                      height: 36,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? PRIMARY : inRange ? "#DDF4FA" : "#FFFFFF",
                      borderWidth: selected || inRange ? 1 : 0,
                      borderColor: selected ? PRIMARY : "#BEE7F1",
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? "#FFFFFF" : NAVY,
                        fontSize: 13,
                        fontWeight: selected || inRange ? "900" : "800",
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <DateTargetButton
              label="Desde"
              value={startDate ? formatDateInput(startDate) : "--"}
              active={activeTarget === "start"}
              onPress={() => onSelectTarget("start")}
            />
            <DateTargetButton
              label="Hasta"
              value={endDate ? formatDateInput(endDate) : "--"}
              active={activeTarget === "end"}
              onPress={() => onSelectTarget("end")}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <TouchableOpacity onPress={onCancel} style={calendarSecondaryButtonStyle}>
              <Text style={{ color: "#0A4960", fontSize: 12, fontWeight: "900" }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onApply}
              disabled={!startDate}
              style={[
                calendarPrimaryButtonStyle,
                !startDate ? { backgroundColor: "#BFD5E4" } : null,
              ]}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DateTargetButton({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: active ? "#E8F7FB" : "#F7FBFF",
        borderWidth: 1,
        borderColor: active ? PRIMARY : "#DCEAF5",
      }}
    >
      <Text style={{ color: MUTED, fontSize: 11, fontWeight: "900" }}>{label}</Text>
      <Text style={{ color: NAVY, fontSize: 13, fontWeight: "900", marginTop: 3 }}>{value}</Text>
    </TouchableOpacity>
  );
}

const calendarNavButtonStyle = {
  width: 36,
  height: 36,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: "#F7FBFF",
  borderWidth: 1,
  borderColor: "#DCEAF5",
};

const calendarSecondaryButtonStyle = {
  paddingVertical: 9,
  paddingHorizontal: 12,
  borderRadius: 12,
  backgroundColor: "#F7FBFF",
  borderWidth: 1,
  borderColor: "#DCEAF5",
};

const calendarPrimaryButtonStyle = {
  paddingVertical: 9,
  paddingHorizontal: 12,
  borderRadius: 12,
  backgroundColor: PRIMARY,
};

function VerticalActivityChart({
  buckets,
  compact,
  expanded = false,
}: {
  buckets: Array<{ key: string; label: string; visitas: number; premios: number; total: number }>;
  compact: boolean;
  expanded?: boolean;
}) {
  if (buckets.length === 0) return <EmptyText />;

  const visibleBuckets = expanded ? buckets : compact ? buckets.slice(-10) : buckets.slice(-18);
  const maxValue = Math.max(1, ...visibleBuckets.map((bucket) => Math.max(bucket.visitas, bucket.premios)));
  const chartHeight = expanded ? 360 : compact ? 190 : 250;

  return (
    <View>
      <View
        style={{
          height: chartHeight,
          borderBottomWidth: 1,
          borderBottomColor: "#E4EEF6",
          borderTopWidth: 1,
          borderTopColor: "#F2F6FA",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: compact ? 8 : 12,
          paddingTop: 16,
          paddingHorizontal: 4,
        }}
      >
        {visibleBuckets.map((bucket) => (
          <View
            key={bucket.key}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              minWidth: 18,
            }}
          >
            <View style={{ minHeight: 28, alignItems: "center", justifyContent: "flex-end" }}>
              <Text style={{ color: PRIMARY, fontSize: compact ? 10 : 11, fontWeight: "900" }}>
                V: {bucket.visitas}
              </Text>
              <Text style={{ color: SECONDARY, fontSize: compact ? 10 : 11, fontWeight: "900" }}>
                P: {bucket.premios}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: chartHeight - 74 }}>
              <View
                style={{
                  width: compact ? 8 : 11,
                  height: bucket.visitas > 0 ? Math.max(5, Math.round((bucket.visitas / maxValue) * (chartHeight - 92))) : 0,
                  borderTopLeftRadius: 5,
                  borderTopRightRadius: 5,
                  backgroundColor: PRIMARY,
                }}
              />
              <View
                style={{
                  width: compact ? 8 : 11,
                  height: bucket.premios > 0 ? Math.max(5, Math.round((bucket.premios / maxValue) * (chartHeight - 92))) : 0,
                  borderTopLeftRadius: 5,
                  borderTopRightRadius: 5,
                  backgroundColor: SECONDARY,
                }}
              />
            </View>
            <Text numberOfLines={1} style={{ color: "#6A7B88", fontSize: compact ? 10 : 11, fontWeight: "800" }}>
              {bucket.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 14 }}>
        <Legend color={PRIMARY} label="Visitas" />
        <Legend color={SECONDARY} label="Premios canjeados" />
      </View>
    </View>
  );
}

function HourlyBars({
  buckets,
  expanded = false,
}: {
  buckets: Array<{ label: string; total: number; hour: number }>;
  expanded?: boolean;
}) {
  if (buckets.length === 0) return <EmptyText />;

  const visible = buckets
    .slice()
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.hour - b.hour;
    })
    .slice(0, expanded ? 12 : 8)
    .sort((a, b) => a.hour - b.hour);
  const maxValue = Math.max(1, ...visible.map((bucket) => bucket.total));
  const peak = buckets.slice().sort((a, b) => b.total - a.total)[0];

  return (
    <View>
      <View style={{ height: expanded ? 250 : 176, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {visible.map((bucket) => {
          const active = peak?.label === bucket.label;
          return (
            <View key={bucket.label} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <Text style={{ color: active ? NAVY : MUTED, fontSize: 12, fontWeight: "900" }}>
                {bucket.total}
              </Text>
              <View
                style={{
                  width: "100%",
                  maxWidth: 28,
                  height: Math.max(12, Math.round((bucket.total / maxValue) * (expanded ? 186 : 116))),
                  borderRadius: 5,
                  backgroundColor: active ? "#057489" : "#DDEBF1",
                }}
              />
              <Text style={{ color: active ? NAVY : "#81919C", fontSize: 10, fontWeight: "900" }}>
                {bucket.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: MUTED, fontSize: 12, fontWeight: "700", marginTop: 10 }}>
        {peak ? `Hora peak: ${peak.label}` : "Sin hora peak disponible."}
      </Text>
    </View>
  );
}

function WeekProgressList({
  buckets,
  expanded = false,
}: {
  buckets: Array<{ label: string; total: number }>;
  expanded?: boolean;
}) {
  if (buckets.length === 0) return <EmptyText />;

  const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.total));
  const ordered = expanded ? buckets : buckets.slice(0, 5);

  return (
    <View style={{ gap: 13 }}>
      {ordered.map((bucket) => {
        const percent = Math.round((bucket.total / maxValue) * 100);
        return (
          <View key={bucket.label} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: NAVY, fontSize: 13, fontWeight: "900" }}>{bucket.label}</Text>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: "800" }}>{percent}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: "#EAF3F8", overflow: "hidden" }}>
              <View style={{ width: `${percent}%` as any, height: "100%", backgroundColor: PRIMARY }} />
            </View>
          </View>
        );
      })}
      <Text style={{ color: "#8A98A2", fontSize: 11, fontStyle: "italic", marginTop: 4 }}>
        Basado en el período seleccionado.
      </Text>
    </View>
  );
}

function RankList({
  items,
  empty,
  tone,
}: {
  items: Array<{ id: string; name: string; total: number }>;
  empty: string;
  tone: "blue" | "gold";
}) {
  if (items.length === 0) return <Text style={{ color: MUTED, fontSize: 14 }}>{empty}</Text>;

  const bg = tone === "blue" ? "#DFF2FF" : "#FFF0CD";
  const color = tone === "blue" ? "#087C94" : "#C77700";

  return (
    <View style={{ gap: 4 }}>
      {items.map((item, index) => (
        <View
          key={`${item.id}-${index}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 10,
            borderBottomWidth: index === items.length - 1 ? 0 : 1,
            borderBottomColor: "#EEF4F8",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bg,
            }}
          >
            <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{getInitials(item.name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: NAVY, fontSize: 13, fontWeight: "900" }}>
              {item.name}
            </Text>
            <Text style={{ color: MUTED, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
              {item.total} {item.total === 1 ? "registro" : "registros"}
            </Text>
          </View>
          <Text style={{ color, fontSize: 15, fontWeight: "900" }}>{item.total}</Text>
        </View>
      ))}
    </View>
  );
}

function RewardsDonutCard({
  basis,
  percent,
  withRewards,
  total,
  onExpand,
}: {
  basis: string;
  percent: number;
  withRewards: number;
  total: number;
  onExpand?: () => void;
}) {
  const outer = 112;
  const inner = 74;

  return (
    <View
      style={{
        flexBasis: basis as any,
        flexGrow: 1,
        minWidth: 0,
        borderRadius: 22,
        padding: 18,
        backgroundColor: "#087C94",
        borderWidth: 1,
        borderColor: "#087C94",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900", flex: 1 }}>Clientes con premios</Text>
        {onExpand ? (
          <TouchableOpacity
            onPress={onExpand}
            style={{
              width: 34,
              height: 34,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.14)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
            }}
          >
            <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={{ color: "#D8F5FF", fontSize: 12, fontWeight: "700", marginTop: 6, lineHeight: 17 }}>
        Porcentaje de clientes activos que tienen al menos un premio disponible.
      </Text>
      <View style={{ alignItems: "center", justifyContent: "center", marginTop: 22 }}>
        <View
          style={{
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            backgroundColor: "#D9F3FA",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: `${Math.max(4, percent)}%` as any,
              backgroundColor: SECONDARY,
            }}
          />
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: "#087C94",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>{percent}%</Text>
          </View>
        </View>
      </View>
      <Text style={{ color: "#D8F5FF", fontSize: 12, fontWeight: "800", marginTop: 18, textAlign: "center" }}>
        {withRewards} de {total} clientes activos
      </Text>
    </View>
  );
}

function AgeDistribution({
  ranges,
  expanded = false,
}: {
  ranges: Array<{ label: string; count: number }>;
  expanded?: boolean;
}) {
  if (ranges.length === 0) return <EmptyText />;

  const maxValue = Math.max(1, ...ranges.map((range) => range.count));

  return (
    <View style={{ height: expanded ? 260 : 170, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      {ranges.map((range) => (
        <View key={range.label} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <Text style={{ color: NAVY, fontSize: 13, fontWeight: "900" }}>{range.count}</Text>
          <View
            style={{
              width: "100%",
              maxWidth: 46,
              height: Math.max(14, Math.round((range.count / maxValue) * (expanded ? 190 : 110))),
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              backgroundColor: "#BEE5F2",
            }}
          />
          <Text numberOfLines={1} style={{ color: MUTED, fontSize: 11, fontWeight: "800" }}>
            {range.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RewardsDetail({
  percent,
  withRewards,
  total,
}: {
  percent: number;
  withRewards: number;
  total: number;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const outer = compact ? 132 : 164;
  const inner = compact ? 86 : 106;
  const withoutRewards = Math.max(0, total - withRewards);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: compact ? "column" : "row", gap: 18, flexWrap: "wrap" }}>
        <View
          style={{
            ...CARD,
            flexBasis: compact ? undefined : 420,
            flexGrow: compact ? 0 : 1,
            flexShrink: 1,
            width: compact ? "100%" : undefined,
            maxWidth: "100%",
            borderRadius: 24,
            padding: compact ? 18 : 26,
            alignItems: "center",
          }}
        >
          <Text style={{ color: NAVY, fontSize: compact ? 17 : 20, fontWeight: "900", alignSelf: "flex-start" }}>
            Clientes con premios
          </Text>
          <Text
            style={{
              color: MUTED,
              fontSize: compact ? 12 : 13,
              fontWeight: "700",
              marginTop: 6,
              alignSelf: "flex-start",
              lineHeight: compact ? 17 : 19,
            }}
          >
            Porcentaje de clientes activos que tienen al menos un premio disponible.
          </Text>
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: compact ? 20 : 28 }}>
            <View
              style={{
                width: outer,
                height: outer,
                borderRadius: outer / 2,
                backgroundColor: "#D9F3FA",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${Math.max(4, percent)}%` as any,
                  backgroundColor: SECONDARY,
                }}
              />
              <View
                style={{
                  width: inner,
                  height: inner,
                  borderRadius: inner / 2,
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#DCEAF5",
                }}
              >
                <Text style={{ color: NAVY, fontSize: 34, fontWeight: "900" }}>{percent}%</Text>
              </View>
            </View>
          </View>
          <Text style={{ color: MUTED, fontSize: compact ? 12 : 14, fontWeight: "800", marginTop: 20, textAlign: "center" }}>
            {withRewards} de {total} clientes activos
          </Text>
        </View>

        <View
          style={{
            flexBasis: compact ? undefined : 360,
            flexGrow: compact ? 0 : 1,
            flexShrink: 1,
            width: compact ? "100%" : undefined,
            maxWidth: "100%",
            gap: 12,
          }}
        >
          <MetricTile
            compact={compact}
            icon="gift-outline"
            label="Con premios"
            value={String(withRewards)}
            note="Clientes con al menos un premio"
            color={SECONDARY}
          />
          <MetricTile
            compact={compact}
            icon="people-outline"
            label="Sin premios"
            value={String(withoutRewards)}
            note="Clientes activos sin premios disponibles"
            color={PRIMARY}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <MetricTile
          compact={compact}
          icon="analytics-outline"
          label="Base evaluada"
          value={String(total)}
          note="Solo clientes activos"
          color={PRIMARY}
        />
        <MetricTile
          compact={compact}
          icon="pie-chart-outline"
          label="Porcentaje"
          value={`${percent}%`}
          note="Clientes activos con premios"
          color={SECONDARY}
        />
      </View>
    </View>
  );
}

function ExpandModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 700;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.42)",
          alignItems: "center",
          justifyContent: "center",
          padding: compact ? 8 : 10,
        }}
      >
        <Pressable style={{ position: "absolute", inset: 0 } as any} onPress={onClose} />
        <View
          style={{
            width: compact ? "94%" : "96%",
            maxWidth: 1500,
            minHeight: compact ? undefined : ("84%" as any),
            maxHeight: compact ? ("90%" as any) : ("94%" as any),
            borderRadius: compact ? 24 : 28,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#DDEAF3",
            shadowColor: "#0C2340",
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.16,
            shadowRadius: 34,
            elevation: 12,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingHorizontal: compact ? 18 : 28,
              paddingVertical: compact ? 16 : 22,
              borderBottomWidth: 1,
              borderBottomColor: "#E8F0F6",
            }}
          >
            <Text style={{ color: NAVY, fontSize: compact ? 18 : 20, fontWeight: "900", flex: 1 }}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#F7FBFF",
                borderWidth: 1,
                borderColor: "#DCEAF5",
              }}
            >
              <Ionicons name="close" size={19} color="#51616F" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: compact ? 16 : 30 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getExpandedTitle(module: ExpandedModule) {
  switch (module) {
    case "activity":
      return "Actividad por día";
    case "hours":
      return "Horas más activas";
    case "week":
      return "Días con más actividad";
    case "topVisits":
      return "Top visitas";
    case "topRewards":
      return "Top premios";
    case "rewards":
      return "Clientes con premios";
    case "ages":
      return "Rangos etarios";
    default:
      return "Detalle";
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: MUTED, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

function InfoCard({
  icon,
  color,
  title,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  title: string;
  text: string;
}) {
  return (
    <View
      style={{
        ...CARD,
        borderRadius: 22,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: "#F4FAFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: NAVY, fontSize: 16, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: MUTED, fontSize: 14, fontWeight: "600", marginTop: 4, lineHeight: 20 }}>{text}</Text>
      </View>
    </View>
  );
}

function EmptyText() {
  return <Text style={{ color: MUTED, fontSize: 14 }}>Sin datos disponibles.</Text>;
}

function filterEventsByRange(events: HistoryEvent[], range: RangeKey, customRange: CustomRange) {
  return events
    .filter((event) => isEventInRange(event.fecha, range, customRange))
    .sort((a, b) => {
      const aTime = a.fecha?.getTime() ?? 0;
      const bTime = b.fecha?.getTime() ?? 0;
      return aTime - bTime;
    });
}

function buildSummary(
  events: HistoryEvent[],
  range: RangeKey,
  activeClientsTotal: number,
  customRange: CustomRange
) {
  const visits = events.filter((event) => event.tipo === "visita").length;
  const rewards = events.filter((event) => event.tipo === "premio").length;
  const uniqueClients = new Set(events.map((event) => event.clienteId)).size;
  const periodDays = getPeriodDays(range, events, customRange);

  return {
    visits,
    rewards,
    total: visits + rewards,
    uniqueClients: Math.min(uniqueClients, activeClientsTotal),
    dailyAverage: periodDays > 0 ? visits / periodDays : 0,
  };
}

function mapHistoryEvent(id: string, data: any): HistoryEvent | null {
  const tipo = data?.tipo;
  if (tipo !== "visita" && tipo !== "premio") return null;

  return {
    id,
    tipo,
    clienteId: String(data?.clienteId ?? ""),
    clienteNombre: String(data?.clienteNombre ?? "Cliente sin nombre"),
    clienteSo: String(data?.clienteSo ?? ""),
    fecha: toDate(data?.fecha),
    visitasTotalesAntes: toNumber(data?.visitasTotalesAntes),
    visitasTotalesDespues: toNumber(data?.visitasTotalesDespues),
    premiosDisponiblesAntes: toNumber(data?.premiosDisponiblesAntes),
    premiosDisponiblesDespues: toNumber(data?.premiosDisponiblesDespues),
    premiosCanjeadosAntes: toNumber(data?.premiosCanjeadosAntes),
    premiosCanjeadosDespues: toNumber(data?.premiosCanjeadosDespues),
  };
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toNumber(value: any) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getDefaultCustomRange(): CustomRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);

  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const mondayBasedOffset = (firstDay.getDay() + 6) % 7;
  const days: Array<Date | null> = [];

  for (let i = 0; i < mondayBasedOffset; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthName(date: Date) {
  return date.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
}

function parseDateInput(value: string, mode: "start" | "end") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const dashMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  let day = 0;
  let month = 0;
  let year = 0;

  if (slashMatch) {
    day = Number(slashMatch[1]);
    month = Number(slashMatch[2]);
    year = Number(slashMatch[3]);
  } else if (dashMatch) {
    year = Number(dashMatch[1]);
    month = Number(dashMatch[2]);
    day = Number(dashMatch[3]);
  } else {
    return null;
  }

  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  if (mode === "start") {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function formatDateInput(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}/${date.getFullYear()}`;
}

function isEventInRange(date: Date | null, range: RangeKey, customRange: CustomRange) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (range === "history") return true;

  if (range === "custom") {
    const start = parseDateInput(customRange.start, "start");
    const end = parseDateInput(customRange.end, "end");
    if (!start || !end) return false;
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  }

  const now = new Date();
  const start = new Date(now);

  if (range === "7d") {
    start.setDate(now.getDate() - 6);
  } else {
    start.setDate(now.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  return date.getTime() >= start.getTime() && date.getTime() <= now.getTime();
}

function getPeriodDays(range: RangeKey, events: HistoryEvent[], customRange: CustomRange) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "custom") {
    const start = parseDateInput(customRange.start, "start");
    const end = parseDateInput(customRange.end, "end");
    if (!start || !end) return 1;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  }

  const datedEvents = events
    .map((event) => event.fecha?.getTime() ?? 0)
    .filter((time) => time > 0)
    .sort((a, b) => a - b);

  if (datedEvents.length === 0) return 1;
  const first = new Date(datedEvents[0]);
  first.setHours(0, 0, 0, 0);
  const last = new Date(datedEvents[datedEvents.length - 1]);
  last.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
}

function buildActivityBuckets(events: HistoryEvent[], range: RangeKey) {
  const buckets = new Map<string, { key: string; label: string; visitas: number; premios: number; total: number }>();

  events.forEach((event) => {
    if (!event.fecha) return;
    const key =
      range === "history"
        ? `${event.fecha.getFullYear()}-${String(event.fecha.getMonth() + 1).padStart(2, "0")}`
        : formatDateKey(event.fecha);
    const label = range === "history" ? formatMonthLabel(event.fecha) : formatShortDate(event.fecha);
    const current = buckets.get(key) ?? { key, label, visitas: 0, premios: 0, total: 0 };

    if (event.tipo === "visita") current.visitas += 1;
    if (event.tipo === "premio") current.premios += 1;
    current.total += 1;
    buckets.set(key, current);
  });

  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function buildHourBuckets(events: HistoryEvent[]) {
  const buckets = new Map<number, number>();
  events.forEach((event) => {
    if (!event.fecha) return;
    const hour = event.fecha.getHours();
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([hour, total]) => ({ label: `${String(hour).padStart(2, "0")}:00 hrs`, total, hour }))
    .sort((a, b) => a.hour - b.hour);
}

function buildWeekBuckets(events: HistoryEvent[]) {
  const buckets = new Map<number, number>();
  events.forEach((event) => {
    if (!event.fecha) return;
    const day = event.fecha.getDay();
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([day, total]) => ({ label: WEEK_DAYS[day], total }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return WEEK_DAYS.indexOf(a.label) - WEEK_DAYS.indexOf(b.label);
    });
}

function buildTopClients(events: HistoryEvent[], type: EventType) {
  const totals = new Map<string, { id: string; name: string; total: number }>();

  events
    .filter((event) => event.tipo === type)
    .forEach((event) => {
      const current = totals.get(event.clienteId) ?? {
        id: event.clienteId,
        name: event.clienteNombre || "Cliente sin nombre",
        total: 0,
      };
      current.total += 1;
      totals.set(event.clienteId, current);
    });

  return Array.from(totals.values())
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
}

function buildTopClientsFromCurrentTotals(clients: ClientForStats[], type: EventType) {
  return clients
    .map((client) => ({
      id: client.id,
      name: client.nombreCompleto || "Cliente sin nombre",
      total:
        type === "visita"
          ? Number(client.visitasTotales ?? 0)
          : Number(client.premiosCanjeados ?? 0),
    }))
    .filter((client) => client.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
}

function buildAgeRanges(clients: ClientForStats[]) {
  const ranges = [
    { label: "Menores de 18", count: 0 },
    { label: "18-24", count: 0 },
    { label: "25-34", count: 0 },
    { label: "35-44", count: 0 },
    { label: "45-54", count: 0 },
    { label: "55+", count: 0 },
  ];

  clients.forEach((client) => {
    const age = getAge(client.fechaNacimiento ?? null);
    if (age == null) return;

    if (age < 18) ranges[0].count += 1;
    else if (age <= 24) ranges[1].count += 1;
    else if (age <= 34) ranges[2].count += 1;
    else if (age <= 44) ranges[3].count += 1;
    else if (age <= 54) ranges[4].count += 1;
    else ranges[5].count += 1;
  });

  return ranges.filter((range) => range.count > 0);
}

function getAge(birthDate: Date | null) {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatShortDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(value >= 10 ? 0 : 1).replace(".", ",");
}

function getInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return initials.join("") || "CL";
}
