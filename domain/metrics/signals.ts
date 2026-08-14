import { formatSignalNumber } from "./format";
import type {
  Signal,
  Status,
  Thresholds,
  WellbeingRecord,
} from "./types";

type MetricSignalInput = {
  weekly: WellbeingRecord | undefined;
  personalSleep: number | null;
  sleepSd: number;
  thresholds: Thresholds;
  zRpe: number | null;
  avgRpe: number | null;
  personalRpe: number | null;
  pending: number;
  rpeCompleted: number;
  rpeExpected: number;
  wellbeingDone: boolean;
  trained: number;
};

const formatSignalValue = (
  value: number | null | undefined,
  decimals = 1,
) => (value == null ? "—" : formatSignalNumber(value, decimals));

export const deriveMetricSignals = ({
  weekly,
  personalSleep,
  sleepSd,
  thresholds,
  zRpe,
  avgRpe,
  personalRpe,
  pending,
  rpeCompleted,
  rpeExpected,
  wellbeingDone,
  trained,
}: MetricSignalInput) => {
  const signals: Signal[] = [];
  if (
    weekly?.sleep != null &&
    personalSleep != null &&
    weekly.sleep < personalSleep - Math.max(0.45, sleepSd)
  )
    signals.push({
      key: "sleep-personal",
      label: "Sueño inferior a su habitual",
      data: `${formatSignalValue(weekly.sleep)} h`,
      reference: `${formatSignalValue(personalSleep)} h`,
      difference: `${formatSignalValue(weekly.sleep - personalSleep)} h`,
      explanation:
        "El dato está por debajo de su rango personal de las 8 semanas anteriores.",
      action: "Comentar el contexto de descanso con el jugador.",
      severity: weekly.sleep < thresholds.criticalSleep ? "review" : "watch",
    });
  else if (weekly?.sleep != null && weekly.sleep < thresholds.lowSleep)
    signals.push({
      key: "sleep-absolute",
      label: "Sueño bajo",
      data: `${formatSignalValue(weekly.sleep)} h`,
      reference: `Umbral ${formatSignalValue(thresholds.lowSleep)} h`,
      difference: `${formatSignalValue(weekly.sleep - thresholds.lowSleep)} h`,
      explanation:
        personalSleep == null
          ? "Todavía sin referencia personal suficiente; se muestra el umbral general."
          : "Está por debajo del umbral configurado.",
      action: "Preguntar por el descanso, sin extraer conclusiones clínicas.",
      severity: "watch",
    });
  if ((weekly?.fatigue ?? 0) >= thresholds.highFatigue)
    signals.push({
      key: "fatigue",
      label: "Cansancio elevado",
      data: `${formatSignalValue(weekly?.fatigue)}/5`,
      reference: `Umbral ${thresholds.highFatigue}/5`,
      difference: `+${formatSignalValue((weekly?.fatigue ?? 0) - thresholds.highFatigue)}`,
      explanation: "Valor semanal igual o superior al umbral configurado.",
      action: "Revisar sensaciones y contexto con el jugador.",
      severity: "review",
    });
  if ((weekly?.pain ?? 0) >= thresholds.relevantPain)
    signals.push({
      key: "pain",
      label: "Dolor relevante registrado",
      data: `${formatSignalValue(weekly?.pain)}/10`,
      reference: `Umbral ${thresholds.relevantPain}/10`,
      difference: `+${formatSignalValue((weekly?.pain ?? 0) - thresholds.relevantPain)}`,
      explanation:
        "Es un dato comunicado por el jugador; no constituye un diagnóstico.",
      action: "Revisar zona, limitación y evolución.",
      severity: "review",
    });
  if (zRpe != null && zRpe >= thresholds.zScore)
    signals.push({
      key: "rpe-z",
      label: "RPE por encima de su comportamiento habitual",
      data: `${formatSignalValue(avgRpe)}/10`,
      reference: `${formatSignalValue(personalRpe)}/10`,
      difference: `z +${formatSignalValue(zRpe)}`,
      explanation: `Se desvía ${formatSignalValue(zRpe)} desviaciones respecto a sus 8 semanas anteriores.`,
      action: "Contextualizar con el contenido y la duración de las sesiones.",
      severity: "watch",
    });
  if (pending > 0)
    signals.push({
      key: "pending",
      label: "Registro incompleto",
      data: `${rpeCompleted}/${rpeExpected} RPE`,
      reference: `Bienestar ${wellbeingDone ? "completo" : "pendiente"}`,
      difference: `${pending} pendiente${pending > 1 ? "s" : ""}`,
      explanation: "Solo se cuentan los RPE de las sesiones en las que entrenó.",
      action: "Solicitar los registros que faltan.",
      severity: "info",
    });
  const review = signals.some((item) => item.severity === "review");
  const watch = signals.some((item) => item.severity === "watch");
  const status: Status = review
    ? "REVISAR"
    : pending > 0
      ? "INCOMPLETO"
      : watch
        ? "VIGILAR"
        : !trained && !weekly
          ? "SIN DATOS"
          : "OK";
  return {
    reasons: signals.map((item) => item.label),
    signals,
    status,
  };
};
