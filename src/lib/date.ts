import { formatInTimeZone } from "date-fns-tz";
import { env } from "@/lib/env";

const BUSINESS_DATE_FORMAT = "yyyy-MM-dd";

export function getCurrentBusinessDate(now = new Date()): string {
  return formatInTimeZone(now, env.APP_TIME_ZONE, BUSINESS_DATE_FORMAT);
}

export function getBusinessDateInTimeZone(timeZone: string, now = new Date()): string {
  return formatInTimeZone(now, timeZone, BUSINESS_DATE_FORMAT);
}

export function isPastBusinessDate(date: string, now = new Date()): boolean {
  return date < getCurrentBusinessDate(now);
}

export function formatBusinessDate(date: Date): string {
  return formatInTimeZone(date, env.APP_TIME_ZONE, "dd/MM/yyyy");
}
