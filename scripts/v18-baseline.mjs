import { serializeCanonicalJson, sha256Utf8 } from "./canonical-json.mjs";
import { withCurrentMetricsEngine } from "./metrics-characterization.mjs";

export const V18_BASE_COMMIT =
  "135f15a0f7a69b59e165d5fd60de64a3a0cc0b21";
export const V18_DATASET_SHA256 =
  "2d30cadd2469c1a6e4c3eef2331a92bf424795ff50826d319a2b1c57150a509b";
export const V18_HISTORICAL_GOLDEN_SHA256 =
  "990cb9139bdb32696898d0bc18bd822c7e73d30c8649fcfcc5f61d4fd8ef81fd";
export const V18_LOCALE = "es-ES";

const assertExplicitLocale = (display) => {
  const supported = Intl.NumberFormat.supportedLocalesOf([V18_LOCALE]);
  if (supported[0] !== V18_LOCALE) {
    throw new Error(
      `ENTORNO: locale ${V18_LOCALE} no disponible; no es un fallo de DOMINIO`,
    );
  }
  const contract = [
    [display(6.5), "6,5"],
    [display(12345.6), "12.345,6"],
    [display(12345.6, 2), "12.345,60"],
  ];
  for (const [actual, expected] of contract) {
    if (actual !== expected) {
      throw new Error(
        `ENTORNO: contrato Intl/display ${V18_LOCALE} inválido: ${actual}; esperado ${expected}; no es un fallo de DOMINIO`,
      );
    }
  }
};

export const assertV18DatasetSha = (actual) => {
  if (actual !== V18_DATASET_SHA256) {
    throw new Error(
      `Dataset SHA inesperado: ${actual}; esperado ${V18_DATASET_SHA256}`,
    );
  }
};

export async function buildV18Baseline() {
  return withCurrentMetricsEngine(
    async ({ buildMetrics, data, phase2, display }) => {
      assertExplicitLocale(display);
      const players = data.INITIAL_PLAYERS;
      const calendar = data.CALENDAR;
      const thresholds = data.INITIAL_THRESHOLDS;
      const sessions = phase2.seedSessions();
      const wellbeing = phase2.seedWellbeing();
      const plans = phase2.seedSessionPlans();
      const availability = phase2.seedAvailability();
      const matches = phase2.seedMatches(availability);
      const alerts = phase2.seedAlerts();
      const metricDataset = {
        availability,
        calendar,
        matches,
        plans,
        players,
        sessions,
        thresholds,
        wellbeing,
      };
      const datasetSha256 = sha256Utf8(
        serializeCanonicalJson(metricDataset),
      );
      assertV18DatasetSha(datasetSha256);

      const metricMap = buildMetrics(
        players,
        sessions,
        wellbeing,
        plans,
        matches,
        availability,
        thresholds,
      );
      const metrics = players.flatMap((player) =>
        calendar.map((week) => {
          const metric = metricMap.get(`${week.id}-${player.id}`);
          if (!metric) {
            throw new Error(
              `Falta PlayerMetric para jornada ${week.id}, jugador ${player.id}`,
            );
          }
          return metric;
        }),
      );
      const signalsPerWeek = calendar.map((week) =>
        metrics
          .filter((metric) => metric.weekId === week.id)
          .reduce((total, metric) => total + metric.signals.length, 0),
      );
      return {
        datasetSha256,
        inputs: { ...metricDataset, alerts },
        metrics,
        signalsPerWeek,
      };
    },
  );
}
