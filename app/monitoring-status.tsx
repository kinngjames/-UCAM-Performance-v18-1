import type { MonitoringStatus, Status } from "../domain/metrics";

export const STATUS_META: Record<
  MonitoringStatus,
  { icon: string; label: string }
> = {
  OK: { icon: "✓", label: "OK" },
  VIGILAR: { icon: "⚠", label: "Vigilar" },
  REVISAR: { icon: "!", label: "Revisar" },
};

export const monitoringPriority = (status: Status) =>
  status === "REVISAR" ? 0 : status === "VIGILAR" ? 1 : status === "OK" ? 2 : 3;

export function StatusBadge({ status }: { status: Status }) {
  if (status === null) {
    return (
      <span className="monitoring-empty" aria-label="Monitorización sin estado">
        —
      </span>
    );
  }
  const meta = STATUS_META[status];
  return (
    <span className={`status status-${status.toLocaleLowerCase("es-ES")}`}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
