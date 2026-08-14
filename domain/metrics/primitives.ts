import type { LoadCompleteness } from "./types";

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

export const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = meanValue(values) ?? 0;
  // Population SD: this describes exactly the observed personal-history window.
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      values.length,
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
  const sd = standardDeviation(valid);
  return { mean, range: [mean - sd, mean + sd] as [number, number], sd };
};

export const zScore = (
  value: number | null | undefined,
  baseline: ReturnType<typeof personalBaseline>,
) =>
  value == null || !baseline || baseline.sd === 0
    ? null
    : (value - baseline.mean) / baseline.sd;

export const nextEwma = (
  current: number,
  previous: number | null,
  alpha = 0.4,
) => (previous == null ? current : alpha * current + (1 - alpha) * previous);

export const compliancePercent = (
  completedRpe: number,
  expectedRpe: number,
  wellnessCompleted: boolean,
) =>
  Math.round(
    ((completedRpe + (wellnessCompleted ? 1 : 0)) /
      Math.max(1, expectedRpe + 1)) *
      100,
  );

export const monotonyAndStrain = (dailyLoads: number[]) => {
  const average = meanValue(dailyLoads) ?? 0;
  const sd = standardDeviation(dailyLoads);
  const monotony = sd ? average / sd : null;
  return {
    monotony,
    strain: monotony == null ? null : weeklyLoad(dailyLoads) * monotony,
  };
};

export const round = (value: number | null, decimals = 1) =>
  value == null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;
