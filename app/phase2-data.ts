import { CALENDAR, INITIAL_PLAYERS, INITIAL_SESSIONS, INITIAL_WELLBEING } from "./data";
import type {
  Availability,
  AvailabilityRecord,
  Convocation,
  MatchRecord,
  SessionPlan,
  SessionType,
} from "../domain/metrics/types";

export type {
  Availability,
  AvailabilityRecord,
  Convocation,
  MatchRecord,
  SessionPlan,
  SessionType,
} from "../domain/metrics/types";

export const ACTIVE_WEEK_ID = 18;
export const ACTIVE_SESSION = 2;

export type AlertWorkflow = "NUEVA" | "REVISADA" | "EN SEGUIMIENTO" | "CERRADA";
export type PainZone = "Cabeza/cuello" | "Hombro" | "Espalda" | "Cadera" | "Aductor" | "Cuádriceps" | "Isquios" | "Rodilla" | "Gemelo" | "Tobillo" | "Pie" | "Otra";
export type PainLimitation = "No" | "Algo" | "Sí";

export type PainRecord = { id: string; weekId: number; playerId: string; date: string; zone: PainZone; intensity: number; limitation: PainLimitation; note: string };
export type AlertRecord = { id: string; weekId: number; playerId: string; status: AlertWorkflow; note: string; updatedAt: string; history: string[] };

// Reserved extension points for future imports. They are intentionally not rendered yet.
export const OBJECTIVE_METRIC_SCHEMA = ["distance", "highSpeedDistance", "sprints", "accelerations", "decelerations", "heartRate", "gym", "physicalTests"] as const;

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function seedAvailability(): AvailabilityRecord[] {
  return CALENDAR.flatMap((week) => INITIAL_PLAYERS.map((player) => {
    let value: Availability = "COMPLETO";
    let note = "Entrenamiento completo";
    if (player.id === "P05" && week.id >= 12 && week.id <= 14) { value = "NO DISPONIBLE"; note = "Proceso muscular; trabajo fuera de grupo"; }
    if (player.id === "P05" && week.id === 15) { value = "RECUPERACIÓN"; note = "Reincorporación progresiva"; }
    if (player.id === "P07" && week.id >= 16 && week.id <= 18) { value = "MODIFICADO"; note = "Reduce volumen de campo por molestia en isquios"; }
    if (player.id === "P07" && week.id === 19) { value = "RECUPERACIÓN"; note = "Vuelta progresiva al grupo"; }
    if (player.id === "P14" && (week.id === 18 || week.id === 27)) { value = "AUSENTE"; note = "Ausencia justificada"; }
    if (player.id === "P16" && week.id === 18) { value = "NO DISPONIBLE"; note = "Molestia de rodilla; sin trabajo de campo"; }
    if (player.id === "P16" && week.id === 28) { value = "MODIFICADO"; note = "Volumen limitado"; }
    if (player.id === "P16" && week.id === 29) { value = "RECUPERACIÓN"; note = "Retorno progresivo"; }
    if (player.id === "P12" && week.id === 18) { value = "RECUPERACIÓN"; note = "Reincorporación tras proceso leve"; }
    if (player.id === "P20" && week.id >= 35) { value = "MODIFICADO"; note = "Ajuste de volumen por fatiga acumulada"; }
    return { weekId: week.id, playerId: player.id, value, note };
  }));
}

export function seedSessions() {
  return INITIAL_SESSIONS.map((item) => {
    if (item.weekId !== ACTIVE_WEEK_ID) return { ...item };
    if (item.playerId === "P14") return { ...item, attendance: "AUSENTE", rpe: null, minutes: null };
    if (item.playerId === "P16") return { ...item, attendance: "LESIONADO", rpe: null, minutes: null };
    if (item.session === ACTIVE_SESSION && ["P12", "P18", "P20"].includes(item.playerId)) return { ...item, rpe: null };
    return { ...item };
  });
}

export function seedWellbeing() {
  return INITIAL_WELLBEING.map((item) => {
    if (item.weekId === ACTIVE_WEEK_ID && item.playerId === "P18") return { ...item, sleep: null, mood: null, fatigue: null, pain: null, stress: null, notes: "" };
    if (item.weekId === ACTIVE_WEEK_ID && item.playerId === "P20") return { ...item, stress: null };
    return { ...item };
  });
}

export function seedSessionPlans(): SessionPlan[] {
  const types: SessionType[] = ["Recuperación", "Campo", "Táctico", "Activación"];
  const names = ["Recuperación + fuerza compensatoria", "Campo · carga principal", "Táctico · modelo de juego", "Activación prepartido"];
  const md = ["MD+1", "MD-4", "MD-2", "MD-1"];
  const times = ["10:30", "18:30", "18:00", "17:30"];
  const targets = [3.5, 5, 6, 3.5];
  return CALENDAR.flatMap((week) => [1, 2, 3, 4].map((session) => ({
    key: `${week.id}-${session}`,
    weekId: week.id,
    session,
    name: names[session - 1],
    date: week.dates[session - 1],
    time: times[session - 1],
    md: md[session - 1],
    type: types[session - 1],
    plannedDuration: week.durations[session - 1] || [55, 75, 70, 45][session - 1],
    targetRpe: targets[session - 1] + (week.notes?.includes("carga alta") ? 0.5 : 0),
    notes: week.notes || (session === 2 ? "Bloque principal de la semana" : ""),
    closed: !(week.id === ACTIVE_WEEK_ID && session === ACTIVE_SESSION),
  })));
}

