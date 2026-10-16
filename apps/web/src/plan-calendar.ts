export type PlanCalendarDay = { date: string; inMonth: boolean; isToday: boolean };
const yyyyMmDd = (d: Date): string => [
  d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"),
].join("-");
/** All dates are civil local dates, not UTC timestamps. */
export function localDate(d: Date = new Date()): string { return yyyyMmDd(d); }
export function dateFromLocal(value: string): Date {
  const [y,m,d] = value.split("-").map(Number);
  const result = new Date(y,m-1,d,12,0,0);
  if (result.getFullYear()!==y || result.getMonth()!==m-1 || result.getDate()!==d) throw new Error("Invalid date");
  return result;
}
export function weekStart(value: string): string {
  const d = dateFromLocal(value);
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return localDate(d);
}
export function getMonthGrid(monthDate: string, today = localDate()): PlanCalendarDay[] {
  const first = dateFromLocal(monthDate);
  first.setDate(1);
  first.setDate(first.getDate() - ((first.getDay()+6)%7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return { date: localDate(d), inMonth: d.getMonth()===dateFromLocal(monthDate).getMonth(), isToday: localDate(d)===today };
  });
}
export function shiftMonth(monthDate: string, delta: number): string {
  const date = dateFromLocal(monthDate);
  date.setDate(1);
  date.setMonth(date.getMonth()+delta);
  return localDate(date);
}
