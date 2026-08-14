export const METRICS_LOCALE = "es-ES";

export const formatSignalNumber = (value: number, decimals = 1) =>
  value.toLocaleString(METRICS_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