export function seedMatches(availability: AvailabilityRecord[]): MatchRecord[] {
  const highExposure = new Set(["P01", "P03", "P04", "P06", "P09", "P10", "P15"]);
  const lowExposure = new Set(["P08", "P16", "P18"]);
  const records: MatchRecord[] = [];
  for (const week of CALENDAR) {
    const available = INITIAL_PLAYERS.filter((player) => !["NO DISPONIBLE", "AUSENTE"].includes(availability.find((item) => item.weekId === week.id && item.playerId === player.id)?.value ?? "COMPLETO"));
    const ranked = available.map((player) => {
      let score = highExposure.has(player.id) ? 100 : lowExposure.has(player.id) ? 35 : 68;
      score += (week.id * 7 + player.number * 11) % 24;
      if (player.id === "P20" && week.id >= 34) score = 112;
      if (player.id === "P05" && week.id === 15) score = 45;
      return { player, score };
    }).sort((a, b) => b.score - a.score);
    const starters = new Set(ranked.slice(0, 11).map((item) => item.player.id));
    const squad = new Set(ranked.slice(0, 18).map((item) => item.player.id));
    for (const player of INITIAL_PLAYERS) {
      const availabilityValue = availability.find((item) => item.weekId === week.id && item.playerId === player.id)?.value ?? "COMPLETO";
      let convocation: Convocation = starters.has(player.id) ? "TITULAR" : squad.has(player.id) ? "SUPLENTE" : "NO CONVOCADO";
      if (["NO DISPONIBLE", "AUSENTE"].includes(availabilityValue)) convocation = "NO CONVOCADO";
      let minutes = convocation === "TITULAR" ? 68 + ((week.id + player.number * 3) % 23) : convocation === "SUPLENTE" ? 8 + ((week.id * 3 + player.number) % 28) : 0;
      if (week.id <= 4 && minutes > 0) minutes = 35 + ((week.id + player.number) % 26);
      if (player.id === "P20" && week.id >= 35) minutes = 78 + (week.id % 12);
      const rpe = minutes > 0 ? Math.round((4.3 + minutes / 45 + ((player.number + week.id) % 5) * 0.12) * 10) / 10 : null;
      const compensatory = convocation === "SUPLENTE" && minutes < 30;
      records.push({
        key: `${week.id}-${player.id}`,
        weekId: week.id,
        playerId: player.id,
        opponent: week.opponent || "Partido de preparación",
        venue: week.id % 2 === 0 ? "LOCAL" : "VISITANTE",
        date: addDays(week.dates[3], 1),
        convocation,
        minutes,
        rpe,
        observation: player.id === "P08" && compensatory ? "Baja exposición competitiva" : "",
        compensatory,
        compensatoryMinutes: compensatory ? 28 + ((week.id + player.number) % 8) : 0,
        compensatoryRpe: compensatory ? 4 : null,
      });
    }
  }
  return records;
}

export function seedPainRecords(): PainRecord[] {
  const fromWeek = (id: string, weekId: number, playerId: string, zone: PainZone, intensity: number, limitation: PainLimitation, note: string): PainRecord => ({ id, weekId, playerId, date: CALENDAR[weekId - 1].dates[0], zone, intensity, limitation, note });
  return [
    fromWeek("pain-1", 12, "P05", "Isquios", 5, "Sí", "Aparece después de la sesión principal"),
    fromWeek("pain-2", 13, "P05", "Isquios", 6, "Sí", "Trabajo fuera de grupo"),
    fromWeek("pain-3", 14, "P05", "Isquios", 4, "Algo", "Evolución favorable"),
    fromWeek("pain-4", 16, "P07", "Isquios", 3, "Algo", "Molestia al acelerar"),
    fromWeek("pain-5", 17, "P07", "Isquios", 4, "Algo", "Reduce volumen"),
    fromWeek("pain-6", 18, "P07", "Isquios", 5, "Algo", "Entrenamiento modificado"),
    fromWeek("pain-7", 19, "P07", "Isquios", 2, "No", "Reincorporación progresiva"),
    fromWeek("pain-8", 28, "P16", "Rodilla", 3, "Algo", "Molestia anterior tras campo"),
    fromWeek("pain-9", 29, "P16", "Rodilla", 2, "No", "Retorno progresivo"),
    fromWeek("pain-10", 35, "P20", "Aductor", 2, "No", "Rigidez postpartido"),
    fromWeek("pain-11", 37, "P20", "Aductor", 3, "Algo", "Se limita el volumen"),
    fromWeek("pain-12", 38, "P20", "Aductor", 4, "Algo", "Seguimiento por el staff"),
  ];
}

export function seedAlerts(): AlertRecord[] {
  return [
    { id: "alert-p07-18", weekId: 18, playerId: "P07", status: "NUEVA", note: "", updatedAt: "Hoy · 09:10", history: ["Señal creada: dolor recurrente y carga modificada"] },
    { id: "alert-p12-18", weekId: 18, playerId: "P12", status: "EN SEGUIMIENTO", note: "Reincorporación progresiva. Entrena parte inicial con grupo.", updatedAt: "Hoy · 08:45", history: ["Revisada por el staff", "Pasa a seguimiento"] },
    { id: "alert-p18-18", weekId: 18, playerId: "P18", status: "NUEVA", note: "", updatedAt: "Hoy · 09:15", history: ["Señal creada: bienestar semanal pendiente"] },
    { id: "alert-p05-15", weekId: 15, playerId: "P05", status: "CERRADA", note: "Completa la readaptación y vuelve al grupo.", updatedAt: "J11 · viernes", history: ["Lesión registrada", "Pasa a recuperación", "Cerrada: regreso completo"] },
  ];
}
