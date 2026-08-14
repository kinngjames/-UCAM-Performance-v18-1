"use client";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { CALENDAR, INITIAL_THRESHOLDS } from "./data";
import {
  buildMetrics,
  completeEffortProduct,
  loadForCompleteEffort,
  meanValue as mean,
  round,
  summarizeLoadCoverage,
} from "../domain/metrics";
import type {
  Attendance,
  Availability,
  AvailabilityRecord,
  Convocation,
  MatchRecord,
  PlayerMetric,
  RosterPlayer,
  SessionPlan,
  SessionRecord,
  Signal,
  Status,
  Thresholds,
  WellbeingRecord,
} from "../domain/metrics";
import { display } from "./ui-format";
import {
  ACTIVE_SESSION,
  ACTIVE_WEEK_ID,
  type AlertRecord,
  type AlertWorkflow,
  type PainLimitation,
  type PainRecord,
  type PainZone,
  seedAlerts,
  seedAvailability,
  seedMatches,
  seedPainRecords,
  seedSessionPlans,
  seedSessions,
  seedWellbeing,
} from "./phase2-data";
type AppMode = "staff" | "player";
type StaffPage =
  | "home"
  | "team"
  | "sessions"
  | "analysis"
  | "reports"
  | "settings"
  | "playerDetail";
type PlayerPage = "home" | "register" | "evolution" | "report";
type SessionWorkspaceView =
  | "1"
  | "2"
  | "3"
  | "4"
  | "match"
  | "wellbeing";
type TeamSignalFilter = "all" | "sleep" | "fatigue" | "pain" | "pending";
type MetricKey =
  | "rpe"
  | "load"
  | "sleep"
  | "mood"
  | "fatigue"
  | "pain"
  | "stress";
type DetailTab = "summary" | "load" | "wellbeing" | "history" | "report";


const STATUS_META: Record<Status, { icon: string; label: string }> = {
  OK: { icon: "✓", label: "OK" },
  VIGILAR: { icon: "⚠", label: "Vigilar" },
  REVISAR: { icon: "!", label: "Revisar" },
  INCOMPLETO: { icon: "◷", label: "Incompleto" },
  "SIN DATOS": { icon: "—", label: "Sin datos" },
};
const AVAILABILITY_META: Record<Availability, { icon: string; label: string }> =
  {
    COMPLETO: { icon: "✓", label: "Completo" },
    MODIFICADO: { icon: "↘", label: "Modificado" },
    RECUPERACIÓN: { icon: "↻", label: "Recuperación" },
    "NO DISPONIBLE": { icon: "×", label: "No disponible" },
    AUSENTE: { icon: "—", label: "Ausente" },
  };
const ALERT_META: Record<AlertWorkflow, { icon: string; label: string }> = {
  NUEVA: { icon: "●", label: "Nueva" },
  REVISADA: { icon: "✓", label: "Revisada" },
  "EN SEGUIMIENTO": { icon: "↻", label: "En seguimiento" },
  CERRADA: { icon: "×", label: "Cerrada" },
};
const METRICS: Record<
  MetricKey,
  {
    label: string;
    unit: string;
    color: string;
    goodDirection: "up" | "down" | "neutral";
  }
> = {
  rpe: {
    label: "RPE",
    unit: "/10",
    color: "var(--chart-rpe)",
    goodDirection: "neutral",
  },
  load: {
    label: "Carga",
    unit: " UA",
    color: "var(--chart-load)",
    goodDirection: "neutral",
  },
  sleep: { label: "Sueño", unit: " h", color: "var(--chart-sleep)", goodDirection: "up" },
  mood: { label: "Ánimo", unit: "/5", color: "var(--chart-mood)", goodDirection: "up" },
  fatigue: {
    label: "Cansancio",
    unit: "/5",
    color: "var(--chart-fatigue)",
    goodDirection: "down",
  },
  pain: {
    label: "Dolor",
    unit: "/10",
    color: "var(--chart-pain)",
    goodDirection: "down",
  },
  stress: {
    label: "Estrés",
    unit: "/5",
    color: "var(--chart-stress)",
    goodDirection: "down",
  },
};
const UCAM_LOGO_WHITE =
  "https://www.ucam.edu/sites/default/files/public/la-universidad/identidad-visual/logos-ucam/logo-horizontal-ucam-universidad-color-letras-blanco-sin-fondo.svg";
const UCAM_LOGO_BLUE =
  "https://www.ucam.edu/sites/default/files/public/la-universidad/identidad-visual/logos-ucam/logo-horizontal-ucam-universidad-azul.svg";
const positionGroup = (position: string) => {
  const normalized = position.toLocaleUpperCase("es-ES");
  if (normalized.includes("PORTER")) return "PORTEROS";
  if (normalized.includes("DEFEN")) return "DEFENSAS";
  if (normalized.includes("EXTREM")) return "EXTREMOS";
  if (normalized.includes("DELANT")) return "DELANTEROS";
  return "CENTROCAMPISTAS";
};

const compact = (value: number | null) =>
  value == null
    ? "—"
    : value.toLocaleString("es-ES", { maximumFractionDigits: 0 });
const rpeRegistrationText = (metric: PlayerMetric) =>
  `RPE ${metric.rpeCompleted}/${metric.rpeExpected}`;
const wellbeingRegistrationText = (metric: PlayerMetric) =>
  metric.wellbeingExpected === 0
    ? metric.wellbeingDone
      ? "Bienestar opcional enviado"
      : "Bienestar opcional esta semana"
    : `Bienestar ${metric.wellbeingDone ? 1 : 0}/1`;
const formatDate = (iso: string, long = false) =>
  new Intl.DateTimeFormat(
    "es-ES",
    long
      ? { weekday: "long", day: "numeric", month: "long" }
      : { day: "numeric", month: "short" },
  ).format(new Date(`${iso}T12:00:00`));
const titleCase = (value: string) =>
  value
    .toLocaleLowerCase("es-ES")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("es-ES"));
const metricValue = (metric: PlayerMetric, key: MetricKey) =>
  key === "rpe" ? metric.avgRpe : metric[key];
const calculateAge = (birthDate: string) => {
  if (!birthDate) return "—";
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return "—";
  const reference = new Date("2026-08-10T12:00:00");
  let age = reference.getFullYear() - birth.getFullYear();
  if (
    reference.getMonth() < birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() &&
      reference.getDate() < birth.getDate())
  )
    age -= 1;
  return age;
};
const planState = (actual: number, planned: number) => {
  const variation = planned ? ((actual - planned) / planned) * 100 : 0;
  return {
    variation,
    label:
      variation > 10
        ? "Por encima de lo previsto"
        : variation < -10
          ? "Por debajo de lo previsto"
          : "En línea",
    tone: variation > 10 ? "above" : variation < -10 ? "below" : "line",
  };
};

function trendInfo(history: PlayerMetric[], key: MetricKey) {
  const valid = history
    .map((item) => {
      if (item.status === "SIN DATOS") return null;
      if (key === "load" && item.loadCompleteness !== "COMPLETE") return null;
      if (
        ["rpe", "load"].includes(key) &&
        item.rpeExpected > 0 &&
        item.rpeCompleted === 0 &&
        item.matchRpe == null
      )
        return null;
      return metricValue(item, key);
    })
    .filter((value): value is number => value != null);
  if (valid.length < 5)
    return {
      symbol: "—",
      label: "sin tendencia suficiente",
      delta: 0,
      tone: "neutral",
      reliable: false,
    };
  const recent = mean(valid.slice(-3)) ?? 0;
  const previous = mean(valid.slice(-6, -3)) ?? valid[valid.length - 4];
  const delta =
    previous === 0 ? 0 : ((recent - previous) / Math.abs(previous)) * 100;
  const direction = Math.abs(delta) < 4 ? "flat" : delta > 0 ? "up" : "down";
  const good = METRICS[key].goodDirection;
  return {
    symbol: direction === "up" ? "↑" : direction === "down" ? "↓" : "→",
    label:
      direction === "up"
        ? "aumentando"
        : direction === "down"
          ? "bajando"
          : "estable",
    delta,
    tone:
      direction === "flat" || good === "neutral"
        ? "neutral"
        : direction === good
          ? "positive"
          : "negative",
    reliable: true,
  };
}

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`status status-${status.toLocaleLowerCase("es-ES").replace(" ", "-")}`}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
function AvailabilityBadge({ value }: { value: Availability }) {
  const meta = AVAILABILITY_META[value];
  return (
    <span
      className={`availability availability-${value
        .toLocaleLowerCase("es-ES")
        .replaceAll(" ", "-")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")}`}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
function AlertBadge({ status }: { status: AlertWorkflow }) {
  const meta = ALERT_META[status];
  return (
    <span
      className={`alert-workflow alert-${status.toLocaleLowerCase("es-ES").replaceAll(" ", "-")}`}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
function WeekSelector({
  weekId,
  onChange,
  compact = false,
}: {
  weekId: number;
  onChange: (week: number) => void;
  compact?: boolean;
}) {
  const week = CALENDAR[weekId - 1];
  return (
    <label className={`week-selector ${compact ? "compact" : ""}`}>
      <span>Jornada</span>
      <select
        aria-label="Seleccionar jornada"
        value={weekId}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {CALENDAR.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} · {item.opponent.replace(/^.*·\s*/, "")}
          </option>
        ))}
      </select>
      {!compact && (
        <small>
          {week.period} · {formatDate(week.dates[0])}–
          {formatDate(week.dates[3])}
        </small>
      )}
    </label>
  );
}
function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </header>
  );
}
function Kpi({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: string;
}) {
  return (
    <article className="phase2-kpi">
      <span className="phase2-kpi-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {helper && <p>{helper}</p>}
      </div>
    </article>
  );
}

