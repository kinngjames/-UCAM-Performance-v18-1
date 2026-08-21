import type { Thresholds } from "./types";

export const ACTIVE_THRESHOLD_KEYS = [
  "highRpe",
  "lowSleep",
  "lowMood",
  "highFatigue",
  "relevantPain",
  "highStress",
  "criticalSleep",
  "zScore",
  "baselineWeeks",
] as const satisfies readonly (keyof Thresholds)[];

export type ActiveThresholdKey = (typeof ACTIVE_THRESHOLD_KEYS)[number];

export const DEFAULT_ACTIVE_THRESHOLDS: Thresholds = {
  highRpe: 8,
  lowSleep: 8,
  lowMood: 2,
  highFatigue: 4,
  relevantPain: 4,
  highStress: 4,
  criticalSleep: 6.5,
  zScore: 1.5,
  baselineWeeks: 8,
};

export const THRESHOLD_LIMITS: Record<
  ActiveThresholdKey,
  { min: number; max: number; integer?: boolean }
> = {
  highRpe: { min: 0.1, max: 10 },
  lowSleep: { min: 0.1, max: 16 },
  lowMood: { min: 1, max: 5 },
  highFatigue: { min: 1, max: 5 },
  relevantPain: { min: 1, max: 10 },
  highStress: { min: 1, max: 5 },
  criticalSleep: { min: 0.1, max: 16 },
  zScore: { min: 0.1, max: 10 },
  baselineWeeks: { min: 1, max: 52, integer: true },
};

export type ThresholdNormalization = {
  fallback: number;
  key: ActiveThresholdKey;
  received: unknown;
  reason: "EMPTY" | "NON_FINITE" | "OUT_OF_RANGE" | "NOT_INTEGER";
};

const isActiveThresholdKey = (key: string): key is ActiveThresholdKey =>
  (ACTIVE_THRESHOLD_KEYS as readonly string[]).includes(key);

const thresholdIssue = (
  key: ActiveThresholdKey,
  value: unknown,
): ThresholdNormalization["reason"] | null => {
  if (
    value == null ||
    (typeof value === "string" && value.trim().length === 0)
  )
    return "EMPTY";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "NON_FINITE";
  const limits = THRESHOLD_LIMITS[key];
  if (parsed < limits.min || parsed > limits.max) return "OUT_OF_RANGE";
  if (limits.integer && !Number.isInteger(parsed)) return "NOT_INTEGER";
  return null;
};

export const parseThresholdValue = (
  key: ActiveThresholdKey,
  value: unknown,
): number | null => (thresholdIssue(key, value) ? null : Number(value));

export const validateThresholdRecordForWrite = (
  source: Record<string, unknown>,
) => {
  const validated: Partial<Record<ActiveThresholdKey, number>> = {};
  for (const [rawKey, value] of Object.entries(source)) {
    if (!isActiveThresholdKey(rawKey))
      throw new Error(`THRESHOLD_UNKNOWN_KEY:${rawKey}`);
    const parsed = parseThresholdValue(rawKey, value);
    if (parsed == null)
      throw new Error(
        `THRESHOLD_INVALID_VALUE:${rawKey}:${thresholdIssue(rawKey, value)}`,
      );
    validated[rawKey] = parsed;
  }
  return validated;
};

export const normalizeThresholdRecord = (
  source: Record<string, unknown>,
  fallback: Thresholds = DEFAULT_ACTIVE_THRESHOLDS,
) => {
  const thresholds = {} as Thresholds;
  const normalizations: ThresholdNormalization[] = [];
  for (const key of ACTIVE_THRESHOLD_KEYS) {
    const hasValue = Object.hasOwn(source, key);
    const value = hasValue ? source[key] : fallback[key];
    const parsed = parseThresholdValue(key, value);
    if (parsed != null) {
      thresholds[key] = parsed;
      continue;
    }
    const fallbackValue = parseThresholdValue(key, fallback[key]);
    if (fallbackValue == null)
      throw new Error(`THRESHOLD_INVALID_FALLBACK:${key}`);
    thresholds[key] = fallbackValue;
    if (hasValue)
      normalizations.push({
        fallback: fallbackValue,
        key,
        received: value,
        reason: thresholdIssue(key, value)!,
      });
  }
  return { normalizations, thresholds };
};

export const normalizePersistedThresholdRows = (
  rows: readonly Record<string, unknown>[],
  fallback: Thresholds = DEFAULT_ACTIVE_THRESHOLDS,
) => {
  const source: Record<string, unknown> = {};
  for (const row of rows) {
    const key = String(row.key ?? "");
    if (isActiveThresholdKey(key)) source[key] = row.value;
  }
  const normalized = normalizeThresholdRecord(source, fallback);
  return {
    normalizations: normalized.normalizations,
    rows: ACTIVE_THRESHOLD_KEYS.map((key) => ({
      key,
      value: normalized.thresholds[key],
    })),
    thresholds: normalized.thresholds,
  };
};
