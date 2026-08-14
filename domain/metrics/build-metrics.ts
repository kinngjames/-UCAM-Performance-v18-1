import { BASELINE_MINIMUM, BASELINE_WINDOW } from "./constants";
import {
  classifyLoadCompleteness,
  classifyRecordCompleteness,
  loadForCompleteEffort,
  meanValue as mean,
  monotonyAndStrain,
  nextEwma,
  personalBaseline,
  registrationPending,
  round,
  standardDeviation as sd,
  wellbeingExpectedForAvailability,
  zScore,
} from "./primitives";
import { deriveMetricSignals } from "./signals";
import type {
  BuildMetricsInput,
  MetricCalendarWeek,
  PlayerMetric,
  SessionRecord,
} from "./types";

export function assertValidMetricCalendar(
  calendar: readonly MetricCalendarWeek[],
) {
  if (calendar.length === 0) {
    throw new Error("METRICS_CALENDAR_EMPTY: calendar no puede estar vacío");
  }

  const seen = new Set<number>();
  let previousId: number | null = null;
  for (const week of calendar) {
    if (!Number.isInteger(week.id) || week.id <= 0) {
      throw new Error(
        `METRICS_CALENDAR_INVALID_ID: ${String(week.id)} no es un ID válido`,
      );
    }
    if (seen.has(week.id)) {
      throw new Error(`METRICS_CALENDAR_DUPLICATE_ID: ${week.id}`);
    }
    if (previousId != null && week.id <= previousId) {
      throw new Error(
        `METRICS_CALENDAR_NOT_STRICTLY_INCREASING: ${previousId} → ${week.id}`,
      );
    }
    seen.add(week.id);
    previousId = week.id;
  }
}

