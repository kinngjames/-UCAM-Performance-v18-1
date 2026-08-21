export type Attendance =
  | "ENTRENÓ"
  | "DESCANSO"
  | "LESIONADO"
  | "AUSENTE"
  | "SIN DATO";

export type MonitoringStatus = "OK" | "VIGILAR" | "REVISAR";

export type Status = MonitoringStatus | null;

export type RecordCompleteness =
  | "COMPLETE"
  | "PARTIAL"
  | "NO_DATA"
  | "NOT_EXPECTED";

export type LoadCompleteness =
  | "COMPLETE"
  | "PARTIAL"
  | "NO_EXPOSURE"
  | "NO_DATA";

export type Availability =
  | "COMPLETO"
  | "MODIFICADO"
  | "RECUPERACIÓN"
  | "NO DISPONIBLE"
  | "AUSENTE";

export type Convocation = "TITULAR" | "SUPLENTE" | "NO CONVOCADO";

export type SessionType =
  | "Recuperación"
  | "Gimnasio"
  | "Campo"
  | "Técnico"
  | "Táctico"
  | "Físico"
  | "Compensatorio"
  | "Activación"
  | "Partido"
  | "Otro";

export type RosterPlayer = {
  id: string;
  name: string;
  number: number;
  position: string;
  birthDate: string;
  dominantFoot: string;
  notes: string;
  accessActive: boolean;
  active: boolean;
};

export type SessionRecord = {
  key: string;
  weekId: number;
  session: number;
  playerId: string;
  attendance: Attendance;
  rpe: number | null;
  minutes: number | null;
  incident: string;
  note: string;
};

export type WellbeingRecord = {
  weekId: number;
  playerId: string;
  sleep: number | null;
  mood: number | null;
  fatigue: number | null;
  pain: number | null;
  stress: number | null;
  notes: string;
};

export type Thresholds = {
  highRpe: number;
  lowSleep: number;
  lowMood: number;
  highFatigue: number;
  relevantPain: number;
  highStress: number;
  criticalSleep: number;
  zScore: number;
  baselineWeeks: number;
};

export type Signal = {
  key: string;
  label: string;
  data: string;
  reference: string;
  difference: string;
  explanation: string;
  action: string;
  severity: "watch" | "review";
};

export type AvailabilityRecord = {
  weekId: number;
  playerId: string;
  value: Availability;
  note: string;
};

export type SessionPlan = {
  key: string;
  weekId: number;
  session: number;
  name: string;
  date: string;
  time: string;
  md: string;
  type: SessionType;
  plannedDuration: number;
  notes: string;
  closed: boolean;
};

export type MatchRecord = {
  key: string;
  weekId: number;
  playerId: string;
  opponent: string;
  venue: "LOCAL" | "VISITANTE";
  date: string;
  convocation: Convocation;
  minutes: number | null;
  rpe: number | null;
  observation: string;
  compensatory: boolean;
  compensatoryMinutes: number;
  compensatoryRpe: number | null;
};

export type PlayerMetric = {
  weekId: number;
  playerId: string;
  availability: Availability;
  avgRpe: number | null;
  trainingLoad: number;
  matchLoad: number | null;
  compensatoryLoad: number | null;
  load: number;
  trainingMinutes: number;
  matchMinutes: number | null;
  minutes: number;
  sleep: number | null;
  mood: number | null;
  fatigue: number | null;
  pain: number | null;
  stress: number | null;
  trained: number;
  completed: number;
  rpeExpected: number;
  rpeCompleted: number;
  wellbeingExpected: 0 | 1;
  wellbeingDone: boolean;
  pending: number;
  recordCompleteness: RecordCompleteness;
  zRpe: number | null;
  zSleep: number | null;
  personalRpe: number | null;
  personalSleep: number | null;
  rpeRange: [number, number] | null;
  sleepRange: [number, number] | null;
  matchRpe: number | null;
  convocation: Convocation;
  status: Status;
  availabilityKnown: boolean;
  loadCompleteness: LoadCompleteness;
  expectedLoadEfforts: number;
  completedLoadEfforts: number;
  reasons: string[];
  signals: Signal[];
};

export type MetricCalendarWeek = { id: number };

export type BuildMetricsInput = {
  calendar: readonly MetricCalendarWeek[];
  players: readonly RosterPlayer[];
  sessions: readonly SessionRecord[];
  wellbeing: readonly WellbeingRecord[];
  matches: readonly MatchRecord[];
  availability: readonly AvailabilityRecord[];
  thresholds: Thresholds;
};