function LineChart({
  data,
  color,
  unit = "",
  reference,
  referenceLabel = "Referencia personal",
  height = 220,
  domain,
  ariaLabel = "Evolución temporal; los huecos representan periodos sin dato",
}: {
  data: Array<{ label: string; value: number | null; tooltip?: string }>;
  color: string;
  unit?: string;
  reference?: number | null;
  referenceLabel?: string;
  height?: number;
  domain?: [number, number];
  ariaLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const valid = data
    .map((item, index) => ({ ...item, index }))
    .filter(
      (item): item is typeof item & { value: number } => item.value != null,
    );
  if (!valid.length)
    return <div className="empty-chart">Sin datos en este periodo</div>;
  const values = [
    ...valid.map((item) => item.value),
    ...(reference == null ? [] : [reference]),
  ];
  const observedMin = Math.min(...values);
  const observedMax = Math.max(...values);
  const spread =
    observedMax - observedMin || Math.max(Math.abs(observedMax) * 0.2, 1);
  const magnitudeStartsAtZero = ["UA", "min"].includes(unit.trim());
  const floor =
    domain?.[0] ??
    (magnitudeStartsAtZero ? 0 : observedMin - spread * 0.22);
  const ceiling =
    domain?.[1] ??
    (magnitudeStartsAtZero
      ? Math.max(observedMax * 1.12, 1)
      : observedMax + spread * 0.18);
  const width = 680;
  const px = 30;
  const py = 24;
  const xFor = (index: number) =>
    data.length === 1
      ? width / 2
      : px + (index * (width - px * 2)) / (data.length - 1);
  const yFor = (value: number) =>
    py + ((ceiling - value) * (height - py * 2)) / (ceiling - floor || 1);
  const points = valid.map((item) => ({
    ...item,
    x: xFor(item.index),
    y: yFor(item.value),
  }));
  const segments: typeof points[] = [];
  let segment: typeof points = [];
  data.forEach((item, index) => {
    if (item.value == null) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    const point = points.find((candidate) => candidate.index === index);
    if (point) segment.push(point);
  });
  if (segment.length) segments.push(segment);
  const referenceY = reference == null ? null : yFor(reference);
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const activePoint =
    activeIndex == null
      ? null
      : points.find((point) => point.index === activeIndex) ?? null;
  return (
    <div className="chart-wrap">
      <svg
        className="line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setActiveIndex(null);
        }}
      >
        <desc>
          {valid.length} periodos con dato de {data.length}. Toca o enfoca un
          punto para consultar su contexto.
        </desc>
        {[0, 0.5, 1].map((fraction) => {
          const value = floor + (ceiling - floor) * fraction;
          const y = yFor(value);
          return (
            <g key={fraction}>
              <line
                x1={px}
                y1={y}
                x2={width - px}
                y2={y}
                className="grid-line"
              />
              <text
                x={px - 7}
                y={y + 4}
                textAnchor="end"
                className={`axis-label axis-value axis-value-${fraction === 0.5 ? "mid" : "edge"}`}
              >
                {display(value, unit.trim() === "UA" || unit.trim() === "min" ? 0 : 1)}
              </text>
            </g>
          );
        })}
        {referenceY != null && (
          <>
            <line
              x1={px}
              y1={referenceY}
              x2={width - px}
              y2={referenceY}
              className="reference-line"
            />
            <text
              x={width - px}
              y={referenceY - 6}
              textAnchor="end"
              className="reference-label"
            >
              {referenceLabel} {display(reference ?? null)}
              {unit}
            </text>
          </>
        )}
        {segments.map((items, index) =>
          items.length > 1 ? (
            <polyline
              key={`segment-${index}`}
              points={items.map((item) => `${item.x},${item.y}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null,
        )}
        {points.map((point) => (
          <g key={`${point.label}-${point.index}`}>
            <circle
              className={point.index === data.length - 1 ? "chart-point-current" : ""}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#fff"
              stroke={color}
              strokeWidth="3"
              tabIndex={0}
              onMouseEnter={() => setActiveIndex(point.index)}
              onFocus={() => setActiveIndex(point.index)}
              onBlur={() => setActiveIndex(null)}
              onPointerDown={() =>
                setActiveIndex((currentIndex) =>
                  currentIndex === point.index ? null : point.index,
                )
              }
              aria-label={
                point.tooltip ??
                `${point.label}: ${display(point.value)}${unit}`
              }
            >
              <title>
                {point.tooltip ??
                  `${point.label} · ${display(point.value)}${unit}`}
              </title>
            </circle>
            {(point.index === 0 ||
              point.index === data.length - 1 ||
              point.index % labelEvery === 0) && (
              <text
                x={point.x}
                y={height - 4}
                textAnchor="middle"
                className="axis-label"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {activePoint && (
        <output
          className="chart-tooltip"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
          }}
          aria-live="polite"
        >
          {activePoint.tooltip ??
            `${activePoint.label} · ${display(activePoint.value)}${unit}`}
        </output>
      )}
      <p className="chart-data-note">
        {valid.length < data.length
          ? `${data.length - valid.length} periodo${data.length - valid.length === 1 ? "" : "s"} sin dato · no se representa como cero`
          : `Rango observado ${display(observedMin)}–${display(observedMax)}${unit}`}
      </p>
    </div>
  );
}
function Sparkline({
  values,
  color = "#004379",
  label,
  className = "",
}: {
  values: Array<number | null>;
  color?: string;
  label?: string;
  className?: string;
}) {
  const valid = values.filter((value): value is number => value != null);
  if (valid.length < 2) return <span>—</span>;
  const min = Math.min(...valid),
    max = Math.max(...valid),
    range = max - min || 1;
  const segments: string[] = [];
  let points: string[] = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (points.length > 1) segments.push(points.join(" "));
      points = [];
      return;
    }
    points.push(
      `${(index * 72) / Math.max(1, values.length - 1) + 4},${27 - ((value - min) / range) * 21}`,
    );
  });
  if (points.length > 1) segments.push(points.join(" "));
  return (
    <svg
      className={`spark ${className}`.trim()}
      viewBox="0 0 80 32"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {segments.map((segmentPoints, index) => (
        <polyline
          key={index}
          points={segmentPoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function ReportTrendSummary({
  playerId,
  weekId,
  metrics,
}: {
  playerId: string;
  weekId: number;
  metrics: Map<string, PlayerMetric>;
}) {
  const history = CALENDAR.slice(0, weekId)
    .map((week) => metrics.get(`${week.id}-${playerId}`))
    .filter((item): item is PlayerMetric => Boolean(item));
  const current = history.at(-1);
  if (!current) return <div className="empty-chart">Sin datos en este periodo</div>;
  return (
    <section className="report-trend-summary" aria-labelledby="report-trends-title">
      <div className="report-trend-heading">
        <div>
          <span className="eyebrow">Contexto personal</span>
          <h2 id="report-trends-title">Dos tendencias que explican la semana</h2>
        </div>
        <small>Últimas 8 jornadas · los huecos son periodos sin registro</small>
      </div>
      <div className="report-trend-grid">
        {(["load", "sleep"] as const).map((key) => {
          const meta = METRICS[key];
          const trend = trendInfo(history, key);
          const values = history.slice(-8).map((item) =>
            item.status === "SIN DATOS" ? null : metricValue(item, key),
          );
          const value = values.at(-1) ?? null;
          const reference = key === "load" ? current.chronic : current.personalSleep;
          return (
            <article key={key}>
              <div>
                <span>{key === "load" ? "Carga semanal" : "Sueño semanal"}</span>
                <strong>
                  {display(value, key === "load" ? 0 : 1)}{meta.unit}
                </strong>
                <small className={`trend-${trend.tone}`}>
                  {trend.symbol} {trend.label}
                </small>
              </div>
              <Sparkline
                values={values}
                color={meta.color}
                className="report-spark"
                label={`${meta.label}, últimas ocho jornadas: ${values.map((item) => item == null ? "sin dato" : display(item, key === "load" ? 0 : 1)).join(", ")}`}
              />
              <p>
                {reference == null
                  ? "Referencia personal aún no disponible"
                  : `Referencia personal ${display(reference, key === "load" ? 0 : 1)}${meta.unit}`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PainHistoryVisualization({ records }: { records: PainRecord[] }) {
  const visible = records.slice(-8).reverse();
  if (!visible.length)
    return <div className="empty-chart compact">Sin molestias contextualizadas.</div>;
  return (
    <div className="pain-history-visual" aria-label="Evolución contextual del dolor declarado">
      <div className="pain-history-intro">
        <strong>{records.length} registro{records.length === 1 ? "" : "s"}</strong>
        <span>Intensidad, zona y limitación; no es un diagnóstico.</span>
      </div>
      <div className="pain-history-list">
        {visible.map((record) => (
          <div key={record.id}>
            <time>{formatDate(record.date)}</time>
            <span className="pain-history-track" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, record.intensity * 10))}%` }} />
            </span>
            <strong>{display(record.intensity)}/10</strong>
            <span>{record.zone}</span>
            <small>Limita: {record.limitation}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitionMinutesHistory({ matches }: { matches: MatchRecord[] }) {
  const visible = matches.slice(-12);
  if (!visible.length)
    return <div className="empty-chart compact">Sin partidos registrados.</div>;
  return (
    <div className="minutes-history" role="list" aria-label="Minutos por partido en las últimas doce jornadas">
      {visible.map((match) => {
        const week = CALENDAR[match.weekId - 1];
        return (
          <div
            key={match.key}
            role="listitem"
            tabIndex={0}
            aria-label={`${week.label}: ${match.minutes == null ? "sin dato" : `${match.minutes} minutos`}, ${match.convocation.toLocaleLowerCase("es-ES")}`}
          >
            <span className="minutes-history-value">{match.minutes ?? "—"}</span>
            <span className="minutes-history-bar" aria-hidden="true">
              <i style={{ height: `${match.minutes == null ? 2 : Math.max(2, Math.min(100, (match.minutes / 90) * 100))}%` }} />
            </span>
            <strong>{week.label}</strong>
            <small>{match.convocation === "TITULAR" ? "Tit." : match.convocation === "SUPLENTE" ? "Sup." : "NC"}</small>
          </div>
        );
      })}
    </div>
  );
}

function MetricExplorer({
  playerId,
  metrics,
  initial = "rpe",
  weekId = ACTIVE_WEEK_ID,
}: {
  playerId: string;
  metrics: Map<string, PlayerMetric>;
  initial?: MetricKey;
  weekId?: number;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>(initial);
  const [range, setRange] = useState<4 | 8 | 12 | 38>(8);
  const history = CALENDAR.slice(0, weekId).map(
    (week) => metrics.get(`${week.id}-${playerId}`)!,
  ).filter(Boolean);
  const visible = history.slice(-range);
  const current = history.at(-1)!;
  const reference =
    metricKey === "rpe"
      ? current.personalRpe
      : metricKey === "sleep"
        ? current.personalSleep
        : null;
  const trend = trendInfo(history, metricKey);
  const meta = METRICS[metricKey];
  const domains: Partial<Record<MetricKey, [number, number]>> = {
    rpe: [0, 10],
    sleep: [4, 10],
    mood: [1, 5],
    fatigue: [1, 5],
    pain: [0, 10],
    stress: [1, 5],
  };
  const chartValue = (item: PlayerMetric) => {
    if (item.status === "SIN DATOS") return null;
    if (
      ["rpe", "load"].includes(metricKey) &&
      item.rpeExpected > 0 &&
      item.rpeCompleted === 0 &&
      item.matchRpe == null
    )
      return null;
    return metricValue(item, metricKey);
  };
  return (
    <section className="panel explorer-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Evolución</span>
          <h2>{meta.label}</h2>
          <small className="panel-subtitle">
            Valor actual{" "}
            {display(
              chartValue(current),
              metricKey === "load" ? 0 : 1,
            )}
            {meta.unit}
            {reference != null
              ? ` · habitual ${display(reference)}${meta.unit}`
              : ""}
          </small>
        </div>
        <div className="range-pills">
          {[4, 8, 12, 38].map((item) => (
            <button
              key={item}
              className={range === item ? "active" : ""}
              onClick={() => setRange(item as 4 | 8 | 12 | 38)}
            >
              {item === 38 ? "Temporada" : `${item} sem.`}
            </button>
          ))}
        </div>
      </div>
      <div className="metric-tabs">
        {(Object.keys(METRICS) as MetricKey[]).map((key) => (
          <button
            key={key}
            className={metricKey === key ? "active" : ""}
            onClick={() => setMetricKey(key)}
          >
            {METRICS[key].label}
          </button>
        ))}
      </div>
      <LineChart
        data={visible.map((item) => ({
          label: CALENDAR[item.weekId - 1].label,
          value: chartValue(item),
          tooltip: `${CALENDAR[item.weekId - 1].label} · ${meta.label}: ${display(
            chartValue(item),
            metricKey === "load" ? 0 : 1,
          )}${meta.unit}`,
        }))}
        color={meta.color}
        unit={meta.unit}
        reference={reference}
        domain={domains[metricKey]}
      />
      <div className="chart-insight">
        <span className={`trend trend-${trend.tone}`}>
          {trend.symbol} {trend.label}
        </span>
        <p>
          {reference == null && ["rpe", "sleep"].includes(metricKey)
            ? "Todavía sin referencia personal suficiente en este periodo."
            : "La referencia usa hasta 8 semanas anteriores y nunca incluye la semana actual."}
        </p>
      </div>
    </section>
  );
}

function GlobalSearch({
  onOpen,
  players,
}: {
  onOpen: (id: string) => void;
  players: RosterPlayer[];
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleUpperCase("es-ES");
  const results = normalized
    ? players.filter(
        (player) =>
          player.name.includes(normalized) ||
          String(player.number) === normalized ||
          player.position.includes(normalized),
      ).slice(0, 6)
    : [];
  return (
    <div className="global-search">
      <label>
        <span>⌕</span>
        <input
          aria-label="Buscar jugador global"
          placeholder="Buscar jugador, dorsal o posición"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {results.length > 0 && (
        <div className="global-results">
          {results.map((player) => (
            <button
              key={player.id}
              onClick={() => {
                onOpen(player.id);
                setQuery("");
              }}
            >
              <span className="number-badge">{player.number}</span>
              <div>
                <strong>{titleCase(player.name)}</strong>
                <small>{titleCase(player.position)}</small>
              </div>
              <b>→</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertDrawer({
  player,
  playerId,
  weekId,
  metric,
  alerts,
  setAlerts,
  onClose,
  onOpenPlayer,
}: {
  player: RosterPlayer;
  playerId: string;
  weekId: number;
  metric: PlayerMetric;
  alerts: AlertRecord[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertRecord[]>>;
  onClose: () => void;
  onOpenPlayer: () => void;
}) {
  const existing = alerts.find(
    (item) => item.playerId === playerId && item.weekId === weekId,
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const workflow = existing?.status ?? "NUEVA";
  const updateStatus = (status: AlertWorkflow) =>
    setAlerts((current) =>
      existing
        ? current.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  status,
                  updatedAt: "Ahora",
                  history: [
                    ...item.history,
                    `${ALERT_META[status].label}: ${note || "sin nota"}`,
                  ],
                  note,
                }
              : item,
          )
        : [
            ...current,
            {
              id: `alert-${playerId}-${weekId}`,
              playerId,
              weekId,
              status,
              note,
              updatedAt: "Ahora",
              history: [`${ALERT_META[status].label}: ${note || "sin nota"}`],
            },
          ],
    );
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="alert-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="drawer-close" onClick={onClose}>
          ×
        </button>
        <span className="eyebrow">Dato → señal → acción</span>
        <h2>{titleCase(player.name)}</h2>
        <div className="drawer-badges">
          <StatusBadge status={metric.status} />
          <AlertBadge status={workflow} />
        </div>
        <div className="signal-explain-list">
          {metric.signals.map((signal) => (
            <article
              key={signal.key}
              className={`signal-explain signal-${signal.severity}`}
            >
              <div>
                <small>DATO</small>
                <strong>{signal.data}</strong>
                <span>{signal.label}</span>
              </div>
              <dl>
                <div>
                  <dt>Referencia</dt>
                  <dd>{signal.reference}</dd>
                </div>
                <div>
                  <dt>Diferencia</dt>
                  <dd>{signal.difference}</dd>
                </div>
              </dl>
              <p>
                <b>SEÑAL:</b> {signal.explanation}
              </p>
              <p>
                <b>ACCIÓN:</b> {signal.action}
              </p>
            </article>
          ))}
        </div>
        <label className="notes-field">
          <span>Nota del staff</span>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej.: durmió mal por examen; entrena normal."
          />
        </label>
        <div className="workflow-actions">
          <button onClick={() => updateStatus("REVISADA")}>
            ✓ Marcar revisada
          </button>
          <button onClick={() => updateStatus("EN SEGUIMIENTO")}>
            ↻ En seguimiento
          </button>
          <button onClick={() => updateStatus("CERRADA")}>Cerrar</button>
        </div>
        <button className="primary-button giant" onClick={onOpenPlayer}>
          Ver ficha completa →
        </button>
        {existing && (
          <div className="review-history">
            <h3>Historial de revisión</h3>
            {existing.history.map((item, index) => (
              <p key={index}>• {item}</p>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

/* v18: implementación v16 retirada del runtime.
function LegacyTodayDashboard({
  weekId,
  setWeekId,
  metrics,
  plans,
  sessions,
  alerts,
  setAlerts,
  goTo,
  onOpenPlayer,
  onOpenAlert,
  players,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  plans: SessionPlan[];
  sessions: SessionRecord[];
  alerts: AlertRecord[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertRecord[]>>;
  goTo: (page: StaffPage) => void;
  onOpenPlayer: (id: string) => void;
  onOpenAlert: (id: string) => void;
}) {
  const priority: Record<Status, number> = {
    REVISAR: 4,
    INCOMPLETO: 3,
    VIGILAR: 2,
    "SIN DATOS": 1,
    OK: 0,
  };
  const session = weekId === ACTIVE_WEEK_ID ? ACTIVE_SESSION : 2;
  const week = CALENDAR[weekId - 1];
  const plan = plans.find(
    (item) => item.weekId === weekId && item.session === session,
  )!;
  const current = INITIAL_PLAYERS.map((player) => ({
    player,
    metric: metrics.get(`${weekId}-${player.id}`)!,
  }));
  const sessionRows = sessions.filter(
    (item) =>
      item.weekId === weekId &&
      item.session === session &&
      item.attendance === "ENTRENÓ",
  );
  const received = sessionRows.filter((item) => item.rpe != null).length;
  const wellbeing = current.filter((item) => item.metric.wellbeingDone).length;
  const attentionAll = current
    .filter((item) =>
      ["REVISAR", "VIGILAR"].includes(item.metric.status),
    )
    .sort((a, b) => priority[b.metric.status] - priority[a.metric.status])
  const attention = attentionAll.slice(0, 4);
  const pendingPlayers = current.filter((item) => item.metric.pending > 0);
  const counts = (value: Availability) =>
    current.filter(
      (item) => item.metric.availabilityKnown && item.metric.availability === value,
    ).length;
  const avgActual = mean(
    sessionRows.map((item) =>
      item.rpe != null && item.minutes != null
        ? completeEffortProduct(item.rpe, item.minutes)
        : null,
    ),
  );
  const planned = plan.plannedDuration * plan.targetRpe;
  const comparison = avgActual == null ? null : planState(avgActual, planned);
  const history = CALENDAR.slice(Math.max(0, weekId - 8), weekId).map(
    (item) => ({
      label: item.label,
      value: mean(
        INITIAL_PLAYERS.map(
          (player) => metrics.get(`${item.id}-${player.id}`)?.load ?? null,
        ),
      ),
    }),
  );
  const teamLoad = history.at(-1)?.value ?? null;
  const previousTeamLoad = history.at(-2)?.value ?? null;
  const teamLoadChange =
    teamLoad != null && previousTeamLoad
      ? ((teamLoad - previousTeamLoad) / previousTeamLoad) * 100
      : null;
  const markReviewed = (playerId: string) =>
    setAlerts((currentAlerts) => {
      const existing = currentAlerts.find(
        (item) => item.playerId === playerId && item.weekId === weekId,
      );
      return existing
        ? currentAlerts.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  status: "REVISADA",
                  updatedAt: "Ahora",
                  history: [
                    ...item.history,
                    "Marcada como revisada desde Inicio",
                  ],
                }
              : item,
          )
        : [
            ...currentAlerts,
            {
              id: `alert-${playerId}-${weekId}`,
              playerId,
              weekId,
              status: "REVISADA",
              note: "",
              updatedAt: "Ahora",
              history: ["Marcada como revisada desde Inicio"],
            },
          ];
    });
  return (
    <>
      <section className="today-hero">
        <div className="today-title">
          <span className="eyebrow">Centro de control de hoy</span>
          <h1>{formatDate(plan.date, true)}</h1>
          <p>
            {week.label} · {plan.name}
          </p>
        </div>
        <div className="today-session">
          <span>Sesión {session}</span>
          <strong>{plan.md}</strong>
          <b>{plan.time}</b>
          <small>
            {plan.type} · {plan.plannedDuration} min
          </small>
        </div>
        <WeekSelector weekId={weekId} onChange={setWeekId} compact />
      </section>
      <section className="today-status-grid">
        <button
          type="button"
          className="availability-overview status-summary-button"
          onClick={() => goTo("team")}
        >
          <span className="big-count">{INITIAL_PLAYERS.length}</span>
          <div>
            <small>JUGADORES</small>
            <div className="availability-counts">
              <span>
                <b>{counts("COMPLETO")}</b> completos
              </span>
              <span>
                <b>{counts("MODIFICADO")}</b> modificados
              </span>
              <span>
                <b>{counts("RECUPERACIÓN")}</b> recuperación
              </span>
              <span>
                <b>{counts("NO DISPONIBLE")}</b> no disponibles
              </span>
              <span>
                <b>{counts("AUSENTE")}</b> ausentes
              </span>
            </div>
          </div>
          <b className="summary-arrow">→</b>
        </button>
        <button
          type="button"
          className="today-progress status-summary-button"
          onClick={() => goTo("sessions")}
        >
          <small>RPE</small>
          <strong>
            {received} / {sessionRows.length}
          </strong>
          <div>
            <i
              style={{
                width: `${(received / Math.max(sessionRows.length, 1)) * 100}%`,
              }}
            />
          </div>
          <span>{sessionRows.length - received} pendientes · Ver</span>
        </button>
        <button
          type="button"
          className="today-progress status-summary-button"
          onClick={() => goTo("sessions")}
        >
          <small>BIENESTAR</small>
          <strong>
            {wellbeing} / {INITIAL_PLAYERS.length}
          </strong>
          <div>
            <i
              style={{
                width: `${(wellbeing / INITIAL_PLAYERS.length) * 100}%`,
              }}
            />
          </div>
          <span>{INITIAL_PLAYERS.length - wellbeing} pendientes · Ver</span>
        </button>
        <button
          type="button"
          className="today-attention status-summary-button"
          onClick={() => goTo("team")}
        >
          <small>ATENCIÓN</small>
          <strong>{attentionAll.length}</strong>
          <span>requieren revisión · Ver</span>
        </button>
      </section>
      <div className="today-action-bar" aria-label="Acciones de la sesión">
        <div>
          <span className="eyebrow">Qué hacer ahora</span>
          <strong>
            {sessionRows.length - received > 0
              ? `Faltan ${sessionRows.length - received} RPE de la sesión`
              : "Registro de RPE completo"}
          </strong>
          <small>{pendingPlayers.length} jugadores con algún registro pendiente</small>
        </div>
        <button onClick={() => goTo("reports")}>Informe previo</button>
        <button onClick={() => goTo("team")}>Revisar jugadores</button>
        <button className="primary-quick" onClick={() => goTo("sessions")}>
          Gestionar sesión →
        </button>
      </div>
      <div className="control-grid">
        <section className="panel control-attention">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Prioridad</span>
              <h2>Atención primero</h2>
            </div>
            <span className="quiet-label">Alertas explicables</span>
          </div>
          <div className="phase2-attention-list">
            {!attention.length && (
              <p className="empty-state compact-empty">
                No hay jugadores en Vigilar o Revisar en esta jornada.
              </p>
            )}
            {attention.map(({ player, metric }) => {
              const alert = alerts.find(
                (item) => item.playerId === player.id && item.weekId === weekId,
              );
              return (
                <article key={player.id}>
                  <div className="attention-main">
                    <span className="number-badge">{player.number}</span>
                    <div>
                      <strong>{titleCase(player.name)}</strong>
                      <small>
                        <AvailabilityBadge value={metric.availability} />
                      </small>
                    </div>
                    <StatusBadge status={metric.status} />
                    {alert && <AlertBadge status={alert.status} />}
                  </div>
                  <p>
                    <b>
                      {metric.signals.length} señal
                      {metric.signals.length !== 1 ? "es" : ""}:
                    </b>{" "}
                    {metric.reasons.slice(0, 2).join(" · ")}
                  </p>
                  <div className="attention-actions">
                    <button onClick={() => onOpenPlayer(player.id)}>
                      Ver ficha
                    </button>
                    <button onClick={() => markReviewed(player.id)}>
                      Marcar revisada
                    </button>
                    <button onClick={() => onOpenAlert(player.id)}>
                      Añadir nota / revisar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="panel today-plan">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sesión de hoy</span>
              <h2>Plan vs. realidad</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>Plan</dt>
              <dd>
                {plan.plannedDuration} min × RPE {display(plan.targetRpe)}
              </dd>
            </div>
            <div>
              <dt>Carga prevista</dt>
              <dd>{compact(planned)} UA</dd>
            </div>
            <div>
              <dt>Carga real media</dt>
              <dd>
                {avgActual == null
                  ? "Pendiente de RPE"
                  : `${compact(Math.round(avgActual))} UA`}
              </dd>
            </div>
            <div>
              <dt>Diferencia</dt>
              <dd className={comparison ? `plan-${comparison.tone}` : ""}>
                {comparison && avgActual != null
                  ? `${avgActual - planned >= 0 ? "+" : ""}${compact(
                      Math.round(avgActual - planned),
                    )} UA · ${comparison.variation >= 0 ? "+" : ""}${display(
                      comparison.variation,
                      0,
                    )}%`
                  : "Sin comparación todavía"}
              </dd>
            </div>
          </dl>
          {comparison && (
            <span className={`plan-label plan-${comparison.tone}`}>
              {comparison.label}
            </span>
          )}
          <p>Es contexto de planificación, no una alerta médica.</p>
        </aside>
      </div>
      <div className="control-grid lower">
        <section className="panel team-state-list">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Excepciones</span>
              <h2>Cambios de disponibilidad</h2>
            </div>
          </div>
          {!current.some((item) => item.metric.availability !== "COMPLETO") && (
            <p className="empty-state compact-empty">
              Toda la plantilla figura con disponibilidad completa.
            </p>
          )}
          {current
            .filter((item) => item.metric.availability !== "COMPLETO")
            .slice(0, 6)
            .map(({ player, metric }) => (
              <button key={player.id} onClick={() => onOpenPlayer(player.id)}>
                <span className="number-badge">{player.number}</span>
                <div>
                  <strong>{titleCase(player.name)}</strong>
                  <small>
                    {metric.reasons[0] ??
                      "Cambio operativo de disponibilidad"}
                  </small>
                </div>
                <AvailabilityBadge value={metric.availability} />
                <StatusBadge status={metric.status} />
                <b>→</b>
              </button>
            ))}
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Tendencia reciente</span>
              <h2>Carga total del equipo</h2>
            </div>
            <span className="quiet-label">Entrenamiento + partido</span>
          </div>
          <div className="chart-current-summary">
            <strong>{compact(teamLoad)} UA</strong>
            <span>
              {teamLoadChange == null
                ? "Sin comparación anterior"
                : `${teamLoadChange >= 0 ? "+" : ""}${display(
                    teamLoadChange,
                    0,
                  )}% vs. jornada anterior`}
            </span>
          </div>
          <LineChart data={history} color="#004379" unit=" UA" height={190} />
        </section>
      </div>
      <CollectiveSignals current={current} />
    </>
  );
}

*/
function TodayDashboard({
  weekId,
  setWeekId,
  metrics,
  plans,
  sessions,
  matches,
  painRecords,
  alerts,
  setAlerts,
  goTo,
  openSession,
  openLoad,
  onOpenPlayer,
  onOpenAlert,
  players,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  plans: SessionPlan[];
  sessions: SessionRecord[];
  matches: MatchRecord[];
  painRecords: PainRecord[];
  alerts: AlertRecord[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertRecord[]>>;
  goTo: (page: StaffPage) => void;
  openSession: (target?: SessionWorkspaceView) => void;
  openLoad: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenAlert: (id: string) => void;
  players: RosterPlayer[];
}) {
  const priority: Record<Status, number> = {
    REVISAR: 4,
    INCOMPLETO: 3,
    VIGILAR: 2,
    "SIN DATOS": 1,
    OK: 0,
  };
  const sessionNumber = weekId === ACTIVE_WEEK_ID ? ACTIVE_SESSION : 2;
  const week = CALENDAR[weekId - 1];
  const plan = plans.find(
    (item) => item.weekId === weekId && item.session === sessionNumber,
  );
  if (!plan) {
    return (
      <section className="command-empty-day">
        <span className="eyebrow">Hoy · Centro de mando</span>
        <h1>Sin sesión programada</h1>
        <p>Todavía no existe una sesión para esta jornada.</p>
        <button className="command-primary" onClick={() => openSession()}>
          Crear o revisar sesiones →
        </button>
      </section>
    );
  }

  const current = players.flatMap((player) => {
    const metric = metrics.get(`${weekId}-${player.id}`);
    return metric ? [{ player, metric }] : [];
  });
  const allSessionRows = sessions.filter(
    (item) => item.weekId === weekId && item.session === sessionNumber,
  );
  const trainedRows = allSessionRows.filter(
    (item) => item.attendance === "ENTRENÓ",
  );
  const received = trainedRows.filter((item) => item.rpe != null).length;
  const minutesDone = trainedRows.filter((item) => item.minutes != null).length;
  const wellbeingDone = current.filter(
    (item) => item.metric.wellbeingDone,
  ).length;
  const pendingPlayers = current.filter((item) => item.metric.pending > 0);
  const attentionAll = current
    .filter((item) => ["REVISAR", "VIGILAR"].includes(item.metric.status))
    .sort((a, b) => priority[b.metric.status] - priority[a.metric.status]);
  const attention = attentionAll.slice(0, 3);
  const counts = (value: Availability) =>
    current.filter(
      (item) => item.metric.availabilityKnown && item.metric.availability === value,
    ).length;
  const avgActual = mean(
    trainedRows.map((item) =>
      item.rpe != null && item.minutes != null
        ? completeEffortProduct(item.rpe, item.minutes)
        : null,
    ),
  );
  const planned = plan.plannedDuration * plan.targetRpe;
  const comparison = avgActual == null ? null : planState(avgActual, planned);
  const loadHistory = CALENDAR.slice(Math.max(0, weekId - 6), weekId).map(
    (calendarWeek) => ({
      label: calendarWeek.label,
      value: mean(
        players.map(
          (player) =>
            metrics.get(`${calendarWeek.id}-${player.id}`)?.load ?? null,
        ),
      ),
    }),
  );
  const teamLoad = loadHistory.at(-1)?.value ?? null;
  const previousTeamLoad = loadHistory.at(-2)?.value ?? null;
  const teamLoadChange =
    teamLoad != null && previousTeamLoad
      ? ((teamLoad - previousTeamLoad) / previousTeamLoad) * 100
      : null;
  const teamPlannedLoad = mean(
    current.map((item) => item.metric.plannedTotalLoad),
  );
  const teamPlanDifference =
    teamLoad != null && teamPlannedLoad
      ? ((teamLoad - teamPlannedLoad) / teamPlannedLoad) * 100
      : null;
  const currentMatch = matches.find((item) => item.weekId === weekId);
  const matchOpponent = currentMatch?.opponent.replace(/^J\d+\s*·\s*/, "");
  const rpePending = Math.max(0, trainedRows.length - received);
  const minutesPending = Math.max(0, trainedRows.length - minutesDone);
  const wellbeingPending = Math.max(
    0,
    players.length - wellbeingDone,
  );
  const reviewPending = attentionAll.filter(({ player }) => {
    const alert = alerts.find(
      (item) => item.playerId === player.id && item.weekId === weekId,
    );
    return !alert || ["NUEVA", "EN SEGUIMIENTO"].includes(alert.status);
  }).length;
  const sessionMoment = plan.closed
    ? "CERRADA"
    : minutesPending > 0
      ? "EN CURSO"
      : rpePending > 0
        ? "POR COMPLETAR"
        : "LISTA PARA CERRAR";
  const primaryLabel = plan.closed
    ? "Ver sesión"
    : minutesPending > 0
      ? "Gestionar sesión"
      : rpePending > 0
        ? "Completar sesión"
        : "Cerrar sesión";

  const sleepValues = current
    .map((item) => item.metric.sleep)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  const medianSleep = sleepValues.length
    ? sleepValues.length % 2
      ? sleepValues[Math.floor(sleepValues.length / 2)]
      : (sleepValues[sleepValues.length / 2 - 1] +
          sleepValues[sleepValues.length / 2]) /
        2
    : null;
  const sleepOutside = current.filter((item) =>
    item.metric.signals.some((signal) => signal.key.includes("sleep")),
  ).length;
  const fatigueOutside = current.filter(({ player, metric }) => {
    if (metric.fatigue == null) return false;
    const prior = CALENDAR.slice(Math.max(0, weekId - 9), weekId - 1)
      .map(
        (calendarWeek) =>
          metrics.get(`${calendarWeek.id}-${player.id}`)?.fatigue ?? null,
      )
      .filter((value): value is number => value != null);
    const reference = prior.length >= 5 ? mean(prior) : null;
    return reference != null && metric.fatigue >= reference + 0.75;
  }).length;
  const playersWithPain = current.filter(
    (item) => (item.metric.pain ?? 0) > 0,
  ).length;
  const limitingPain = new Set(
    painRecords
      .filter(
        (item) => item.weekId === weekId && item.limitation !== "No",
      )
      .map((item) => item.playerId),
  ).size;
  const lowExposure = current.filter(
    (item) =>
      item.metric.convocation !== "NO CONVOCADO" &&
      item.metric.matchMinutes != null && item.metric.matchMinutes < 30,
  ).length;
  const availabilityChanges = current
    .map(({ player, metric }) => ({
      player,
      current: metric.availability,
      previous:
        weekId > 1
          ? metrics.get(`${weekId - 1}-${player.id}`)?.availability ?? null
          : null,
    }))
    .filter((item) => item.previous && item.previous !== item.current);
  const newSignalChanges = current
    .map(({ player, metric }) => {
      const previousKeys = new Set(
        (weekId > 1
          ? metrics.get(`${weekId - 1}-${player.id}`)?.signals ?? []
          : []
        ).map((signal) => signal.key),
      );
      const signal = metric.signals.find(
        (item) =>
          ["review", "watch"].includes(item.severity) &&
          !previousKeys.has(item.key),
      );
      return signal ? { player, signal } : null;
    })
    .filter(
      (item): item is {
        player: RosterPlayer;
        signal: Signal;
      } => item != null,
    );
  const recentChanges = [
    ...availabilityChanges.map((item) => ({
      key: `availability-${item.player.id}`,
      icon: item.current === "COMPLETO" ? "↗" : "↘",
      title: titleCase(item.player.name),
      detail: `${AVAILABILITY_META[item.previous!].label} → ${AVAILABILITY_META[item.current].label}`,
      playerId: item.player.id,
    })),
    ...newSignalChanges.map((item) => ({
      key: `signal-${item.player.id}-${item.signal.key}`,
      icon: item.signal.severity === "review" ? "!" : "⚠",
      title: titleCase(item.player.name),
      detail: item.signal.label,
      playerId: item.player.id,
    })),
  ].slice(0, 4);
  const teamSummary = attentionAll.length
    ? `Equipo estable en general; ${attentionAll.length} jugador${attentionAll.length === 1 ? "" : "es"} requiere${attentionAll.length === 1 ? "" : "n"} atención y ${pendingPlayers.length} tiene${pendingPlayers.length === 1 ? "" : "n"} registros pendientes.`
    : pendingPlayers.length
      ? `Sin señales prioritarias; ${pendingPlayers.length} jugador${pendingPlayers.length === 1 ? "" : "es"} tiene${pendingPlayers.length === 1 ? "" : "n"} registros pendientes.`
      : "Equipo estable y registros al día.";

  const openTeamFilter = (filter: {
    monitor?: Status;
    available?: Availability;
    scope?: "all" | "attention";
    signal?: TeamSignalFilter;
  }) => {
    window.sessionStorage.setItem(
      "ucam-team-v18",
      JSON.stringify({
        search: "",
        position: "TODAS",
        status: filter.monitor ?? "TODOS",
        availability: filter.available ?? "TODAS",
        scope: filter.scope ?? "all",
        signal: filter.signal ?? "all",
      }),
    );
    goTo("team");
  };
  const markReviewed = (playerId: string) =>
    setAlerts((currentAlerts) => {
      const existing = currentAlerts.find(
        (item) => item.playerId === playerId && item.weekId === weekId,
      );
      return existing
        ? currentAlerts.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  status: "REVISADA",
                  updatedAt: "Ahora",
                  history: [
                    ...item.history,
                    "Marcada como revisada desde Hoy",
                  ],
                }
              : item,
          )
        : [
            ...currentAlerts,
            {
              id: `alert-${playerId}-${weekId}`,
              playerId,
              weekId,
              status: "REVISADA",
              note: "",
              updatedAt: "Ahora",
              history: ["Marcada como revisada desde Hoy"],
            },
          ];
    });

  return (
    <main className="command-center">
      <header className="command-day">
        <div className="command-day-copy">
          <span className="eyebrow">Hoy · Centro de mando</span>
          <div className="command-title-line">
            <h1>{formatDate(plan.date, true)}</h1>
            <span className="command-md">{plan.md}</span>
          </div>
          <p>
            <strong>Sesión {sessionNumber} · {plan.name}</strong>
            <span>{plan.time} · {plan.type} · {plan.plannedDuration} min</span>
          </p>
        </div>
        <div className="command-match-context">
          <small>Próximo partido</small>
          <strong>{matchOpponent ?? "Por confirmar"}</strong>
          <span>
            {currentMatch
              ? `${formatDate(currentMatch.date)} · ${currentMatch.venue.toLocaleLowerCase("es-ES")}`
              : "Sin partido programado"}
          </span>
        </div>
        <div className="command-day-controls">
          <WeekSelector weekId={weekId} onChange={setWeekId} compact />
          <span
            className={`session-moment moment-${sessionMoment
              .toLocaleLowerCase("es-ES")
              .replaceAll(" ", "-")}`}
          >
            {sessionMoment}
          </span>
          <button className="command-primary" onClick={() => openSession(String(sessionNumber) as SessionWorkspaceView)}>
            {primaryLabel} <span>→</span>
          </button>
        </div>
      </header>

      <section
        className="command-availability"
        aria-labelledby="availability-title"
      >
        <div className="command-section-intro">
          <span className="eyebrow">Disponibilidad</span>
          <h2 id="availability-title">
            {counts("COMPLETO")} completos
            <small> de {players.length} jugadores</small>
          </h2>
          <p>
            {counts("COMPLETO")} sin incidencias ·{" "}
            {players.length - counts("COMPLETO")} excepciones
          </p>
        </div>
        <div className="availability-command-list">
          {(
            [
              "COMPLETO",
              "MODIFICADO",
              "RECUPERACIÓN",
              "NO DISPONIBLE",
              "AUSENTE",
            ] as Availability[]
          ).map((value) => (
            <button
              key={value}
              className={`availability-command availability-command-${value
                .toLocaleLowerCase("es-ES")
                .replaceAll(" ", "-")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")}`}
              onClick={() => openTeamFilter({ available: value })}
            >
              <span>{AVAILABILITY_META[value].icon}</span>
              <strong>{counts(value)}</strong>
              <small>{AVAILABILITY_META[value].label}</small>
            </button>
          ))}
        </div>
      </section>

      <p className="command-team-sentence">
        <span aria-hidden="true">●</span> {teamSummary}
      </p>

      <div className="command-priority-grid">
        <section
          className="command-attention"
          aria-labelledby="attention-title"
        >
          <div className="command-heading">
            <div>
              <span className="eyebrow">Decisión prioritaria</span>
              <h2 id="attention-title">Atención primero</h2>
            </div>
            {attentionAll.length > attention.length && (
              <button
                onClick={() => openTeamFilter({ scope: "attention" })}
              >
                +{attentionAll.length - attention.length} más
              </button>
            )}
          </div>
          {!attention.length ? (
            <div className="command-calm-state">
              <span>✓</span>
              <div>
                <strong>Sin revisiones prioritarias</strong>
                <p>No hay jugadores en Vigilar o Revisar en esta jornada.</p>
              </div>
            </div>
          ) : (
            <div className="command-attention-list">
              {attention.map(({ player, metric }) => {
                const alert = alerts.find(
                  (item) =>
                    item.playerId === player.id && item.weekId === weekId,
                );
                const importantSignals = metric.signals
                  .filter((signal) => signal.severity !== "info")
                  .slice(0, 2);
                return (
                  <article key={player.id}>
                    <button
                      className="command-player-link"
                      onClick={() => onOpenPlayer(player.id)}
                      aria-label={`Abrir ficha de ${titleCase(player.name)}`}
                    >
                      <span className="command-player-number">
                        {player.number}
                      </span>
                      <span>
                        <strong>{titleCase(player.name)}</strong>
                        <small>{titleCase(player.position)}</small>
                      </span>
                    </button>
                    <div className="command-player-state">
                      <StatusBadge status={metric.status} />
                      <AvailabilityBadge value={metric.availability} />
                      {alert && <AlertBadge status={alert.status} />}
                    </div>
                    <div className="command-signal-list">
                      {importantSignals.map((signal) => (
                        <div key={signal.key}>
                          <span>
                            {signal.severity === "review" ? "!" : "⚠"}
                          </span>
                          <p>
                            <strong>{signal.label}</strong>
                            <small>
                              {signal.data} · habitual/ref. {signal.reference}
                            </small>
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="command-attention-actions">
                      <button onClick={() => onOpenPlayer(player.id)}>
                        Ver jugador
                      </button>
                      <button onClick={() => markReviewed(player.id)}>
                        ✓ Revisado
                      </button>
                      <button
                        className="icon-action"
                        onClick={() => onOpenAlert(player.id)}
                      >
                        + Nota
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="command-work" aria-labelledby="work-title">
          <div className="command-heading">
            <div>
              <span className="eyebrow">Trabajo operativo</span>
              <h2 id="work-title">Qué falta ahora</h2>
            </div>
            <span>{sessionMoment}</span>
          </div>
          <div className="command-task-list">
            <button onClick={() => openSession(String(sessionNumber) as SessionWorkspaceView)}>
              <span className="task-icon">
                {allSessionRows.filter((row) => row.attendance !== "SIN DATO").length === players.length ? "✓" : "◷"}
              </span>
              <span>
                <strong>Asistencia</strong>
                <small>
                  {allSessionRows.filter((row) => row.attendance !== "SIN DATO").length}/{players.length} registrados
                </small>
              </span>
              <b>
                {allSessionRows.filter((row) => row.attendance !== "SIN DATO").length === players.length
                  ? "Lista"
                  : `${Math.max(0, players.length - allSessionRows.filter((row) => row.attendance !== "SIN DATO").length)} faltan`}
              </b>
              <i>→</i>
            </button>
            <button onClick={() => openSession(String(sessionNumber) as SessionWorkspaceView)}>
              <span className="task-icon">{minutesPending ? "◷" : "✓"}</span>
              <span>
                <strong>Minutos</strong>
                <small>
                  {minutesDone}/{trainedRows.length} participantes
                </small>
              </span>
              <b>{minutesPending ? `${minutesPending} faltan` : "Listos"}</b>
              <i>→</i>
            </button>
            <button
              onClick={() => openSession(String(sessionNumber) as SessionWorkspaceView)}
              className={rpePending ? "task-pending" : ""}
            >
              <span className="task-icon">{rpePending ? "!" : "✓"}</span>
              <span>
                <strong>RPE</strong>
                <small>
                  {received}/{trainedRows.length} recibidos
                </small>
              </span>
              <b>{rpePending ? `${rpePending} pendientes` : "Completo"}</b>
              <i>→</i>
            </button>
            <button
              onClick={() => openSession("wellbeing")}
              className={wellbeingPending ? "task-pending" : ""}
            >
              <span className="task-icon">{wellbeingPending ? "◷" : "✓"}</span>
              <span>
                <strong>Bienestar semanal</strong>
                <small>
                  {wellbeingDone}/{players.length} completados
                </small>
              </span>
              <b>
                {wellbeingPending
                  ? `${wellbeingPending} pendientes`
                  : "Completo"}
              </b>
              <i>→</i>
            </button>
            <button
              onClick={() => openTeamFilter({ scope: "attention" })}
              className={reviewPending ? "task-review" : ""}
            >
              <span className="task-icon">{reviewPending ? "!" : "✓"}</span>
              <span>
                <strong>Revisiones</strong>
                <small>Señales explicables del equipo</small>
              </span>
              <b>{reviewPending ? `${reviewPending} pendientes` : "Al día"}</b>
              <i>→</i>
            </button>
          </div>
          <footer>
            <button onClick={() => goTo("reports")}>
              Ver informe preentrenamiento
            </button>
            <button className="command-primary compact" onClick={() => openSession(String(sessionNumber) as SessionWorkspaceView)}>
              {primaryLabel} →
            </button>
          </footer>
        </aside>
      </div>

      <section className="command-arrival" aria-labelledby="arrival-title">
        <div className="command-heading command-arrival-heading">
          <div>
            <span className="eyebrow">Estado general</span>
            <h2 id="arrival-title">Cómo llega el equipo</h2>
          </div>
          <button onClick={openLoad}>Abrir análisis de carga →</button>
        </div>
        <div className="command-arrival-grid">
          <div className="command-load-story">
            <div className="load-story-summary">
              <span>Carga media · esta jornada</span>
              <strong>
                {teamLoad == null ? "Sin datos" : `${compact(teamLoad)} UA`}
              </strong>
              <p>
                {teamLoadChange == null
                  ? "Sin comparación anterior"
                  : `${teamLoadChange >= 0 ? "+" : ""}${display(teamLoadChange, 0)}% vs. jornada anterior`}
                {teamPlanDifference == null
                  ? ""
                  : ` · ${teamPlanDifference >= 0 ? "+" : ""}${display(teamPlanDifference, 0)}% vs. plan`}
              </p>
            </div>
            <div className="command-load-spark">
              <Sparkline
                values={loadHistory.map((item) => item.value)}
                color="var(--chart-load)"
                className="spark-wide"
                label={`Carga media del equipo, últimas seis jornadas: ${loadHistory.map((item) => `${item.label} ${item.value == null ? "sin dato" : `${compact(item.value)} UA`}`).join(", ")}`}
              />
            </div>
            <div className="load-story-legend">
              <span>
                <i /> Media de carga por jugador
              </span>
              <small>6 jornadas · entrenamiento + competición</small>
            </div>
          </div>
          <div className="command-team-signals">
            <button
              onClick={() =>
                openTeamFilter({ signal: "sleep", scope: "attention" })
              }
            >
              <span>Sueño</span>
              <strong>
                {medianSleep == null ? "Sin datos" : `${display(medianSleep)} h`}
              </strong>
              <small>
                {sleepOutside
                  ? `${sleepOutside} por debajo de su habitual`
                  : "Equipo estable"}
              </small>
            </button>
            <button
              onClick={() =>
                openTeamFilter({ signal: "fatigue", scope: "attention" })
              }
            >
              <span>Cansancio</span>
              <strong>{fatigueOutside}</strong>
              <small>
                {fatigueOutside === 1
                  ? "jugador sobre su habitual"
                  : "jugadores sobre su habitual"}
              </small>
            </button>
            <button
              onClick={() =>
                openTeamFilter({ signal: "pain", scope: "attention" })
              }
            >
              <span>Dolor declarado</span>
              <strong>{playersWithPain}</strong>
              <small>
                {limitingPain
                  ? `${limitingPain} limita participación`
                  : "Sin limitación registrada"}
              </small>
            </button>
            <button onClick={openLoad}>
              <span>Exposición competitiva</span>
              <strong>{lowExposure}</strong>
              <small>jugadores con menos de 30 min</small>
            </button>
          </div>
          <div className="command-plan-story">
            <span className="eyebrow">Sesión · plan vs. realidad</span>
            <div>
              <p>
                <small>Plan</small>
                <strong>{compact(planned)} UA</strong>
                <span>
                  {plan.plannedDuration} min × RPE {display(plan.targetRpe)}
                </span>
              </p>
              <b>→</b>
              <p>
                <small>Real</small>
                <strong>
                  {avgActual == null
                    ? "Pendiente"
                    : `${compact(Math.round(avgActual))} UA`}
                </strong>
                <span>media por jugador</span>
              </p>
            </div>
            {comparison ? (
              <p className={`plan-context plan-${comparison.tone}`}>
                {comparison.label} · {comparison.variation >= 0 ? "+" : ""}
                {display(comparison.variation, 0)}%
              </p>
            ) : (
              <p className="plan-context">
                Se comparará cuando lleguen los RPE.
              </p>
            )}
            <small>Contexto de planificación; no es una alerta médica.</small>
          </div>
        </div>
      </section>

      <section className="command-changes" aria-labelledby="changes-title">
        <div className="command-heading">
          <div>
            <span className="eyebrow">Desde la jornada anterior</span>
            <h2 id="changes-title">Cambios relevantes</h2>
          </div>
          <span>Solo cambios deportivos y operativos</span>
        </div>
        {recentChanges.length ? (
          <div className="command-change-list">
            {recentChanges.map((change) => (
              <button
                key={change.key}
                onClick={() => onOpenPlayer(change.playerId)}
              >
                <span>{change.icon}</span>
                <p>
                  <strong>{change.title}</strong>
                  <small>{change.detail}</small>
                </p>
                <b>→</b>
              </button>
            ))}
          </div>
        ) : (
          <p className="command-no-changes">
            Sin cambios relevantes respecto a la jornada anterior.
          </p>
        )}
      </section>
    </main>
  );
}

function CollectiveSignals({
  current,
}: {
  current: Array<{
    player: RosterPlayer;
    metric: PlayerMetric;
  }>;
}) {
  const sleep = current.filter((item) =>
    item.metric.signals.some((signal) => signal.key.includes("sleep")),
  ).length;
  const fatigue = current.filter((item) =>
    item.metric.signals.some((signal) => signal.key === "fatigue"),
  ).length;
  const pain = current.filter((item) =>
    item.metric.signals.some((signal) => signal.key === "pain"),
  ).length;
  const exposure = current.filter(
    (item) =>
      item.metric.matchMinutes != null && item.metric.matchMinutes < 30 &&
      item.metric.convocation !== "NO CONVOCADO",
  ).length;
  return (
    <section className="panel collective-signals">
      <div className="collective-copy">
        <span className="eyebrow">Señales colectivas</span>
        <h2>Qué está cambiando en el equipo</h2>
        <p>
          Contexto para priorizar conversaciones, sin diagnósticos automáticos.
        </p>
      </div>
      <div className="collective-list">
        <span>
          <b>{sleep}</b>
          <small>Sueño por debajo de referencia</small>
        </span>
        <span>
          <b>{fatigue}</b>
          <small>Cansancio elevado</small>
        </span>
        <span>
          <b>{pain}</b>
          <small>Dolor comunicado</small>
        </span>
        <span>
          <b>{exposure}</b>
          <small>Baja exposición competitiva</small>
        </span>
      </div>
    </section>
  );
}

/* v18: vistas de Equipo/Plantilla anteriores retiradas del runtime.
function LegacyTeamViewV16({
  weekId,
  setWeekId,
  metrics,
  availability,
  setAvailability,
  onOpenPlayer,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  availability: AvailabilityRecord[];
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityRecord[]>>;
  onOpenPlayer: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("TODAS");
  const [monitor, setMonitor] = useState("TODOS");
  const [available, setAvailable] = useState("TODAS");
  const [displayMode, setDisplayMode] = useState<"list" | "cards">("list");
  const [importantOnly, setImportantOnly] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("ucam-team-view");
      if (stored) {
        const value = JSON.parse(stored) as {
          search?: string;
          position?: string;
          monitor?: string;
          available?: string;
          displayMode?: "list" | "cards";
          importantOnly?: boolean;
        };
        setSearch(value.search ?? "");
        setPosition(value.position ?? "TODAS");
        setMonitor(value.monitor ?? "TODOS");
        setAvailable(value.available ?? "TODAS");
        setDisplayMode(value.displayMode ?? "list");
        setImportantOnly(Boolean(value.importantOnly));
      }
    } catch {
      window.sessionStorage.removeItem("ucam-team-view");
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    window.sessionStorage.setItem(
      "ucam-team-view",
      JSON.stringify({
        search,
        position,
        monitor,
        available,
        displayMode,
        importantOnly,
      }),
    );
  }, [
    search,
    position,
    monitor,
    available,
    displayMode,
    importantOnly,
    preferencesLoaded,
  ]);
  const normalized = search.toLocaleUpperCase("es-ES");
  const players = INITIAL_PLAYERS.filter(
    (player) =>
      (player.name.includes(normalized) ||
        String(player.number).includes(normalized) ||
        player.position.includes(normalized)) &&
      (position === "TODAS" || POSITION_GROUPS[player.id] === position) &&
      (monitor === "TODOS" ||
        metrics.get(`${weekId}-${player.id}`)?.status === monitor) &&
      (available === "TODAS" ||
        metrics.get(`${weekId}-${player.id}`)?.availability === available) &&
      (!importantOnly ||
        metrics.get(`${weekId}-${player.id}`)?.status !== "OK" ||
        metrics.get(`${weekId}-${player.id}`)?.availability !== "COMPLETO"),
  );
  const activeFilters = [
    Boolean(search),
    position !== "TODAS",
    monitor !== "TODOS",
    available !== "TODAS",
    importantOnly,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setSearch("");
    setPosition("TODAS");
    setMonitor("TODOS");
    setAvailable("TODAS");
    setImportantOnly(false);
  };
  const updateAvailability = (playerId: string, value: Availability) =>
    setAvailability((current) =>
      current.map((item) =>
        item.weekId === weekId && item.playerId === playerId
          ? {
              ...item,
              value,
              note: value === "COMPLETO" ? "Entrenamiento completo" : item.note,
            }
          : item,
      ),
    );
  return (
    <>
      <SectionHeader
        eyebrow="Equipo"
        title="Disponibilidad y seguimiento"
        description="La disponibilidad describe lo que puede hacer; la monitorización explica si merece atención."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <div className="filter-bar">
        <label className="search-field">
          <span>⌕</span>
          <input
            aria-label="Buscar jugador"
            placeholder="Nombre, dorsal o posición"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        >
          <option value="TODAS">Todas las posiciones</option>
          {[
            "PORTEROS",
            "DEFENSAS",
            "CENTROCAMPISTAS",
            "EXTREMOS",
            "DELANTEROS",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          value={available}
          onChange={(event) => setAvailable(event.target.value)}
        >
          <option value="TODAS">Toda disponibilidad</option>
          {Object.keys(AVAILABILITY_META).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          value={monitor}
          onChange={(event) => setMonitor(event.target.value)}
        >
          <option value="TODOS">Toda monitorización</option>
          {Object.keys(STATUS_META).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          type="button"
          className={`important-filter ${importantOnly ? "active" : ""}`}
          aria-pressed={importantOnly}
          onClick={() => setImportantOnly((value) => !value)}
        >
          ⚑ Solo lo importante
        </button>
        <div className="team-view-toggle" aria-label="Cambiar vista">
          <button
            className={displayMode === "list" ? "active" : ""}
            onClick={() => setDisplayMode("list")}
          >
            ☷ Lista
          </button>
          <button
            className={displayMode === "cards" ? "active" : ""}
            onClick={() => setDisplayMode("cards")}
          >
            ▦ Tarjetas
          </button>
        </div>
        <span className="result-count">{players.length} jugadores</span>
        {activeFilters > 0 && (
          <button className="clear-filters" onClick={clearFilters}>
            Limpiar {activeFilters} filtro{activeFilters > 1 ? "s" : ""}
          </button>
        )}
      </div>
      <section className={`panel phase2-team-table view-${displayMode}`}>
        <div className="phase2-team-head">
          <span>Jugador</span>
          <span>Disponibilidad</span>
          <span>Monitorización</span>
          <span>Motivo</span>
          <span>Registros</span>
          <span>Carga total</span>
          <span>Partido</span>
        </div>
        {!players.length && (
          <div className="filtered-empty">
            <strong>No hay jugadores con estos filtros.</strong>
            <button onClick={clearFilters}>Mostrar toda la plantilla</button>
          </div>
        )}
        {players.map((player) => {
          const metric = metrics.get(`${weekId}-${player.id}`)!;
          const loadChange = relativeChange(metric.load, metric.chronic);
          return (
            <div className="phase2-team-row" key={player.id}>
              <button
                className="player-cell"
                onClick={() => onOpenPlayer(player.id)}
              >
                <span className="number-badge">{player.number}</span>
                <span>
                  <strong>{titleCase(player.name)}</strong>
                  <small>
                    {titleCase(player.position)} ·{" "}
                    {POSITION_GROUPS[player.id].toLocaleLowerCase("es-ES")}
                  </small>
                </span>
              </button>
              <select
                aria-label={`Disponibilidad de ${player.name}`}
                className="availability-select"
                value={metric.availability}
                onChange={(event) =>
                  updateAvailability(
                    player.id,
                    event.target.value as Availability,
                  )
                }
              >
                {Object.keys(AVAILABILITY_META).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <StatusBadge status={metric.status} />
              <span className="reason-cell">
                <span>{metric.reasons[0] ?? "Sin señales destacadas"}</span>
                <small>
                  Sueño {display(metric.sleep)} h · Dolor {display(metric.pain)}
                  /10
                </small>
              </span>
              <span className="registration-cell">
                <b>{rpeRegistrationText(metric)}</b>
                <small>{wellbeingRegistrationText(metric)}</small>
                <small>
                  {metric.pending
                    ? `${metric.pending} pendiente${metric.pending > 1 ? "s" : ""}`
                    : "Sin pendientes"}
                </small>
              </span>
              <strong className="team-load-cell">
                <span>
                  {compact(metric.load)} <small>UA</small>
                </span>
                <small>
                  {loadChange == null
                    ? "Sin referencia personal"
                    : `${loadChange >= 0 ? "+" : ""}${display(loadChange, 0)}% vs. 4 anteriores`}
                </small>
              </strong>
              <span>
                {metric.matchMinutes} min ·{" "}
                {metric.convocation.toLocaleLowerCase("es-ES")}
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}

function LegacyPlayersViewV16({
  weekId,
  setWeekId,
  metrics,
  onOpenPlayer,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  onOpenPlayer: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("TODAS");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const normalized = search.toLocaleUpperCase("es-ES");
  const players = INITIAL_PLAYERS.filter(
    (player) =>
      (player.name.includes(normalized) ||
        String(player.number).includes(normalized) ||
        player.position.includes(normalized)) &&
      (position === "TODAS" || POSITION_GROUPS[player.id] === position) &&
      (!attentionOnly ||
        metrics.get(`${weekId}-${player.id}`)?.status !== "OK" ||
        metrics.get(`${weekId}-${player.id}`)?.availability !== "COMPLETO"),
  );
  return (
    <>
      <SectionHeader
        eyebrow="Plantilla completa"
        title="Directorio de jugadores"
        description="Acceso rápido al contexto deportivo y de monitorización de toda la plantilla."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <div className="player-directory-tools">
        <label className="search-field">
          <span>⌕</span>
          <input
            aria-label="Buscar en el directorio"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, dorsal o posición"
          />
        </label>
        <select
          aria-label="Filtrar por grupo de posición"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        >
          <option value="TODAS">Todas las posiciones</option>
          <option>PORTEROS</option>
          <option>DEFENSAS</option>
          <option>CENTROCAMPISTAS</option>
          <option>EXTREMOS</option>
          <option>DELANTEROS</option>
        </select>
        <button
          className={attentionOnly ? "active" : ""}
          aria-pressed={attentionOnly}
          onClick={() => setAttentionOnly((value) => !value)}
        >
          ⚑ Requieren atención
        </button>
        <span>{players.length} jugadores</span>
      </div>
      <section className="player-directory">
        <div className="player-directory-head" aria-hidden="true">
          <span>Jugador</span>
          <span>Situación</span>
          <span>Señal principal</span>
          <span>Carga</span>
          <span>Exposición</span>
          <span>Bienestar</span>
        </div>
        {players.map((player) => {
          const metric = metrics.get(`${weekId}-${player.id}`)!;
          const loadTrend = trendInfo(
            CALENDAR.slice(0, weekId)
              .map((week) => metrics.get(`${week.id}-${player.id}`))
              .filter((item): item is PlayerMetric => Boolean(item)),
            "load",
          );
          return (
            <button
              className="player-directory-row"
              key={player.id}
              onClick={() => onOpenPlayer(player.id)}
            >
              <span className="directory-identity">
                <b>{player.number}</b>
                <span>
                  <strong>{titleCase(player.name)}</strong>
                  <small>
                    {titleCase(player.position)} · {calculateAge(player.birthDate)} años
                  </small>
                </span>
              </span>
              <span className="directory-statuses">
                <AvailabilityBadge value={metric.availability} />
                <StatusBadge status={metric.status} />
              </span>
              <span className="directory-reason">
                <strong>{metric.reasons[0] ?? "Sin señales destacadas"}</strong>
                <small>
                  {metric.pending
                    ? `${metric.pending} registro${metric.pending > 1 ? "s" : ""} pendiente${metric.pending > 1 ? "s" : ""}`
                    : "Registros al día"}
                </small>
              </span>
              <span className="directory-load">
                <strong>{compact(metric.load)} UA</strong>
                <small className={`trend-${loadTrend.tone}`}>
                  {loadTrend.symbol} {loadTrend.label}
                </small>
              </span>
              <span className="directory-exposure">
                <strong>{metric.matchMinutes} min</strong>
                <small>{metric.convocation.toLocaleLowerCase("es-ES")}</small>
              </span>
              <span className="directory-wellness">
                <strong>{display(metric.sleep)} h sueño</strong>
                <small>
                  Cansancio {display(metric.fatigue)}/5 · Dolor {display(metric.pain)}/10
                </small>
              </span>
              <span className="directory-open" aria-hidden="true">→</span>
            </button>
          );
        })}
        {!players.length && (
          <div className="filtered-empty">
            <strong>No hay jugadores con estos criterios.</strong>
            <button
              onClick={() => {
                setSearch("");
                setPosition("TODAS");
                setAttentionOnly(false);
              }}
            >
              Mostrar toda la plantilla
            </button>
          </div>
        )}
      </section>
    </>
  );
}

*/
function TeamView({
  weekId,
  setWeekId,
  metrics,
  players,
  onOpenPlayer,
  onManagePlayer,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  availability?: AvailabilityRecord[];
  setAvailability?: React.Dispatch<React.SetStateAction<AvailabilityRecord[]>>;
  players: RosterPlayer[];
  onOpenPlayer: (id: string) => void;
  onManagePlayer: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("TODAS");
  const [scope, setScope] = useState<"all" | "attention">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "TODOS">("TODOS");
  const [availabilityFilter, setAvailabilityFilter] = useState<
    Availability | "TODAS"
  >("TODAS");
  const [signalFilter, setSignalFilter] = useState<TeamSignalFilter>("all");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("ucam-team-v18");
      if (stored) {
        const value = JSON.parse(stored) as {
          search?: string;
          position?: string;
          scope?: "all" | "attention";
          status?: Status | "TODOS";
          availability?: Availability | "TODAS";
          signal?: TeamSignalFilter;
        };
        setSearch(value.search ?? "");
        setPosition(value.position ?? "TODAS");
        setScope(value.scope ?? "all");
        setStatusFilter(value.status ?? "TODOS");
        setAvailabilityFilter(value.availability ?? "TODAS");
        setSignalFilter(value.signal ?? "all");
      }
    } catch {
      window.sessionStorage.removeItem("ucam-team-v18");
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    window.sessionStorage.setItem(
      "ucam-team-v18",
      JSON.stringify({
        search,
        position,
        scope,
        status: statusFilter,
        availability: availabilityFilter,
        signal: signalFilter,
      }),
    );
  }, [
    search,
    position,
    scope,
    statusFilter,
    availabilityFilter,
    signalFilter,
    preferencesLoaded,
  ]);

  const priority: Record<Status, number> = {
    REVISAR: 0,
    INCOMPLETO: 1,
    VIGILAR: 2,
    "SIN DATOS": 3,
    OK: 4,
  };
  const normalized = search.trim().toLocaleUpperCase("es-ES");
  const allRows = players
    .map((player) => ({
      player,
      metric: metrics.get(`${weekId}-${player.id}`),
    }))
    .filter(
      (item): item is { player: RosterPlayer; metric: PlayerMetric } =>
        Boolean(item.metric),
    );
  const attentionRows = allRows.filter(
    ({ metric }) =>
      metric.status !== "OK" || metric.availability !== "COMPLETO",
  );
  const visibleRows = allRows
    .filter(
      ({ player, metric }) =>
        (player.name.includes(normalized) ||
          String(player.number).includes(normalized) ||
          player.position.includes(normalized)) &&
        (position === "TODAS" || player.position === position) &&
        (statusFilter === "TODOS" || metric.status === statusFilter) &&
        (availabilityFilter === "TODAS" ||
          metric.availability === availabilityFilter) &&
        (signalFilter === "all" ||
          (signalFilter === "pending"
            ? metric.pending > 0
            : metric.signals.some((signal) =>
                signal.key.includes(signalFilter),
              ))) &&
        (scope === "all" ||
          metric.status !== "OK" ||
          metric.availability !== "COMPLETO"),
    )
    .sort((a, b) => {
      const statusDifference = priority[a.metric.status] - priority[b.metric.status];
      if (statusDifference !== 0) return statusDifference;
      const availabilityDifference =
        Number(a.metric.availability === "COMPLETO") -
        Number(b.metric.availability === "COMPLETO");
      if (availabilityDifference !== 0) return availabilityDifference;
      return a.player.number - b.player.number;
    });
  const complete = allRows.filter(
    ({ metric }) => metric.availabilityKnown && metric.availability === "COMPLETO",
  ).length;
  const adapted = allRows.filter(({ metric }) =>
    ["MODIFICADO", "RECUPERACIÓN"].includes(metric.availability),
  ).length;
  const unavailable = allRows.filter(({ metric }) =>
    ["NO DISPONIBLE", "AUSENTE"].includes(metric.availability),
  ).length;
  const incomplete = allRows.filter(({ metric }) =>
    ["INCOMPLETO", "SIN DATOS"].includes(metric.status),
  ).length;
  const clearFilters = () => {
    setSearch("");
    setPosition("TODAS");
    setScope("all");
    setStatusFilter("TODOS");
    setAvailabilityFilter("TODAS");
    setSignalFilter("all");
  };

  return (
    <>
      <SectionHeader
        eyebrow="Equipo"
        title="Estado de la plantilla"
        description="Una lectura estable de todo el equipo. Las excepciones aparecen primero; el detalle vive en la ficha del jugador."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <section className="team-scan-summary" aria-label="Resumen de plantilla">
        <div>
          <span className="eyebrow">Plantilla · {allRows.length} jugadores</span>
          <strong>
            {attentionRows.length
              ? `${attentionRows.length} necesitan revisar su contexto`
              : "Sin excepciones relevantes en esta jornada"}
          </strong>
          <small>Disponibilidad y monitorización se muestran por separado.</small>
        </div>
        <dl>
          <div><dt>Completo</dt><dd>{complete}</dd></div>
          <div><dt>Adaptado</dt><dd>{adapted}</dd></div>
          <div><dt>No disponible</dt><dd>{unavailable}</dd></div>
          <div><dt>Sin completar</dt><dd>{incomplete}</dd></div>
        </dl>
      </section>
      <div className="team-toolbar">
        <label className="search-field">
          <span>⌕</span>
          <input
            aria-label="Buscar jugador en el equipo"
            placeholder="Nombre, dorsal o posición"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="team-scope" aria-label="Alcance de la plantilla">
          <button
            type="button"
            className={scope === "all" ? "active" : ""}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            Todos
          </button>
          <button
            type="button"
            className={scope === "attention" ? "active" : ""}
            aria-pressed={scope === "attention"}
            onClick={() => setScope("attention")}
          >
            Atención · {attentionRows.length}
          </button>
        </div>
        <select
          aria-label="Filtrar equipo por posición"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        >
          <option value="TODAS">Todas las posiciones</option>
          <option>PORTERO</option>
          <option>DEFENSA</option>
          <option>MEDIO</option>
          <option>DELANTERO</option>
        </select>
        <details className="team-filter-menu">
          <summary>Filtros</summary>
          <label>
            Disponibilidad
            <select
              value={availabilityFilter}
              onChange={(event) =>
                setAvailabilityFilter(
                  event.target.value as Availability | "TODAS",
                )
              }
            >
              <option value="TODAS">Todas</option>
              {Object.keys(AVAILABILITY_META).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Monitorización
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as Status | "TODOS")
              }
            >
              <option value="TODOS">Todas</option>
              {Object.keys(STATUS_META).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Motivo
            <select
              value={signalFilter}
              onChange={(event) =>
                setSignalFilter(event.target.value as TeamSignalFilter)
              }
            >
              <option value="all">Todos</option>
              <option value="sleep">Sueño</option>
              <option value="fatigue">Cansancio</option>
              <option value="pain">Dolor</option>
              <option value="pending">Registros pendientes</option>
            </select>
          </label>
        </details>
        <span className="result-count">{visibleRows.length} visibles</span>
        {(search ||
          position !== "TODAS" ||
          scope !== "all" ||
          statusFilter !== "TODOS" ||
          availabilityFilter !== "TODAS" ||
          signalFilter !== "all") && (
          <button className="clear-filters" onClick={clearFilters}>Limpiar</button>
        )}
      </div>
      <section className="team-roster-list">
        <div className="team-roster-head" aria-hidden="true">
          <span>Jugador</span>
          <span>Disponibilidad</span>
          <span>Monitorización</span>
          <span>Por qué importa</span>
          <span>Contexto</span>
          <span>Acciones</span>
        </div>
        {!visibleRows.length && (
          <div className="filtered-empty">
            <strong>No hay jugadores con estos criterios.</strong>
            <button onClick={clearFilters}>Mostrar toda la plantilla</button>
          </div>
        )}
        {visibleRows.map(({ player, metric }) => {
          const loadChange =
            metric.loadCompleteness === "COMPLETE"
              ? relativeChange(metric.load, metric.chronic)
              : null;
          const isNormal =
            metric.status === "OK" &&
            metric.availabilityKnown &&
            metric.availability === "COMPLETO";
          const loadLabel =
            metric.loadCompleteness === "COMPLETE"
              ? `${compact(metric.load)} UA`
              : metric.loadCompleteness === "PARTIAL"
                ? `${compact(metric.load)} UA · Parcial`
                : metric.loadCompleteness === "NO_EXPOSURE"
                  ? "0 UA · Sin exposición"
                  : "Carga sin datos";
          return (
            <article
              className={`team-roster-row ${isNormal ? "is-normal" : "needs-attention"}`}
              key={player.id}
            >
              <button
                className="team-player-identity"
                onClick={() => onOpenPlayer(player.id)}
              >
                <b>{player.number}</b>
                <span>
                  <strong>{titleCase(player.name)}</strong>
                  <small>{titleCase(player.position)}</small>
                </span>
              </button>
              <span className="team-player-availability">
                <small>Disponibilidad</small>
                {metric.availabilityKnown ? (
                  <AvailabilityBadge value={metric.availability} />
                ) : (
                  <span className="availability availability-unknown">— Sin dato</span>
                )}
              </span>
              <span className="team-player-monitoring">
                <small>Monitorización</small>
                <StatusBadge status={metric.status} />
              </span>
              <span className="team-player-reason">
                <strong>{metric.reasons[0] ?? "Sin señales relevantes"}</strong>
                <small>
                  {metric.pending
                    ? `${metric.pending} registro${metric.pending > 1 ? "s" : ""} pendiente${metric.pending > 1 ? "s" : ""}`
                    : "Registros al día"}
                </small>
              </span>
              <span className="team-player-context">
                <strong>{loadLabel}</strong>
                <small>
                  {loadChange == null ? "" : `${loadChange >= 0 ? "+" : ""}${display(loadChange, 0)}% · `}
                  {metric.matchMinutes == null ? "Competición sin dato" : `${metric.matchMinutes} min competición`}
                </small>
              </span>
              <span className="team-row-actions">
                <button onClick={() => onOpenPlayer(player.id)}>Abrir</button>
                <button onClick={() => onManagePlayer(player.id)}>Gestionar</button>
              </span>
            </article>
          );
        })}
      </section>
    </>
  );
}

function PlayerManagementPanel({
  player,
  players,
  onClose,
  onUpdated,
  notify,
}: {
  player: RosterPlayer;
  players: RosterPlayer[];
  onClose: () => void;
  onUpdated: (player: RosterPlayer) => void;
  notify?: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: player.name,
    number: String(player.number),
    position: player.position,
    birthDate: player.birthDate,
    dominantFoot: player.dominantFoot,
    notes: player.notes,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const initialForm = {
    name: player.name,
    number: String(player.number),
    position: player.position,
    birthDate: player.birthDate,
    dominantFoot: player.dominantFoot,
    notes: player.notes,
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const requestClose = () => {
    if (dirty) {
      setDiscardConfirm(true);
      return;
    }
    onClose();
  };
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dirty]);
  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const save = async () => {
    const nextErrors: Record<string, string> = {};
    const number = Number(form.number);
    if (!form.name.trim()) nextErrors.name = "Introduce el nombre del jugador.";
    if (!Number.isInteger(number) || number < 0 || number > 999)
      nextErrors.number = "Introduce un dorsal válido entre 0 y 999.";
    const duplicate = players.find(
      (candidate) =>
        candidate.id !== player.id && candidate.number === number,
    );
    if (duplicate)
      nextErrors.number = `El dorsal ${number} ya pertenece a ${titleCase(duplicate.name)}.`;
    if (!form.position) nextErrors.position = "Selecciona una posición.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: player.id,
          action: "UPDATE",
          name: form.name.trim(),
          shirtNumber: number,
          position: form.position,
          dateOfBirth: form.birthDate,
          dominantFoot: form.dominantFoot,
          notes: form.notes.trim(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "No hemos podido guardar los cambios.");
      onUpdated({
        ...player,
        name: form.name.trim().toLocaleUpperCase("es-ES"),
        number,
        position: form.position,
        birthDate: form.birthDate,
        dominantFoot: form.dominantFoot,
        notes: form.notes.trim(),
      });
      notify?.("Datos generales del jugador actualizados");
      onClose();
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "No hemos podido guardar los cambios.",
      });
    } finally {
      setSaving(false);
    }
  };
  const runAction = async (
    action: "ARCHIVE" | "ACTIVATE" | "REGENERATE_PIN" | "DISABLE_ACCESS",
  ) => {
    if (dirty) {
      setErrors({ form: "Guarda o descarta los cambios de información antes de modificar acceso o plantilla." });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const response = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: player.id, action }),
      });
      const payload = (await response.json()) as {
        error?: string;
        pin?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "No hemos podido completar la acción.");
      if (action === "REGENERATE_PIN") {
        setGeneratedPin(payload.pin ?? null);
        onUpdated({ ...player, accessActive: true });
        notify?.("Acceso Player activado y PIN renovado");
      } else if (action === "DISABLE_ACCESS") {
        setGeneratedPin(null);
        onUpdated({ ...player, accessActive: false });
        notify?.("Acceso Player desactivado");
      } else if (action === "ARCHIVE") {
        onUpdated({ ...player, active: false, accessActive: false });
        notify?.("Jugador archivado; su histórico se conserva");
        onClose();
      } else {
        onUpdated({ ...player, active: true });
        notify?.("Jugador reactivado en la plantilla");
        onClose();
      }
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "No hemos podido completar la acción.",
      });
    } finally {
      setSaving(false);
      setArchiveConfirm(false);
    }
  };
  return (
    <div
      className="drawer-backdrop player-manager-backdrop"
      role="presentation"
      onMouseDown={requestClose}
    >
      <section
        className="player-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="player-manager-header">
          <div>
            <span className="eyebrow">Gestión de plantilla</span>
            <h2 id="player-manager-title">Gestionar jugador</h2>
            <p>Modifica datos estables. Carga, RPE, bienestar y minutos se editan en sus flujos propios.</p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Cerrar gestión de jugador">×</button>
        </header>
        <div className="player-manager-body">
          <fieldset>
            <legend>Identidad</legend>
            <label className="field-wide">
              <span>Nombre</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} />
              {errors.name && <small className="field-error">{errors.name}</small>}
            </label>
            <label>
              <span>Dorsal</span>
              <input inputMode="numeric" value={form.number} onChange={(event) => update("number", event.target.value)} />
              {errors.number && <small className="field-error">{errors.number}</small>}
            </label>
            <label>
              <span>Fecha de nacimiento</span>
              <input type="date" value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} />
            </label>
          </fieldset>
          <fieldset>
            <legend>Contexto deportivo</legend>
            <label>
              <span>Posición</span>
              <select value={form.position} onChange={(event) => update("position", event.target.value)}>
                <option>PORTERO</option>
                <option>DEFENSA</option>
                <option>MEDIO</option>
                <option>DELANTERO</option>
              </select>
              {errors.position && <small className="field-error">{errors.position}</small>}
            </label>
            <label>
              <span>Pierna dominante</span>
              <select value={form.dominantFoot} onChange={(event) => update("dominantFoot", event.target.value)}>
                <option value="">Sin especificar</option>
                <option>DERECHA</option>
                <option>IZQUIERDA</option>
                <option>AMBAS</option>
              </select>
            </label>
            <label className="field-wide">
              <span>Nota general</span>
              <textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
              <small>Contexto estable del perfil; no sustituye notas de sesión o dolor.</small>
            </label>
          </fieldset>
          <fieldset className="player-access-management">
            <legend>Acceso Player Mode</legend>
            <div>
              <span>Estado de acceso</span>
              <strong>{player.accessActive ? "✓ Activo" : "— Sin acceso"}</strong>
            </div>
            <p>El PIN es privado. Al renovarlo, el anterior deja de funcionar.</p>
            <div className="player-access-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={saving || !player.active}
                onClick={() => runAction("REGENERATE_PIN")}
              >
                {player.accessActive ? "Renovar PIN" : "Activar acceso y crear PIN"}
              </button>
              {player.accessActive && (
                <button
                  type="button"
                  className="danger-quiet"
                  disabled={saving}
                  onClick={() => runAction("DISABLE_ACCESS")}
                >
                  Desactivar acceso
                </button>
              )}
            </div>
            {generatedPin && (
              <div className="generated-pin" role="status">
                <span>PIN nuevo · visible una sola vez</span>
                <strong>{generatedPin}</strong>
                <small>Anótalo y entrégalo al jugador por un canal seguro.</small>
              </div>
            )}
          </fieldset>
          <fieldset className="player-roster-actions">
            <legend>Acciones de plantilla</legend>
            <p>Archivar retira al jugador de la plantilla activa sin borrar su histórico.</p>
            {player.active ? (
              archiveConfirm ? (
                <div className="destructive-confirm">
                  <strong>¿Archivar a {titleCase(player.name)}?</strong>
                  <span>Sus sesiones, carga, bienestar e informes históricos permanecerán.</span>
                  <button type="button" className="danger-button" disabled={saving} onClick={() => runAction("ARCHIVE")}>Sí, archivar</button>
                  <button type="button" onClick={() => setArchiveConfirm(false)}>Cancelar</button>
                </div>
              ) : (
                <button type="button" className="danger-quiet" onClick={() => setArchiveConfirm(true)}>Archivar jugador</button>
              )
            ) : (
              <button type="button" className="secondary-button" disabled={saving} onClick={() => runAction("ACTIVATE")}>Reactivar en plantilla</button>
            )}
          </fieldset>
          {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        </div>
        <footer className="player-manager-footer">
          <button type="button" className="secondary-button" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={save} disabled={saving || !dirty || !player.active}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>
        {discardConfirm && (
          <div className="discard-dialog" role="alertdialog" aria-modal="true" aria-label="Cambios sin guardar">
            <strong>Hay cambios sin guardar</strong>
            <p>Si cierras ahora, se perderán las modificaciones del formulario.</p>
            <div>
              <button type="button" className="danger-quiet" onClick={onClose}>Descartar cambios</button>
              <button type="button" className="primary-button" onClick={() => setDiscardConfirm(false)}>Seguir editando</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PlayersView({
  players,
  onPlayerUpdated,
  onRosterChanged,
  notify,
  onOpenPlayer,
  isAdmin,
  requestedPlayerId,
}: {
  weekId?: number;
  setWeekId?: (id: number) => void;
  metrics?: Map<string, PlayerMetric>;
  players: RosterPlayer[];
  onPlayerUpdated?: (player: RosterPlayer) => void;
  onRosterChanged: () => void;
  notify?: (message: string) => void;
  onOpenPlayer: (id: string) => void;
  isAdmin: boolean;
  requestedPlayerId?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("TODAS");
  const [managingId, setManagingId] = useState<string | null>(null);
  const [rosterScope, setRosterScope] = useState<"active" | "archived">("active");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [playerForm, setPlayerForm] = useState({
    name: "",
    shirtNumber: "",
    position: "MEDIO",
  });
  useEffect(() => {
    if (requestedPlayerId) setManagingId(requestedPlayerId);
  }, [requestedPlayerId]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("ucam-player-directory");
      if (stored) {
        const value = JSON.parse(stored) as { search?: string; position?: string };
        setSearch(value.search ?? "");
        setPosition(value.position ?? "TODAS");
      }
    } catch {
      window.sessionStorage.removeItem("ucam-player-directory");
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    window.sessionStorage.setItem(
      "ucam-player-directory",
      JSON.stringify({ search, position }),
    );
  }, [search, position, preferencesLoaded]);
  const normalized = search.trim().toLocaleUpperCase("es-ES");
  const filteredPlayers = players.filter(
    (player) =>
      (player.name.includes(normalized) ||
        String(player.number).includes(normalized) ||
        player.position.includes(normalized)) &&
      (position === "TODAS" || player.position === position) &&
      (rosterScope === "active" ? player.active : !player.active),
  );
  const managedPlayer = players.find((player) => player.id === managingId) ?? null;
  const addPlayer = async () => {
    setCreateError("");
    const number = Number(playerForm.shirtNumber);
    const duplicate = players.find((player) => player.number === number);
    if (duplicate) {
      setCreateError(`El dorsal ${number} ya pertenece a ${titleCase(duplicate.name)}.`);
      return;
    }
    setBusy(true);
    const response = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...playerForm,
        shirtNumber: Number(playerForm.shirtNumber),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setCreateError(payload.error ?? "No hemos podido añadir el jugador.");
      return;
    }
    setPlayerForm({ name: "", shirtNumber: "", position: "MEDIO" });
    notify?.("Jugador añadido a la plantilla");
    onRosterChanged();
  };
  const importCsv = async (file: File) => {
    setBusy(true);
    setCreateError("");
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: await file.text() }),
    });
    const payload = (await response.json()) as {
      error?: string;
      imported?: number;
    };
    setBusy(false);
    if (!response.ok) {
      setCreateError(payload.error ?? "No hemos podido importar el CSV.");
      return;
    }
    notify?.(`${payload.imported ?? 0} jugadores importados`);
    onRosterChanged();
  };
  return (
    <>
      <SectionHeader
        eyebrow="Plantilla"
        title="Gestionar plantilla"
        description="Altas, datos estables, acceso y archivado en un único flujo secundario. El histórico nunca se elimina por defecto."
      />
      <section className="roster-create-strip">
        <div>
          <span className="eyebrow">Añadir jugador</span>
          <strong>Alta individual</strong>
        </div>
        <input value={playerForm.name} onChange={(event) => setPlayerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" aria-label="Nombre del nuevo jugador" />
        <input inputMode="numeric" value={playerForm.shirtNumber} onChange={(event) => setPlayerForm((current) => ({ ...current, shirtNumber: event.target.value.replace(/\D/g, "") }))} placeholder="Dorsal" aria-label="Dorsal del nuevo jugador" />
        <select value={playerForm.position} onChange={(event) => setPlayerForm((current) => ({ ...current, position: event.target.value }))} aria-label="Posición del nuevo jugador">
          <option>PORTERO</option><option>DEFENSA</option><option>MEDIO</option><option>DELANTERO</option>
        </select>
        <button className="primary-button" disabled={busy || !playerForm.name.trim() || !playerForm.shirtNumber} onClick={addPlayer}>Añadir</button>
        {isAdmin && (
          <label className="file-button">Importar CSV<input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])} /></label>
        )}
        {createError && <p className="form-error" role="alert">{createError}</p>}
      </section>
      <div className="player-directory-tools">
        <label className="search-field">
          <span>⌕</span>
          <input
            aria-label="Buscar en la plantilla"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, dorsal o posición"
          />
        </label>
        <select
          aria-label="Filtrar plantilla por posición"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
        >
          <option value="TODAS">Todas las posiciones</option>
          <option>PORTERO</option>
          <option>DEFENSA</option>
          <option>MEDIO</option>
          <option>DELANTERO</option>
        </select>
        <div className="team-scope" aria-label="Estado de plantilla">
          <button className={rosterScope === "active" ? "active" : ""} onClick={() => setRosterScope("active")}>Activos · {players.filter((player) => player.active).length}</button>
          <button className={rosterScope === "archived" ? "active" : ""} onClick={() => setRosterScope("archived")}>Archivados · {players.filter((player) => !player.active).length}</button>
        </div>
        <span>{filteredPlayers.length} visibles</span>
      </div>
      <section className="player-directory player-directory-management">
        <div className="player-directory-head" aria-hidden="true">
          <span>Jugador</span>
          <span>Perfil deportivo</span>
          <span>Acceso</span>
          <span>Nota general</span>
          <span>Acciones</span>
        </div>
        {filteredPlayers.map((player) => (
          <div className="player-directory-row" key={player.id}>
            <span className="directory-identity">
              <b>{player.number}</b>
              <span>
                <strong>{titleCase(player.name)}</strong>
                <small>{player.active ? "En plantilla" : "Histórico archivado"}</small>
              </span>
            </span>
            <span className="directory-profile">
              <strong>{titleCase(player.position)}</strong>
              <small>{calculateAge(player.birthDate)} años · {titleCase(player.dominantFoot || "Sin especificar")}</small>
            </span>
            <span className="directory-access">
              <strong>{player.accessActive ? "Player activo" : "Sin acceso"}</strong>
              <small>{player.active ? "En plantilla" : "Archivado"}</small>
            </span>
            <span className="directory-note">{player.notes || "Sin nota general"}</span>
            <span className="directory-actions">
              <button type="button" className="directory-open-profile" onClick={() => onOpenPlayer(player.id)}>Ver ficha</button>
              <button type="button" className="directory-manage" onClick={() => setManagingId(player.id)}>Gestionar</button>
            </span>
          </div>
        ))}
        {!filteredPlayers.length && (
          <div className="filtered-empty">
            <strong>No hay jugadores con estos criterios.</strong>
            <button onClick={() => { setSearch(""); setPosition("TODAS"); }}>
              Mostrar toda la plantilla
            </button>
          </div>
        )}
      </section>
      {managedPlayer && (
        <PlayerManagementPanel
          player={managedPlayer}
          players={players}
          onClose={() => setManagingId(null)}
          onUpdated={(player) => onPlayerUpdated?.(player)}
          notify={notify}
        />
      )}
    </>
  );
}

function TeamWorkspace({
  weekId,
  setWeekId,
  metrics,
  activePlayers,
  roster,
  onOpenPlayer,
  onPlayerUpdated,
  onRosterChanged,
  notify,
  isAdmin,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  activePlayers: RosterPlayer[];
  roster: RosterPlayer[];
  onOpenPlayer: (id: string) => void;
  onPlayerUpdated: (player: RosterPlayer) => void;
  onRosterChanged: () => void;
  notify: (message: string) => void;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<"status" | "manage">("status");
  const [requestedPlayerId, setRequestedPlayerId] = useState<string | null>(
    null,
  );
  return (
    <>
      <nav className="workspace-tabs team-workspace-tabs" aria-label="Secciones de Equipo">
        <span>Equipo</span>
        <button className={tab === "status" ? "active" : ""} onClick={() => setTab("status")}>Estado</button>
        <button className={tab === "manage" ? "active" : ""} onClick={() => setTab("manage")}>Gestionar plantilla</button>
      </nav>
      {tab === "status" ? (
        <TeamView
          weekId={weekId}
          setWeekId={setWeekId}
          metrics={metrics}
          players={activePlayers}
          onOpenPlayer={onOpenPlayer}
          onManagePlayer={(playerId) => {
            setRequestedPlayerId(playerId);
            setTab("manage");
          }}
        />
      ) : (
        <PlayersView
          players={roster}
          onPlayerUpdated={onPlayerUpdated}
          onRosterChanged={onRosterChanged}
          notify={notify}
          onOpenPlayer={onOpenPlayer}
          isAdmin={isAdmin}
          requestedPlayerId={requestedPlayerId}
        />
      )}
    </>
  );
}

function RegisterView({
  weekId,
  setWeekId,
  sessions,
  setSessions,
  wellbeing,
  setWellbeing,
  plans,
  setPlans,
  matches,
  setMatches,
  availability,
  setAvailability,
  metrics,
  notify,
  onOpenPlayer,
  players,
  view,
  setView,
  sessionFilter,
  setSessionFilter,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  sessions: SessionRecord[];
  setSessions: React.Dispatch<React.SetStateAction<SessionRecord[]>>;
  wellbeing: WellbeingRecord[];
  setWellbeing: React.Dispatch<React.SetStateAction<WellbeingRecord[]>>;
  plans: SessionPlan[];
  setPlans: React.Dispatch<React.SetStateAction<SessionPlan[]>>;
  matches: MatchRecord[];
  setMatches: React.Dispatch<React.SetStateAction<MatchRecord[]>>;
  availability: AvailabilityRecord[];
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityRecord[]>>;
  metrics: Map<string, PlayerMetric>;
  notify: (message: string) => void;
  onOpenPlayer: (playerId: string) => void;
  players: RosterPlayer[];
  view: SessionWorkspaceView;
  setView: (view: SessionWorkspaceView) => void;
  sessionFilter: "focus" | "exceptions" | "all";
  setSessionFilter: (filter: "focus" | "exceptions" | "all") => void;
}) {
  const week = CALENDAR[weekId - 1];
  const sessionNumber = Number(view);
  const plan = plans.find(
    (item) => item.weekId === weekId && item.session === sessionNumber,
  );
  const rows = sessions.filter(
    (item) => item.weekId === weekId && item.session === sessionNumber,
  );
  const matchRows = matches.filter((item) => item.weekId === weekId);
  const updateSession = (
    key: string,
    field: keyof SessionRecord,
    value: string | number | null,
  ) =>
    setSessions((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  const updatePlan = (
    field: keyof SessionPlan,
    value: string | number | boolean,
  ) =>
    setPlans((current) =>
      current.map((item) =>
        item.key === plan?.key ? { ...item, [field]: value } : item,
      ),
    );
  const updateMatch = (
    key: string,
    field: keyof MatchRecord,
    value: string | number | boolean | null,
  ) =>
    setMatches((current) =>
      current.map((item) =>
        item.key !== key
          ? item
          : field === "compensatory" && value === true
            ? {
                ...item,
                compensatory: true,
                compensatoryMinutes: item.compensatoryMinutes || 30,
                compensatoryRpe: item.compensatoryRpe ?? 4,
                observation:
                  item.observation === "__SIN_DATO__" ? "" : item.observation,
              }
            : field === "compensatory" && value === false
              ? {
                  ...item,
                  compensatory: false,
                  compensatoryMinutes: 0,
                  compensatoryRpe: null,
                  observation:
                    item.observation === "__SIN_DATO__" ? "" : item.observation,
                }
              : {
                  ...item,
                  [field]: value,
                  observation:
                    item.observation === "__SIN_DATO__"
                      ? ""
                      : item.observation,
                },
      ),
    );
  const updateAllMatch = (
    field: "opponent" | "venue" | "date",
    value: string,
  ) =>
    setMatches((current) =>
      current.map((item) =>
        item.weekId === weekId ? { ...item, [field]: value } : item,
      ),
    );
  const updateAvail = (playerId: string, value: Availability) =>
    setAvailability((current) => {
      const exists = current.some(
        (item) => item.weekId === weekId && item.playerId === playerId,
      );
      return exists
        ? current.map((item) =>
            item.weekId === weekId && item.playerId === playerId
              ? { ...item, value }
              : item,
          )
        : [...current, { weekId, playerId, value, note: "" }];
    });
  const updateWellbeing = (
    playerId: string,
    field: keyof WellbeingRecord,
    value: string | number | null,
  ) =>
    setWellbeing((current) =>
      current.map((item) =>
        item.weekId === weekId && item.playerId === playerId
          ? { ...item, [field]: value }
          : item,
      ),
    );
  type SessionParticipation = Availability | "DESCANSO" | "SIN DATO";
  const participationFor = (row: SessionRecord): SessionParticipation => {
    if (row.attendance === "SIN DATO") return "SIN DATO";
    if (row.attendance === "AUSENTE") return "AUSENTE";
    if (row.attendance === "DESCANSO") return "DESCANSO";
    if (row.attendance === "LESIONADO") return "NO DISPONIBLE";
    return (
      availability.find(
        (item) => item.weekId === weekId && item.playerId === row.playerId,
      )?.value ?? "COMPLETO"
    );
  };
  const setParticipation = (
    row: SessionRecord,
    value: SessionParticipation,
  ) => {
    if (!plan || plan.closed) return;
    if (value !== "DESCANSO" && value !== "SIN DATO") {
      updateAvail(row.playerId, value);
    }
    setSessions((current) =>
      current.map((item) => {
        if (item.key !== row.key) return item;
        if (value === "SIN DATO")
          return {
            ...item,
            attendance: "SIN DATO",
            minutes: null,
            rpe: null,
          };
        if (["NO DISPONIBLE", "AUSENTE", "DESCANSO"].includes(value)) {
          return {
            ...item,
            attendance:
              value === "AUSENTE"
                ? "AUSENTE"
                : value === "DESCANSO"
                  ? "DESCANSO"
                  : "LESIONADO",
            minutes: null,
            rpe: null,
          };
        }
        return {
          ...item,
          attendance: "ENTRENÓ",
          minutes: item.minutes ?? plan.plannedDuration,
        };
      }),
    );
  };
  const applyMinutesToTrained = () => {
    if (!plan) return;
    setSessions((current) =>
      current.map((item) =>
        item.weekId === weekId &&
        item.session === sessionNumber &&
        item.attendance === "ENTRENÓ"
          ? { ...item, minutes: plan.plannedDuration }
          : item,
      ),
    );
    notify(`${plan.plannedDuration} min aplicados a quienes entrenaron`);
  };
  const applyCompleteDefaults = () => {
    if (!plan) return;
    const sessionPlayerIds = new Set(rows.map((item) => item.playerId));
    setAvailability((current) =>
      current.map((item) =>
        item.weekId === weekId && sessionPlayerIds.has(item.playerId)
          ? { ...item, value: "COMPLETO" }
          : item,
      ),
    );
    setSessions((current) =>
      current.map((item) =>
        item.weekId === weekId &&
        item.session === sessionNumber
          ? {
              ...item,
              attendance: "ENTRENÓ",
              minutes: plan.plannedDuration,
            }
          : item,
      ),
    );
    setSessionFilter("focus");
    notify(
      `Base aplicada: todos completos · ${plan.plannedDuration} min. Revisa las excepciones.`,
    );
  };
  const participants = rows.filter((item) => item.attendance === "ENTRENÓ");
  const rpeReceived = participants.filter((item) => item.rpe != null).length;
  const missingRpeRows = participants.filter((item) => item.rpe == null);
  const missingMinuteRows = participants.filter((item) => item.minutes == null);
  const inconsistentRows = rows.filter(
    (item) =>
      (item.rpe != null && (item.rpe < 0 || item.rpe > 10)) ||
      (item.minutes != null && (item.minutes < 0 || item.minutes > 180)) ||
      (item.attendance !== "ENTRENÓ" &&
        (item.rpe != null || item.minutes != null)),
  );
  const unregisteredRows = rows.filter(
    (item) => item.attendance === "SIN DATO",
  );
  const pendingPlayerIds = new Set(
    [
      ...unregisteredRows,
      ...missingRpeRows,
      ...missingMinuteRows,
      ...inconsistentRows,
    ].map((item) => item.playerId),
  );
  const isException = (row: SessionRecord) => {
    const participation = participationFor(row);
    return (
      participation !== "COMPLETO" ||
      (row.attendance === "ENTRENÓ" &&
        row.minutes != null &&
        row.minutes !== plan?.plannedDuration)
    );
  };
  const exceptionCount = rows.filter(isException).length;
  const isPriority = (row: SessionRecord) =>
    pendingPlayerIds.has(row.playerId) || participationFor(row) !== "COMPLETO";
  const priorityCount = rows.filter(isPriority).length;
  const normalCount = Math.max(rows.length - exceptionCount, 0);
  const visibleRows = [...rows]
    .filter((row) =>
      sessionFilter === "all"
        ? true
        : sessionFilter === "exceptions"
          ? isException(row)
          : isPriority(row),
    )
    .sort((a, b) => {
      const priorityA = pendingPlayerIds.has(a.playerId)
        ? 0
        : isException(a)
          ? 1
          : 2;
      const priorityB = pendingPlayerIds.has(b.playerId)
        ? 0
        : isException(b)
          ? 1
          : 2;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const playerA = players.find((item) => item.id === a.playerId);
      const playerB = players.find((item) => item.id === b.playerId);
      return (playerA?.number ?? 0) - (playerB?.number ?? 0);
    });
  const validLoads = participants
    .filter(
      (
        item,
      ): item is SessionRecord & { rpe: number; minutes: number } =>
        item.rpe != null && item.minutes != null,
    )
    .map((item) => loadForCompleteEffort(item.rpe, item.minutes));
  const validMinutes = participants
    .map((item) => item.minutes)
    .filter((item): item is number => item != null);
  const validRpe = participants
    .map((item) => item.rpe)
    .filter((item): item is number => item != null);
  const actualMinutes = mean(validMinutes);
  const actualRpe = mean(validRpe);
  const actualLoad = mean(validLoads);
  const plannedLoad = plan
    ? plan.plannedDuration * plan.targetRpe
    : null;
  const loadVariation =
    actualLoad != null && plannedLoad
      ? ((actualLoad - plannedLoad) / plannedLoad) * 100
      : null;
  const canClose =
    !!plan &&
    rows.length > 0 &&
    !unregisteredRows.length &&
    !missingRpeRows.length &&
    !missingMinuteRows.length &&
    !inconsistentRows.length;
  const sessionState = plan?.closed
    ? "CERRADA"
    : unregisteredRows.length ||
        missingRpeRows.length ||
        missingMinuteRows.length ||
        inconsistentRows.length
      ? "PENDIENTE DE DATOS"
      : "EN CURSO";
  const handleCloseSession = () => {
    if (!plan) return;
    if (plan.closed) {
      updatePlan("closed", false);
      notify(`Sesión ${view} reabierta para correcciones`);
      return;
    }
    if (!canClose) {
      setSessionFilter("focus");
      notify(
        `Aún faltan ${unregisteredRows.length} asistencias, ${missingRpeRows.length} RPE y ${missingMinuteRows.length} registros de minutos`,
      );
      return;
    }
    updatePlan("closed", true);
    notify(`Sesión ${view} cerrada y validada`);
  };
  return (
    <>
      <SectionHeader
        eyebrow="Centro operativo"
        title="Sesiones"
        description="Abre una sesión, aplica la normalidad una vez y trabaja únicamente sobre excepciones y pendientes."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <div className="record-view-tabs session-select-strip">
        {["1", "2", "3", "4"].map((item) => {
          const itemNumber = Number(item);
          const itemPlan = plans.find(
            (planItem) =>
              planItem.weekId === weekId &&
              planItem.session === itemNumber,
          );
          const itemRows = sessions.filter(
            (sessionRow) =>
              sessionRow.weekId === weekId &&
              sessionRow.session === itemNumber,
          );
          const itemParticipants = itemRows.filter(
            (sessionRow) => sessionRow.attendance === "ENTRENÓ",
          );
          const itemPending = itemParticipants.filter(
            (sessionRow) =>
              sessionRow.rpe == null || sessionRow.minutes == null,
          ).length;
          return (
            <button
              key={item}
              className={`${view === item ? "active" : ""} ${
                itemPlan?.closed
                  ? "session-tab-closed"
                  : itemPending
                    ? "session-tab-pending"
                    : "session-tab-ready"
              }`}
              onClick={() => setView(item as "1")}
            >
              <span>
                <b>S{item}</b>
                <small>{itemPlan?.md}</small>
              </span>
              <strong>{itemPlan?.name ?? "Sin plan"}</strong>
              <em>
                {itemPlan?.closed
                  ? "✓ Cerrada"
                  : itemPending
                    ? `${itemPending} pendientes`
                    : "Lista para cerrar"}
              </em>
            </button>
          );
        })}
        <button
          className={view === "match" ? "active match-tab" : "match-tab"}
          onClick={() => setView("match")}
        >
          <span><b>PARTIDO</b><small>MD</small></span>
          <strong>{matchRows[0]?.opponent ?? "Competición"}</strong>
          <em>Registro separado</em>
        </button>
        <button
          className={view === "wellbeing" ? "active" : ""}
          onClick={() => setView("wellbeing")}
        >
          <span><b>BIENESTAR</b><small>SEMANAL</small></span>
          <strong>Registro del jugador</strong>
          <em>1 vez por semana</em>
        </button>
      </div>
      {view !== "match" && view !== "wellbeing" && plan ? (
        <div className="session-operations">
          <section className="panel session-command">
            <div className="session-command-main">
              <span className="session-index">S{view}</span>
              <div>
                <span className="eyebrow">{formatDate(plan.date, true)} · {plan.time}</span>
                <h2>{plan.name}</h2>
                <p>{plan.type} · <b>{plan.md}</b>{plan.notes ? ` · ${plan.notes}` : ""}</p>
              </div>
              <span className={`session-state state-${plan.closed ? "closed" : canClose ? "ready" : "pending"}`}>
                {plan.closed ? "✓ Cerrada" : canClose ? "✓ Lista para cerrar" : `● ${sessionState.toLocaleLowerCase("es-ES")}`}
              </span>
            </div>
            <div className="session-plan-real" aria-label="Planificado frente a realizado">
              <div>
                <small>PLAN</small>
                <strong>{plan.plannedDuration} min · RPE {display(plan.targetRpe, 1)}</strong>
                <span>{compact(plan.plannedDuration * plan.targetRpe)} UA por jugador</span>
              </div>
              <b aria-hidden="true">→</b>
              <div>
                <small>REAL · MEDIA</small>
                <strong>{actualMinutes == null ? "Sin minutos" : `${display(actualMinutes, 0)} min`} · {actualRpe == null ? "RPE pendiente" : `RPE ${display(actualRpe, 1)}`}</strong>
                <span>{actualLoad == null ? "Carga pendiente" : `${compact(actualLoad)} UA`}{loadVariation == null ? "" : ` · ${loadVariation >= 0 ? "+" : ""}${display(loadVariation, 0)}% vs plan`}</span>
              </div>
            </div>
            <details className="session-plan-editor">
              <summary>Editar planificación y contexto</summary>
              <div className="blueprint-fields">
                <label>
                  Nombre
                  <input disabled={plan.closed} value={plan.name} onChange={(event) => updatePlan("name", event.target.value)} />
                </label>
                <label>
                  Fecha
                  <input disabled={plan.closed} type="date" value={plan.date} onChange={(event) => updatePlan("date", event.target.value)} />
                </label>
                <label>
                  Hora
                  <input disabled={plan.closed} type="time" value={plan.time} onChange={(event) => updatePlan("time", event.target.value)} />
                </label>
                <label>
                  Contexto MD
                  <select disabled={plan.closed} value={plan.md} onChange={(event) => updatePlan("md", event.target.value)}>
                    {["MD+1", "MD+2", "MD-4", "MD-3", "MD-2", "MD-1", "MD"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Tipo
                  <select disabled={plan.closed} value={plan.type} onChange={(event) => updatePlan("type", event.target.value)}>
                    {["Recuperación", "Gimnasio", "Campo", "Técnico", "Táctico", "Físico", "Compensatorio", "Activación", "Partido", "Otro"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Duración prevista
                  <input disabled={plan.closed} type="number" min="0" max="180" value={plan.plannedDuration} onChange={(event) => updatePlan("plannedDuration", Math.max(0, Math.min(180, Number(event.target.value))))} />
                </label>
                <label>
                  RPE objetivo
                  <input disabled={plan.closed} type="number" step=".5" min="0" max="10" value={plan.targetRpe} onChange={(event) => updatePlan("targetRpe", Math.max(0, Math.min(10, Number(event.target.value))))} />
                </label>
                <label className="plan-notes-field">
                  Observaciones
                  <input disabled={plan.closed} value={plan.notes} onChange={(event) => updatePlan("notes", event.target.value)} placeholder="Objetivo, contenido o contexto" />
                </label>
              </div>
            </details>
          </section>

          <section className={`session-close-check ${plan.closed ? "is-closed" : canClose ? "is-ready" : "has-pending"}`}>
            <div>
              <span className="eyebrow">Control de cierre</span>
              <strong>{plan.closed ? "Sesión cerrada y protegida" : canClose ? "Todo correcto. Puedes cerrar la sesión." : "Completa los datos pendientes antes de cerrar."}</strong>
              <small>{participants.length}/{rows.length} participaron · {rpeReceived}/{participants.length} RPE recibidos</small>
            </div>
            <ul>
              <li className={unregisteredRows.length ? "pending" : "done"}><b>{rows.length - unregisteredRows.length}/{rows.length}</b><span>Asistencia</span></li>
              <li className={missingMinuteRows.length ? "pending" : "done"}><b>{participants.length - missingMinuteRows.length}/{participants.length}</b><span>Minutos</span></li>
              <li className={missingRpeRows.length ? "pending" : "done"}><b>{rpeReceived}/{participants.length}</b><span>RPE</span></li>
              <li className={inconsistentRows.length ? "pending" : "done"}><b>{inconsistentRows.length || "✓"}</b><span>{inconsistentRows.length ? "Incoherencias" : "Coherencia"}</span></li>
            </ul>
            <button className={plan.closed || canClose ? "primary-button" : ""} onClick={handleCloseSession}>
              {plan.closed ? "Reabrir para corregir" : canClose ? "Cerrar sesión" : "Ver qué falta"}
            </button>
          </section>

          <section className="panel session-roster">
            <div className="session-roster-toolbar">
              <div>
                <span className="eyebrow">Plantilla · edición por excepciones</span>
                <strong>{normalCount} completos · {exceptionCount} excepciones · {missingRpeRows.length} RPE pendientes</strong>
                <small>Los cambios se guardan automáticamente y alimentan HOY, CARGA, jugadores e informes.</small>
              </div>
              <button disabled={plan.closed} className="session-default-action" onClick={applyCompleteDefaults}>
                Todos: completo · {plan.plannedDuration} min
              </button>
              <details className="session-bulk-menu">
                <summary>Más acciones</summary>
                <button disabled={plan.closed} onClick={applyMinutesToTrained}>{plan.plannedDuration} min a quienes participaron</button>
              </details>
            </div>
            <div className="session-roster-filters" aria-label="Filtrar jugadores de la sesión">
              <button className={sessionFilter === "focus" ? "active" : ""} onClick={() => setSessionFilter("focus")}>Prioridad <b>{priorityCount}</b></button>
              <button className={sessionFilter === "exceptions" ? "active" : ""} onClick={() => setSessionFilter("exceptions")}>Excepciones <b>{exceptionCount}</b></button>
              <button className={sessionFilter === "all" ? "active" : ""} onClick={() => setSessionFilter("all")}>Toda la plantilla <b>{rows.length}</b></button>
            </div>
            <div className="session-player-head" role="row">
              <span>Jugador</span><span>Participación</span><span>Minutos</span><span>RPE</span><span>Carga</span><span>Registro</span>
            </div>
            <div className="session-player-list">
              {visibleRows.map((row) => {
                const player = players.find((item) => item.id === row.playerId);
                if (!player) return null;
                const participation = participationFor(row);
                const pending = pendingPlayerIds.has(row.playerId);
                const exception = isException(row);
                const actual = row.rpe != null && row.minutes != null ? loadForCompleteEffort(row.rpe, row.minutes) : null;
                const tone = participation === "COMPLETO" ? "complete" : participation === "MODIFICADO" ? "modified" : participation === "RECUPERACIÓN" ? "recovery" : participation === "AUSENTE" ? "absent" : participation === "SIN DATO" ? "unknown" : "unavailable";
                return (
                  <div className={`session-player-row ${exception ? "is-exception" : "is-normal"} ${pending ? "needs-data" : ""}`} key={row.key} role="row">
                    <button className="session-player-identity" onClick={() => onOpenPlayer(player.id)} aria-label={`Abrir ficha de ${player.name}`}>
                      <span className="number-badge">{player.number}</span>
                      <span><strong>{titleCase(player.name)}</strong><small>{player.position} · Ver ficha</small></span>
                    </button>
                    <label className={`session-participation participation-${tone}`}>
                      <span>Participación</span>
                      <select disabled={plan.closed} value={participation} onChange={(event) => setParticipation(row, event.target.value as SessionParticipation)} aria-label={`Participación de ${player.name}`}>
                        <option value="SIN DATO">Sin registrar</option>
                        <option value="COMPLETO">Completo</option>
                        <option value="MODIFICADO">Modificado</option>
                        <option value="RECUPERACIÓN">Recuperación</option>
                        <option value="NO DISPONIBLE">No disponible</option>
                        <option value="AUSENTE">Ausente</option>
                        <option value="DESCANSO">Descanso</option>
                      </select>
                    </label>
                    <label className="session-number-field">
                      <span>Minutos</span>
                      <input aria-label={`Minutos de ${player.name}`} inputMode="numeric" type="number" min="0" max="180" disabled={plan.closed || row.attendance !== "ENTRENÓ"} value={row.minutes ?? ""} placeholder="—" onChange={(event) => updateSession(row.key, "minutes", event.target.value === "" ? null : Math.max(0, Math.min(180, Number(event.target.value))))} />
                      <small>{row.attendance === "ENTRENÓ" && row.minutes == null ? "Pendiente" : "min"}</small>
                    </label>
                    <label className="session-number-field">
                      <span>RPE</span>
                      <input aria-label={`RPE de ${player.name}`} inputMode="decimal" type="number" min="0" max="10" step=".1" disabled={plan.closed || row.attendance !== "ENTRENÓ"} value={row.rpe ?? ""} placeholder="—" onChange={(event) => updateSession(row.key, "rpe", event.target.value === "" ? null : Math.max(0, Math.min(10, Number(event.target.value))))} />
                      <small>{row.attendance !== "ENTRENÓ" ? "No aplica" : row.rpe == null ? "Pendiente" : "/10"}</small>
                    </label>
                    <div className="session-load-result"><span>Carga</span><strong>{actual == null ? "Sin dato" : `${compact(actual)} UA`}</strong></div>
                    <span className={`session-record-state ${row.attendance !== "ENTRENÓ" ? "not-required" : row.rpe == null ? "pending" : "received"}`}>
                      {row.attendance !== "ENTRENÓ" ? "— No requerido" : row.rpe == null ? "○ RPE pendiente" : "✓ RPE recibido"}
                    </span>
                  </div>
                );
              })}
              {!visibleRows.length && (
                <div className="session-roster-empty">
                  <strong>✓ No hay jugadores que necesiten revisión.</strong>
                  <span>La normalidad queda resumida para no añadir ruido.</span>
                  <button onClick={() => setSessionFilter("all")}>Ver toda la plantilla</button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : view === "match" ? (
        <>
          <section className="panel match-blueprint">
            <div>
              <span className="eyebrow">Competición</span>
              <h2>{matchRows[0]?.opponent}</h2>
              <p>
                La carga de partido se suma a la carga semanal, separada del
                entrenamiento.
              </p>
            </div>
            <label>
              Rival
              <input
                value={matchRows[0]?.opponent ?? ""}
                onChange={(event) =>
                  updateAllMatch("opponent", event.target.value)
                }
              />
            </label>
            <label>
              Local / visitante
              <select
                value={matchRows[0]?.venue ?? "LOCAL"}
                onChange={(event) =>
                  updateAllMatch("venue", event.target.value)
                }
              >
                <option>LOCAL</option>
                <option>VISITANTE</option>
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={matchRows[0]?.date ?? ""}
                onChange={(event) => updateAllMatch("date", event.target.value)}
              />
            </label>
          </section>
          <section className="panel phase2-match-table">
            <div className="phase2-match-head">
              <span>Jugador</span>
              <span>Convocatoria</span>
              <span>Minutos</span>
              <span>RPE partido</span>
              <span>Carga competición</span>
              <span>Exposición</span>
              <span>Compensatorio</span>
            </div>
            {matchRows.map((match) => {
              const player = players.find(
                (item) => item.id === match.playerId,
              );
              if (!player) return null;
              const load = loadForCompleteEffort(match.rpe, match.minutes);
              return (
                <div className="phase2-match-row" key={match.key}>
                  <div className="player-cell">
                    <span className="number-badge">{player.number}</span>
                    <strong>{titleCase(player.name)}</strong>
                  </div>
                  <select
                    value={match.convocation}
                    onChange={(event) =>
                      updateMatch(
                        match.key,
                        "convocation",
                        event.target.value as Convocation,
                      )
                    }
                  >
                    {["TITULAR", "SUPLENTE", "NO CONVOCADO"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <input
                    aria-label={`Minutos de partido de ${player.name}`}
                    type="number"
                    min="0"
                    max="120"
                    value={match.minutes ?? ""}
                    onChange={(event) =>
                      updateMatch(
                        match.key,
                        "minutes",
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                      )
                    }
                  />
                  <input
                    aria-label={`RPE de partido de ${player.name}`}
                    type="number"
                    min="0"
                    max="10"
                    step=".1"
                    value={match.rpe ?? ""}
                    onChange={(event) =>
                      updateMatch(
                        match.key,
                        "rpe",
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                      )
                    }
                  />
                  <strong>{load == null ? "Sin dato" : `${compact(load)} UA`}</strong>
                  <span
                    className={
                      match.minutes == null
                        ? "missing-exposure"
                        : match.minutes < 30
                          ? "low-exposure"
                          : "normal-exposure"
                    }
                  >
                    {match.minutes == null
                      ? "Sin minutos"
                      : match.minutes < 30
                        ? "↓ Baja exposición"
                        : "En contexto"}
                  </span>
                  <label className="comp-check">
                    <input
                      type="checkbox"
                      checked={match.compensatory}
                      onChange={(event) =>
                        updateMatch(
                          match.key,
                          "compensatory",
                          event.target.checked,
                        )
                      }
                    />
                    <span>
                      {match.compensatory
                        ? `${match.compensatoryMinutes} min · ${compact(completeEffortProduct(match.compensatoryRpe, match.compensatoryMinutes) ?? 0)} UA`
                        : "Añadir"}
                    </span>
                  </label>
                </div>
              );
            })}
            <div className="table-save">
              <span>
                Más carga no significa peor: se muestra exposición y contexto.
              </span>
              <strong className="autosave-copy">Los cambios se guardan automáticamente.</strong>
            </div>
          </section>
        </>
      ) : (
        <section className="wellbeing-staff-grid phase2-wellbeing-grid">
          {players.map((player) => {
            const record = wellbeing.find(
              (item) => item.weekId === weekId && item.playerId === player.id,
            );
            const metric = metrics.get(`${weekId}-${player.id}`);
            if (!record || !metric) return null;
            return (
              <article className="wellbeing-staff-card" key={player.id}>
                <div className="wellbeing-card-head">
                  <span className="number-badge">{player.number}</span>
                  <div>
                    <strong>{titleCase(player.name)}</strong>
                    <small>
                      {metric.wellbeingDone ? "✓ Completado" : "◷ Pendiente"}
                    </small>
                  </div>
                  <StatusBadge status={metric.status} />
                </div>
                <div className="compact-inputs">
                  <label>
                    Sueño
                    <input
                      type="number"
                      min="0"
                      max="14"
                      step=".1"
                      value={record.sleep ?? ""}
                      onChange={(event) =>
                        updateWellbeing(
                          player.id,
                          "sleep",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Ánimo
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step=".1"
                      value={record.mood ?? ""}
                      onChange={(event) =>
                        updateWellbeing(
                          player.id,
                          "mood",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Cans.
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step=".1"
                      value={record.fatigue ?? ""}
                      onChange={(event) =>
                        updateWellbeing(
                          player.id,
                          "fatigue",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Dolor
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step=".1"
                      value={record.pain ?? ""}
                      onChange={(event) =>
                        updateWellbeing(
                          player.id,
                          "pain",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Estrés
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step=".1"
                      value={record.stress ?? ""}
                      onChange={(event) =>
                        updateWellbeing(
                          player.id,
                          "stress",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>
              </article>
            );
          })}
          <p className="autosave-copy wellbeing-autosave">Los cambios se guardan automáticamente · vacío significa sin dato.</p>
        </section>
      )}
    </>
  );
}

type TeamLoadPoint = {
  label: string;
  training: number | null;
  match: number | null;
  compensatory: number | null;
  actual: number | null;
  planned: number | null;
  coverage: ReturnType<typeof summarizeLoadCoverage>;
};

const hasInterpretableLoad = (metric: PlayerMetric | undefined) =>
  metric?.loadCompleteness === "COMPLETE";
const loadText = (metric: PlayerMetric) =>
  metric.loadCompleteness === "COMPLETE"
    ? `${compact(metric.load)} UA`
    : metric.loadCompleteness === "PARTIAL"
      ? `${compact(metric.load)} UA · parcial`
      : metric.loadCompleteness === "NO_EXPOSURE"
        ? "0 UA · sin exposición"
        : "Sin dato";

const relativeChange = (
  current: number | null | undefined,
  reference: number | null | undefined,
) =>
  current != null && reference != null && reference !== 0
    ? ((current - reference) / reference) * 100
    : null;

function TeamLoadChart({
  data,
  activeIndex,
  onActiveIndex,
}: {
  data: TeamLoadPoint[];
  activeIndex: number;
  onActiveIndex: (index: number) => void;
}) {
  const width = 780;
  const height = 260;
  const left = 48;
  const top = 22;
  const plotHeight = 190;
  const step = (width - left * 2) / Math.max(data.length, 1);
  const barWidth = Math.min(42, step * 0.48);
  const maximum = Math.max(
    1,
    ...data.flatMap((item) =>
      [item.actual, item.planned].filter(
        (value): value is number => value != null,
      ),
    ),
  );
  const scaleMax = maximum * 1.12;
  const yFor = (value: number) =>
    top + plotHeight - (value / scaleMax) * plotHeight;
  const mobileData = data.slice(-5);
  const active = data[Math.min(activeIndex, Math.max(0, data.length - 1))];
  const widthFor = (value: number | null) =>
    `${Math.min(100, Math.max(0, ((value ?? 0) / scaleMax) * 100))}%`;

  return (
    <>
      <div className="team-load-chart-scroll">
        <svg
          className="team-load-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Evolución de la carga media semanal, desglosada por origen y comparada con la planificación"
        >
        {[0, 0.5, 1].map((fraction) => {
          const value = scaleMax * fraction;
          const y = yFor(value);
          return (
            <g key={fraction}>
              <line
                x1={left}
                y1={y}
                x2={width - left}
                y2={y}
                className="grid-line"
              />
              <text
                x={left - 9}
                y={y + 4}
                textAnchor="end"
                className="axis-label"
              >
                {compact(value)}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = left + step * index + step / 2;
          const training = item.training ?? 0;
          const match = item.match ?? 0;
          const compensatory = item.compensatory ?? 0;
          const trainingHeight = (training / scaleMax) * plotHeight;
          const matchHeight = (match / scaleMax) * plotHeight;
          const compensatoryHeight = (compensatory / scaleMax) * plotHeight;
          const base = top + plotHeight;
          return (
            <g
              key={item.label}
              className={index === data.length - 1 ? "current-week" : ""}
              tabIndex={0}
              onFocus={() => onActiveIndex(index)}
              onMouseEnter={() => onActiveIndex(index)}
              onPointerDown={() => onActiveIndex(index)}
              aria-label={`${item.label}: ${item.actual == null ? "sin datos completos" : `total ${compact(item.actual)} UA, entrenamiento ${compact(item.training)} UA, competición ${compact(item.match)} UA, compensatoria ${compact(item.compensatory)} UA`}${item.planned == null ? ", sin planificación comparable" : `, plan ${compact(item.planned)} UA`}; cobertura ${item.coverage.complete} completos, ${item.coverage.partial} parciales, ${item.coverage.noExposure} sin exposición, ${item.coverage.noData} sin datos`}
            >
              <title>
                {item.label} · {item.actual == null
                  ? "Sin datos"
                  : `Entrenamiento ${compact(training)} UA · Competición ${compact(match)} UA · Compensatoria ${compact(compensatory)} UA · Total ${compact(item.actual)} UA · Plan ${compact(item.planned)} UA`}
              </title>
              {index === data.length - 1 && (
                <rect
                  x={x - step / 2 + 4}
                  y={top - 9}
                  width={Math.max(0, step - 8)}
                  height={plotHeight + 31}
                  rx="9"
                  className="current-week-bg"
                />
              )}
              {item.actual == null ? (
                <line
                  x1={x - barWidth / 2}
                  y1={base}
                  x2={x + barWidth / 2}
                  y2={base}
                  className="no-data-mark"
                />
              ) : (
                <>
                  <rect
                    x={x - barWidth / 2}
                    y={base - trainingHeight}
                    width={barWidth}
                    height={Math.max(trainingHeight, training ? 1 : 0)}
                    rx="4"
                    className="team-training-bar"
                  />
                  <rect
                    x={x - barWidth / 2}
                    y={base - trainingHeight - matchHeight}
                    width={barWidth}
                    height={Math.max(matchHeight, match ? 1 : 0)}
                    rx="4"
                    className="team-match-bar"
                  />
                  <rect
                    x={x - barWidth / 2}
                    y={base - trainingHeight - matchHeight - compensatoryHeight}
                    width={barWidth}
                    height={Math.max(
                      compensatoryHeight,
                      compensatory ? 1 : 0,
                    )}
                    rx="4"
                    className="team-compensatory-bar"
                  />
                </>
              )}
              <text
                x={x}
                y={height - 20}
                textAnchor="middle"
                className="axis-label"
              >
                {item.label}
              </text>
              {item.planned != null && (
                <line
                  x1={x - barWidth / 2 - 5}
                  y1={yFor(item.planned)}
                  x2={x + barWidth / 2 + 5}
                  y2={yFor(item.planned)}
                  className="team-planned-marker"
                />
              )}
            </g>
          );
        })}
        </svg>
      </div>
      {active && (
        <div className="chart-selection" aria-live="polite">
          <strong>{active.label}</strong>
          <span>{active.actual == null ? "Sin dato realizado" : `${compact(active.actual)} UA total`}</span>
          <small>
            {active.actual == null
              ? "El hueco no se interpreta como cero."
              : `Entrenamiento ${compact(active.training)} · competición ${compact(active.match)} · compensatoria ${compact(active.compensatory)} UA`}
          </small>
          <em>{active.planned == null ? "Sin plan" : `Plan ${compact(active.planned)} UA`}</em>
          <span className="chart-coverage">{active.coverage.complete} completos · {active.coverage.partial} parciales · {active.coverage.noExposure} sin exposición · {active.coverage.noData} sin datos</span>
        </div>
      )}
      <div
        className="team-load-mobile"
        role="img"
        aria-label="Últimas cinco semanas de carga media, con carga realizada por origen y referencia planificada"
      >
        {mobileData.map((item) => (
          <div
            key={item.label}
            className={item === mobileData.at(-1) ? "current" : ""}
            aria-label={`${item.label}: ${item.actual == null ? "sin dato" : `total ${compact(item.actual)} UA, entrenamiento ${compact(item.training)} UA, competición ${compact(item.match)} UA, compensatoria ${compact(item.compensatory)} UA`}${item.planned == null ? ", sin plan" : `, plan ${compact(item.planned)} UA`}`}
          >
            <span className="team-load-mobile-week">{item.label}</span>
            <span className="team-load-mobile-track">
              {item.actual == null ? (
                <i className="team-load-mobile-empty">Sin dato</i>
              ) : (
                <span className="team-load-mobile-stack">
                  <i
                    className="training"
                    style={{ width: widthFor(item.training) }}
                  />
                  <i
                    className="match"
                    style={{ width: widthFor(item.match) }}
                  />
                  <i
                    className="compensatory"
                    style={{ width: widthFor(item.compensatory) }}
                  />
                </span>
              )}
              {item.planned != null && (
                <b
                  className="team-load-mobile-plan"
                  style={{ left: widthFor(item.planned) }}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="team-load-mobile-value">
              <strong>{item.actual == null ? "—" : compact(item.actual)}</strong>
              <small>
                {item.planned == null ? "Sin plan" : `Plan ${compact(item.planned)}`}
              </small>
              <em>{item.coverage.complete} completos</em>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function LoadView({
  weekId,
  setWeekId,
  metrics,
  onOpenPlayer,
  players,
  playerOrder,
  setPlayerOrder,
  advancedOpen,
  setAdvancedOpen,
  historyIndex,
  setHistoryIndex,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  onOpenPlayer: (id: string) => void;
  players: RosterPlayer[];
  playerOrder: "change" | "high" | "low" | "name";
  setPlayerOrder: (order: "change" | "high" | "low" | "name") => void;
  advancedOpen: boolean;
  setAdvancedOpen: (open: boolean) => void;
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
}) {
  const week = CALENDAR[weekId - 1];
  const current = players.flatMap((player) => {
    const metric = metrics.get(`${weekId}-${player.id}`);
    if (!metric) return [];
    const recentChange = relativeChange(
      hasInterpretableLoad(metric) ? metric.load : null,
      metric.chronic,
    );
    const plannedChange = relativeChange(
      hasInterpretableLoad(metric) ? metric.load : null,
      metric.plannedTotalLoad > 0 ? metric.plannedTotalLoad : null,
    );
    return [{
      player,
      metric,
      known: hasInterpretableLoad(metric),
      completeness: metric.loadCompleteness,
      recentChange,
      plannedChange,
    }];
  });
  const knownCurrent = current.filter((item) => item.known);
  const coverage = summarizeLoadCoverage(
    current.map((item) => item.completeness),
  );
  const totals = {
    training: knownCurrent.reduce(
      (sum, item) => sum + item.metric.trainingLoad,
      0,
    ),
    match: knownCurrent.reduce(
      (sum, item) => sum + item.metric.matchLoad,
      0,
    ),
    compensatory: knownCurrent.reduce(
      (sum, item) => sum + item.metric.compensatoryLoad,
      0,
    ),
    total: knownCurrent.reduce((sum, item) => sum + item.metric.load, 0),
    minutes: knownCurrent.reduce((sum, item) => sum + item.metric.minutes, 0),
  };
  const teamMean = mean(knownCurrent.map((item) => item.metric.load));
  const plannedMean = mean(
    knownCurrent.map((item) => item.metric.plannedTotalLoad),
  );
  const trainingMean = mean(
    knownCurrent.map((item) => item.metric.trainingLoad),
  );
  const matchMean = mean(knownCurrent.map((item) => item.metric.matchLoad));
  const compensatoryMean = mean(
    knownCurrent.map((item) => item.metric.compensatoryLoad),
  );
  const teamMeanForWeek = (id: number) => {
    if (id < 1) return null;
    return mean(
      players.map((player) => {
        const metric = metrics.get(`${id}-${player.id}`);
        return hasInterpretableLoad(metric) ? metric!.load : null;
      }),
    );
  };
  const previousMean = teamMeanForWeek(weekId - 1);
  const recentMean = mean(
    CALENDAR.slice(Math.max(0, weekId - 5), Math.max(0, weekId - 1)).map(
      (item) => teamMeanForWeek(item.id),
    ),
  );
  const weekChange = relativeChange(teamMean, previousMean);
  const recentChange = relativeChange(teamMean, recentMean);
  const planComparison =
    teamMean != null && plannedMean != null && plannedMean > 0
      ? planState(teamMean, plannedMean)
      : null;
  const sourceTotal =
    (trainingMean ?? 0) + (matchMean ?? 0) + (compensatoryMean ?? 0);
  const sourceShare = (value: number | null) =>
    sourceTotal > 0 ? ((value ?? 0) / sourceTotal) * 100 : 0;
  const teamHistory: TeamLoadPoint[] = CALENDAR.slice(
    Math.max(0, weekId - 8),
    weekId,
  ).map((calendarWeek) => {
    const allWeekRows = players.map((player) =>
      metrics.get(`${calendarWeek.id}-${player.id}`),
    ).filter((metric): metric is PlayerMetric => Boolean(metric));
    const rows = allWeekRows.filter(
      (metric): metric is PlayerMetric => hasInterpretableLoad(metric),
    );
    return {
      label: calendarWeek.label,
      training: mean(rows.map((metric) => metric.trainingLoad)),
      match: mean(rows.map((metric) => metric.matchLoad)),
      compensatory: mean(rows.map((metric) => metric.compensatoryLoad)),
      actual: mean(rows.map((metric) => metric.load)),
      planned: mean(rows.map((metric) => metric.plannedTotalLoad)),
      coverage: summarizeLoadCoverage(
        allWeekRows.map((metric) => metric.loadCompleteness),
      ),
    };
  });
  const planDifference =
    teamMean != null && plannedMean != null ? teamMean - plannedMean : null;
  const planBarMax = Math.max(teamMean ?? 0, plannedMean ?? 0, 1);
  const abovePlan = current.filter(
    (item) => item.plannedChange != null && item.plannedChange > 15,
  ).length;
  const belowPlan = current.filter(
    (item) => item.plannedChange != null && item.plannedChange < -15,
  ).length;
  const relevantChanges = current.filter(
    (item) => item.recentChange != null && Math.abs(item.recentChange) >= 20,
  ).length;
  const sortedPlayers = [...current].sort((a, b) => {
    if (a.known !== b.known) return a.known ? -1 : 1;
    if (playerOrder === "high") return b.metric.load - a.metric.load;
    if (playerOrder === "low") return a.metric.load - b.metric.load;
    if (playerOrder === "name")
      return a.player.name.localeCompare(b.player.name, "es");
    const aChange = Math.max(
      Math.abs(a.recentChange ?? 0),
      Math.abs(a.plannedChange ?? 0),
    );
    const bChange = Math.max(
      Math.abs(b.recentChange ?? 0),
      Math.abs(b.plannedChange ?? 0),
    );
    return bChange - aChange;
  });
  const deltaLabel = (value: number | null) =>
    value == null
      ? "Sin referencia"
      : `${value >= 0 ? "+" : ""}${display(value, 0)}%`;
  const deltaClass = (value: number | null) =>
    value == null
      ? "missing"
      : Math.abs(value) < 5
        ? "steady"
        : value > 0
          ? "rise"
          : "fall";
  const readingFor = (item: (typeof current)[number]) => {
    if (item.completeness === "PARTIAL")
      return {
        className: "partial",
        text: `Parcial · ${item.metric.completedLoadEfforts}/${item.metric.expectedLoadEfforts} esfuerzos`,
      };
    if (item.completeness === "NO_EXPOSURE")
      return { className: "no-exposure", text: "Sin exposición confirmada" };
    if (item.completeness === "NO_DATA")
      return { className: "missing", text: "Sin datos suficientes" };
    if (item.plannedChange != null && Math.abs(item.plannedChange) > 15)
      return {
        className: "plan",
        text: `${item.plannedChange > 0 ? "Por encima" : "Por debajo"} del plan`,
      };
    if (item.recentChange != null && Math.abs(item.recentChange) >= 20)
      return {
        className: "change",
        text: `Cambio ${item.recentChange > 0 ? "al alza" : "a la baja"}`,
      };
    return { className: "normal", text: "En su línea reciente" };
  };
  return (
    <div className="load-workspace">
      <SectionHeader
        eyebrow={`${week.period} · ${week.label}`}
        title="Carga semanal"
        description={`${formatDate(week.dates[0])}–${formatDate(week.dates[3])} · ${week.opponent.replace(/^.*·\s*/, "")}. Primero la lectura colectiva; después, las diferencias individuales.`}
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <p className="load-scope-note">
        <strong>Cómo leer esta pantalla:</strong> la cifra principal es la media
        de jugadores con exposición válida y datos completos. Los parciales,
        la ausencia de exposición y los datos desconocidos se muestran aparte.
      </p>
      <section className="panel load-command-panel">
        <div className="load-command-main">
          <span className="eyebrow">1 · Cuánto llevamos</span>
          <div className="load-command-value">
            <strong>{compact(teamMean)} UA</strong>
            <span>media de jugadores con exposición válida y datos completos</span>
          </div>
          <p>
            {weekChange == null
              ? "Sin comparación válida con la semana anterior."
              : `${weekChange >= 0 ? "↑" : "↓"} ${display(Math.abs(weekChange), 0)}% frente a la semana anterior`}
          </p>
          <dl className="load-context-grid">
            <div>
              <dt>Semana anterior</dt>
              <dd>{compact(previousMean)} UA</dd>
            </div>
            <div>
              <dt>Referencia reciente</dt>
              <dd>{compact(recentMean)} UA</dd>
            </div>
            <div>
              <dt>Cobertura de la media</dt>
              <dd>{coverage.complete} completos</dd>
            </div>
          </dl>
          <p className="load-coverage-line">
            <strong>{coverage.complete} completos</strong> · {coverage.partial} parciales · {coverage.noExposure} sin exposición · {coverage.noData} sin datos
          </p>
        </div>
        <div className="load-source-block">
          <div className="load-block-title">
            <span>2 · De dónde viene</span>
            <strong>Media por origen</strong>
          </div>
          <div className="load-source-stack" aria-label="Origen de la carga media">
            <i style={{ width: `${sourceShare(trainingMean)}%` }} />
            <b style={{ width: `${sourceShare(matchMean)}%` }} />
            <em style={{ width: `${sourceShare(compensatoryMean)}%` }} />
          </div>
          <div className="load-source-list">
            <span className="training">
              <i />
              <small>Entrenamiento</small>
              <strong>{compact(trainingMean)} UA</strong>
            </span>
            <span className="match">
              <i />
              <small>Competición</small>
              <strong>{compact(matchMean)} UA</strong>
            </span>
            <span className="compensatory">
              <i />
              <small>Compensatoria</small>
              <strong>{compact(compensatoryMean)} UA</strong>
            </span>
          </div>
        </div>
        <div className="load-plan-block">
          <div className="load-block-title">
            <span>3 · Frente al plan</span>
            <strong className={`plan-tone-${planComparison?.tone ?? "line"}`}>
              {planComparison?.label ?? "Sin planificación comparable"}
            </strong>
          </div>
          <div className="load-plan-bars">
            <div>
              <span>Plan</span>
              <i>
                <b
                  style={{
                    width: `${((plannedMean ?? 0) / planBarMax) * 100}%`,
                  }}
                />
              </i>
              <strong>{compact(plannedMean)}</strong>
            </div>
            <div>
              <span>Real</span>
              <i>
                <b
                  style={{ width: `${((teamMean ?? 0) / planBarMax) * 100}%` }}
                />
              </i>
              <strong>{compact(teamMean)}</strong>
            </div>
          </div>
          <div className="load-plan-difference">
            <span>Diferencia</span>
            <strong>
              {planDifference == null
                ? "—"
                : `${planDifference >= 0 ? "+" : ""}${compact(planDifference)} UA`}
            </strong>
            <small>
              {planComparison == null
                ? "Sin porcentaje"
                : `${planComparison.variation >= 0 ? "+" : ""}${display(planComparison.variation, 0)}%`}
            </small>
          </div>
          <p className="cohort-note">Plan y realizado usan los mismos {coverage.complete} jugadores completos.</p>
        </div>
      </section>

      <section className="panel load-trend-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Comparación temporal</span>
            <h2>Evolución de las últimas 8 jornadas</h2>
            <small className="panel-subtitle">
              Media por jugador · entrenamiento, competición y plan en una sola lectura
            </small>
          </div>
          <div className="load-reading-summary">
            <strong>
              {recentChange == null
                ? "Sin referencia reciente"
                : `${recentChange >= 0 ? "+" : ""}${display(recentChange, 0)}% vs. 4 anteriores`}
            </strong>
            <span>{compact(totals.minutes)} min acumulados</span>
          </div>
        </div>
        <TeamLoadChart
          data={teamHistory}
          activeIndex={Math.min(historyIndex, Math.max(0, teamHistory.length - 1))}
          onActiveIndex={setHistoryIndex}
        />
        <div className="team-load-legend">
          <span><i className="training" /> Entrenamiento</span>
          <span><i className="match" /> Competición</span>
          <span><i className="compensatory" /> Compensatoria</span>
          <span><i className="planned" /> Planificado</span>
          <small>Los huecos se mantienen como “sin dato”.</small>
        </div>
      </section>

      <section className="panel load-players-panel">
        <div className="load-players-heading">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Vista de jugadores</span>
              <h2>Quién cambia respecto a su contexto</h2>
              <small className="panel-subtitle">
                {abovePlan} por encima del plan · {belowPlan} por debajo · {relevantChanges} con cambios ≥20%
              </small>
            </div>
          </div>
          <div className="load-player-order" aria-label="Ordenar jugadores">
            {([
              ["change", "Cambios"],
              ["high", "Mayor carga"],
              ["low", "Menor exposición"],
              ["name", "Jugador"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={playerOrder === value ? "active" : ""}
                aria-pressed={playerOrder === value}
                onClick={() => setPlayerOrder(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="load-player-head" aria-hidden="true">
          <span>Jugador</span>
          <span>Carga y origen</span>
          <span>Vs. sus 4 anteriores</span>
          <span>Vs. plan</span>
          <span>Lectura</span>
          <span />
        </div>
        <div className="load-player-list">
          {sortedPlayers.map((item) => {
            const reading = readingFor(item);
            const hasRecordedLoad = ["COMPLETE", "PARTIAL"].includes(
              item.completeness,
            );
            const ownTotal = hasRecordedLoad ? item.metric.load : 0;
            const ownShare = (value: number) =>
              ownTotal > 0 ? (value / ownTotal) * 100 : 0;
            return (
              <button
                key={item.player.id}
                className="load-player-row"
                onClick={() => onOpenPlayer(item.player.id)}
              >
                <span className="load-player-identity">
                  <b>{item.player.number}</b>
                  <span>
                    <strong>{titleCase(item.player.name)}</strong>
                    <small>{titleCase(item.player.position)}</small>
                  </span>
                </span>
                <span className="load-player-composition">
                  <small>Carga y origen</small>
                  <strong>
                    {hasRecordedLoad
                      ? `${compact(item.metric.load)} UA`
                      : item.completeness === "NO_EXPOSURE"
                        ? "0 UA · Sin exposición"
                        : "Sin dato"}
                    <em>{item.metric.matchMinutes == null ? "Comp. sin dato" : `${item.metric.matchMinutes} min comp.`}</em>
                  </strong>
                  <i>
                    <b
                      className="training"
                      style={{ width: `${ownShare(item.metric.trainingLoad)}%` }}
                    />
                    <b
                      className="match"
                      style={{ width: `${ownShare(item.metric.matchLoad)}%` }}
                    />
                    <b
                      className="compensatory"
                      style={{
                        width: `${ownShare(item.metric.compensatoryLoad)}%`,
                      }}
                    />
                  </i>
                </span>
                <span className={`load-delta ${deltaClass(item.recentChange)}`}>
                  <small>Vs. sus 4 anteriores</small>
                  <strong>{deltaLabel(item.recentChange)}</strong>
                  <em>{compact(item.metric.chronic)} UA ref.</em>
                </span>
                <span className={`load-delta ${deltaClass(item.plannedChange)}`}>
                  <small>Vs. plan</small>
                  <strong>{deltaLabel(item.plannedChange)}</strong>
                  <em>{compact(item.metric.plannedTotalLoad)} UA plan</em>
                </span>
                <span className={`load-reading load-reading-${reading.className}`}>
                  {reading.text}
                </span>
                <span className="load-player-arrow" aria-hidden="true">→</span>
              </button>
            );
          })}
        </div>
      </section>

      <details
        className="panel load-advanced-details"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary>
          <div>
            <span className="eyebrow">Análisis avanzado</span>
            <h2>Análisis avanzado por jugador</h2>
          </div>
          <span className="quiet-label">
            EWMA · monotonía · strain · ratio descriptivo
          </span>
        </summary>
        {advancedOpen && (
          <div className="load-advanced-body">
            <p className="advanced-context-note">
              Estas métricas describen la carga y su distribución. No se utilizan
              como predictores de lesión.
            </p>
            <dl className="advanced-glossary">
              <div><dt>EWMA</dt><dd>Carga suavizada que da más peso a las semanas recientes.</dd></div>
              <div><dt>Monotonía</dt><dd>Cuánto se parece la carga de unos días a otros.</dd></div>
              <div><dt>Strain</dt><dd>Carga semanal multiplicada por la monotonía.</dd></div>
              <div><dt>Ratio</dt><dd>Semana actual dividida por la media de las 4 anteriores.</dd></div>
            </dl>
            <div className="load-advanced-scroll">
              <div className="load-advanced-head">
                <span>Jugador</span>
                <span>Entreno</span>
                <span>Partido</span>
                <span>Total</span>
                <span>Media 4 sem.</span>
                <span>EWMA</span>
                <span>Monotonía</span>
                <span>Strain</span>
                <span>Ratio</span>
              </div>
              {current.map(({ player, metric, known }) => {
                return (
                  <button
                    key={player.id}
                    className="load-advanced-row"
                    onClick={() => onOpenPlayer(player.id)}
                  >
                    <span className="player-cell">
                      <span className="number-badge">{player.number}</span>
                      <strong>{titleCase(player.name)}</strong>
                    </span>
                    <span>{known ? compact(metric.trainingLoad) : "—"}</span>
                    <span>{known ? compact(metric.matchLoad) : "—"}</span>
                    <strong>
                      {known ? `${compact(metric.load)} UA` : "—"}
                    </strong>
                    <span>{compact(metric.chronic)}</span>
                    <span>{compact(metric.ewma)}</span>
                    <span>{display(metric.monotony, 2)}</span>
                    <span>{compact(metric.strain)}</span>
                    <span>{display(metric.ratio, 2)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}

function EvolutionView({
  weekId,
  setWeekId,
  metrics,
  onOpenPlayer,
  players,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  onOpenPlayer: (id: string) => void;
  players: RosterPlayer[];
}) {
  return (
    <>
      <SectionHeader
        eyebrow="Cambios recientes"
        title="Evolución de la plantilla"
        description="Valores, mini tendencias y contexto; sin convertir más carga en peor resultado."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <section className="panel evolution-board">
        <div className="evolution-head">
          <span>Jugador</span>
          {(["rpe", "load", "sleep", "fatigue", "pain"] as MetricKey[]).map(
            (key) => (
              <span key={key}>{METRICS[key].label}</span>
            ),
          )}
        </div>
        {players.map((player) => {
          const history = CALENDAR.slice(0, weekId)
            .map((week) => metrics.get(`${week.id}-${player.id}`)!)
            .filter(Boolean);
          const current = history.at(-1);
          if (!current) return null;
          return (
            <button
              key={player.id}
              className="evolution-row"
              onClick={() => onOpenPlayer(player.id)}
            >
              <span className="player-cell">
                <span className="number-badge">{player.number}</span>
                <span>
                  <strong>{titleCase(player.name)}</strong>
                  <small>
                    <StatusBadge status={current.status} />
                  </small>
                </span>
              </span>
              {(["rpe", "load", "sleep", "fatigue", "pain"] as MetricKey[]).map(
                (key) => {
                  const trend = trendInfo(history, key);
                  return (
                    <span className="evo-metric" key={key}>
                      <small>{METRICS[key].label}</small>
                      <b>
                        {display(
                          metricValue(current, key),
                          key === "load" ? 0 : 1,
                        )}{METRICS[key].unit}
                      </b>
                      <em className={`trend-${trend.tone}`}>
                        {trend.symbol} {trend.label}
                      </em>
                    </span>
                  );
                },
              )}
            </button>
          );
        })}
      </section>
    </>
  );
}

function CalendarView({
  weekId,
  setWeekId,
  plans,
  matches,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  plans: SessionPlan[];
  matches: MatchRecord[];
}) {
  const week = CALENDAR[weekId - 1];
  const weekPlans = plans.filter((item) => item.weekId === weekId);
  const match = matches.find((item) => item.weekId === weekId)!;
  return (
    <>
      <SectionHeader
        eyebrow="Temporada 2026/2027"
        title="Calendario con contexto MD"
        description="Cuatro sesiones y partido por jornada, con planificación visible."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <section className="calendar-hero">
        <div>
          <span>{week.period}</span>
          <h2>{week.label}</h2>
          <p>{week.opponent}</p>
        </div>
        <div className="calendar-week-dates">
          {formatDate(week.dates[0])}
          <span>→</span>
          {formatDate(match.date)}
        </div>
      </section>
      <div className="phase2-session-cards">
        {weekPlans.map((plan) => (
          <article key={plan.key}>
            <div>
              <span className="session-index">S{plan.session}</span>
              <b>{plan.md}</b>
            </div>
            <h3>{plan.name}</h3>
            <p>
              {formatDate(plan.date)} · {plan.time}
            </p>
            <dl>
              <div>
                <dt>Tipo</dt>
                <dd>{plan.type}</dd>
              </div>
              <div>
                <dt>Previsto</dt>
                <dd>
                  {plan.plannedDuration} min × RPE {display(plan.targetRpe)}
                </dd>
              </div>
              <div>
                <dt>Carga</dt>
                <dd>{compact(plan.plannedDuration * plan.targetRpe)} UA</dd>
              </div>
            </dl>
          </article>
        ))}
        <article className="match-card">
          <div>
            <span className="session-index">P</span>
            <b>MD</b>
          </div>
          <h3>{match.opponent}</h3>
          <p>
            {formatDate(match.date)} · {match.venue.toLocaleLowerCase("es-ES")}
          </p>
          <dl>
            <div>
              <dt>Convocados</dt>
              <dd>
                {
                  matches.filter(
                    (item) =>
                      item.weekId === weekId &&
                      item.convocation !== "NO CONVOCADO",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Titulares</dt>
              <dd>
                {
                  matches.filter(
                    (item) =>
                      item.weekId === weekId && item.convocation === "TITULAR",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Evento</dt>
              <dd>Partido</dd>
            </div>
          </dl>
        </article>
      </div>
      <section className="panel season-timeline">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Todas las jornadas</span>
            <h2>Mapa de temporada</h2>
          </div>
        </div>
        <div className="week-chip-grid">
          {CALENDAR.map((item) => (
            <button
              key={item.id}
              className={item.id === weekId ? "active" : ""}
              onClick={() => setWeekId(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{formatDate(item.dates[0])}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function PlayerLoadChart({ history }: { history: PlayerMetric[] }) {
  const [range, setRange] = useState<8 | 12 | 38>(8);
  const visible = history.slice(-range);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, visible.length - 1));
  useEffect(
    () => setActiveIndex(Math.max(0, visible.length - 1)),
    [range, visible.length],
  );
  const width = 760;
  const height = 270;
  const left = 42;
  const top = 22;
  const plotHeight = 198;
  const step = (width - left * 2) / Math.max(visible.length, 1);
  const barWidth = Math.min(34, step * 0.58);
  const hasData = (item: PlayerMetric) =>
    item.status !== "SIN DATOS" &&
    !(
      item.rpeExpected > 0 &&
      item.rpeCompleted === 0 &&
      item.matchRpe == null
    );
  const maximum = Math.max(
    1,
    ...visible.flatMap((item) =>
      hasData(item) ? [item.load, item.plannedTotalLoad] : [],
    ),
  );
  const scaleMax = maximum * 1.12;
  const yFor = (value: number) => top + plotHeight - (value / scaleMax) * plotHeight;
  const planSegments: string[] = [];
  let planPoints: string[] = [];
  visible.forEach((item, index) => {
    if (!hasData(item) || item.plannedTotalLoad <= 0) {
      if (planPoints.length > 1) planSegments.push(planPoints.join(" "));
      planPoints = [];
      return;
    }
    const x = left + step * index + step / 2;
    planPoints.push(`${x},${yFor(item.plannedTotalLoad)}`);
  });
  if (planPoints.length > 1) planSegments.push(planPoints.join(" "));
  const labelEvery = Math.max(1, Math.ceil(visible.length / 8));
  const mobileData = visible.slice(-6);
  const active = visible[Math.min(activeIndex, Math.max(0, visible.length - 1))];
  const widthFor = (value: number) =>
    `${Math.min(100, Math.max(0, (value / scaleMax) * 100))}%`;
  return (
    <section className="panel player-load-chart">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Evolución de carga</span>
          <h2>Entrenamiento, competición y planificación</h2>
          <small className="panel-subtitle">
            Barras apiladas reales · línea dorada planificada · UA
          </small>
        </div>
        <div className="range-pills" aria-label="Periodo del gráfico">
          {[8, 12, 38].map((item) => (
            <button
              key={item}
              className={range === item ? "active" : ""}
              onClick={() => setRange(item as 8 | 12 | 38)}
            >
              {item === 38 ? "Temporada" : `${item} sem.`}
            </button>
          ))}
        </div>
      </div>
      <div className="performance-chart-scroll">
        <svg
          className="performance-load-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Carga semanal de entrenamiento y competición comparada con la planificación"
        >
          {[0, 0.5, 1].map((fraction) => {
            const value = scaleMax * fraction;
            const y = yFor(value);
            return (
              <g key={fraction}>
                <line x1={left} y1={y} x2={width - left} y2={y} className="grid-line" />
                <text x={left - 8} y={y + 4} textAnchor="end" className="axis-label">
                  {compact(value)}
                </text>
              </g>
            );
          })}
          {visible.map((item, index) => {
            const x = left + step * index + step / 2;
            const training = item.trainingLoad + item.compensatoryLoad;
            const competition = item.matchLoad;
            const trainingHeight = (training / scaleMax) * plotHeight;
            const competitionHeight = (competition / scaleMax) * plotHeight;
            const show = hasData(item);
            return (
              <g
                key={item.weekId}
                className={index === visible.length - 1 ? "current-week" : ""}
                tabIndex={0}
                onFocus={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={() => setActiveIndex(index)}
                aria-label={`${CALENDAR[item.weekId - 1].label}: ${hasData(item) ? `total ${compact(item.load)} UA, entrenamiento ${compact(item.trainingLoad + item.compensatoryLoad)} UA, competición ${compact(item.matchLoad)} UA` : "sin datos"}${item.plannedTotalLoad > 0 ? `, plan ${compact(item.plannedTotalLoad)} UA` : ", sin plan"}`}
              >
                <title>
                  {CALENDAR[item.weekId - 1].label} · {show ? `Entrenamiento ${compact(training)} UA · Partido ${compact(competition)} UA · Total ${compact(item.load)} UA · Plan ${compact(item.plannedTotalLoad)} UA` : "Sin datos"}
                </title>
                {index === visible.length - 1 && (
                  <rect
                    x={x - step / 2 + 2}
                    y={top - 8}
                    width={Math.max(0, step - 4)}
                    height={plotHeight + 27}
                    rx="8"
                    className="current-week-bg"
                  />
                )}
                {show ? (
                  <>
                    <rect
                      x={x - barWidth / 2}
                      y={top + plotHeight - trainingHeight}
                      width={barWidth}
                      height={Math.max(trainingHeight, 1)}
                      rx="4"
                      className="load-training-bar"
                    />
                    <rect
                      x={x - barWidth / 2}
                      y={top + plotHeight - trainingHeight - competitionHeight}
                      width={barWidth}
                      height={Math.max(competitionHeight, competition ? 1 : 0)}
                      rx="4"
                      className="load-match-bar"
                    />
                  </>
                ) : (
                  <line
                    x1={x - barWidth / 2}
                    y1={top + plotHeight}
                    x2={x + barWidth / 2}
                    y2={top + plotHeight}
                    className="no-data-mark"
                  />
                )}
                {(index % labelEvery === 0 || index === visible.length - 1) && (
                  <text x={x} y={height - 20} textAnchor="middle" className="axis-label">
                    {CALENDAR[item.weekId - 1].label}
                  </text>
                )}
              </g>
            );
          })}
          {planSegments.map((points, index) => (
            <polyline key={index} points={points} className="planned-load-line" />
          ))}
          {visible.map((item, index) =>
            hasData(item) && item.plannedTotalLoad > 0 ? (
              <circle
                key={item.weekId}
                cx={left + step * index + step / 2}
                cy={yFor(item.plannedTotalLoad)}
                r="3.5"
                className="planned-load-point"
              >
                <title>
                  {CALENDAR[item.weekId - 1].label} · Plan {compact(item.plannedTotalLoad)} UA
                </title>
              </circle>
            ) : null,
          )}
        </svg>
      </div>
      {active && (
        <div className="chart-selection" aria-live="polite">
          <strong>{CALENDAR[active.weekId - 1].label}</strong>
          <span>{hasData(active) ? `${compact(active.load)} UA total` : "Sin dato realizado"}</span>
          <small>
            {hasData(active)
              ? `Entrenamiento ${compact(active.trainingLoad + active.compensatoryLoad)} · competición ${compact(active.matchLoad)} UA`
              : "El hueco no se interpreta como cero."}
          </small>
          <em>{active.plannedTotalLoad > 0 ? `Plan ${compact(active.plannedTotalLoad)} UA` : "Sin plan"}</em>
        </div>
      )}
      <div className="player-load-mobile" aria-label="Carga semanal individual en las últimas seis jornadas">
        {mobileData.map((item) => {
          const show = hasData(item);
          const training = item.trainingLoad + item.compensatoryLoad;
          const competition = item.matchLoad;
          const weekLabel = CALENDAR[item.weekId - 1].label;
          return (
            <div
              key={item.weekId}
              className={item === mobileData.at(-1) ? "current" : ""}
              aria-label={`${weekLabel}: ${show ? `${compact(item.load)} UA, entrenamiento ${compact(training)} UA, competición ${compact(competition)} UA` : "sin dato"}${item.plannedTotalLoad > 0 ? `, plan ${compact(item.plannedTotalLoad)} UA` : ", sin plan"}`}
            >
              <span className="player-load-mobile-week">{weekLabel}</span>
              <span className="player-load-mobile-track">
                {show ? (
                  <span>
                    <i className="training" style={{ width: widthFor(training) }} />
                    <i className="match" style={{ width: widthFor(competition) }} />
                  </span>
                ) : (
                  <i className="player-load-mobile-empty">Sin dato</i>
                )}
                {item.plannedTotalLoad > 0 && (
                  <b
                    className="player-load-mobile-plan"
                    style={{ left: widthFor(item.plannedTotalLoad) }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="player-load-mobile-value">
                <strong>{show ? compact(item.load) : "—"}</strong>
                <small>{item.plannedTotalLoad > 0 ? `Plan ${compact(item.plannedTotalLoad)}` : "Sin plan"}</small>
              </span>
            </div>
          );
        })}
      </div>
      <div className="performance-chart-legend">
        <span><i className="training" /> Entrenamiento</span>
        <span><i className="match" /> Competición</span>
        <span><i className="planned" /> Planificado</span>
        <small>Los huecos representan semanas sin dato.</small>
      </div>
    </section>
  );
}

function PlayerWellbeingExplorer({
  history,
  pains,
}: {
  history: PlayerMetric[];
  pains: PainRecord[];
}) {
  const wellnessKeys: MetricKey[] = ["sleep", "mood", "fatigue", "pain", "stress"];
  const [metricKey, setMetricKey] = useState<MetricKey>("sleep");
  const [range, setRange] = useState<8 | 12 | 38>(8);
  const current = history.at(-1)!;
  const previousValues = history
    .slice(0, -1)
    .slice(-8)
    .map((item) => metricValue(item, metricKey))
    .filter((value): value is number => value != null);
  const personalReference = previousValues.length >= 5 ? mean(previousValues) : null;
  const actual = metricValue(current, metricKey);
  const difference =
    actual != null && personalReference != null ? actual - personalReference : null;
  const trend = trendInfo(history, metricKey);
  const visible = history.slice(-range);
  const meta = METRICS[metricKey];
  const domains: Partial<Record<MetricKey, [number, number]>> = {
    sleep: [4, 10],
    mood: [1, 5],
    fatigue: [1, 5],
    pain: [0, 10],
    stress: [1, 5],
  };
  const latestPain = pains.find((item) => item.weekId === current.weekId);
  return (
    <>
      <section className="panel wellness-command">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Bienestar semanal</span>
            <h2>Una lectura, cinco variables</h2>
          </div>
          <div className="range-pills" aria-label="Periodo de bienestar">
            {[8, 12, 38].map((item) => (
              <button
                key={item}
                className={range === item ? "active" : ""}
                onClick={() => setRange(item as 8 | 12 | 38)}
              >
                {item === 38 ? "Temporada" : `${item} sem.`}
              </button>
            ))}
          </div>
        </div>
        <div className="wellness-variable-strip">
          {wellnessKeys.map((key) => {
            const value = metricValue(current, key);
            const keyTrend = trendInfo(history, key);
            const isException = current.signals.some((signal) => signal.key.includes(key));
            return (
              <button
                key={key}
                className={`${metricKey === key ? "active" : ""} ${isException ? "exception" : ""}`}
                aria-pressed={metricKey === key}
                onClick={() => setMetricKey(key)}
              >
                <span>{METRICS[key].label}</span>
                <strong>{display(value)}{METRICS[key].unit}</strong>
                <small className={`trend-${keyTrend.tone}`}>
                  {keyTrend.symbol} {keyTrend.label}
                </small>
              </button>
            );
          })}
        </div>
        <div className="wellness-detail-grid">
          <div className="wellness-context">
            <span className="eyebrow">{meta.label} · ahora</span>
            <strong>{display(actual)}{meta.unit}</strong>
            <dl>
              <div>
                <dt>Habitual</dt>
                <dd>
                  {personalReference == null
                    ? "Referencia aún no disponible"
                    : `${display(personalReference)}${meta.unit}`}
                </dd>
              </div>
              <div>
                <dt>Diferencia</dt>
                <dd>
                  {difference == null
                    ? "—"
                    : `${difference >= 0 ? "+" : ""}${display(difference)}${meta.unit}`}
                </dd>
              </div>
              <div>
                <dt>Tendencia</dt>
                <dd className={`trend-${trend.tone}`}>
                  {trend.symbol} {trend.label}
                </dd>
              </div>
            </dl>
            {metricKey === "pain" && (
              <div className={`pain-context-brief ${actual ? "active" : "clear"}`}>
                {actual ? (
                  <>
                    <strong>{latestPain?.zone ?? "Zona sin indicar"}</strong>
                    <span>
                      Limita: {latestPain?.limitation ?? "Sin indicar"} · {pains.length} registro{pains.length === 1 ? "" : "s"}
                    </span>
                  </>
                ) : (
                  <><strong>Sin dolor declarado</strong><span>No requiere más espacio en el resumen.</span></>
                )}
              </div>
            )}
          </div>
          <div className="wellness-chart-area">
            {metricKey === "pain" ? (
              <PainHistoryVisualization records={pains} />
            ) : (
              <LineChart
                data={visible.map((item) => ({
                  label: CALENDAR[item.weekId - 1].label,
                  value: metricValue(item, metricKey),
                  tooltip: `${CALENDAR[item.weekId - 1].label} · ${meta.label}: ${display(metricValue(item, metricKey))}${meta.unit}${personalReference == null ? "" : ` · referencia personal ${display(personalReference)}${meta.unit}`}`,
                }))}
                color={meta.color}
                unit={meta.unit}
                reference={personalReference}
                domain={domains[metricKey]}
                height={220}
                ariaLabel={`${meta.label}, últimas ${visible.length} jornadas, comparado con su referencia personal`}
              />
            )}
          </div>
        </div>
      </section>
      {metricKey === "pain" && (
        <details className="panel pain-register-details">
          <summary>
            <span><strong>Historial de molestias</strong><small>Zona, intensidad, limitación y observación</small></span>
            <b>{pains.length} registros</b>
          </summary>
          {pains.length ? (
            <div className="pain-register-table">
              {pains.slice().reverse().map((pain) => (
                <div key={pain.id}>
                  <time>{formatDate(pain.date)}</time>
                  <strong>{pain.zone}</strong>
                  <span>{pain.intensity}/10</span>
                  <span>Limita: {pain.limitation}</span>
                  <p>{pain.note || "Sin observación"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Sin molestias contextualizadas.</p>
          )}
        </details>
      )}
    </>
  );
}

/* v18: ficha de jugador anterior retirada del runtime.
function LegacyPlayerDetail({
  playerId,
  weekId,
  metrics,
  sessions,
  matches,
  availability,
  setAvailability,
  painRecords,
  alerts,
  onBack,
  notify,
}: {
  playerId: string;
  weekId: number;
  metrics: Map<string, PlayerMetric>;
  sessions: SessionRecord[];
  matches: MatchRecord[];
  availability: AvailabilityRecord[];
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityRecord[]>>;
  painRecords: PainRecord[];
  alerts: AlertRecord[];
  onBack: () => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("summary");
  const player = INITIAL_PLAYERS.find((item) => item.id === playerId)!;
  const current = metrics.get(`${weekId}-${playerId}`)!;
  const currentLoadKnown =
    current.status !== "SIN DATOS" &&
    !(
      current.rpeExpected > 0 &&
      current.rpeCompleted === 0 &&
      current.matchRpe == null
    );
  const history = CALENDAR.slice(0, weekId)
    .map((week) => metrics.get(`${week.id}-${playerId}`)!)
    .filter(Boolean);
  const playerMatches = matches.filter(
    (item) => item.playerId === playerId && item.weekId <= weekId,
  );
  const pastAlerts = alerts.filter((item) => item.playerId === playerId);
  const pains = painRecords.filter((item) => item.playerId === playerId);
  const updateAvail = (value: Availability) =>
    setAvailability((all) =>
      all.map((item) =>
        item.weekId === weekId && item.playerId === playerId
          ? { ...item, value }
          : item,
      ),
    );
  const lastWeeks = CALENDAR.slice(Math.max(0, weekId - 7), weekId).reverse();
  const competition = {
    called: playerMatches.filter((item) => item.convocation !== "NO CONVOCADO")
      .length,
    starts: playerMatches.filter((item) => item.convocation === "TITULAR")
      .length,
    minutes: playerMatches.reduce((sum, item) => sum + (item.minutes ?? 0), 0),
    load: playerMatches.reduce(
      (sum, item) =>
        sum + (completeEffortProduct(item.rpe, item.minutes) ?? 0),
      0,
    ),
    rpe: mean(playerMatches.map((item) => item.rpe)),
  };
  const weeklyPlanComparison =
    currentLoadKnown && current.plannedTotalLoad > 0
      ? planState(current.load, current.plannedTotalLoad)
      : null;
  return (
    <>
      <button className="back-button" onClick={onBack}>
        ← Volver
      </button>
      <section className="phase2-player-hero">
        <div className="avatar avatar-large">
          {player.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <span>
            #{player.number} · {titleCase(player.position)} ·{" "}
            {calculateAge(player.birthDate)} años
          </span>
          <h1>{titleCase(player.name)}</h1>
          <p>
            Jornada {CALENDAR[weekId - 1].label} · Pierna{" "}
            {player.dominantFoot.toLocaleLowerCase("es-ES")}
          </p>
        </div>
        <div className="hero-states">
          <AvailabilityBadge value={current.availability} />
          <StatusBadge status={current.status} />
        </div>
        <div className="hero-actions">
          <label>
            Disponibilidad
            <select
              value={current.availability}
              onChange={(event) =>
                updateAvail(event.target.value as Availability)
              }
            >
              {Object.keys(AVAILABILITY_META).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setTab("history")}>Ver historial</button>
        </div>
      </section>
      <nav className="detail-tabs">
        {(
          [
            ["summary", "Resumen"],
            ["load", "Carga"],
            ["wellbeing", "Bienestar"],
            ["history", "Historial"],
            ["report", "Informe"],
          ] as Array<[DetailTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "summary" ? (
        <>
          <div className="player-answer-grid">
            <Kpi
              label="Disponibilidad"
              value={AVAILABILITY_META[current.availability].label}
              helper={
                availability.find(
                  (item) =>
                    item.weekId === weekId && item.playerId === playerId,
                )?.note
              }
              icon={AVAILABILITY_META[current.availability].icon}
            />
            <Kpi
              label="Monitorización"
              value={STATUS_META[current.status].label}
              helper={current.reasons[0] ?? "Sin señales"}
              icon={STATUS_META[current.status].icon}
            />
            <Kpi
              label="Carga total"
              value={loadText(current)}
              helper={currentLoadKnown ? `${compact(current.trainingLoad + current.compensatoryLoad)} entreno · ${compact(current.matchLoad)} partido` : "Cobertura insuficiente para interpretar"}
              icon="Σ"
            />
            <Kpi
              label="Minutos competitivos"
              value={current.matchMinutes == null ? "Sin dato" : `${current.matchMinutes} min`}
              helper={`${rpeRegistrationText(current)} · ${wellbeingRegistrationText(current)}`}
              icon="⏱"
            />
          </div>
          <div className="summary-load-context">
            <span>
              <small>PLANIFICADO</small>
              <strong>{compact(current.plannedTotalLoad)} UA</strong>
            </span>
            <b>→</b>
            <span>
              <small>REALIZADO</small>
              <strong>{loadText(current)}</strong>
            </span>
            <em className={weeklyPlanComparison ? `plan-${weeklyPlanComparison.tone}` : ""}>
              {weeklyPlanComparison
                ? `${current.load - current.plannedTotalLoad >= 0 ? "+" : ""}${compact(
                    current.load - current.plannedTotalLoad,
                  )} UA · ${weeklyPlanComparison.variation >= 0 ? "+" : ""}${display(
                    weeklyPlanComparison.variation,
                    0,
                  )}%`
                : "Sin planificación disponible"}
            </em>
          </div>
          <div className="player-summary-layout">
            <section className="panel current-snapshot">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Última semana</span>
                  <h2>Qué ha cambiado</h2>
                </div>
              </div>
              {(["rpe", "load", "sleep", "fatigue", "pain"] as MetricKey[]).map(
                (key) => {
                  const trend = trendInfo(history, key);
                  return (
                    <div className="snapshot-row" key={key}>
                      <span>{METRICS[key].label}</span>
                      <strong>
                        {display(
                          metricValue(current, key),
                          key === "load" ? 0 : 1,
                        )}
                        {METRICS[key].unit}
                      </strong>
                      <em className={`trend-${trend.tone}`}>
                        {trend.symbol} {trend.label}
                      </em>
                    </div>
                  );
                },
              )}
            </section>
            <section className="panel transparent-signals">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Motivo de atención</span>
                  <h2>
                    {current.signals.length
                      ? `${current.signals.length} señal${current.signals.length > 1 ? "es" : ""} detectada${current.signals.length > 1 ? "s" : ""}`
                      : "Sin señales activas"}
                  </h2>
                </div>
              </div>
              {current.signals.slice(0, 3).map((signal) => (
                <article key={signal.key}>
                  <div>
                    <strong>{signal.label}</strong>
                    <span>{signal.data}</span>
                  </div>
                  <p>
                    Referencia: {signal.reference} · {signal.difference}
                  </p>
                  <small>{signal.explanation}</small>
                </article>
              ))}
            </section>
          </div>
        </>
      ) : tab === "load" ? (
        <>
          <div className="competition-strip">
            <Kpi
              label="Partidos convocado"
              value={String(competition.called)}
              helper={`${competition.starts} titularidades`}
              icon="P"
            />
            <Kpi
              label="Minutos competitivos"
              value={compact(competition.minutes)}
              helper={`${display(competition.rpe)} RPE medio`}
              icon="⏱"
            />
            <Kpi
              label="Carga entrenamiento"
              value={`${compact(current.trainingLoad + current.compensatoryLoad)} UA`}
              helper={`${current.trainingMinutes} min`}
              icon="T"
            />
            <Kpi
              label="Carga competición"
              value={`${compact(current.matchLoad)} UA`}
              helper={`${current.matchMinutes} min esta jornada`}
              icon="C"
            />
          </div>
          <div className="player-load-grid">
            <section className="panel load-breakdown">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Semana actual</span>
                  <h2>Planificada vs. realizada</h2>
                </div>
              </div>
              {[
                { label: "Carga planificada", value: current.plannedTotalLoad },
                { label: "Carga realizada", value: current.load },
              ].map((item) => (
                <div className="load-row" key={item.label}>
                  <span>{item.label}</span>
                  <div>
                    <i
                      style={{
                        width: `${Math.min(100, (item.value / Math.max(current.load, current.plannedTotalLoad, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{compact(item.value)} UA</strong>
                </div>
              ))}
              <div className="plan-difference-callout">
                <span>Diferencia</span>
                <strong>
                  {current.load - current.plannedTotalLoad >= 0 ? "+" : ""}
                  {compact(current.load - current.plannedTotalLoad)} UA
                </strong>
                <em>
                  {weeklyPlanComparison
                    ? `${weeklyPlanComparison.variation >= 0 ? "+" : ""}${display(
                        weeklyPlanComparison.variation,
                        0,
                      )}% · ${weeklyPlanComparison.label}`
                    : "Sin planificación"}
                </em>
              </div>
              <details className="inline-advanced">
                <summary>Ver análisis avanzado de carga</summary>
                <div className="advanced-inline">
                  <span>
                    Media 4 sem. <b>{compact(current.chronic)} UA</b>
                  </span>
                  <span>
                    EWMA <b>{compact(current.ewma)} UA</b>
                  </span>
                  <span>
                    Monotonía <b>{display(current.monotony, 2)}</b>
                  </span>
                  <span>
                    Strain <b>{compact(current.strain)}</b>
                  </span>
                  <span>
                    Ratio de cambio <b>{display(current.ratio, 2)}</b>
                  </span>
                </div>
                <small>
                  El ratio describe cambios de carga; no predice lesiones.
                </small>
              </details>
            </section>
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Competición</span>
                  <h2>Minutos por jornada</h2>
                </div>
              </div>
              <LineChart
                data={playerMatches
                  .slice(-12)
                  .map((item) => ({
                    label: CALENDAR[item.weekId - 1].label,
                    value: item.minutes,
                  }))}
                color="#3975c6"
                unit=" min"
                height={210}
              />
            </section>
          </div>
          <MetricExplorer
            playerId={playerId}
            metrics={metrics}
            initial="load"
            weekId={weekId}
          />
        </>
      ) : tab === "wellbeing" ? (
        <>
          <div className="baseline-grid">
            {(["sleep", "rpe"] as MetricKey[]).map((key) => {
              const actual = metricValue(current, key);
              const average =
                key === "sleep" ? current.personalSleep : current.personalRpe;
              const range =
                key === "sleep" ? current.sleepRange : current.rpeRange;
              return (
                <article key={key}>
                  <span>{METRICS[key].label}</span>
                  <dl>
                    <div>
                      <dt>Valor actual</dt>
                      <dd>
                        {display(actual)}
                        {METRICS[key].unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Media personal</dt>
                      <dd>
                        {average == null
                          ? "Todavía sin referencia"
                          : `${display(average)}${METRICS[key].unit}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Rango habitual</dt>
                      <dd>
                        {range
                          ? `${display(range[0])}–${display(range[1])}${METRICS[key].unit}`
                          : "Mínimo 5 registros previos"}
                      </dd>
                    </div>
                    <div>
                      <dt>Diferencia</dt>
                      <dd>
                        {average != null && actual != null
                          ? `${actual - average >= 0 ? "+" : ""}${display(actual - average)}${METRICS[key].unit}`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
          <MetricExplorer
            playerId={playerId}
            metrics={metrics}
            initial="sleep"
            weekId={weekId}
          />
          <section className="panel pain-history">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Molestias comunicadas</span>
                <h2>Historial con contexto</h2>
              </div>
              <span className="quiet-label">No es diagnóstico</span>
            </div>
            <div className="pain-head">
              <span>Fecha</span>
              <span>Zona</span>
              <span>Dolor</span>
              <span>Limitación</span>
              <span>Observación</span>
            </div>
            {pains.length ? (
              pains.map((pain) => (
                <div className="pain-row" key={pain.id}>
                  <span>{formatDate(pain.date)}</span>
                  <strong>{pain.zone}</strong>
                  <span>{pain.intensity}/10</span>
                  <span>{pain.limitation}</span>
                  <p>{pain.note}</p>
                </div>
              ))
            ) : (
              <p className="empty-state">Sin molestias contextualizadas.</p>
            )}
          </section>
        </>
      ) : tab === "history" ? (
        <>
          <section className="panel player-timeline">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Timeline</span>
                <h2>Temporada con contexto</h2>
              </div>
            </div>
            {lastWeeks.map((week) => {
              const metric = metrics.get(`${week.id}-${playerId}`)!;
              const rows = sessions.filter(
                (item) => item.weekId === week.id && item.playerId === playerId,
              );
              const match = matches.find(
                (item) => item.weekId === week.id && item.playerId === playerId,
              )!;
              const pain = painRecords.find(
                (item) => item.weekId === week.id && item.playerId === playerId,
              );
              const alert = alerts.find(
                (item) => item.weekId === week.id && item.playerId === playerId,
              );
              return (
                <article key={week.id}>
                  <div className="timeline-marker">
                    <span>{week.label}</span>
                    <i />
                  </div>
                  <div className="timeline-card">
                    <div>
                      <strong>
                        {formatDate(week.dates[0])}–{formatDate(match.date)}
                      </strong>
                      <AvailabilityBadge value={metric.availability} />
                      <StatusBadge status={metric.status} />
                    </div>
                    <div className="timeline-sessions">
                      {rows.map((row) => (
                        <span key={row.key}>
                          S{row.session}{" "}
                          {row.attendance === "ENTRENÓ" && row.rpe != null
                            ? "✓"
                            : row.attendance === "ENTRENÓ"
                              ? "○"
                              : "—"}
                        </span>
                      ))}
                      <span>PARTIDO · {match.minutes} min</span>
                    </div>
                    <p>
                      Carga {compact(metric.load)} UA
                      {match.compensatory
                        ? ` · Compensatorio ${match.compensatoryMinutes} min`
                        : ""}
                    </p>
                    {pain && (
                      <small>
                        Molestia: {pain.zone} {pain.intensity}/10 · limita:{" "}
                        {pain.limitation}
                      </small>
                    )}
                    {alert && (
                      <small>
                        Revisión: {ALERT_META[alert.status].label} ·{" "}
                        {alert.note || alert.history.at(-1)}
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
          <section className="panel review-history">
            <h3>Historial de revisiones</h3>
            {pastAlerts.length ? (
              pastAlerts.flatMap((alert) =>
                alert.history.map((item, index) => (
                  <p key={`${alert.id}-${index}`}>
                    • {CALENDAR[alert.weekId - 1].label}: {item}
                  </p>
                )),
              )
            ) : (
              <p>Sin revisiones registradas.</p>
            )}
          </section>
        </>
      ) : (
        <PlayerReport weekId={weekId} playerId={playerId} metrics={metrics} players={INITIAL_ROSTER} />
      )}
    </>
  );
}

*/
function PlayerDetail({
  playerId,
  weekId,
  setWeekId,
  metrics,
  sessions,
  matches,
  availability,
  setAvailability,
  painRecords,
  alerts,
  onBack,
  onSelectPlayer,
  notify,
  players,
}: {
  playerId: string;
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  sessions: SessionRecord[];
  matches: MatchRecord[];
  availability: AvailabilityRecord[];
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityRecord[]>>;
  painRecords: PainRecord[];
  alerts: AlertRecord[];
  onBack: () => void;
  onSelectPlayer: (id: string) => void;
  notify: (message: string) => void;
  players: RosterPlayer[];
}) {
  const [tab, setTab] = useState<DetailTab>("summary");
  useEffect(() => setTab("summary"), [playerId]);
  const player = players.find((item) => item.id === playerId) ?? players[0];
  if (!player)
    return <p className="empty-state">No hay jugadores activos.</p>;
  const playerIndex = Math.max(0, players.findIndex((item) => item.id === playerId));
  const current = metrics.get(`${weekId}-${player.id}`);
  if (!current)
    return <p className="empty-state">No hay datos del jugador.</p>;
  const currentLoadKnown = current.loadCompleteness === "COMPLETE";
  const history = CALENDAR.slice(0, weekId)
    .map((week) => metrics.get(`${week.id}-${playerId}`))
    .filter((item): item is PlayerMetric => Boolean(item));
  const previous = history.at(-2);
  const recentReference = mean(
    history.slice(-5, -1).filter(hasInterpretableLoad).map((item) => item.load),
  );
  const playerMatches = matches
    .filter((item) => item.playerId === playerId && item.weekId <= weekId)
    .sort((a, b) => a.weekId - b.weekId);
  const knownPlayerMatches = playerMatches.filter(
    (item) => item.observation !== "__SIN_DATO__",
  );
  const currentMatch = playerMatches.find((item) => item.weekId === weekId);
  const weekSessions = sessions
    .filter((item) => item.playerId === playerId && item.weekId === weekId)
    .sort((a, b) => a.session - b.session);
  const pastAlerts = alerts.filter((item) => item.playerId === playerId);
  const pains = painRecords
    .filter((item) => item.playerId === playerId)
    .sort((a, b) => a.weekId - b.weekId);
  const currentPain = pains.find((item) => item.weekId === weekId);
  const weeklyPlanComparison =
    currentLoadKnown && current.plannedTotalLoad > 0
      ? planState(current.load, current.plannedTotalLoad)
      : null;
  const loadChange =
    currentLoadKnown && hasInterpretableLoad(previous) && previous!.load > 0
      ? ((current.load - previous!.load) / previous!.load) * 100
      : null;
  const exposureFor = (weeks: number) => {
    const window = history.slice(-weeks);
    return {
      training: window.reduce((sum, item) => sum + item.trainingMinutes, 0),
      match: window.reduce((sum, item) => sum + (item.matchMinutes ?? 0), 0),
    };
  };
  const exposure = [
    { label: "7 días", ...exposureFor(1) },
    { label: "14 días", ...exposureFor(2) },
    { label: "28 días", ...exposureFor(4) },
  ];
  const competition = {
    called: knownPlayerMatches.filter((item) => item.convocation !== "NO CONVOCADO").length,
    starts: knownPlayerMatches.filter((item) => item.convocation === "TITULAR").length,
    minutes: knownPlayerMatches.reduce((sum, item) => sum + (item.minutes ?? 0), 0),
    load: knownPlayerMatches.reduce((sum, item) => sum + (loadForCompleteEffort(item.rpe, item.minutes) ?? 0), 0),
    rpe: mean(knownPlayerMatches.map((item) => item.rpe)),
  };
  const changeCandidates = [
    loadChange == null
      ? null
      : {
          label: "Carga",
          value: `${loadChange >= 0 ? "+" : ""}${display(loadChange, 0)}%`,
          context: "respecto a la jornada anterior",
          score: Math.abs(loadChange) / 8,
          tone: Math.abs(loadChange) >= 25 ? "attention" : "neutral",
        },
    current.sleep == null || previous?.sleep == null
      ? null
      : {
          label: "Sueño",
          value: `${current.sleep - previous.sleep >= 0 ? "+" : ""}${display(current.sleep - previous.sleep)} h`,
          context: "respecto a la jornada anterior",
          score: Math.abs(current.sleep - previous.sleep) / 0.35,
          tone: current.sleep < previous.sleep ? "attention" : "positive",
        },
    current.fatigue == null || previous?.fatigue == null
      ? null
      : {
          label: "Cansancio",
          value: `${current.fatigue - previous.fatigue >= 0 ? "+" : ""}${display(current.fatigue - previous.fatigue)}`,
          context: "sobre 5",
          score: Math.abs(current.fatigue - previous.fatigue) / 0.5,
          tone: current.fatigue > previous.fatigue ? "attention" : "positive",
        },
    current.pain == null || previous?.pain == null || current.pain === previous.pain
      ? null
      : {
          label: "Dolor",
          value: `${current.pain - previous.pain >= 0 ? "+" : ""}${display(current.pain - previous.pain)}`,
          context: currentPain ? currentPain.zone : "sobre 10",
          score: Math.abs(current.pain - previous.pain),
          tone: current.pain > previous.pain ? "attention" : "positive",
        },
    previous && current.matchMinutes != null && previous.matchMinutes != null && current.matchMinutes !== previous.matchMinutes
      ? {
          label: "Minutos",
          value: `${current.matchMinutes - previous.matchMinutes >= 0 ? "+" : ""}${current.matchMinutes - previous.matchMinutes} min`,
          context: "competición",
          score: Math.abs(current.matchMinutes - previous.matchMinutes) / 25,
          tone: "neutral",
        }
      : null,
  ]
    .filter(
      (item): item is {
        label: string;
        value: string;
        context: string;
        score: number;
        tone: string;
      } => Boolean(item && item.score >= 0.7),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const updateAvail = (value: Availability) =>
    setAvailability((all) =>
      all.map((item) =>
        item.weekId === weekId && item.playerId === playerId
          ? { ...item, value }
          : item,
      ),
    );
  const switchPlayer = (id: string) => {
    onSelectPlayer(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const lastWeeks = CALENDAR.slice(Math.max(0, weekId - 10), weekId).reverse();
  const wellnessKeys: MetricKey[] = ["sleep", "mood", "fatigue", "pain", "stress"];
  const primarySignal = current.signals[0];
  return (
    <div className="player-performance-workspace">
      <div className="player-context-toolbar">
        <button className="back-button" onClick={onBack}>← Volver al contexto</button>
        <div className="player-switcher">
          <button
            aria-label="Jugador anterior"
            onClick={() => switchPlayer(players[(playerIndex - 1 + players.length) % players.length].id)}
          >
            ‹
          </button>
          <label>
            <span>Cambiar jugador</span>
            <select value={playerId} onChange={(event) => switchPlayer(event.target.value)}>
              {players.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.number} · {titleCase(item.name)} · {titleCase(item.position)}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Jugador siguiente"
            onClick={() => switchPlayer(players[(playerIndex + 1) % players.length].id)}
          >
            ›
          </button>
        </div>
        <WeekSelector weekId={weekId} onChange={setWeekId} compact />
      </div>

      <section className="player-profile-hero-v7">
        <div className="player-profile-identity">
          <div className="profile-number">{player.number}</div>
          <div>
            <span className="eyebrow">{positionGroup(player.position)} · Jornada {CALENDAR[weekId - 1].label}</span>
            <h1>{titleCase(player.name)}</h1>
            <p>
              {titleCase(player.position)} · {calculateAge(player.birthDate)} años · Pierna {player.dominantFoot.toLocaleLowerCase("es-ES")}
            </p>
            <small>
              Último registro: {current.wellbeingDone ? "bienestar semanal completado" : "bienestar pendiente"} · {current.rpeCompleted}/{current.rpeExpected} RPE
            </small>
          </div>
        </div>
        <div className={`player-profile-state state-${current.status.toLocaleLowerCase("es-ES").replace(" ", "-")}`}>
          <span className="eyebrow">Ahora mismo</span>
          <div className="profile-state-badges">
            <AvailabilityBadge value={current.availability} />
            <StatusBadge status={current.status} />
          </div>
          <strong>{primarySignal?.label ?? current.reasons[0] ?? "Sin señales activas"}</strong>
          <p>
            {primarySignal
              ? `${primarySignal.data} · ${primarySignal.difference}`
              : current.status === "OK"
                ? "Sin cambios que requieran priorización esta jornada."
                : "Revisar registros pendientes antes de interpretar tendencias."}
          </p>
        </div>
        <details className="player-actions-menu">
          <summary>Acciones ···</summary>
          <div>
            <label>
              Disponibilidad
              <select value={current.availability} onChange={(event) => updateAvail(event.target.value as Availability)}>
                {Object.keys(AVAILABILITY_META).map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <button onClick={() => setTab("history")}>Abrir historial</button>
            <button onClick={() => setTab("report")}>Ver informe</button>
          </div>
        </details>
      </section>

      <nav className="player-detail-nav" aria-label="Análisis del jugador">
        {(
          [
            ["summary", "Visión general", "Situación actual"],
            ["load", "Carga y minutos", "Entrenamiento + partido"],
            ["wellbeing", "Bienestar", "5 variables"],
            ["history", "Historia", "Contexto semanal"],
            ["report", "Informe", "Vista para compartir"],
          ] as Array<[DetailTab, string, string]>
        ).map(([id, label, helper]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <strong>{label}</strong><small>{helper}</small>
          </button>
        ))}
      </nav>

      {tab === "summary" ? (
        <div className="player-overview-v7">
          <section className="panel overview-load-main">
            <div className="overview-section-title">
              <div><span className="eyebrow">Carga esta semana</span><h2>{compact(currentLoadKnown ? current.load : null)} <small>UA</small></h2></div>
              <span className={weeklyPlanComparison ? `plan-${weeklyPlanComparison.tone}` : ""}>
                {weeklyPlanComparison
                  ? `${weeklyPlanComparison.variation >= 0 ? "+" : ""}${display(weeklyPlanComparison.variation, 0)}% vs plan`
                  : "Sin planificación"}
              </span>
            </div>
            <div className="load-source-bar" aria-label="Origen de la carga">
              <i
                style={{ width: `${current.load ? ((current.trainingLoad + current.compensatoryLoad) / current.load) * 100 : 0}%` }}
              />
              <b style={{ width: `${current.load ? (current.matchLoad / current.load) * 100 : 0}%` }} />
            </div>
            <div className="overview-load-facts">
              <span><small>Entrenamiento</small><strong>{compact(current.trainingLoad + current.compensatoryLoad)} UA</strong></span>
              <span><small>Competición</small><strong>{compact(current.matchLoad)} UA</strong></span>
              <span><small>Semana anterior</small><strong>{compact(previous?.load ?? null)} UA</strong></span>
              <span><small>Media reciente</small><strong>{compact(recentReference)} UA</strong></span>
            </div>
            <button className="text-action" onClick={() => setTab("load")}>Analizar carga y exposición →</button>
          </section>

          <section className="panel overview-attention">
            <div className="overview-section-title">
              <div><span className="eyebrow">Prioridad</span><h2>{current.signals.length ? `${current.signals.length} motivo${current.signals.length === 1 ? "" : "s"}` : "Sin señales"}</h2></div>
              <StatusBadge status={current.status} />
            </div>
            {current.signals.length ? current.signals.slice(0, 2).map((signal) => (
              <button key={signal.key} onClick={() => setTab(signal.key.includes("sleep") || signal.key === "fatigue" || signal.key === "pain" ? "wellbeing" : "load") }>
                <span className={`signal-mark signal-${signal.severity}`}>!</span>
                <span><strong>{signal.label}</strong><small>{signal.data} · {signal.difference}</small></span>
                <b>→</b>
              </button>
            )) : (
              <div className="overview-all-clear"><span>✓</span><p><strong>Sin excepciones relevantes</strong><small>Disponibilidad y respuestas dentro del contexto esperado.</small></p></div>
            )}
            {current.pending > 0 && (
              <div className="pending-context">◷ {current.pending} registro{current.pending > 1 ? "s" : ""} pendiente{current.pending > 1 ? "s" : ""}</div>
            )}
          </section>

          <section className="panel overview-exposure">
            <span className="eyebrow">Exposición reciente</span>
            <div className="exposure-primary"><strong>{current.matchMinutes}</strong><span>min<br />competición</span></div>
            <div className="exposure-secondary">
              <span><small>Entrenamiento</small><strong>{current.trainingMinutes} min</strong></span>
              <span><small>Sesiones</small><strong>{current.trained}</strong></span>
              <span><small>RPE medio</small><strong>{display(current.avgRpe)}/10</strong></span>
            </div>
            <p>{current.convocation.toLocaleLowerCase("es-ES")} · {rpeRegistrationText(current)} · {wellbeingRegistrationText(current)}</p>
          </section>

          <section className="panel overview-changes">
            <span className="eyebrow">Qué ha cambiado</span>
            <h2>Solo variaciones relevantes</h2>
            {changeCandidates.length ? changeCandidates.map((change) => (
              <div key={change.label} className={`change-${change.tone}`}>
                <span>{change.label}</span><strong>{change.value}</strong><small>{change.context}</small>
              </div>
            )) : <p className="quiet-empty">Sin cambios relevantes frente a la jornada anterior.</p>}
          </section>

          <section className="panel overview-wellness">
            <div className="overview-section-title">
              <div><span className="eyebrow">Bienestar</span><h2>Lectura rápida</h2></div>
              <button className="text-action" onClick={() => setTab("wellbeing")}>Ver evolución →</button>
            </div>
            <div className="overview-wellness-rows">
              {wellnessKeys.map((key) => {
                const trend = trendInfo(history, key);
                const isException = current.signals.some((signal) => signal.key.includes(key));
                return (
                  <button key={key} className={isException ? "exception" : ""} onClick={() => setTab("wellbeing")}>
                    <span>{METRICS[key].label}</span>
                    <strong>{display(metricValue(current, key))}{METRICS[key].unit}</strong>
                    <small className={`trend-${trend.tone}`}>{trend.symbol} {isException ? "revisar" : trend.label}</small>
                  </button>
                );
              })}
            </div>
            {current.pain ? (
              <div className="overview-pain-active">
                <strong>Dolor · {currentPain?.zone ?? "zona sin indicar"} {display(current.pain)}/10</strong>
                <span>Limita: {currentPain?.limitation ?? "sin indicar"} · {pains.length} antecedente{pains.length === 1 ? "" : "s"} registrado{pains.length === 1 ? "" : "s"}</span>
              </div>
            ) : (
              <div className="overview-pain-clear">✓ Sin dolor declarado esta jornada</div>
            )}
          </section>
        </div>
      ) : tab === "load" ? (
        <div className="player-load-v7">
          <section className="panel load-decision-strip">
            <div className="load-total-now">
              <span>Esta semana</span><strong>{compact(currentLoadKnown ? current.load : null)} UA</strong>
              <small>{loadChange == null ? "Sin comparación" : `${loadChange >= 0 ? "+" : ""}${display(loadChange, 0)}% vs anterior`}</small>
            </div>
            <dl>
              <div><dt>Anterior</dt><dd>{compact(previous?.load ?? null)} UA</dd></div>
              <div><dt>Media 4 sem.</dt><dd>{compact(recentReference)} UA</dd></div>
              <div><dt>Planificada</dt><dd>{compact(current.plannedTotalLoad)} UA</dd></div>
              <div><dt>Entrenamiento</dt><dd>{compact(current.trainingLoad + current.compensatoryLoad)} UA</dd></div>
              <div><dt>Competición</dt><dd>{compact(current.matchLoad)} UA</dd></div>
            </dl>
          </section>

          <div className="load-detail-grid-v7">
            <section className="panel load-plan-v7">
              <div className="panel-heading"><div><span className="eyebrow">Planificado vs realizado</span><h2>Diferencia directa</h2></div></div>
              <div className="plan-comparison-bars">
                {[{ label: "Plan", value: current.plannedTotalLoad }, { label: "Real", value: current.load }].map((item) => (
                  <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.min(100, item.value / Math.max(current.load, current.plannedTotalLoad, 1) * 100)}%` }} /></i><strong>{compact(item.value)} UA</strong></div>
                ))}
              </div>
              <div className={`plan-result ${weeklyPlanComparison ? `plan-${weeklyPlanComparison.tone}` : ""}`}>
                <strong>{current.load - current.plannedTotalLoad >= 0 ? "+" : ""}{compact(current.load - current.plannedTotalLoad)} UA</strong>
                <span>{weeklyPlanComparison ? `${weeklyPlanComparison.variation >= 0 ? "+" : ""}${display(weeklyPlanComparison.variation, 0)}% · ${weeklyPlanComparison.label}` : "Sin planificación disponible"}</span>
              </div>
            </section>
            <section className="panel exposure-windows">
              <div className="panel-heading"><div><span className="eyebrow">Exposición</span><h2>7, 14 y 28 días</h2></div></div>
              {exposure.map((item) => (
                <div key={item.label}><strong>{item.label}</strong><span><i /> Entreno {item.training} min</span><span><b /> Partido {item.match} min</span><em>{item.training + item.match} min</em></div>
              ))}
            </section>
          </div>

          <PlayerLoadChart history={history} />

          <section className="panel weekly-efforts">
            <div className="panel-heading"><div><span className="eyebrow">Jornada {CALENDAR[weekId - 1].label}</span><h2>RPE, minutos y carga por esfuerzo</h2></div><span className="quiet-label">RPE × minutos</span></div>
            <div className="weekly-effort-head"><span>Esfuerzo</span><span>Participación</span><span>RPE</span><span>Minutos</span><span>Carga</span></div>
            {weekSessions.map((row) => (
              <div className="weekly-effort-row" key={row.key}>
                <strong>S{row.session}</strong><span>{titleCase(row.attendance)}</span><span>{display(row.rpe)}/10</span><span>{row.minutes == null ? "—" : `${row.minutes} min`}</span><strong>{row.rpe == null || row.minutes == null ? "Sin dato" : `${compact(loadForCompleteEffort(row.rpe, row.minutes))} UA`}</strong>
              </div>
            ))}
            {currentMatch && (
              <div className="weekly-effort-row match">
                <strong>Partido</strong><span>{currentMatch.convocation.toLocaleLowerCase("es-ES")}</span><span>{display(currentMatch.rpe)}/10</span><span>{currentMatch.minutes} min</span><strong>{currentMatch.rpe == null ? "Sin dato" : `${compact(loadForCompleteEffort(currentMatch.rpe, currentMatch.minutes))} UA`}</strong>
              </div>
            )}
          </section>

          <section className="panel competition-context-v7">
            <div><span className="eyebrow">Competición · temporada</span><h2>{competition.minutes} minutos</h2><p>{competition.called} convocatorias · {competition.starts} titularidades</p></div>
            <dl><div><dt>RPE medio partido</dt><dd>{display(competition.rpe)}/10</dd></div><div><dt>Carga competición</dt><dd>{compact(competition.load)} UA</dd></div></dl>
            <div className="competition-minutes-spark">
              <CompetitionMinutesHistory matches={knownPlayerMatches} />
            </div>
          </section>

          <details className="panel player-advanced-v7">
            <summary><span><strong>Análisis avanzado</strong><small>Segundo nivel · contexto descriptivo</small></span><b>Mostrar</b></summary>
            <div><span>EWMA <b>{compact(current.ewma)} UA</b></span><span>Monotonía <b>{display(current.monotony, 2)}</b></span><span>Strain <b>{compact(current.strain)}</b></span><span>Z-RPE <b>{display(current.zRpe, 2)}</b></span><span>Ratio de cambio <b>{display(current.ratio, 2)}</b></span></div>
            <p>Estas métricas aportan contexto y no predicen lesiones.</p>
          </details>
        </div>
      ) : tab === "wellbeing" ? (
        <PlayerWellbeingExplorer history={history} pains={pains} />
      ) : tab === "history" ? (
        <div className="player-history-v7">
          <section className="panel player-storyline">
            <div className="panel-heading"><div><span className="eyebrow">Historia del jugador</span><h2>Qué ha ido pasando</h2><small className="panel-subtitle">Las semanas se pueden desplegar para investigar.</small></div></div>
            <div className="storyline-list">
              {lastWeeks.map((week, index) => {
                const metric = metrics.get(`${week.id}-${playerId}`)!;
                const rows = sessions.filter((item) => item.weekId === week.id && item.playerId === playerId);
                const match = matches.find((item) => item.weekId === week.id && item.playerId === playerId);
                const pain = painRecords.find((item) => item.weekId === week.id && item.playerId === playerId);
                const alert = alerts.find((item) => item.weekId === week.id && item.playerId === playerId);
                const headline = pain
                  ? `Molestia ${pain.zone} ${pain.intensity}/10`
                  : metric.availability !== "COMPLETO"
                    ? AVAILABILITY_META[metric.availability].label
                    : alert
                      ? alert.history.at(-1) ?? "Revisión registrada"
                      : `${loadText(metric)} · ${match?.minutes == null ? "partido sin dato" : `${match.minutes} min partido`}`;
                return (
                  <details key={week.id} open={index === 0}>
                    <summary>
                      <span className="story-week">{week.label}</span>
                      <span className="story-status"><AvailabilityBadge value={metric.availability} /><StatusBadge status={metric.status} /></span>
                      <strong>{headline}</strong>
                      <span className="story-numbers">{loadText(metric)} · {match?.minutes == null ? "sin dato" : `${match.minutes} min`}</span>
                    </summary>
                    <div className="story-detail">
                      <div className="story-sessions">{rows.map((row) => <span key={row.key}>S{row.session} {row.attendance === "ENTRENÓ" ? row.rpe == null ? "○" : `✓ RPE ${row.rpe}` : "—"}</span>)}<span>PARTIDO · {match?.minutes == null ? "sin dato" : `${match.minutes} min`}</span></div>
                      <dl><div><dt>Sueño</dt><dd>{display(metric.sleep)} h</dd></div><div><dt>Cansancio</dt><dd>{display(metric.fatigue)}/5</dd></div><div><dt>Dolor</dt><dd>{display(metric.pain)}/10</dd></div><div><dt>Registros</dt><dd>{rpeRegistrationText(metric)} · {wellbeingRegistrationText(metric)}</dd></div></dl>
                      {pain && <p className="story-event">Molestia · {pain.zone} · limita: {pain.limitation} · {pain.note || "sin observación"}</p>}
                      {alert && <p className="story-event">Revisión · {ALERT_META[alert.status].label} · {alert.note || alert.history.at(-1)}</p>}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
          <details className="panel season-record-table">
            <summary><span><strong>Todos los registros</strong><small>Vista tabular para consulta detallada</small></span><b>Mostrar tabla</b></summary>
            <div className="season-record-head"><span>Jornada</span><span>Carga</span><span>RPE</span><span>Sueño</span><span>Cansancio</span><span>Dolor</span><span>Minutos</span><span>Estado</span></div>
            {history.slice().reverse().map((metric) => (
              <div className="season-record-row" key={metric.weekId}><strong>{CALENDAR[metric.weekId - 1].label}</strong><span>{loadText(metric)}</span><span>{display(metric.avgRpe)}/10</span><span>{display(metric.sleep)} h</span><span>{display(metric.fatigue)}/5</span><span>{display(metric.pain)}/10</span><span>{metric.matchMinutes == null ? "Sin dato" : `${metric.matchMinutes} min`}</span><StatusBadge status={metric.status} /></div>
            ))}
          </details>
          <section className="panel review-history-v7">
            <div><span className="eyebrow">Seguimiento</span><h2>Revisiones y notas</h2></div>
            {pastAlerts.length ? pastAlerts.slice().reverse().flatMap((alert) => alert.history.map((item, index) => <p key={`${alert.id}-${index}`}><strong>{CALENDAR[alert.weekId - 1].label}</strong><span>{item}</span></p>)) : <p className="empty-state">Sin revisiones registradas.</p>}
          </section>
        </div>
      ) : (
        <PlayerReport weekId={weekId} playerId={playerId} metrics={metrics} players={players} />
      )}
    </div>
  );
}

function ReportsView({
  weekId,
  setWeekId,
  metrics,
  plans,
  alerts,
  selectedPlayerId,
  setSelectedPlayerId,
  onOpenPlayer,
  players,
}: {
  weekId: number;
  setWeekId: (id: number) => void;
  metrics: Map<string, PlayerMetric>;
  plans: SessionPlan[];
  alerts: AlertRecord[];
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  onOpenPlayer: (id: string) => void;
  players: RosterPlayer[];
}) {
  const [tab, setTab] = useState<"pre" | "weekly" | "player">("pre");
  const current = players.flatMap((player) => {
    const metric = metrics.get(`${weekId}-${player.id}`);
    return metric ? [{ player, metric }] : [];
  });
  const counts = (value: Availability) =>
    current.filter(
      (item) => item.metric.availabilityKnown && item.metric.availability === value,
    ).length;
  const review = current.filter(
    (item) =>
      item.metric.status === "REVISAR" || item.metric.status === "VIGILAR",
  );
  const pending = current.filter((item) => item.metric.pending > 0);
  const rpeExpectedTotal = current.reduce(
    (total, item) => total + item.metric.rpeExpected,
    0,
  );
  const rpeCompletedTotal = current.reduce(
    (total, item) => total + item.metric.rpeCompleted,
    0,
  );
  const wellbeingExpectedTotal = current.reduce(
    (total, item) => total + item.metric.wellbeingExpected,
    0,
  );
  const wellbeingCompletedTotal = current.filter(
    (item) => item.metric.wellbeingExpected === 1 && item.metric.wellbeingDone,
  ).length;
  const previousTotal = players.reduce((sum, player) => {
    const previous = metrics.get(`${Math.max(1, weekId - 1)}-${player.id}`);
    return sum + (previous?.loadCompleteness === "COMPLETE" ? previous.load : 0);
  }, 0);
  const total = current.reduce(
    (sum, item) =>
      sum +
      (item.metric.loadCompleteness === "COMPLETE" ? item.metric.load : 0),
    0,
  );
  const change = previousTotal
    ? ((total - previousTotal) / previousTotal) * 100
    : 0;
  const player =
    players.find((item) => item.id === selectedPlayerId) ?? players[0];
  const playerMetric = player
    ? metrics.get(`${weekId}-${player.id}`)
    : undefined;
  if (!player || !playerMetric)
    return <p className="empty-state">No hay jugadores activos para generar informes.</p>;
  return (
    <>
      <SectionHeader
        eyebrow="Informes operativos"
        title="Informes"
        description="Preentrenamiento, resumen semanal e informe individual en una sola sección."
        action={<WeekSelector weekId={weekId} onChange={setWeekId} compact />}
      />
      <div className="report-type-tabs">
        <button
          className={tab === "pre" ? "active" : ""}
          onClick={() => setTab("pre")}
        >
          Informe preentrenamiento
        </button>
        <button
          className={tab === "weekly" ? "active" : ""}
          onClick={() => setTab("weekly")}
        >
          Resumen semanal
        </button>
        <button
          className={tab === "player" ? "active" : ""}
          onClick={() => setTab("player")}
        >
          Informe jugador
        </button>
      </div>
      {tab === "pre" ? (
        <section className="one-page-report">
          <header>
            <div>
              <span>INFORME PREENTRENAMIENTO</span>
              <h2>
                {CALENDAR[weekId - 1].label} ·{" "}
                {
                  plans.find(
                    (item) => item.weekId === weekId && item.session === 2,
                  )?.name
                }
              </h2>
              <p>
                {formatDate(
                  plans.find(
                    (item) => item.weekId === weekId && item.session === 2,
                  )!.date,
                  true,
                )}{" "}
                ·{" "}
                {
                  plans.find(
                    (item) => item.weekId === weekId && item.session === 2,
                  )?.time
                }
              </p>
            </div>
            <b>
              {
                plans.find(
                  (item) => item.weekId === weekId && item.session === 2,
                )?.md
              }
            </b>
          </header>
          <div className="pre-report-grid">
            <article>
              <h3>Disponibilidad</h3>
              {Object.keys(AVAILABILITY_META).map((value) => (
                <p key={value}>
                  <AvailabilityBadge value={value as Availability} />
                  <strong>{counts(value as Availability)}</strong>
                </p>
              ))}
            </article>
            <article>
              <h3>Revisar</h3>
              {review.slice(0, 5).map(({ player: reviewPlayer, metric }) => (
                <button
                  key={reviewPlayer.id}
                  onClick={() => onOpenPlayer(reviewPlayer.id)}
                >
                  <span>
                    #{reviewPlayer.number} {titleCase(reviewPlayer.name)}
                  </span>
                  <StatusBadge status={metric.status} />
                  <small>{metric.reasons[0]}</small>
                </button>
              ))}
            </article>
            <article>
              <h3>Registros pendientes</h3>
              <strong className="report-big-number">{pending.length}</strong>
              <p>jugadores con algún dato pendiente</p>
              {pending.slice(0, 4).map((item) => (
                <small key={item.player.id}>
                  #{item.player.number} {titleCase(item.player.name)} ·{" "}
                  {item.metric.pending}
                </small>
              ))}
            </article>
            <article>
              <h3>Principales señales</h3>
              <p>
                Sueño bajo{" "}
                <b>
                  {
                    current.filter((item) =>
                      item.metric.signals.some((signal) =>
                        signal.key.includes("sleep"),
                      ),
                    ).length
                  }
                </b>
              </p>
              <p>
                Cansancio{" "}
                <b>
                  {
                    current.filter((item) =>
                      item.metric.signals.some(
                        (signal) => signal.key === "fatigue",
                      ),
                    ).length
                  }
                </b>
              </p>
              <p>
                Dolor{" "}
                <b>
                  {
                    current.filter((item) =>
                      item.metric.signals.some(
                        (signal) => signal.key === "pain",
                      ),
                    ).length
                  }
                </b>
              </p>
              <p>
                RPE fuera de habitual{" "}
                <b>
                  {
                    current.filter((item) =>
                      item.metric.signals.some(
                        (signal) => signal.key === "rpe-z",
                      ),
                    ).length
                  }
                </b>
              </p>
            </article>
          </div>
          <footer>
            <div>
              <small>Carga media reciente</small>
              <strong>
                {compact(mean(current.map((item) => item.metric.load)))} UA
              </strong>
            </div>
            <div>
              <small>Registros RPE</small>
              <strong>{rpeCompletedTotal}/{rpeExpectedTotal}</strong>
            </div>
            <div>
              <small>Alertas en seguimiento</small>
              <strong>
                {
                  alerts.filter(
                    (item) =>
                      item.weekId === weekId &&
                      item.status === "EN SEGUIMIENTO",
                  ).length
                }
              </strong>
            </div>
            <p>
              Documento de monitorización y contexto. No contiene predicciones
              ni diagnósticos.
            </p>
          </footer>
        </section>
      ) : tab === "weekly" ? (
        <>
          <div className="weekly-report-kpis">
            <Kpi
              label="Sesiones realizadas"
              value={`${plans.filter((item) => item.weekId === weekId && item.closed).length}/4`}
              helper="+ partido"
              icon="✓"
            />
            <Kpi
              label="Carga equipo"
              value={`${compact(total)} UA`}
              helper={`${change >= 0 ? "+" : ""}${display(change, 0)}% vs. anterior`}
              icon="Σ"
            />
            <Kpi
              label="RPE medio"
              value={`${display(mean(current.map((item) => item.metric.avgRpe)))}/10`}
              helper={`${compact(current.reduce((sum, item) => sum + item.metric.minutes, 0))} min`}
              icon="R"
            />
            <Kpi
              label="Registros RPE"
              value={`${rpeCompletedTotal}/${rpeExpectedTotal}`}
              helper={`Bienestar ${wellbeingCompletedTotal}/${wellbeingExpectedTotal}`}
              icon="◷"
            />
          </div>
          <div className="weekly-report-grid">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Temporada</span>
                  <h2>Carga media del equipo</h2>
                </div>
              </div>
              <LineChart
                data={CALENDAR.slice(Math.max(0, weekId - 11), weekId).map(
                  (week) => ({
                    label: week.label,
                    value: mean(
                      players.map((item) => {
                        const metric = metrics.get(`${week.id}-${item.id}`);
                        return metric?.loadCompleteness === "COMPLETE"
                          ? metric.load
                          : null;
                      }),
                    ),
                  }),
                )}
                color="#004379"
                unit=" UA"
              />
            </section>
            <section className="panel weekly-tendencies">
              <h2>Principales tendencias</h2>
              {(["rpe", "load", "sleep", "fatigue"] as MetricKey[]).map(
                (key) => {
                  const teamHistory = CALENDAR.slice(0, weekId).map(
                    (week) =>
                      ({
                        ...current[0].metric,
                        weekId: week.id,
                        [key]: mean(
                          players.map((item) => {
                            const metric = metrics.get(`${week.id}-${item.id}`);
                            return metric ? metricValue(metric, key) : null;
                          }),
                        ),
                      }) as PlayerMetric,
                  );
                  const trend = trendInfo(teamHistory, key);
                  return (
                    <p key={key}>
                      <span>{METRICS[key].label}</span>
                      <strong className={`trend-${trend.tone}`}>
                        {trend.symbol} {trend.label}
                      </strong>
                    </p>
                  );
                },
              )}
              <h3>Jugadores revisados</h3>
              {review.slice(0, 5).map((item) => (
                <small key={item.player.id}>
                  #{item.player.number} {titleCase(item.player.name)} ·{" "}
                  {item.metric.reasons[0]}
                </small>
              ))}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="player-report-select">
            <label>
              Jugador
              <select
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                {players.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.number} · {titleCase(item.name)}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => onOpenPlayer(selectedPlayerId)}>
              Abrir ficha completa →
            </button>
          </div>
          <section className="report-cover">
            <div>
              <span className="eyebrow">
                Mi informe · {CALENDAR[weekId - 1].label}
              </span>
              <h2>{titleCase(player.name)}</h2>
              <p>
                #{player.number} · {titleCase(player.position)}
              </p>
            </div>
            <div>
              <AvailabilityBadge value={playerMetric.availability} />
              <StatusBadge status={playerMetric.status} />
            </div>
          </section>
          <div className="weekly-report-kpis">
            <Kpi
              label="RPE"
              value={`${display(playerMetric.avgRpe)}/10`}
              helper="Media semanal"
              icon="R"
            />
            <Kpi
              label="Carga"
              value={loadText(playerMetric)}
              helper={hasInterpretableLoad(playerMetric) ? `${compact(playerMetric.matchLoad)} competición` : "No entra en la media completa"}
              icon="Σ"
            />
            <Kpi
              label="Sueño"
              value={`${display(playerMetric.sleep)} h`}
              helper={
                playerMetric.personalSleep
                  ? `Habitual ${display(playerMetric.personalSleep)} h`
                  : "Sin referencia aún"
              }
              icon="☾"
            />
            <Kpi
              label="Registros"
              value={rpeRegistrationText(playerMetric)}
              helper={wellbeingRegistrationText(playerMetric)}
              icon="✓"
            />
          </div>
          <ReportTrendSummary
            playerId={selectedPlayerId}
            metrics={metrics}
            weekId={weekId}
          />
        </>
      )}
    </>
  );
}

function PlayerReport({
  weekId,
  playerId,
  metrics,
  players,
}: {
  weekId: number;
  playerId: string;
  metrics: Map<string, PlayerMetric>;
  players: RosterPlayer[];
}) {
  const player = players.find((item) => item.id === playerId) ?? players[0];
  const metric = player ? metrics.get(`${weekId}-${player.id}`) : undefined;
  if (!player || !metric)
    return <p className="empty-state">No hay datos del jugador.</p>;
  const peers = players
    .filter((item) => positionGroup(item.position) === positionGroup(player.position))
    .flatMap((item) => {
      const peerMetric = metrics.get(`${weekId}-${item.id}`);
      return peerMetric ? [peerMetric] : [];
    });
  const history = CALENDAR.slice(0, weekId)
    .map((week) => metrics.get(`${week.id}-${player.id}`))
    .filter((item): item is PlayerMetric => Boolean(item));
  const loadTrend = trendInfo(history, "load");
  const sleepTrend = trendInfo(history, "sleep");
  const doingWell = [
    metric.personalSleep != null &&
    metric.sleep != null &&
    metric.sleep >= metric.personalSleep
      ? "Sueño en línea con tu comportamiento habitual"
      : null,
    metric.rpeExpected > 0 && metric.rpeCompleted === metric.rpeExpected
      ? "Todos los RPE esperados están completados"
      : null,
  ].filter(Boolean) as string[];
  const focus = metric.reasons.length
    ? metric.reasons.slice(0, 2)
    : ["Mantener la regularidad de registros y sensaciones."];
  return (
    <>
      <SectionHeader
        eyebrow={`Mi informe · ${CALENDAR[weekId - 1].label}`}
        title={titleCase(player.name)}
        description="Tus datos principales, su evolución y una comparación sencilla con jugadores de posición similar."
      />
      <section className="report-cover player-only-cover">
        <div>
          <span className="eyebrow">Resumen personal</span>
          <h2>
            #{player.number} · {titleCase(player.position)}
          </h2>
          <p>Semana frente a {CALENDAR[weekId - 1].opponent}</p>
        </div>
        <div>
          <AvailabilityBadge value={metric.availability} />
          <StatusBadge status={metric.status} />
        </div>
      </section>
      <div className="weekly-report-kpis">
        <Kpi
          label="RPE medio"
          value={`${display(metric.avgRpe)}/10`}
          helper={`${metric.rpeCompleted}/${metric.rpeExpected} esperados`}
          icon="R"
        />
        <Kpi
          label="Carga total"
          value={loadText(metric)}
          helper={hasInterpretableLoad(metric) ? `${compact(metric.matchLoad)} competición` : "No entra en la media completa"}
          icon="Σ"
        />
        <Kpi
          label="Sueño"
          value={`${display(metric.sleep)} h`}
          helper={
            metric.personalSleep
              ? `Habitual ${display(metric.personalSleep)} h`
              : "Aún sin referencia"
          }
          icon="☾"
        />
        <Kpi
          label="Registros"
          value={rpeRegistrationText(metric)}
          helper={wellbeingRegistrationText(metric)}
          icon="✓"
        />
      </div>
      <div className="player-report-context">
        <section className="panel">
          <span className="eyebrow">Cómo voy</span>
          <h2>Tu tendencia reciente</h2>
          <p>
            <strong>Carga</strong>
            <b className={`trend-${loadTrend.tone}`}>
              {loadTrend.symbol} {loadTrend.label}
            </b>
          </p>
          <p>
            <strong>Sueño</strong>
            <b className={`trend-${sleepTrend.tone}`}>
              {sleepTrend.symbol} {sleepTrend.label}
            </b>
          </p>
          <p>
            <strong>Sesiones</strong>
            <b>
              {metric.rpeCompleted}/{metric.rpeExpected} RPE completados
            </b>
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">Yo vs. posición</span>
          <h2>{positionGroup(player.position).toLocaleLowerCase("es-ES")}</h2>
          <p>
            <strong>Tu carga</strong>
            <b>{loadText(metric)}</b>
          </p>
          <p>
            <strong>Media posición</strong>
            <b>{compact(mean(peers.filter(hasInterpretableLoad).map((item) => item.load)))} UA</b>
          </p>
          <p>
            <strong>Tu RPE</strong>
            <b>{display(metric.avgRpe)}/10</b>
          </p>
          <small>Comparación contextual; no genera alertas.</small>
        </section>
        <section className="panel positive-context">
          <span className="eyebrow">Lo que haces bien</span>
          <h2>Fortalezas de la semana</h2>
          {(doingWell.length
            ? doingWell
            : ["Has mantenido actividad y registros durante la semana."]
          ).map((item) => (
            <p key={item}>✓ {item}</p>
          ))}
        </section>
        <section className="panel focus-context">
          <span className="eyebrow">En qué fijarme</span>
          <h2>Próximo foco</h2>
          {focus.map((item) => (
            <p key={item}>→ {item}</p>
          ))}
          <small>
            Son señales para contextualizar, no conclusiones médicas.
          </small>
        </section>
      </div>
      <ReportTrendSummary playerId={playerId} metrics={metrics} weekId={weekId} />
    </>
  );
}

function SettingsView({
  thresholds,
  setThresholds,
  notify,
  activePlayerCount,
}: {
  thresholds: Thresholds;
  setThresholds: React.Dispatch<React.SetStateAction<Thresholds>>;
  notify: (message: string) => void;
  activePlayerCount: number;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ auth?: { role?: string } }>)
          : null,
      )
      .then((payload) => setIsAdmin(payload?.auth?.role === "ADMIN"))
      .catch(() => setIsAdmin(false));
  }, []);
  const fields: Array<{
    key: keyof Thresholds;
    label: string;
    unit: string;
    helper: string;
  }> = [
    {
      key: "highRpe",
      label: "RPE alto",
      unit: "/10",
      helper:
        "Contexto absoluto; la referencia personal tiene prioridad cuando existe.",
    },
    {
      key: "lowSleep",
      label: "Sueño bajo",
      unit: "h",
      helper: "Señal general cuando aún no existe baseline personal.",
    },
    {
      key: "lowMood",
      label: "Ánimo bajo",
      unit: "/5",
      helper: "Revisar si es igual o inferior.",
    },
    {
      key: "highFatigue",
      label: "Cansancio alto",
      unit: "/5",
      helper: "Revisar si es igual o superior.",
    },
    {
      key: "relevantPain",
      label: "Dolor relevante",
      unit: "/10",
      helper: "Abre conversación; no implica diagnóstico.",
    },
    {
      key: "highStress",
      label: "Estrés alto",
      unit: "/5",
      helper: "Revisar si es igual o superior.",
    },
  ];
  return (
    <>
      <SectionHeader
        eyebrow="Configuración"
        title="Ajustes"
        description="Equipo, permisos, datos, marca y monitorización con control de cambios."
      />
      <section className="settings-layout">
        <div className="panel settings-panel">
          {fields.map((field) => (
            <label className="setting-row" key={field.key}>
              <div>
                <strong>{field.label}</strong>
                <p>{field.helper}</p>
              </div>
              <span>
                <input
                  type="number"
                  step=".1"
                  disabled={!isAdmin}
                  value={thresholds[field.key]}
                  onChange={(event) =>
                    setThresholds((current) => ({
                      ...current,
                      [field.key]: Number(event.target.value),
                    }))
                  }
                />
                <em>{field.unit}</em>
              </span>
            </label>
          ))}
          <p className="settings-save-model">
            {isAdmin ? "Autoguardado activo · los cambios se persisten al editar" : "Solo ADMIN puede editar"}
          </p>
        </div>
        <aside className="settings-aside">
          <div>
            <span>Equipo</span>
            <strong>Juvenil B</strong>
          </div>
          <div>
            <span>Temporada</span>
            <strong>2026/2027</strong>
          </div>
          <div>
            <span>Baseline</span>
            <strong>8 semanas</strong>
          </div>
          <div>
            <span>Persistencia</span>
            <strong>Activa</strong>
          </div>
          <p>
            El ratio de carga se conserva únicamente como indicador secundario
            de cambio. No se generan predicciones de lesión ni readiness scores
            opacos.
          </p>
        </aside>
      </section>
      <AdminOperations
        isAdmin={isAdmin}
        weekId={ACTIVE_WEEK_ID}
        notify={notify}
        activePlayerCount={activePlayerCount}
      />
    </>
  );
}

function PlayerHome({
  player,
  weekId,
  onOpenRegister,
  sessions,
  plans,
  matches,
  metrics,
}: {
  player: RosterPlayer;
  weekId: number;
  onOpenRegister: (target: number | "match" | "wellbeing") => void;
  sessions: SessionRecord[];
  plans: SessionPlan[];
  matches: MatchRecord[];
  metrics: Map<string, PlayerMetric>;
}) {
  const playerId = player.id;
  const metric = metrics.get(`${weekId}-${playerId}`);
  if (!metric)
    return <p className="empty-state">No hay datos disponibles.</p>;
  const rows = sessions
    .filter((item) => item.weekId === weekId && item.playerId === playerId)
    .sort((a, b) => a.session - b.session);
  const match = matches.find(
    (item) => item.weekId === weekId && item.playerId === playerId,
  );
  const openSessions = new Set(
    plans
      .filter((item) => item.weekId === weekId && !item.closed)
      .map((item) => item.session),
  );
  const pendingRpe = rows.find(
    (item) =>
      item.attendance === "ENTRENÓ" &&
      item.rpe == null &&
      openSessions.has(item.session),
  );
  const action = pendingRpe
    ? {
        title: "REGISTRAR RPE",
        text: `Sesión ${pendingRpe.session}`,
        target: pendingRpe.session as number | "wellbeing",
        tone: "needed" as const,
      }
    : metric.wellbeingExpected === 0 && !metric.wellbeingDone
      ? {
          title: "BIENESTAR OPCIONAL",
          text: "Bienestar opcional esta semana",
          target: "wellbeing" as const,
          tone: "optional" as const,
        }
      : !metric.wellbeingDone
      ? {
          title: "COMPLETAR BIENESTAR",
          text: "Una vez esta semana",
          target: "wellbeing" as const,
          tone: "needed" as const,
        }
      : {
          title: "TODO AL DÍA ✓",
          text: "Has completado tus registros esperados",
          target: null,
          tone: "done" as const,
        };
  return (
    <>
      <section className="player-welcome">
        <div>
          <span>
            {CALENDAR[weekId - 1].label} · {CALENDAR[weekId - 1].opponent}
          </span>
          <h1>Hola, {titleCase(player.name.split(" ")[0])} 👋</h1>
        </div>
        <AvailabilityBadge value={metric.availability} />
      </section>
      <section
        className={`player-primary-action ${action.tone}`}
      >
        <div>
          <span className="eyebrow">Tu próxima acción</span>
          <h2>{action.title}</h2>
          <p>{action.text}</p>
        </div>
        {action.target == null ? (
          <span className="player-complete-confirmation">✓ Completado y guardado</span>
        ) : (
          <button onClick={() => onOpenRegister(action.target!)}>Empezar →</button>
        )}
      </section>
      <section className="player-week-card">
        <div className="player-week-head">
          <div>
            <span className="eyebrow">Esta semana</span>
            <h2>Sesiones y partido</h2>
          </div>
          <strong>
            {metric.rpeCompleted}/{metric.rpeExpected}
          </strong>
        </div>
        <div className="simple-week-list">
          {rows.map((row) => (
            <button key={row.key} onClick={() => onOpenRegister(row.session)}>
              <span
                className={
                  row.attendance === "ENTRENÓ" && row.rpe != null
                    ? "done"
                    : row.attendance === "ENTRENÓ"
                      ? "pending"
                      : "not-expected"
                }
              >
                {row.attendance === "ENTRENÓ" && row.rpe != null
                  ? "✓"
                  : row.attendance === "ENTRENÓ"
                    ? "○"
                    : "—"}
              </span>
              <div>
                <strong>S{row.session}</strong>
                <small>
                  {row.attendance === "ENTRENÓ"
                    ? row.rpe != null
                      ? `RPE ${display(row.rpe)} · ${row.minutes} min`
                      : "RPE pendiente"
                    : titleCase(row.attendance)}
                </small>
              </div>
            </button>
          ))}
          {match && <button className="player-match-line" onClick={() => onOpenRegister("match")}>
            <span>P</span>
            <div>
              <strong>Partido · {formatDate(match.date)}</strong>
              <small>
                {match.observation === "__SIN_DATO__"
                  ? `${match.opponent} · Sin datos de participación`
                  : `${match.opponent} · ${match.convocation.toLocaleLowerCase("es-ES")} · ${match.minutes == null ? "minutos sin dato" : `${match.minutes} min`}`}
              </small>
            </div>
          </button>}
        </div>
      </section>
      <section className="player-quiet-summary">
        <div>
          <span>RPE</span>
          <strong>{display(metric.avgRpe)}/10</strong>
        </div>
        <div>
          <span>Carga</span>
          <strong>{loadText(metric)}</strong>
        </div>
        <div>
          <span>Sueño</span>
          <strong>{display(metric.sleep)} h</strong>
        </div>
        <div>
          <span>Registros</span>
          <strong>{rpeRegistrationText(metric)}</strong>
          <small>{wellbeingRegistrationText(metric)}</small>
        </div>
      </section>
    </>
  );
}

function PlayerRegister({
  playerId,
  weekId,
  sessions,
  setSessions,
  plans,
  wellbeing,
  setWellbeing,
  matches,
  setMatches,
  painRecords,
  setPainRecords,
  notify,
  initialTarget,
  syncLabel,
}: {
  playerId: string;
  weekId: number;
  sessions: SessionRecord[];
  setSessions: React.Dispatch<React.SetStateAction<SessionRecord[]>>;
  plans: SessionPlan[];
  wellbeing: WellbeingRecord[];
  setWellbeing: React.Dispatch<React.SetStateAction<WellbeingRecord[]>>;
  matches: MatchRecord[];
  setMatches: React.Dispatch<React.SetStateAction<MatchRecord[]>>;
  painRecords: PainRecord[];
  setPainRecords: React.Dispatch<React.SetStateAction<PainRecord[]>>;
  notify: (message: string) => void;
  initialTarget: number | "match" | "wellbeing" | null;
  syncLabel: "idle" | "saving" | "saved" | "error";
}) {
  const rows = sessions
    .filter((item) => item.weekId === weekId && item.playerId === playerId)
    .sort((a, b) => a.session - b.session);
  const match = matches.find(
    (item) => item.weekId === weekId && item.playerId === playerId,
  );
  const openSessions = new Set(
    plans
      .filter((item) => item.weekId === weekId && !item.closed)
      .map((item) => item.session),
  );
  const pending = rows.find(
    (item) =>
      item.attendance === "ENTRENÓ" &&
      item.rpe == null &&
      openSessions.has(item.session),
  );
  const [tab, setTab] = useState<"rpe" | "wellbeing">(
    initialTarget === "wellbeing" || (!initialTarget && !pending)
      ? "wellbeing"
      : "rpe",
  );
  const [target, setTarget] = useState<number | "match">(
    initialTarget === "match" || typeof initialTarget === "number"
      ? initialTarget
      : (pending?.session ?? 1),
  );
  const [confirmation, setConfirmation] = useState<{
    status: "saving" | "saved" | "error";
    text: string;
  } | null>(null);
  const [wellbeingAttempted, setWellbeingAttempted] = useState(false);
  useEffect(() => {
    if (initialTarget === "wellbeing") setTab("wellbeing");
    else if (initialTarget === "match" || typeof initialTarget === "number") {
      setTab("rpe");
      setTarget(initialTarget);
    }
  }, [initialTarget]);
  useEffect(() => {
    if (!confirmation) return;
    if (syncLabel === "saved")
      setConfirmation((current) =>
        current ? { ...current, status: "saved" } : current,
      );
    if (syncLabel === "error")
      setConfirmation((current) =>
        current ? { ...current, status: "error" } : current,
      );
  }, [syncLabel]);
  const selected =
    typeof target === "number"
      ? rows.find((item) => item.session === target)
      : null;
  const [rpe, setRpe] = useState<number | null>(
    selected ? selected.rpe : (match?.rpe ?? null),
  );
  const rpeWindowOpen =
    weekId === ACTIVE_WEEK_ID &&
    (target === "match" || openSessions.has(target));
  const record = wellbeing.find(
    (item) => item.weekId === weekId && item.playerId === playerId,
  ) ?? {
    weekId,
    playerId,
    sleep: null,
    mood: null,
    fatigue: null,
    pain: null,
    stress: null,
    notes: "",
  };
  const [form, setForm] = useState<WellbeingRecord>({ ...record });
  useEffect(() => {
    setForm({ ...record });
    setWellbeingAttempted(false);
  }, [weekId, playerId, record.sleep, record.mood, record.fatigue, record.pain, record.stress]);
  const existingPain = painRecords.find(
    (item) => item.weekId === weekId && item.playerId === playerId,
  );
  const [painContext, setPainContext] = useState<{
    zone: PainZone;
    limitation: PainLimitation;
    note: string;
  }>({
    zone: existingPain?.zone ?? "Rodilla",
    limitation: existingPain?.limitation ?? "No",
    note: existingPain?.note ?? "",
  });
  const choose = (value: number | "match") => {
    setTarget(value);
    setRpe(
      value === "match"
        ? (match?.rpe ?? null)
        : (rows.find((item) => item.session === value)?.rpe ?? null),
    );
  };
  useEffect(() => {
    setRpe(
      target === "match"
        ? (match?.rpe ?? null)
        : (rows.find((item) => item.session === target)?.rpe ?? null),
    );
  }, [target]);
  const saveRpe = () => {
    if (rpe == null || !rpeWindowOpen) return;
    if (target === "match" && match) {
      setMatches((current) =>
        current.map((item) =>
          item.key === match.key
            ? {
                ...item,
                rpe,
                observation:
                  item.observation === "__SIN_DATO__" ? "" : item.observation,
              }
            : item,
        ),
      );
      setConfirmation({ status: "saving", text: `RPE de partido · ${rpe}/10` });
      notify(
        match.minutes == null
          ? `RPE de partido registrado · ${rpe}/10 · carga pendiente de minutos`
          : `RPE de partido registrado · ${rpe}/10 · ${match.minutes} min`,
      );
    } else if (selected) {
      setSessions((current) =>
        current.map((item) =>
          item.key === selected.key ? { ...item, rpe } : item,
        ),
      );
      setConfirmation({ status: "saving", text: `RPE de S${target} · ${rpe}/10` });
      notify(
        selected.minutes == null
          ? `RPE de S${target} registrado · ${rpe}/10 · carga pendiente de minutos`
          : `RPE de S${target} registrado · ${rpe}/10 · ${selected.minutes} min`,
      );
    }
  };
  const wellbeingComplete = [
    form.sleep,
    form.mood,
    form.fatigue,
    form.pain,
    form.stress,
  ].every((value) => value != null && Number.isFinite(value));
  const saveWellbeing = () => {
    setWellbeingAttempted(true);
    if (!wellbeingComplete) return;
    setWellbeing((current) => {
      const exists = current.some(
        (item) => item.weekId === weekId && item.playerId === playerId,
      );
      return exists
        ? current.map((item) =>
            item.weekId === weekId && item.playerId === playerId ? form : item,
          )
        : [...current, form];
    });
    if ((form.pain ?? 0) > 0) {
      const pain: PainRecord = {
        id: existingPain?.id ?? `pain-${playerId}-${weekId}`,
        weekId,
        playerId,
        date: CALENDAR[weekId - 1].dates[0],
        zone: painContext.zone,
        intensity: form.pain ?? 0,
        limitation: painContext.limitation,
        note: painContext.note,
      };
      setPainRecords((current) =>
        existingPain
          ? current.map((item) => (item.id === existingPain.id ? pain : item))
          : [...current, pain],
      );
    }
    setConfirmation({ status: "saving", text: "Bienestar semanal completo" });
    notify("Bienestar semanal enviado");
  };
  const nextPending = rows.find(
    (row) =>
      row.attendance === "ENTRENÓ" &&
      row.rpe == null &&
      openSessions.has(row.session) &&
      row.session !== target,
  );
  return (
    <>
      <SectionHeader
        eyebrow={CALENDAR[weekId - 1].label}
        title="Registrar"
        description="Dos pasos sencillos: RPE de cada sesión y bienestar una vez por semana."
      />
      <div className="segmented large player-segmented">
        <button
          className={tab === "rpe" ? "active" : ""}
          onClick={() => setTab("rpe")}
        >
          RPE
        </button>
        <button
          className={tab === "wellbeing" ? "active" : ""}
          onClick={() => setTab("wellbeing")}
        >
          Bienestar semanal
        </button>
      </div>
      {confirmation && (
        <section className={`player-save-confirmation save-${confirmation.status}`} aria-live="polite">
          <strong>
            {confirmation.status === "saving"
              ? "↻ Guardando…"
              : confirmation.status === "saved"
                ? "✓ Guardado"
                : "! No se ha guardado"}
          </strong>
          <span>{confirmation.text}</span>
          {confirmation.status === "saved" && nextPending && (
            <button onClick={() => choose(nextPending.session)}>
              1 registro pendiente · Ir a S{nextPending.session}
            </button>
          )}
        </section>
      )}
      {tab === "rpe" ? (
        <section className="mobile-form-card">
          <div className="session-picker">
            {rows.map((row) => (
              <button
                key={row.key}
                className={target === row.session ? "active" : ""}
                onClick={() => choose(row.session)}
              >
                <span>
                  {row.rpe != null && row.attendance === "ENTRENÓ"
                    ? "✓"
                    : row.attendance === "ENTRENÓ"
                      ? "○"
                      : "—"}
                </span>
                S{row.session}
              </button>
            ))}
            {match && <button
              className={target === "match" ? "active match-tab" : "match-tab"}
              onClick={() => choose("match")}
            >
              <span>{match.rpe != null ? "✓" : "○"}</span>P
            </button>}
          </div>
          <div className="rpe-question">
            <span>
              {target === "match"
                ? `Partido · ${match?.minutes == null ? "minutos sin registrar" : `${match.minutes} min`}`
                : `Sesión ${target} · ${selected?.minutes == null ? "minutos sin registrar" : `${selected.minutes} min`}`}
            </span>
            <h2>¿Cómo de duro ha sido?</h2>
            <p>Selecciona un valor y guarda.</p>
          </div>
          {!rpeWindowOpen ? (
            <div className="not-expected-message">
              <span>⌁</span>
              <h3>Registro no disponible</h3>
              <p>
                Solo se puede enviar RPE cuando el Staff mantiene la sesión
                abierta.
              </p>
            </div>
          ) : target === "match" && (!match || match.observation === "__SIN_DATO__") ? (
            <div className="not-expected-message">
              <span>◷</span>
              <h3>Participación pendiente</h3>
              <p>El Staff debe registrar convocatoria y minutos antes de abrir este RPE.</p>
            </div>
          ) : target !== "match" && selected?.attendance !== "ENTRENÓ" ? (
            <div className="not-expected-message">
              <span>—</span>
              <h3>No se espera RPE</h3>
              <p>
                La sesión figura como {titleCase(selected?.attendance ?? "")}.
              </p>
            </div>
          ) : (
            <>
              <div className="rpe-scale">
                {Array.from({ length: 11 }, (_, index) => (
                  <button
                    key={index}
                    className={rpe === index ? "active" : ""}
                    onClick={() => setRpe(index)}
                  >
                    {index}
                  </button>
                ))}
              </div>
              <div className="rpe-reading">
                <strong>{rpe ?? "—"}</strong>
                <div>
                  <span>
                    {rpe == null
                      ? "Elige un valor"
                      : rpe <= 2
                        ? "Fácil"
                        : rpe <= 4
                          ? "Algo duro"
                          : rpe <= 6
                            ? "Duro"
                            : rpe <= 8
                              ? "Muy duro"
                              : "Máximo"}
                  </span>
                  <small>
                    0 reposo · 2 fácil · 4 algo duro · 5 duro · 7 muy duro · 10
                    máximo
                  </small>
                </div>
              </div>
              <button
                className="primary-button giant"
                disabled={rpe == null}
                onClick={saveRpe}
              >
                Guardar RPE
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="mobile-form-card wellbeing-form">
          <div className="form-intro">
            <span className="eyebrow">Una vez por semana</span>
            <h2>¿Cómo ha ido tu semana?</h2>
            <p>Controles grandes y menos de un minuto.</p>
          </div>
          <label className="sleep-input">
            <span>
              <strong>Sueño</strong>
              <small>Horas dormidas</small>
            </span>
            <input
              type="number"
              min="0"
              max="14"
              step=".1"
              value={form.sleep ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sleep:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                }))
              }
            />
            <em>h</em>
          </label>
          {(
            ["mood", "fatigue", "stress"] as Array<
              "mood" | "fatigue" | "stress"
            >
          ).map((key) => (
            <div className="scale-question" key={key}>
              <div>
                <strong>{METRICS[key].label}</strong>
                <small>
                  1 = {key === "mood" ? "muy bajo" : "muy poco"} · 5 ={" "}
                  {key === "mood" ? "muy bueno" : "muy alto"}
                </small>
              </div>
              <div className="five-scale">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={
                      Math.round(form[key] ?? 0) === value ? "active" : ""
                    }
                    onClick={() =>
                      setForm((current) => ({ ...current, [key]: value }))
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="scale-question">
            <div>
              <strong>Dolor</strong>
              <small>0 = nada · 10 = máximo</small>
            </div>
            <input
              className={`pain-slider ${form.pain == null ? "is-unanswered" : ""}`}
              type="range"
              min="0"
              max="10"
              value={form.pain ?? 0}
              onPointerDown={() => {
                if (form.pain == null)
                  setForm((current) => ({ ...current, pain: 0 }));
              }}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  pain: Number(event.target.value),
                }))
              }
            />
            <output>{form.pain == null ? "Sin dato" : `${form.pain}/10`}</output>
          </div>
          {(form.pain ?? 0) > 0 && (
            <div className="pain-context-form">
              <span className="eyebrow">Contexto del dolor</span>
              <label>
                Zona
                <select
                  value={painContext.zone}
                  onChange={(event) =>
                    setPainContext((current) => ({
                      ...current,
                      zone: event.target.value as PainZone,
                    }))
                  }
                >
                  {[
                    "Cabeza/cuello",
                    "Hombro",
                    "Espalda",
                    "Cadera",
                    "Aductor",
                    "Cuádriceps",
                    "Isquios",
                    "Rodilla",
                    "Gemelo",
                    "Tobillo",
                    "Pie",
                    "Otra",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                ¿Limita el entrenamiento?
                <div className="limit-buttons">
                  {["No", "Algo", "Sí"].map((item) => (
                    <button
                      key={item}
                      className={
                        painContext.limitation === item ? "active" : ""
                      }
                      onClick={() =>
                        setPainContext((current) => ({
                          ...current,
                          limitation: item as PainLimitation,
                        }))
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                Nota
                <input
                  value={painContext.note}
                  onChange={(event) =>
                    setPainContext((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </label>
              <small>
                Esta información describe contexto; no genera diagnósticos.
              </small>
            </div>
          )}
          {wellbeingAttempted && !wellbeingComplete && (
            <p className="form-error" role="alert">
              Completa sueño, ánimo, cansancio, dolor y estrés antes de enviar.
            </p>
          )}
          <button className="primary-button giant" disabled={!wellbeingComplete} onClick={saveWellbeing}>
            Enviar bienestar
          </button>
          <small className="required-fields-note">Los cinco campos son obligatorios. Vacío significa sin dato, nunca cero.</small>
        </section>
      )}
    </>
  );
}

type AccessSession =
  | {
      role: "staff";
      email: string;
      displayName?: string;
      permissionRole?: "STAFF" | "ADMIN";
      authMethod?: "DEMO_CODE" | "CHATGPT";
    }
  | {
      role: "player";
      playerId: string;
      displayName?: string;
      authMethod?: "PIN";
    };

const INITIAL_STAFF_EMAILS = [
  "staff@juvenilb.es",
  "entrenador@juvenilb.es",
  "preparador@juvenilb.es",
];

/* v18: acceso local anterior retirado; el acceso persistente usa la plantilla del servidor.
function AccessGate({
  authorizedEmails,
  onPlayer,
  onStaff,
}: {
  authorizedEmails: string[];
  onPlayer: (playerId: string) => void;
  onStaff: (email: string) => void;
}) {
  const [role, setRole] = useState<"player" | "staff">("player");
  const [publicPlayers, setPublicPlayers] = useState<
    Array<{ id: string; display_name: string; shirt_number: number; position: string }>
  >([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/public/players", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{
              players?: Array<{
                id: string;
                display_name: string;
                shirt_number: number;
                position: string;
              }>;
            }>)
          : null,
      )
      .then((payload) => {
        const next = payload?.players ?? [];
        setPublicPlayers(next);
        if (next.length) setPlayerId((current) => current || next[0].id);
      })
      .catch(() => setPublicPlayers([]));
  }, []);
  const submitStaff = () => {
    const normalized = email.trim().toLocaleLowerCase("es-ES");
    if (!authorizedEmails.includes(normalized)) {
      setError("Este correo no tiene acceso autorizado al área Staff.");
      return;
    }
    setError("");
    onStaff(normalized);
  };
  return (
    <main className="access-shell">
      <section className="access-brand">
        <img src={UCAM_LOGO_WHITE} alt="UCAM Universidad Católica de Murcia" />
        <div>
          <strong>UCAM Performance</strong>
          <small>Rendimiento & seguimiento · 26/27</small>
        </div>
      </section>
      <section className="access-card">
        <div className="access-intro">
          <span className="eyebrow">UCAM · Football Performance</span>
          <h1>Accede a tu espacio</h1>
          <p>
            Una plataforma, dos experiencias: gestión profesional para el Staff
            y registro sencillo para cada jugador.
          </p>
        </div>
        <div className="access-role-tabs">
          <button
            className={role === "player" ? "active" : ""}
            onClick={() => {
              setRole("player");
              setError("");
            }}
          >
            <span>♙</span>
            <div>
              <strong>Soy jugador</strong>
              <small>RPE, bienestar y evolución personal</small>
            </div>
          </button>
          <button
            className={role === "staff" ? "active" : ""}
            onClick={() => {
              setRole("staff");
              setError("");
            }}
          >
            <span>◉</span>
            <div>
              <strong>Soy Staff</strong>
              <small>Gestión y análisis del equipo</small>
            </div>
          </button>
        </div>
        {role === "player" ? (
          <div className="access-form player-access-form">
            <label>
              <span>Selecciona tu nombre</span>
              <select
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
              >
                {INITIAL_PLAYERS.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.number} · {titleCase(player.name)} ·{" "}
                    {titleCase(player.position)}
                  </option>
                ))}
              </select>
            </label>
            <div className="access-identity">
              <span className="avatar">
                {INITIAL_PLAYERS.find((item) => item.id === playerId)!
                  .name.split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>
                  {titleCase(
                    INITIAL_PLAYERS.find((item) => item.id === playerId)!.name,
                  )}
                </strong>
                <small>
                  Solo podrás consultar y registrar tus propios datos.
                </small>
              </div>
            </div>
            <button
              className="access-submit"
              onClick={() => onPlayer(playerId)}
            >
              Entrar como jugador <b>→</b>
            </button>
          </div>
        ) : (
          <div className="access-form staff-access-form">
            <label>
              <span>Correo electrónico autorizado</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && submitStaff()}
                placeholder="nombre@ucam.edu"
                autoComplete="email"
              />
            </label>
            {error && (
              <p className="access-error">
                <span>!</span>
                {error}
              </p>
            )}
            <p className="access-demo">
              Correo autorizado para probar:{" "}
              <button onClick={() => setEmail("staff@juvenilb.es")}>
                staff@juvenilb.es
              </button>
            </p>
            <button className="access-submit" onClick={submitStaff}>
              Acceder al área Staff <b>→</b>
            </button>
          </div>
        )}
        <footer>
          <span>↳</span>
          <p>
            <strong>Acceso separado por funciones</strong>Los jugadores no
            pueden abrir menús, fichas ni análisis del Staff desde su sesión.
          </p>
        </footer>
      </section>
    </main>
  );
}

*/
type LoginResult = { error?: string };
function ProductionAccessGate({
  onPlayer,
  onStaff,
}: {
  onPlayer: (playerId: string, pin: string) => Promise<LoginResult>;
  onStaff: (email: string, code: string) => Promise<LoginResult>;
}) {
  const [role, setRole] = useState<"player" | "staff">("player");
  const [publicPlayers, setPublicPlayers] = useState<
    Array<{ id: string; display_name: string; shirt_number: number; position: string }>
  >([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("staff@juvenilb.es");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/public/players", { cache: "no-store" })
      .then((response) => response.ok
        ? response.json() as Promise<{ players?: Array<{ id: string; display_name: string; shirt_number: number; position: string }> }>
        : Promise.reject())
      .then((payload) => {
        const next = payload.players ?? [];
        setPublicPlayers(next);
        setPlayerId((current) => current || next[0]?.id || "");
      })
      .catch(() => setError("No hemos podido cargar la plantilla activa."));
  }, []);
  const submitPlayer = async () => {
    setBusy(true);
    setError("");
    if (!playerId) {
      setBusy(false);
      setError("Selecciona un jugador activo.");
      return;
    }
    const result = await onPlayer(playerId, pin);
    setBusy(false);
    if (result.error) setError(result.error);
  };
  const submitStaff = async () => {
    setBusy(true);
    setError("");
    const result = await onStaff(email, code);
    setBusy(false);
    if (result.error) setError(result.error);
  };
  const selected = publicPlayers.find((item) => item.id === playerId);
  return (
    <main className="access-shell">
      <section className="access-brand">
        <img src={UCAM_LOGO_WHITE} alt="UCAM Universidad Católica de Murcia" />
        <div>
          <strong>UCAM Performance</strong>
          <small>Rendimiento & seguimiento · 26/27</small>
        </div>
        <span className="environment-badge">DEMO PERSISTENTE</span>
      </section>
      <section className="access-card">
        <div className="access-intro">
          <span className="eyebrow">UCAM · Acceso seguro</span>
          <h1>Accede a tu espacio</h1>
          <p>
            Tu identidad determina automáticamente qué información puedes
            consultar y modificar.
          </p>
        </div>
        <div className="access-role-tabs">
          <button
            className={role === "player" ? "active" : ""}
            onClick={() => {
              setRole("player");
              setError("");
            }}
          >
            <span>♙</span>
            <div>
              <strong>Acceso jugador</strong>
              <small>Nombre + PIN privado</small>
            </div>
          </button>
          <button
            className={role === "staff" ? "active" : ""}
            onClick={() => {
              setRole("staff");
              setError("");
            }}
          >
            <span>◉</span>
            <div>
              <strong>Acceso Staff</strong>
              <small>Correo previamente autorizado</small>
            </div>
          </button>
        </div>
        {role === "player" ? (
          <div className="access-form player-access-form">
            <label>
              <span>Busca tu nombre</span>
              <select
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
              >
                {publicPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.shirt_number} · {player.display_name} ·{" "}
                    {titleCase(player.position)}
                  </option>
                ))}
              </select>
            </label>
            {selected && <div className="access-identity">
              <span className="avatar">
                {selected.display_name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div>
                <strong>{selected.display_name}</strong>
                <small>Solo tendrás acceso a tus propios datos.</small>
              </div>
            </div>}
            <label>
              <span>PIN privado</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && submitPlayer()}
                placeholder="••••"
                autoComplete="current-password"
              />
            </label>
            <p className="access-demo">
              <strong>DEMO</strong> PIN de todos los jugadores:{" "}
              <button onClick={() => setPin("2026")}>2026</button>
            </p>
            {error && (
              <p className="access-error">
                <span>!</span>
                {error}
              </p>
            )}
            <button
              className="access-submit"
              disabled={busy || !playerId || pin.length < 4}
              onClick={submitPlayer}
            >
              {busy ? "Comprobando…" : "Entrar a mi espacio"} <b>→</b>
            </button>
          </div>
        ) : (
          <div className="access-form staff-access-form">
            <a className="siwc-button" href="/signin-with-chatgpt?return_to=/">
              <span>✓</span>
              <div>
                <strong>Continuar con correo autorizado</strong>
                <small>Identidad verificada mediante ChatGPT</small>
              </div>
            </a>
            <div className="access-divider">
              <span>o acceso de demostración</span>
            </div>
            <label>
              <span>Correo autorizado</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="nombre@ucam.edu"
                autoComplete="email"
              />
            </label>
            <label>
              <span>Código de acceso DEMO</span>
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && submitStaff()}
                placeholder="••••••"
                autoComplete="current-password"
              />
            </label>
            <p className="access-demo">
              Admin DEMO:{" "}
              <button
                onClick={() => {
                  setEmail("admin@ucam-performance.demo");
                  setCode("260026");
                }}
              >
                admin@ucam-performance.demo · 260026
              </button>
            </p>
            {error && (
              <p className="access-error">
                <span>!</span>
                {error}
              </p>
            )}
            <button
              className="access-submit"
              disabled={busy || code.length !== 6}
              onClick={submitStaff}
            >
              {busy ? "Validando permiso…" : "Acceder al área Staff"} <b>→</b>
            </button>
          </div>
        )}
        <footer>
          <span>↳</span>
          <p>
            <strong>Permisos comprobados en servidor</strong>Un jugador no puede
            consultar compañeros; el Staff solo accede al equipo autorizado.
          </p>
        </footer>
      </section>
    </main>
  );
}

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: "STAFF" | "ADMIN";
  active: boolean;
  invite_status: string;
  last_access_at: string | null;
};
function AdminOperations({
  isAdmin,
  weekId,
  notify,
  activePlayerCount,
}: {
  isAdmin: boolean;
  weekId: number;
  notify: (message: string) => void;
  activePlayerCount: number;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [busy, setBusy] = useState(false);
  const loadStaff = async () => {
    if (!isAdmin) return;
    const response = await fetch("/api/admin/staff", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { staff: StaffMember[] };
      setStaff(payload.staff);
    }
  };
  useEffect(() => {
    loadStaff();
  }, [isAdmin]);
  const invite = async () => {
    setBusy(true);
    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      notify(payload.error ?? "No hemos podido añadir el miembro.");
      return;
    }
    setName("");
    setEmail("");
    notify("Invitación de Staff creada");
    loadStaff();
  };
  const updateMember = async (
    member: StaffMember,
    next: Partial<StaffMember>,
  ) => {
    const response = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: member.id,
        role: next.role ?? member.role,
        active: next.active ?? member.active,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      notify(payload.error ?? "No hemos podido actualizar el permiso.");
      return;
    }
    notify("Permiso actualizado");
    loadStaff();
  };
  const migrate = async () => {
    setBusy(true);
    const response = await fetch("/api/admin/migrate-demo", { method: "POST" });
    const payload = (await response.json()) as {
      error?: string;
      weeks?: number;
    };
    setBusy(false);
    notify(
      response.ok
        ? `Temporada DEMO migrada · ${payload.weeks} jornadas persistentes`
        : (payload.error ?? "No hemos podido migrar la temporada."),
    );
  };
  return (
    <section className="production-settings">
      <div className="production-head">
        <div>
          <span className="eyebrow">Fase 4 · Datos y permisos</span>
          <h2>Administración del equipo</h2>
          <p>
            Persistencia, trazabilidad, importación y accesos separados por rol.
          </p>
        </div>
        <span className="security-badge">⌾ Protección en servidor</span>
      </div>
      <div className="production-grid">
        <article className="production-block">
          <div className="block-head">
            <div>
              <span>Equipo</span>
              <h3>UCAM Juvenil B</h3>
            </div>
            <span className="environment-badge">DEMO</span>
          </div>
          <dl>
            <div>
              <dt>Temporada</dt>
              <dd>2026/2027</dd>
            </div>
            <div>
              <dt>Zona horaria</dt>
              <dd>Europe/Madrid</dd>
            </div>
            <div>
              <dt>Sesiones habituales</dt>
              <dd>4 + partido</dd>
            </div>
            <div>
              <dt>Jugadores</dt>
              <dd>{activePlayerCount} activos</dd>
            </div>
          </dl>
          <div className="action-row">
            <a className="secondary-button" href="/api/export?type=players">
              Exportar plantilla CSV
            </a>
            <a
              className="secondary-button"
              href={`/api/export?type=week&week=${weekId}`}
            >
              Exportar jornada
            </a>
          </div>
        </article>
        <article className="production-block">
          <div className="block-head">
            <div>
              <span>Marca</span>
              <h3>UCAM Performance</h3>
            </div>
            <span className="ucam-swatches">
              <i />
              <i />
            </span>
          </div>
          <p>
            La marca se guarda por equipo y puede cambiarse sin rehacer la
            interfaz.
          </p>
          <dl>
            <div>
              <dt>Primario</dt>
              <dd>#004379</dd>
            </div>
            <div>
              <dt>Acento</dt>
              <dd>#EDAB00</dd>
            </div>
            <div>
              <dt>Logo</dt>
              <dd>UCAM horizontal</dd>
            </div>
          </dl>
        </article>
      </div>
      {isAdmin ? (
        <>
          <div className="production-grid admin-grid">
            <article className="production-block staff-management">
              <div className="block-head">
                <div>
                  <span>Solo ADMIN</span>
                  <h3>Staff autorizado</h3>
                </div>
                <strong>
                  {staff.filter((item) => item.active).length} activos
                </strong>
              </div>
              <div className="staff-list">
                {staff.map((member) => (
                  <div key={member.id}>
                    <span className="staff-avatar">
                      {member.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <strong>{member.name}</strong>
                      <small>
                        {member.email} ·{" "}
                        {member.last_access_at
                          ? `Último acceso ${member.last_access_at}`
                          : "Sin acceso todavía"}
                      </small>
                    </div>
                    <select
                      value={member.role}
                      onChange={(event) =>
                        updateMember(member, {
                          role: event.target.value as "STAFF" | "ADMIN",
                        })
                      }
                    >
                      <option>STAFF</option>
                      <option>ADMIN</option>
                    </select>
                    <button
                      className={
                        member.active ? "danger-quiet" : "secondary-button"
                      }
                      onClick={() =>
                        updateMember(member, { active: !member.active })
                      }
                    >
                      {member.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                ))}
              </div>
              <div className="inline-form">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nombre"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@ucam.edu"
                />
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as "STAFF" | "ADMIN")
                  }
                >
                  <option>STAFF</option>
                  <option>ADMIN</option>
                </select>
                <button
                  className="primary-button"
                  disabled={busy || !name || !email}
                  onClick={invite}
                >
                  Añadir miembro
                </button>
              </div>
            </article>
          </div>
          <div className="migration-strip">
            <div>
              <strong>Migración de temporada DEMO</strong>
              <p>
                Convierte las 38 jornadas existentes en registros persistentes
                normalizados. La operación es idempotente.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={busy}
              onClick={migrate}
            >
              {busy ? "Procesando…" : "Migrar toda la temporada"}
            </button>
          </div>
        </>
      ) : (
        <div className="restricted-panel">
          <span>🔒</span>
          <div>
            <strong>Administración restringida</strong>
            <p>
              Solo un ADMIN puede invitar Staff o cambiar permisos. La gestión
              de jugadores está centralizada en Equipo → Gestionar plantilla.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const STAFF_NAV: Array<{ id: StaffPage; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Hoy" },
  { id: "team", icon: "◉", label: "Equipo" },
  { id: "sessions", icon: "+", label: "Sesiones" },
  { id: "analysis", icon: "↗", label: "Carga" },
  { id: "reports", icon: "▤", label: "Informes" },
  { id: "settings", icon: "⚙", label: "Ajustes" },
];
const STAFF_MOBILE_NAV = STAFF_NAV.filter((item) =>
  ["home", "team", "sessions", "analysis"].includes(item.id),
);
const PLAYER_NAV: Array<{ id: PlayerPage; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Inicio" },
  { id: "register", icon: "+", label: "Registrar" },
  { id: "evolution", icon: "∿", label: "Mi evolución" },
  { id: "report", icon: "≡", label: "Mi informe" },
];

/* v18: composición monolítica anterior retirada del runtime.
function LegacyHome() {
  const initialAvailability = useMemo(() => seedAvailability(), []);
  const [access, setAccess] = useState<AccessSession | null>(null);
  const [authorizedStaffEmails] = useState(INITIAL_STAFF_EMAILS);
  const [mode, setMode] = useState<AppMode>("staff");
  const [staffPage, setStaffPage] = useState<StaffPage>("home");
  const [sessionsTab, setSessionsTab] = useState<"register" | "calendar">(
    "register",
  );
  const [analysisTab, setAnalysisTab] = useState<"load" | "evolution">("load");
  const [playerPage, setPlayerPage] = useState<PlayerPage>("home");
  const [staffMoreOpen, setStaffMoreOpen] = useState(false);
  const [weekId, setWeekId] = useState(ACTIVE_WEEK_ID);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    INITIAL_PLAYERS[0].id,
  );
  const [sessions, setSessions] = useState<SessionRecord[]>(
    seedSessions() as SessionRecord[],
  );
  const [wellbeing, setWellbeing] = useState<WellbeingRecord[]>(
    seedWellbeing() as WellbeingRecord[],
  );
  const [plans, setPlans] = useState<SessionPlan[]>(seedSessionPlans());
  const [availability, setAvailability] =
    useState<AvailabilityRecord[]>(initialAvailability);
  const [matches, setMatches] = useState<MatchRecord[]>(() =>
    seedMatches(initialAvailability),
  );
  const [painRecords, setPainRecords] =
    useState<PainRecord[]>(seedPainRecords());
  const [alerts, setAlerts] = useState<AlertRecord[]>(seedAlerts());
  const [thresholds, setThresholds] = useState<Thresholds>(INITIAL_THRESHOLDS);
  const [activeAlertPlayer, setActiveAlertPlayer] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const metrics = useMemo(
    () =>
      buildMetrics({
        calendar: CALENDAR,
        players: INITIAL_ROSTER,
        sessions,
        wellbeing,
        plans,
        matches,
        availability,
        thresholds,
      }),
    [sessions, wellbeing, plans, matches, availability, thresholds],
  );
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  };
  const openPlayer = (id: string) => {
    setSelectedPlayerId(id);
    setStaffPage("playerDetail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goTo = (page: StaffPage) => {
    setStaffPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const loginPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setMode("player");
    setPlayerPage("home");
    setAccess({ role: "player", playerId });
    window.scrollTo({ top: 0 });
  };
  const loginStaff = (email: string) => {
    setMode("staff");
    setStaffPage("home");
    setAccess({ role: "staff", email });
    window.scrollTo({ top: 0 });
  };
  const logout = () => {
    setAccess(null);
    setActiveAlertPlayer(null);
    setToast("");
    window.scrollTo({ top: 0 });
  };
  const isAdmin = access?.role === "staff" && access.permissionRole === "ADMIN";
  const signedPlayer = access?.role === "player"
    ? roster.find((item) => item.id === access.playerId)
    : undefined;
  const staffContent =
    staffPage === "home" ? (
      <TodayDashboard
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        plans={plans}
        sessions={sessions}
        matches={matches}
        painRecords={painRecords}
        alerts={alerts}
        setAlerts={setAlerts}
        goTo={goTo}
        openSession={() => {
          setSessionsTab("register");
          goTo("sessions");
        }}
        openLoad={() => {
          setAnalysisTab("load");
          goTo("analysis");
        }}
        onOpenPlayer={openPlayer}
        onOpenAlert={setActiveAlertPlayer}
      />
    ) : staffPage === "team" ? (
      <TeamView
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        availability={availability}
        setAvailability={setAvailability}
        onOpenPlayer={openPlayer}
      />
    ) : staffPage === "players" ? (
      <PlayersView
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        onOpenPlayer={openPlayer}
      />
    ) : staffPage === "sessions" ? (
      <>
        <nav className="workspace-tabs" aria-label="Secciones de sesiones">
          <span>Sesiones</span>
          <button
            className={sessionsTab === "register" ? "active" : ""}
            onClick={() => setSessionsTab("register")}
          >
            Registro operativo
          </button>
          <button
            className={sessionsTab === "calendar" ? "active" : ""}
            onClick={() => setSessionsTab("calendar")}
          >
            Calendario
          </button>
        </nav>
        {sessionsTab === "register" ? (
          <RegisterView
            weekId={weekId}
            setWeekId={setWeekId}
            sessions={sessions}
            setSessions={setSessions}
            wellbeing={wellbeing}
            setWellbeing={setWellbeing}
            plans={plans}
            setPlans={setPlans}
            matches={matches}
            setMatches={setMatches}
            availability={availability}
            setAvailability={setAvailability}
            metrics={metrics}
            notify={notify}
            onOpenPlayer={openPlayer}
          />
        ) : (
          <CalendarView
            weekId={weekId}
            setWeekId={setWeekId}
            plans={plans}
            matches={matches}
          />
        )}
      </>
    ) : staffPage === "analysis" ? (
      <>
        <nav className="workspace-tabs" aria-label="Secciones de análisis">
          <span>Carga</span>
          <button
            className={analysisTab === "load" ? "active" : ""}
            onClick={() => setAnalysisTab("load")}
          >
            Resumen de carga
          </button>
          <button
            className={analysisTab === "evolution" ? "active" : ""}
            onClick={() => setAnalysisTab("evolution")}
          >
            Tendencias
          </button>
        </nav>
        {analysisTab === "load" ? (
          <LoadView
            weekId={weekId}
            setWeekId={setWeekId}
            metrics={metrics}
            onOpenPlayer={openPlayer}
          />
        ) : (
          <EvolutionView
            weekId={weekId}
            setWeekId={setWeekId}
            metrics={metrics}
            onOpenPlayer={openPlayer}
          />
        )}
      </>
    ) : staffPage === "reports" ? (
      <ReportsView
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        plans={plans}
        alerts={alerts}
        selectedPlayerId={selectedPlayerId}
        setSelectedPlayerId={setSelectedPlayerId}
        onOpenPlayer={openPlayer}
      />
    ) : staffPage === "settings" ? (
      <SettingsView
        thresholds={thresholds}
        setThresholds={setThresholds}
        notify={notify}
      />
    ) : (
      <PlayerDetail
        playerId={selectedPlayerId}
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        sessions={sessions}
        matches={matches}
        availability={availability}
        setAvailability={setAvailability}
        painRecords={painRecords}
        alerts={alerts}
        onBack={() => setStaffPage("team")}
        onSelectPlayer={openPlayer}
        notify={notify}
      />
    );
  const playerContent =
    playerPage === "home" ? (
      <PlayerHome
        playerId={selectedPlayerId}
        weekId={weekId}
        setPage={setPlayerPage}
        sessions={sessions}
        plans={plans}
        matches={matches}
        metrics={metrics}
      />
    ) : playerPage === "register" ? (
      <PlayerRegister
        playerId={selectedPlayerId}
        weekId={weekId}
        sessions={sessions}
        setSessions={setSessions}
        plans={plans}
        wellbeing={wellbeing}
        setWellbeing={setWellbeing}
        matches={matches}
        setMatches={setMatches}
        painRecords={painRecords}
        setPainRecords={setPainRecords}
        notify={notify}
      />
    ) : playerPage === "evolution" ? (
      <>
        <SectionHeader
          eyebrow={CALENDAR[weekId - 1].label}
          title="Mi evolución"
          description="Una métrica cada vez, con tu referencia personal cuando existe."
        />
        <MetricExplorer
          playerId={selectedPlayerId}
          metrics={metrics}
          weekId={weekId}
        />
      </>
    ) : (
      <PlayerReport
        weekId={weekId}
        playerId={selectedPlayerId}
        metrics={metrics}
      />
    );
  if (!access)
    return (
      <AccessGate
        authorizedEmails={authorizedStaffEmails}
        onPlayer={loginPlayer}
        onStaff={loginStaff}
      />
    );
  const activeMetric = activeAlertPlayer
    ? metrics.get(`${weekId}-${activeAlertPlayer}`)
    : null;
  const activeAlertRosterPlayer = activeAlertPlayer
    ? activeRoster.find((player) => player.id === activeAlertPlayer)
    : null;
  const signedPlayer =
    access.role === "player"
      ? INITIAL_PLAYERS.find((item) => item.id === access.playerId)!
      : null;
  return (
    <div className={`app-shell mode-${mode}`}>
      <aside className="sidebar">
        <div className="brand">
          <img
            src={UCAM_LOGO_WHITE}
            alt="UCAM Universidad Católica de Murcia"
          />
          <div>
            <strong>UCAM Performance</strong>
            <small>Juvenil B · Temporada 26/27</small>
          </div>
        </div>
        <nav>
          {(mode === "staff" ? STAFF_NAV : PLAYER_NAV).map((item) => (
            <button
              key={item.id}
              className={
                (
                  mode === "staff"
                    ? staffPage === item.id
                    : playerPage === item.id
                )
                  ? "active"
                  : ""
              }
              onClick={() =>
                mode === "staff"
                  ? setStaffPage(item.id as StaffPage)
                  : setPlayerPage(item.id as PlayerPage)
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            {access.role === "staff"
              ? "ST"
              : signedPlayer!.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
          </span>
          <div>
            <strong>
              {access.role === "staff"
                ? "Staff autorizado"
                : titleCase(signedPlayer!.name)}
            </strong>
            <small>{access.role === "staff" ? access.email : "Jugador"}</small>
          </div>
        </div>
      </aside>
      <div className="app-column">
        <header className="topbar">
          <div className="mobile-brand">
            <img src={UCAM_LOGO_BLUE} alt="UCAM" />
            <strong>Performance</strong>
          </div>
          {mode === "staff" && <GlobalSearch onOpen={openPlayer} />}
          <div className="access-session">
            <span className={`access-role access-role-${access.role}`}>
              {access.role === "staff" ? "✓ Staff autorizado" : "♙ Jugador"}
            </span>
            <div className="access-user">
              <strong>
                {access.role === "staff"
                  ? access.email
                  : titleCase(signedPlayer!.name)}
              </strong>
              <small>
                {access.role === "staff"
                  ? "Acceso de gestión"
                  : `#${signedPlayer!.number} · ${titleCase(signedPlayer!.position)}`}
              </small>
            </div>
            <WeekSelector weekId={weekId} onChange={setWeekId} compact />
            <button className="logout-button" onClick={logout}>
              Salir <span>↗</span>
            </button>
          </div>
        </header>
        <div className="mobile-scroll-nav">
          {(mode === "staff" ? STAFF_NAV : PLAYER_NAV).map((item) => (
            <button
              key={item.id}
              className={
                (
                  mode === "staff"
                    ? staffPage === item.id
                    : playerPage === item.id
                )
                  ? "active"
                  : ""
              }
              onClick={() =>
                mode === "staff"
                  ? setStaffPage(item.id as StaffPage)
                  : setPlayerPage(item.id as PlayerPage)
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <main className="content">
          {mode === "staff" ? staffContent : playerContent}
        </main>
      </div>
      {mode === "player" && (
        <nav className="player-bottom-nav">
          {PLAYER_NAV.map((item) => (
            <button
              key={item.id}
              className={playerPage === item.id ? "active" : ""}
              onClick={() => setPlayerPage(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      )}
      {mode === "staff" && (
        <>
          <nav className="staff-bottom-nav" aria-label="Navegación principal Staff">
            {STAFF_MOBILE_NAV.map((item) => (
              <button
                key={item.id}
                className={staffPage === item.id ? "active" : ""}
                onClick={() => {
                  setStaffMoreOpen(false);
                  goTo(item.id);
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <button
              className={staffMoreOpen || staffPage === "reports" || staffPage === "settings" ? "active" : ""}
              onClick={() => setStaffMoreOpen((open) => !open)}
              aria-expanded={staffMoreOpen}
            >
              <span>•••</span>
              Más
            </button>
          </nav>
          {staffMoreOpen && (
            <div className="staff-more-menu" role="menu">
              <button role="menuitem" onClick={() => { setStaffMoreOpen(false); goTo("reports"); }}>▤ Informes</button>
              <button role="menuitem" onClick={() => { setStaffMoreOpen(false); goTo("settings"); }}>⚙ Ajustes</button>
              <button role="menuitem" onClick={() => { setStaffMoreOpen(false); logout(); }}>↗ Salir</button>
            </div>
          )}
        </>
      )}
      {activeAlertPlayer && activeMetric && activeAlertRosterPlayer && (
        <AlertDrawer
          player={activeAlertRosterPlayer}
          playerId={activeAlertPlayer}
          weekId={weekId}
          metric={activeMetric}
          alerts={alerts}
          setAlerts={setAlerts}
          onClose={() => setActiveAlertPlayer(null)}
          onOpenPlayer={() => {
            setActiveAlertPlayer(null);
            openPlayer(activeAlertPlayer);
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

*/
type PersistDomain =
  | "sessions"
  | "wellbeing"
  | "availability"
  | "matches"
  | "painRecords"
  | "alerts"
  | "plans"
  | "thresholds";
type ServerAuth = {
  role: "PLAYER" | "STAFF" | "ADMIN";
  playerId: string | null;
  email: string | null;
  displayName: string;
  authMethod: "PIN" | "DEMO_CODE" | "CHATGPT";
};

export default function Home() {
  const initialAvailability = useMemo(() => seedAvailability(), []);
  const [access, setAccess] = useState<AccessSession | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [mode, setMode] = useState<AppMode>("staff");
  const [staffPage, setStaffPage] = useState<StaffPage>("home");
  const [sessionsTab, setSessionsTab] = useState<"register" | "calendar">(
    "register",
  );
  const [analysisTab, setAnalysisTab] = useState<"load" | "evolution">("load");
  const [playerPage, setPlayerPage] = useState<PlayerPage>("home");
  const [staffMoreOpen, setStaffMoreOpen] = useState(false);
  const [weekId, setWeekId] = useState(ACTIVE_WEEK_ID);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [sessionView, setSessionView] = useState<
    "1" | "2" | "3" | "4" | "match" | "wellbeing"
  >(String(ACTIVE_SESSION) as "2");
  const [sessionFilter, setSessionFilter] = useState<
    "focus" | "exceptions" | "all"
  >("focus");
  const [loadOrder, setLoadOrder] = useState<
    "change" | "high" | "low" | "name"
  >("change");
  const [loadAdvancedOpen, setLoadAdvancedOpen] = useState(false);
  const [loadHistoryIndex, setLoadHistoryIndex] = useState(7);
  const [playerRegisterTarget, setPlayerRegisterTarget] = useState<
    number | "match" | "wellbeing" | null
  >(null);
  const [sessions, setSessions] = useState<SessionRecord[]>(
    seedSessions() as SessionRecord[],
  );
  const [wellbeing, setWellbeing] = useState<WellbeingRecord[]>(
    seedWellbeing() as WellbeingRecord[],
  );
  const [plans, setPlans] = useState<SessionPlan[]>(seedSessionPlans());
  const [availability, setAvailability] =
    useState<AvailabilityRecord[]>(initialAvailability);
  const [matches, setMatches] = useState<MatchRecord[]>(() =>
    seedMatches(initialAvailability),
  );
  const [painRecords, setPainRecords] =
    useState<PainRecord[]>(seedPainRecords());
  const [alerts, setAlerts] = useState<AlertRecord[]>(seedAlerts());
  const [thresholds, setThresholds] = useState<Thresholds>(INITIAL_THRESHOLDS);
  const [activeAlertPlayer, setActiveAlertPlayer] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const [syncLabel, setSyncLabel] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const dirtyRef = useRef<Set<PersistDomain>>(new Set());
  const hydratingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const playerReturnRef = useRef<{ page: StaffPage; scrollY: number }>({
    page: "team",
    scrollY: 0,
  });
  const [syncTick, setSyncTick] = useState(0);
  const activeRoster = useMemo(
    () => roster.filter((player) => player.active),
    [roster],
  );
  const metrics = useMemo(
    () =>
      buildMetrics({
        calendar: CALENDAR,
        players: activeRoster,
        sessions,
        wellbeing,
        plans,
        matches,
        availability,
        thresholds,
      }),
    [activeRoster, sessions, wellbeing, plans, matches, availability, thresholds],
  );
  const rosterMetrics = useMemo(
    () =>
      buildMetrics({
        calendar: CALENDAR,
        players: roster,
        sessions,
        wellbeing,
        plans,
        matches,
        availability,
        thresholds,
      }),
    [roster, sessions, wellbeing, plans, matches, availability, thresholds],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  };
  const mapAuth = (auth: ServerAuth): AccessSession =>
    auth.role === "PLAYER"
      ? {
          role: "player",
          playerId: auth.playerId!,
          displayName: auth.displayName,
          authMethod: "PIN",
        }
      : {
          role: "staff",
          email: auth.email ?? "Staff UCAM",
          displayName: auth.displayName,
          permissionRole: auth.role,
          authMethod: auth.authMethod === "CHATGPT" ? "CHATGPT" : "DEMO_CODE",
        };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!live) return;
        if (response.ok) {
          const payload = (await response.json()) as { auth: ServerAuth };
          const next = mapAuth(payload.auth);
          setAccess(next);
          if (next.role === "player") {
            setSelectedPlayerId(next.playerId);
            setMode("player");
            setPlayerPage("home");
          } else {
            setMode("staff");
            setStaffPage("home");
          }
        }
      } catch {
      } finally {
        if (live) setAccessLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!access) return;
    let live = true;
    hydratingRef.current = true;
    setSyncLabel("idle");
    (async () => {
      try {
        const response = await fetch(`/api/data?week=${weekId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as Record<string, unknown>;
        if (!response.ok)
          throw new Error(
            String(payload.error ?? "No hemos podido cargar la jornada."),
          );
        if (!live) return;
        const playerRows = (payload.players ?? []) as Array<
          Record<string, unknown>
        >;
        const nextRoster = playerRows.map((row) => ({
          id: String(row.id),
          name: String(row.name),
          number: Number(row.shirt_number),
          position: String(row.position),
          birthDate: String(row.date_of_birth ?? ""),
          dominantFoot: String(row.dominant_foot ?? ""),
          notes: String(row.notes ?? ""),
          accessActive: Boolean(row.access_active),
          active: Boolean(row.active),
        }));
        const nextActiveRoster = nextRoster.filter((player) => player.active);
        setRoster(nextRoster);
        setRosterLoaded(true);
        if (
          nextActiveRoster.length &&
          !nextActiveRoster.some((player) => player.id === selectedPlayerId)
        )
          setSelectedPlayerId(nextActiveRoster[0].id);
        const sessionRows = (payload.sessions ?? []) as Array<
          Record<string, unknown>
        >;
        setSessions((current) => [
          ...current.filter((item) => item.weekId !== weekId),
          ...nextRoster.flatMap((player) =>
            [1, 2, 3, 4].map((session) => {
              const row = sessionRows.find(
                (entry) =>
                  Number(entry.session_number) === session &&
                  String(entry.player_id) === player.id,
              );
              return {
                key: `${weekId}-${session}-${player.id}`,
                weekId,
                session,
                playerId: player.id,
                attendance: row
                  ? (String(row.attendance_status) as Attendance)
                  : ("SIN DATO" as Attendance),
                minutes:
                  row?.actual_minutes == null
                    ? null
                    : Number(row.actual_minutes),
                rpe: row?.rpe == null ? null : Number(row.rpe),
                incident: "",
                note: String(row?.notes ?? ""),
              };
            }),
          ),
        ]);
        const wellnessRows = (payload.wellbeing ?? []) as Array<
          Record<string, unknown>
        >;
        setWellbeing((current) => [
          ...current.filter((item) => item.weekId !== weekId),
          ...nextRoster.map((player) => {
            const row = wellnessRows.find(
              (entry) => String(entry.player_id) === player.id,
            );
            return {
              weekId,
              playerId: player.id,
              sleep:
                row?.sleep_hours == null ? null : Number(row.sleep_hours),
              mood: row?.mood == null ? null : Number(row.mood),
              fatigue:
                row?.fatigue == null ? null : Number(row.fatigue),
              pain: row?.pain == null ? null : Number(row.pain),
              stress: row?.stress == null ? null : Number(row.stress),
              notes: String(row?.notes ?? ""),
            };
          }),
        ]);
        const availabilityRows = (payload.availability ?? []) as Array<
          Record<string, unknown>
        >;
        setAvailability((current) => [
          ...current.filter((item) => item.weekId !== weekId),
          ...availabilityRows.map((row) => ({
            weekId,
            playerId: String(row.player_id),
            value: String(row.availability) as Availability,
            note: String(row.note ?? ""),
          })),
        ]);
        const matchRows = (payload.matches ?? []) as Array<
          Record<string, unknown>
        >;
        const matchContext = matchRows[0];
        setMatches((current) => [
          ...current.filter((item) => item.weekId !== weekId),
          ...nextRoster.map((player) => {
            const row = matchRows.find(
              (entry) => String(entry.player_id) === player.id,
            );
            return {
              key: `${weekId}-${player.id}`,
              weekId,
              playerId: player.id,
              opponent: String(
                row?.rival ?? matchContext?.rival ?? CALENDAR[weekId - 1].opponent,
              ),
              venue: String(
                row?.venue ?? matchContext?.venue ?? "LOCAL",
              ) as "LOCAL" | "VISITANTE",
              date: String(
                row?.date ??
                  matchContext?.date ??
                  CALENDAR[weekId - 1].dates[3],
              ),
              convocation: row
                ? (String(row.squad_status) as Convocation)
                : "NO CONVOCADO",
              minutes: row?.minutes == null ? null : Number(row.minutes),
              rpe: row?.rpe == null ? null : Number(row.rpe),
              observation: row
                ? String(row.observation ?? "")
                : "__SIN_DATO__",
              compensatory: Boolean(row?.compensatory),
              compensatoryMinutes: Number(row?.compensatory_minutes ?? 0),
              compensatoryRpe:
                row?.compensatory_rpe == null
                  ? null
                  : Number(row.compensatory_rpe),
            };
          }),
        ]);
        const painRows = (payload.painRecords ?? []) as Array<
          Record<string, unknown>
        >;
        setPainRecords((current) => [
          ...current.filter((item) => item.weekId !== weekId),
          ...painRows.map((row) => ({
            id: String(row.id),
            weekId,
            playerId: String(row.player_id),
            date: String(row.date),
            zone: String(row.body_area) as PainZone,
            intensity: Number(row.intensity),
            limitation: String(row.limitation) as PainLimitation,
            note: String(row.observation ?? ""),
          })),
        ]);
        const alertRows = (payload.alerts ?? []) as Array<
          Record<string, unknown>
        >;
        setAlerts((current) => [
          ...current.filter((item) => item.weekId !== weekId),
          ...alertRows.map((row) => ({
            id: String(row.id),
            weekId,
            playerId: String(row.player_id),
            status: String(row.status) as AlertWorkflow,
            note: String(row.note ?? ""),
            updatedAt: String(row.updated_at ?? "Ahora"),
            history: [String(row.reason ?? "Señal de monitorización")],
          })),
        ]);
        const planRows = (payload.plans ?? []) as Array<
          Record<string, unknown>
        >;
        setPlans((current) =>
          current.map((item) => {
            const row = planRows.find(
              (entry) =>
                Number(entry.session_number) === item.session &&
                item.weekId === weekId,
            );
            return row
              ? {
                  ...item,
                  name: String(row.session_name),
                  date: String(row.date),
                  time: String(row.time ?? ""),
                  md: String(row.md_context ?? ""),
                  type: String(row.session_type) as SessionPlan["type"],
                  plannedDuration: Number(row.planned_duration),
                  targetRpe: Number(row.planned_rpe),
                  notes: String(row.notes ?? ""),
                  closed: String(row.status) === "CERRADA",
                }
              : item;
          }),
        );
        const thresholdRows = (payload.thresholds ?? []) as Array<
          Record<string, unknown>
        >;
        if (thresholdRows.length)
          setThresholds((current) => ({
            ...current,
            ...Object.fromEntries(
              thresholdRows.map((row) => [String(row.key), Number(row.value)]),
            ),
          }));
      } catch (error) {
        if (live) {
          setRoster([]);
          setRosterLoaded(true);
          setSyncLabel("error");
          notify(
            error instanceof Error
              ? error.message
              : "No hemos podido cargar los datos persistentes.",
          );
        }
      } finally {
        window.setTimeout(() => {
          hydratingRef.current = false;
        }, 0);
      }
    })();
    return () => {
      live = false;
    };
  }, [access, weekId, dataVersion]);

  const markDirty = (domain: PersistDomain) => {
    if (hydratingRef.current || !access) return;
    dirtyRef.current.add(domain);
    setSyncTick((value) => value + 1);
  };
  const persistedSessions: React.Dispatch<
    React.SetStateAction<SessionRecord[]>
  > = (action) => {
    setSessions(action);
    markDirty("sessions");
  };
  const persistedWellbeing: React.Dispatch<
    React.SetStateAction<WellbeingRecord[]>
  > = (action) => {
    setWellbeing(action);
    markDirty("wellbeing");
  };
  const persistedPlans: React.Dispatch<React.SetStateAction<SessionPlan[]>> = (
    action,
  ) => {
    setPlans(action);
    markDirty("plans");
  };
  const persistedMatches: React.Dispatch<
    React.SetStateAction<MatchRecord[]>
  > = (action) => {
    setMatches(action);
    markDirty("matches");
  };
  const persistedAvailability: React.Dispatch<
    React.SetStateAction<AvailabilityRecord[]>
  > = (action) => {
    setAvailability(action);
    markDirty("availability");
  };
  const persistedPain: React.Dispatch<React.SetStateAction<PainRecord[]>> = (
    action,
  ) => {
    setPainRecords(action);
    markDirty("painRecords");
  };
  const persistedAlerts: React.Dispatch<React.SetStateAction<AlertRecord[]>> = (
    action,
  ) => {
    setAlerts(action);
    markDirty("alerts");
  };
  const persistedThresholds: React.Dispatch<
    React.SetStateAction<Thresholds>
  > = (action) => {
    setThresholds(action);
    markDirty("thresholds");
  };

  useEffect(() => {
    if (!access || !dirtyRef.current.size) return;
    if (saveTimerRef.current != null)
      window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const domains = [...dirtyRef.current];
      dirtyRef.current.clear();
      const own = (row: { playerId?: string }) =>
        access.role === "staff" || row.playerId === access.playerId;
      const rowsFor = (domain: PersistDomain) =>
        domain === "sessions"
          ? sessions.filter(
              (item) =>
                item.weekId === weekId &&
                own(item) &&
                item.attendance !== "SIN DATO",
            )
          : domain === "wellbeing"
            ? wellbeing.filter((item) => item.weekId === weekId && own(item))
            : domain === "plans"
              ? plans.filter((item) => item.weekId === weekId)
              : domain === "matches"
              ? matches.filter(
                  (item) =>
                    item.weekId === weekId &&
                    own(item) &&
                    item.observation !== "__SIN_DATO__",
                )
                : domain === "availability"
                  ? availability.filter(
                      (item) => item.weekId === weekId && own(item),
                    )
                  : domain === "painRecords"
                    ? painRecords.filter(
                        (item) => item.weekId === weekId && own(item),
                      )
                    : domain === "alerts"
                      ? alerts.filter(
                          (item) => item.weekId === weekId && own(item),
                        )
                      : [thresholds];
      setSyncLabel("saving");
      Promise.all(
        domains.map(async (domain) => {
          const response = await fetch("/api/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain, weekId, rows: rowsFor(domain) }),
          });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok)
            throw new Error(
              payload.error ?? "No hemos podido guardar los cambios.",
            );
        }),
      )
        .then(() => {
          setSyncLabel("saved");
          window.setTimeout(() => setSyncLabel("idle"), 2200);
        })
        .catch((error) => {
          domains.forEach((domain) => dirtyRef.current.add(domain));
          setSyncLabel("error");
          notify(
            error instanceof Error
              ? error.message
              : "No hemos podido guardar los cambios. Inténtalo de nuevo.",
          );
        });
    }, 650);
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [syncTick]);

  const openPlayer = (id: string) => {
    if (staffPage !== "playerDetail")
      playerReturnRef.current = { page: staffPage, scrollY: window.scrollY };
    setSelectedPlayerId(id);
    setStaffPage("playerDetail");
    window.scrollTo({ top: 0 });
  };
  const returnFromPlayer = () => {
    const context = playerReturnRef.current;
    setStaffPage(context.page === "playerDetail" ? "team" : context.page);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: context.scrollY, behavior: "auto" }),
    );
  };
  const updateRosterPlayer = (updated: RosterPlayer) =>
    setRoster((current) =>
      current.map((player) => (player.id === updated.id ? updated : player)),
    );
  const goTo = (page: StaffPage) => {
    setStaffPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const loginPlayer = async (
    playerId: string,
    pin: string,
  ): Promise<LoginResult> => {
    try {
      const response = await fetch("/api/auth/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, pin }),
      });
      const payload = (await response.json()) as {
        auth?: ServerAuth;
        error?: string;
      };
      if (!response.ok || !payload.auth)
        return { error: payload.error ?? "No hemos podido identificarte." };
      setSelectedPlayerId(playerId);
      setMode("player");
      setPlayerPage("home");
      setAccess(mapAuth(payload.auth));
      window.scrollTo({ top: 0 });
      return {};
    } catch {
      return {
        error: "No hay conexión. Comprueba la red e inténtalo de nuevo.",
      };
    }
  };
  const loginStaff = async (
    email: string,
    code: string,
  ): Promise<LoginResult> => {
    try {
      const response = await fetch("/api/auth/demo-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const payload = (await response.json()) as {
        auth?: ServerAuth;
        error?: string;
      };
      if (!response.ok || !payload.auth)
        return {
          error: payload.error ?? "No hemos podido validar el permiso.",
        };
      setMode("staff");
      setStaffPage("home");
      setAccess(mapAuth(payload.auth));
      window.scrollTo({ top: 0 });
      return {};
    } catch {
      return {
        error: "No hay conexión. Comprueba la red e inténtalo de nuevo.",
      };
    }
  };
  const logout = async () => {
    if (access?.role === "staff" && access.authMethod === "CHATGPT") {
      window.location.href = "/signout-with-chatgpt?return_to=/";
      return;
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAccess(null);
      setRoster([]);
      setRosterLoaded(false);
      setActiveAlertPlayer(null);
      setToast("");
      window.scrollTo({ top: 0 });
    }
  };

  const isAdmin = access?.role === "staff" && access.permissionRole === "ADMIN";
  const signedPlayer = access?.role === "player"
    ? roster.find((item) => item.id === access.playerId)
    : undefined;
  const staffContent =
    staffPage === "home" ? (
      <TodayDashboard
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        plans={plans}
        sessions={sessions}
        matches={matches}
        painRecords={painRecords}
        alerts={alerts}
        setAlerts={persistedAlerts}
        players={activeRoster}
        goTo={goTo}
        openSession={(target) => {
          if (target) setSessionView(target);
          setSessionsTab("register");
          goTo("sessions");
        }}
        openLoad={() => {
          setAnalysisTab("load");
          goTo("analysis");
        }}
        onOpenPlayer={openPlayer}
        onOpenAlert={setActiveAlertPlayer}
      />
    ) : staffPage === "team" ? (
      <TeamWorkspace
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        activePlayers={activeRoster}
        roster={roster}
        onOpenPlayer={openPlayer}
        onPlayerUpdated={updateRosterPlayer}
        onRosterChanged={() => setDataVersion((value) => value + 1)}
        notify={notify}
        isAdmin={isAdmin}
      />
    ) : staffPage === "sessions" ? (
      <>
        <nav className="workspace-tabs" aria-label="Secciones de sesiones">
          <span>Sesiones</span>
          <button
            className={sessionsTab === "register" ? "active" : ""}
            onClick={() => setSessionsTab("register")}
          >
            Registro operativo
          </button>
          <button
            className={sessionsTab === "calendar" ? "active" : ""}
            onClick={() => setSessionsTab("calendar")}
          >
            Calendario
          </button>
        </nav>
        {sessionsTab === "register" ? (
          <RegisterView
            weekId={weekId}
            setWeekId={setWeekId}
            sessions={sessions}
            setSessions={persistedSessions}
            wellbeing={wellbeing}
            setWellbeing={persistedWellbeing}
            plans={plans}
            setPlans={persistedPlans}
            matches={matches}
            setMatches={persistedMatches}
            availability={availability}
            setAvailability={persistedAvailability}
            metrics={metrics}
            players={activeRoster}
            view={sessionView}
            setView={setSessionView}
            sessionFilter={sessionFilter}
            setSessionFilter={setSessionFilter}
            notify={notify}
            onOpenPlayer={openPlayer}
          />
        ) : (
          <CalendarView
            weekId={weekId}
            setWeekId={setWeekId}
            plans={plans}
            matches={matches}
          />
        )}
      </>
    ) : staffPage === "analysis" ? (
      <>
        <nav className="workspace-tabs" aria-label="Secciones de análisis">
          <span>Carga</span>
          <button
            className={analysisTab === "load" ? "active" : ""}
            onClick={() => setAnalysisTab("load")}
          >
            Resumen de carga
          </button>
          <button
            className={analysisTab === "evolution" ? "active" : ""}
            onClick={() => setAnalysisTab("evolution")}
          >
            Tendencias
          </button>
        </nav>
        {analysisTab === "load" ? (
          <LoadView
            weekId={weekId}
            setWeekId={setWeekId}
            metrics={metrics}
            players={activeRoster}
            playerOrder={loadOrder}
            setPlayerOrder={setLoadOrder}
            advancedOpen={loadAdvancedOpen}
            setAdvancedOpen={setLoadAdvancedOpen}
            historyIndex={loadHistoryIndex}
            setHistoryIndex={setLoadHistoryIndex}
            onOpenPlayer={openPlayer}
          />
        ) : (
          <EvolutionView
            weekId={weekId}
            setWeekId={setWeekId}
            metrics={metrics}
            players={activeRoster}
            onOpenPlayer={openPlayer}
          />
        )}
      </>
    ) : staffPage === "reports" ? (
      <ReportsView
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={metrics}
        plans={plans}
        alerts={alerts}
        selectedPlayerId={selectedPlayerId}
        setSelectedPlayerId={setSelectedPlayerId}
        onOpenPlayer={openPlayer}
        players={activeRoster}
      />
    ) : staffPage === "settings" ? (
      <SettingsView
        thresholds={thresholds}
        setThresholds={persistedThresholds}
        notify={notify}
        activePlayerCount={activeRoster.length}
      />
    ) : (
      <PlayerDetail
        playerId={selectedPlayerId}
        weekId={weekId}
        setWeekId={setWeekId}
        metrics={rosterMetrics}
        sessions={sessions}
        matches={matches}
        availability={availability}
        setAvailability={persistedAvailability}
        painRecords={painRecords}
        alerts={alerts}
        onBack={returnFromPlayer}
        onSelectPlayer={openPlayer}
        notify={notify}
        players={roster}
      />
    );
  const playerContent = !signedPlayer ? (
    <p className="empty-state">Tu jugador ya no forma parte de la plantilla activa.</p>
  ) : playerPage === "home" ? (
      <PlayerHome
        player={signedPlayer}
        weekId={weekId}
        onOpenRegister={(target) => {
          setPlayerRegisterTarget(target);
          setPlayerPage("register");
        }}
        sessions={sessions}
        plans={plans}
        matches={matches}
        metrics={metrics}
      />
    ) : playerPage === "register" ? (
      <PlayerRegister
        playerId={selectedPlayerId}
        weekId={weekId}
        sessions={sessions}
        setSessions={persistedSessions}
        plans={plans}
        wellbeing={wellbeing}
        setWellbeing={persistedWellbeing}
        matches={matches}
        setMatches={persistedMatches}
        painRecords={painRecords}
        setPainRecords={persistedPain}
        notify={notify}
        initialTarget={playerRegisterTarget}
        syncLabel={syncLabel}
      />
    ) : playerPage === "evolution" ? (
      <>
        <SectionHeader
          eyebrow={CALENDAR[weekId - 1].label}
          title="Mi evolución"
          description="Una métrica cada vez, con tu referencia personal cuando existe."
        />
        <MetricExplorer
          playerId={selectedPlayerId}
          metrics={metrics}
          weekId={weekId}
        />
      </>
    ) : (
      <PlayerReport
        weekId={weekId}
        playerId={selectedPlayerId}
        metrics={metrics}
        players={activeRoster}
      />
    );
  if (accessLoading)
    return (
      <main className="app-loading">
        <img src={UCAM_LOGO_BLUE} alt="UCAM" />
        <div className="loading-mark" />
        <strong>Preparando tu espacio seguro…</strong>
        <small>Cargando equipo, temporada y permisos</small>
      </main>
    );
  if (!access)
    return <ProductionAccessGate onPlayer={loginPlayer} onStaff={loginStaff} />;
  if (!rosterLoaded)
    return (
      <main className="app-loading">
        <img src={UCAM_LOGO_BLUE} alt="UCAM" />
        <div className="loading-mark" />
        <strong>Cargando la plantilla activa…</strong>
        <small>La interfaz se abrirá cuando exista una única fuente de datos.</small>
      </main>
    );
  if (access.role === "player" && !signedPlayer)
    return (
      <main className="app-loading roster-access-blocked">
        <img src={UCAM_LOGO_BLUE} alt="UCAM" />
        <strong>Acceso de jugador no disponible</strong>
        <small>Tu ficha no forma parte de la plantilla activa. Contacta con el Staff.</small>
        <button className="secondary-button" onClick={logout}>Cerrar sesión</button>
      </main>
    );
  const activeMetric = activeAlertPlayer
    ? metrics.get(`${weekId}-${activeAlertPlayer}`)
    : null;
  const activeAlertRosterPlayer = activeAlertPlayer
    ? activeRoster.find((player) => player.id === activeAlertPlayer)
    : null;
  return (
    <div className={`app-shell mode-${mode}`}>
      <aside className="sidebar">
        <div className="brand">
          <img
            src={UCAM_LOGO_WHITE}
            alt="UCAM Universidad Católica de Murcia"
          />
          <div>
            <strong>UCAM Performance</strong>
            <small>Juvenil B · Temporada 26/27</small>
          </div>
          <span className="environment-badge sidebar-demo">DEMO</span>
        </div>
        <nav>
          {(mode === "staff" ? STAFF_NAV : PLAYER_NAV).map((item) => (
            <button
              key={item.id}
              className={
                (
                  mode === "staff"
                    ? staffPage === item.id
                    : playerPage === item.id
                )
                  ? "active"
                  : ""
              }
              onClick={() =>
                mode === "staff"
                  ? setStaffPage(item.id as StaffPage)
                  : setPlayerPage(item.id as PlayerPage)
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            {access.role === "staff"
              ? isAdmin
                ? "AD"
                : "ST"
              : signedPlayer!.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
          </span>
          <div>
            <strong>
              {access.role === "staff"
                ? (access.displayName ?? "Staff autorizado")
                : titleCase(signedPlayer!.name)}
            </strong>
            <small>
              {access.role === "staff"
                ? isAdmin
                  ? "Administrador"
                  : "Staff"
                : "Jugador"}
            </small>
          </div>
        </div>
      </aside>
      <div className="app-column">
        <header className="topbar">
          <div className="mobile-brand">
            <img src={UCAM_LOGO_BLUE} alt="UCAM" />
            <strong>Performance</strong>
            <span className="environment-badge">DEMO</span>
          </div>
          {mode === "staff" && <GlobalSearch onOpen={openPlayer} players={activeRoster} />}
          <div className="access-session">
            <span className={`sync-indicator sync-${syncLabel}`}>
              {syncLabel === "saving"
                ? "↻ Guardando"
                : syncLabel === "saved"
                  ? "✓ Guardado"
                  : syncLabel === "error"
                    ? "! Sin guardar"
                    : "● Persistente"}
            </span>
            <span className={`access-role access-role-${access.role}`}>
              {access.role === "staff"
                ? isAdmin
                  ? "✓ Admin"
                  : "✓ Staff autorizado"
                : "♙ Jugador"}
            </span>
            <div className="access-user">
              <strong>
                {access.role === "staff"
                  ? (access.displayName ?? access.email)
                  : titleCase(signedPlayer!.name)}
              </strong>
              <small>
                {access.role === "staff"
                  ? (access.email ?? "Acceso verificado")
                  : `#${signedPlayer!.number} · ${titleCase(signedPlayer!.position)}`}
              </small>
            </div>
            <WeekSelector weekId={weekId} onChange={setWeekId} compact />
            <button className="logout-button" onClick={logout}>
              Salir <span>↗</span>
            </button>
          </div>
        </header>
        <div className="mobile-scroll-nav">
          {(mode === "staff" ? STAFF_NAV : PLAYER_NAV).map((item) => (
            <button
              key={item.id}
              className={
                (
                  mode === "staff"
                    ? staffPage === item.id
                    : playerPage === item.id
                )
                  ? "active"
                  : ""
              }
              onClick={() =>
                mode === "staff"
                  ? setStaffPage(item.id as StaffPage)
                  : setPlayerPage(item.id as PlayerPage)
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <main className="content">
          {mode === "staff" ? staffContent : playerContent}
        </main>
      </div>
      {mode === "player" && (
        <nav className="player-bottom-nav">
          {PLAYER_NAV.map((item) => (
            <button
              key={item.id}
              className={playerPage === item.id ? "active" : ""}
              onClick={() => setPlayerPage(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      )}
      {mode === "staff" && (
        <>
          <nav className="staff-bottom-nav" aria-label="Navegación principal Staff">
            {STAFF_MOBILE_NAV.map((item) => (
              <button key={item.id} className={staffPage === item.id ? "active" : ""} onClick={() => { setStaffMoreOpen(false); goTo(item.id); }}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
            <button className={staffMoreOpen || staffPage === "reports" || staffPage === "settings" ? "active" : ""} onClick={() => setStaffMoreOpen((open) => !open)} aria-expanded={staffMoreOpen}>
              <span>•••</span>Más
            </button>
          </nav>
          {staffMoreOpen && (
            <div className="staff-more-menu" role="menu">
              <button role="menuitem" onClick={() => { setStaffMoreOpen(false); goTo("reports"); }}>▤ Informes</button>
              <button role="menuitem" onClick={() => { setStaffMoreOpen(false); goTo("settings"); }}>⚙ Ajustes</button>
              <button role="menuitem" onClick={() => { setStaffMoreOpen(false); logout(); }}>↗ Salir</button>
            </div>
          )}
        </>
      )}
      {activeAlertPlayer && activeMetric && activeAlertRosterPlayer && (
        <AlertDrawer
          player={activeAlertRosterPlayer}
          playerId={activeAlertPlayer}
          weekId={weekId}
          metric={activeMetric}
          alerts={alerts}
          setAlerts={persistedAlerts}
          onClose={() => setActiveAlertPlayer(null)}
          onOpenPlayer={() => {
            setActiveAlertPlayer(null);
            openPlayer(activeAlertPlayer);
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