export function buildMetrics({
  calendar,
  players,
  sessions,
  wellbeing,
  plans,
  matches,
  availability,
  thresholds,
}: BuildMetricsInput) {
  assertValidMetricCalendar(calendar);

  const result = new Map<string, PlayerMetric>();
  const sessionIndex = new Map<string, SessionRecord[]>();
  const wellbeingIndex = new Map<string, BuildMetricsInput["wellbeing"][number]>();
  const planIndex = new Map<string, BuildMetricsInput["plans"][number]>();
  const matchIndex = new Map<string, BuildMetricsInput["matches"][number]>();
  const availabilityIndex = new Map<
    string,
    BuildMetricsInput["availability"][number]
  >();
  for (const row of sessions) {
    const key = `${row.weekId}-${row.playerId}`;
    const bucket = sessionIndex.get(key);
    if (bucket) bucket.push(row);
    else sessionIndex.set(key, [row]);
  }
  for (const row of wellbeing)
    wellbeingIndex.set(`${row.weekId}-${row.playerId}`, row);
  for (const row of plans) planIndex.set(`${row.weekId}-${row.session}`, row);
  for (const row of matches)
    matchIndex.set(`${row.weekId}-${row.playerId}`, row);
  for (const row of availability)
    availabilityIndex.set(`${row.weekId}-${row.playerId}`, row);

  for (const player of players) {
    const history: PlayerMetric[] = [];
    let previousEwma: number | null = null;
    for (const week of calendar) {
      const indexKey = `${week.id}-${player.id}`;
      const rows = (sessionIndex.get(indexKey) ?? []).filter(
        (item) => item.attendance !== "SIN DATO",
      );
      const trained = rows.filter((item) => item.attendance === "ENTRENÓ");
      const loadRows = trained.filter(
        (
          item,
        ): item is SessionRecord & { rpe: number; minutes: number } =>
          item.rpe != null && item.minutes != null,
      );
      const weekly = wellbeingIndex.get(indexKey);
      const availabilityRecord = availabilityIndex.get(indexKey);
      const availabilityValue = availabilityRecord?.value ?? "COMPLETO";
      const match = matchIndex.get(indexKey);
      const matchKnown = Boolean(
        match && match.observation !== "__SIN_DATO__",
      );
      const trainingLoad = loadRows.reduce(
        (sum, item) => sum + loadForCompleteEffort(item.rpe, item.minutes),
        0,
      );
      const matchExpected = Boolean(
        matchKnown &&
          (match?.minutes == null
            ? match?.convocation !== "NO CONVOCADO" || match?.rpe != null
            : match.minutes > 0),
      );
      const matchLoadValue = matchExpected
        ? loadForCompleteEffort(match?.rpe, match?.minutes)
        : null;
      const compensatoryExpected = Boolean(
        matchKnown && match?.compensatory && match.compensatoryMinutes > 0,
      );
      const compensatoryLoadValue = compensatoryExpected
        ? loadForCompleteEffort(
            match?.compensatoryRpe,
            match?.compensatoryMinutes,
          )
        : null;
      const matchLoad = matchLoadValue ?? 0;
      const compensatoryLoad = compensatoryLoadValue ?? 0;
      const totalLoad = trainingLoad + matchLoad + compensatoryLoad;
      const expectedLoadEfforts =
        trained.length + Number(matchExpected) + Number(compensatoryExpected);
      const completedLoadEfforts =
        loadRows.length +
        Number(matchExpected && matchLoadValue != null) +
        Number(compensatoryExpected && compensatoryLoadValue != null);
      const explicitNoExposure =
        expectedLoadEfforts === 0 &&
        (rows.length > 0 || Boolean(availabilityRecord) || matchKnown);
      const loadCompleteness = classifyLoadCompleteness({
        expectedEfforts: expectedLoadEfforts,
        completedEfforts: completedLoadEfforts,
        explicitNoExposure,
      });
      const availabilityFactor =
        availabilityValue === "MODIFICADO"
          ? 0.68
          : availabilityValue === "RECUPERACIÓN"
            ? 0.5
            : ["NO DISPONIBLE", "AUSENTE"].includes(availabilityValue)
              ? 0
              : 1;
      const plannedTrainingLoad = Math.round(
        trained.reduce((sum, row) => {
          const plan = planIndex.get(`${week.id}-${row.session}`);
          return (
            sum +
            (plan
              ? plan.plannedDuration * plan.targetRpe * availabilityFactor
              : 0)
          );
        }, 0),
      );
      const plannedMatchLoad =
        matchKnown && match?.convocation === "TITULAR"
          ? 540
          : matchKnown && match?.convocation === "SUPLENTE"
            ? 140
            : 0;
      const previous4 = history
        .filter((item) => item.loadCompleteness === "COMPLETE")
        .slice(-4);
      const chronic = mean(previous4.map((item) => item.load));
      const ratio = chronic && chronic > 0 ? totalLoad / chronic : null;
      const ewma: number | null =
        loadCompleteness === "COMPLETE"
          ? nextEwma(totalLoad, previousEwma, 0.4)
          : null;
      if (ewma != null) previousEwma = ewma;
      const sessionLoads = [1, 2, 3, 4].map((session) =>
        loadRows
          .filter((item) => item.session === session)
          .reduce(
            (sum, item) =>
              sum + loadForCompleteEffort(item.rpe, item.minutes),
            0,
          ),
      );
      const daily = [...sessionLoads, matchLoad, compensatoryLoad, 0];
      const { monotony, strain } = monotonyAndStrain(daily);
      const avgRpe = mean(trained.map((item) => item.rpe));
      const baselineRows = history.slice(-BASELINE_WINDOW);
      const priorRpe = baselineRows
        .map((item) => item.avgRpe)
        .filter((value): value is number => value != null);
      const priorSleep = baselineRows
        .map((item) => item.sleep)
        .filter((value): value is number => value != null);
      const rpeBaseline = personalBaseline(priorRpe, BASELINE_MINIMUM);
      const sleepBaseline = personalBaseline(priorSleep, BASELINE_MINIMUM);
      const personalRpe = rpeBaseline?.mean ?? null;
      const personalSleep = sleepBaseline?.mean ?? null;
      const rpeSd = rpeBaseline?.sd ?? sd(priorRpe);
      const sleepSd = sleepBaseline?.sd ?? sd(priorSleep);
      const zRpe = zScore(avgRpe, rpeBaseline);
      const zSleep = zScore(weekly?.sleep, sleepBaseline);
      const rpeExpected = trained.length;
      const rpeCompleted = trained.filter((item) => item.rpe != null).length;
      const wellbeingDone = Boolean(
        weekly &&
          [
            weekly.sleep,
            weekly.mood,
            weekly.fatigue,
            weekly.pain,
            weekly.stress,
          ].every((value) => value != null),
      );
      const wellbeingExpected =
        wellbeingExpectedForAvailability(availabilityValue);
      const pending = registrationPending({
        rpeCompleted,
        rpeExpected,
        wellbeingDone,
        wellbeingExpected,
      });
      const recordCompleteness = classifyRecordCompleteness({
        rpeCompleted,
        rpeExpected,
        wellbeingDone,
        wellbeingExpected,
      });
      const { reasons, signals, status } = deriveMetricSignals({
        weekly,
        personalSleep,
        sleepSd,
        thresholds,
        zRpe,
        avgRpe,
        personalRpe,
        recordCompleteness,
      });
      const metric: PlayerMetric = {
        weekId: week.id,
        playerId: player.id,
        availability: availabilityValue,
        avgRpe: round(avgRpe),
        trainingLoad,
        matchLoad,
        compensatoryLoad,
        load: totalLoad,
        plannedTrainingLoad,
        plannedTotalLoad: plannedTrainingLoad + plannedMatchLoad,
        trainingMinutes:
          loadRows.reduce((sum, item) => sum + (item.minutes ?? 0), 0) +
          (matchKnown ? (match?.compensatoryMinutes ?? 0) : 0),
        matchMinutes: matchKnown ? (match?.minutes ?? null) : null,
        minutes:
          loadRows.reduce((sum, item) => sum + (item.minutes ?? 0), 0) +
          (matchKnown ? (match?.minutes ?? 0) : 0) +
          (matchKnown ? (match?.compensatoryMinutes ?? 0) : 0),
        sleep: weekly?.sleep ?? null,
        mood: weekly?.mood ?? null,
        fatigue: weekly?.fatigue ?? null,
        pain: weekly?.pain ?? null,
        stress: weekly?.stress ?? null,
        trained: trained.length,
        completed: loadRows.length,
        rpeExpected,
        rpeCompleted,
        wellbeingExpected,
        wellbeingDone,
        pending,
        recordCompleteness,
        chronic: round(chronic, 0),
        ewma: round(ewma, 0),
        ratio: round(ratio, 2),
        monotony: round(monotony, 2),
        strain: round(strain, 0),
        zRpe: round(zRpe, 2),
        zSleep: round(zSleep, 2),
        personalRpe: round(personalRpe),
        personalSleep: round(personalSleep),
        rpeRange:
          personalRpe == null
            ? null
            : [round(personalRpe - rpeSd)!, round(personalRpe + rpeSd)!],
        sleepRange:
          personalSleep == null
            ? null
            : [
                round(personalSleep - sleepSd)!,
                round(personalSleep + sleepSd)!,
              ],
        matchRpe: matchKnown ? (match?.rpe ?? null) : null,
        convocation: matchKnown
          ? (match?.convocation ?? "NO CONVOCADO")
          : "NO CONVOCADO",
        status,
        availabilityKnown: Boolean(availabilityRecord),
        loadCompleteness,
        expectedLoadEfforts,
        completedLoadEfforts,
        reasons,
        signals,
      };
      (metric as PlayerMetric & { sessions: number }).sessions =
        metric.completed;
      result.set(`${week.id}-${player.id}`, metric);
      history.push(metric);
    }
  }
  return result;
}
