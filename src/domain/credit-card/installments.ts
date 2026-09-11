import Decimal from "decimal.js";

export const INSTALLMENT_TERM_COUNTS = [3, 6, 9, 12, 18, 24] as const;
export type InstallmentTermCount = (typeof INSTALLMENT_TERM_COUNTS)[number];

function parts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Ngày nghiệp vụ không hợp lệ.");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function format(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthDay(year: number, month: number, requestedDay: number) {
  return format(year, month, Math.min(requestedDay, new Date(Date.UTC(year, month, 0)).getUTCDate()));
}

function addMonth(year: number, month: number, offset = 1) {
  const absolute = year * 12 + month - 1 + offset;
  return { year: Math.floor(absolute / 12), month: absolute % 12 + 1 };
}

export function firstStatementOnOrAfter(date: string, closingDay: number) {
  const { year, month } = parts(date);
  const candidate = monthDay(year, month, closingDay);
  if (candidate >= date) return candidate;
  const next = addMonth(year, month);
  return monthDay(next.year, next.month, closingDay);
}

export function nextStatementDate(statementDate: string, closingDay: number) {
  const { year, month } = parts(statementDate);
  const next = addMonth(year, month);
  return monthDay(next.year, next.month, closingDay);
}

export function dueDateAfterStatement(statementDate: string, dueDay: number) {
  const { year, month } = parts(statementDate);
  const sameMonth = monthDay(year, month, dueDay);
  if (sameMonth > statementDate) return sameMonth;
  const next = addMonth(year, month);
  return monthDay(next.year, next.month, dueDay);
}

export function installmentAmounts(total: Decimal.Value, count: number) {
  const principal = new Decimal(total);
  const regular = principal.div(count).toDecimalPlaces(4, Decimal.ROUND_DOWN);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? principal.minus(regular.times(count - 1)) : regular,
  );
}

