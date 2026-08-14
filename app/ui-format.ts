import { formatSignalNumber } from "../domain/metrics/format";

export const display = (value: number | null, decimals = 1) =>
  value == null ? "—" : formatSignalNumber(value, decimals);
