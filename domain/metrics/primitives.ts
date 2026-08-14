import type {
  Availability,
  LoadCompleteness,
  RecordCompleteness,
} from "./types";

export function completeEffortProduct(rpe: number, minutes: number): number;
export function completeEffortProduct(
  rpe: number | null | undefined,
  minutes: number | null | undefined,
): number | null;
export function completeEffortProduct(
  rpe: number | null | undefined,
  minutes: number | null | undefined,
) {
  return typeof rpe === "number" &&
    Number.isFinite(rpe) &&
    typeof minutes === "number" &&
    Number.isFinite(minutes)
    ? rpe * minutes
    : null;
}

export function loadForCompleteEffort(rpe: number, minutes: number): number;
export function loadForCompleteEffort(
  rpe: number | null | undefined,
  minutes: number | null | undefined,
): number | null;
export function loadForCompleteEffort(
  rpe: number | null | undefined,
  minutes: number | null | undefined,
) {
  const product = completeEffortProduct(rpe, minutes);
  return product == null ? null : Math.round(product);
}

export const classifyLoadCompleteness = ({
  expectedEfforts,
  completedEfforts,
  explicitNoExposure,
}: {
  expectedEfforts: number;
  completedEfforts: number;
  explicitNoExposure: boolean;
}): LoadCompleteness => {
  if (expectedEfforts > 0 && completedEfforts === expectedEfforts)
    return "COMPLETE";
  if (completedEfforts > 0) return "PARTIAL";
  if (expectedEfforts === 0 && explicitNoExposure) return "NO_EXPOSURE";
  return "NO_DATA";
};

export const summarizeLoadCoverage = (states: LoadCompleteness[]) => ({
  complete: states.filter((state) => state === "COMPLETE").length,
  partial: states.filter((state) => state === "PARTIAL").length,
  noExposure: states.filter((state) => state === "NO_EXPOSURE").length,
  noData: states.filter((state) => state === "NO_DATA").length,
});

export const weeklyLoad = (loads: number[]) =>
  loads.reduce((total, value) => total + value, 0);

export const meanValue = (values: Array<number | null | undefined>) => {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
};

export const sampleStandardDeviation = (values: number[]) => {
  if (values.length < 2) return null;
  const average = meanValue(values);
  if (average == null) return null;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
};

export const personalBaseline = (
  priorValues: Array<number | null | undefined>,
  minimumRecords = 5,
) => {
  const valid = priorValues.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (valid.length < minimumRecords) return null;
  const mean = meanValue(valid)!;
  const sd = sampleStandardDeviation(valid);
  if (sd == null) return null;
  return { mean, range: [mean - sd, mean + sd] as [number, number], sd };
};

export const zScore = (
  value: number | null | undefined,
  baseline: ReturnType<typeof personalBaseline>,
) =>
  value == null || !baseline || baseline.sd === 0
    ? null
    : (value - baseline.mean) / baseline.sd;

export const wellbeingExpectedForAvailability = (
  availability: Availability,
): 0 | 1 =>
  availability === "NO DISPONIBLE" || availability === "AUSENTE" ? 0 : 1;

export const registrationPending = ({
  rpeCompleted,
  rpeExpected,
  wellbeingDone,
  wellbeingExpected,
}: {
  rpeCompleted: number;
  rpeExpected: number;
  wellbeingDone: boolean;
  wellbeingExpected: 0 | 1;
}) =>
  Math.max(0, rpeExpected - rpeCompleted) +
  (wellbeingExpected === 1 && !wellbeingDone ? 1 : 0);

export const classifyRecordCompleteness = ({
  rpeCompleted,
  rpeExpected,
  wellbeingDone,
  wellbeingExpected,
}: {
  rpeCompleted: number;
  rpeExpected: number;
  wellbeingDone: boolean;
  wellbeingExpected: 0 | 1;
}): RecordCompleteness => {
  const expected = rpeExpected + wellbeingExpected;
  const completed =
    rpeCompleted + Number(wellbeingExpected === 1 && wellbeingDone);
  if (expected === 0) return "NOT_EXPECTED";
  if (completed === expected) return "COMPLETE";
  if (completed > 0) return "PARTIAL";
  return "NO_DATA";
};

export const round = (value: number | null, decimals = 1) =>
  value == null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;
