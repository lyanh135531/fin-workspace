import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { env } from "@/lib/env";

const BUSINESS_DATE_FORMAT = "yyyy-MM-dd";

export function getCurrentBusinessDate(now = new Date()): string {
  return formatInTimeZone(now, env.APP_TIME_ZONE, BUSINESS_DATE_FORMAT);
}

export function getBusinessDateInTimeZone(timeZone: string, now = new Date()): string {
  return formatInTimeZone(now, timeZone, BUSINESS_DATE_FORMAT);
}

export function shiftIsoDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function getBusinessDateRange(
  timeZone: string,
  dateFrom?: string,
  dateTo?: string,
) {
  return {
    ...(dateFrom
      ? { gte: fromZonedTime(`${dateFrom}T00:00:00`, timeZone) }
      : {}),
    ...(dateTo
      ? {
          lt: fromZonedTime(
            `${shiftIsoDate(dateTo, 1)}T00:00:00`,
            timeZone,
          ),
        }
      : {}),
  };
}

export function getBusinessNotificationRange(timeZone: string, now = new Date()) {
  const today = getBusinessDateInTimeZone(timeZone, now);
  const [year, month] = today.split("-").map(Number);
  const currentMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));
  const todayAsDatabaseDate = new Date(`${today}T00:00:00.000Z`);
  const businessDayStart = fromZonedTime(`${today}T00:00:00`, timeZone);
  const nextBusinessDayStart = fromZonedTime(`${shiftIsoDate(today, 1)}T00:00:00`, timeZone);

  return {
    today,
    currentMonthStart,
    nextMonthStart,
    todayAsDatabaseDate,
    businessDayStart,
    nextBusinessDayStart,
  };
}

export function isPastBusinessDate(date: string, now = new Date()): boolean {
  return date < getCurrentBusinessDate(now);
}

export function formatBusinessDate(date: Date): string {
  return formatInTimeZone(date, env.APP_TIME_ZONE, "dd/MM/yyyy");
}
