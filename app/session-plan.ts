import type { SessionPlan, SessionRecord } from "../domain/metrics";

export const toActiveSessionPlan = (plan: SessionPlan): SessionPlan => ({
  key: plan.key,
  weekId: plan.weekId,
  session: plan.session,
  name: plan.name,
  date: plan.date,
  time: plan.time,
  md: plan.md,
  type: plan.type,
  plannedDuration: plan.plannedDuration,
  notes: plan.notes,
  closed: plan.closed,
});

export const applyPlannedDurationBatchDefaults = (
  records: readonly SessionRecord[],
  plan: Pick<SessionPlan, "weekId" | "session" | "plannedDuration">,
  includeEveryPlayer = false,
): SessionRecord[] =>
  records.map((record) => {
    const belongsToSession =
      record.weekId === plan.weekId && record.session === plan.session;
    if (
      !belongsToSession ||
      (!includeEveryPlayer && record.attendance !== "ENTRENÓ")
    ) {
      return record;
    }
    return {
      ...record,
      attendance: includeEveryPlayer ? "ENTRENÓ" : record.attendance,
      minutes: plan.plannedDuration,
    };
  });
