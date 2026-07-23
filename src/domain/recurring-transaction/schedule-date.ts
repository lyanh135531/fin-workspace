function parseBusinessDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Ngày nghiệp vụ không hợp lệ.");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function executionDateForMonth(year: number, month: number, dayOfMonth: number) {
  return formatDate(year, month, Math.min(dayOfMonth, daysInMonth(year, month)));
}

export function firstExecutionOnOrAfter(businessDate: string, dayOfMonth: number) {
  const { year, month } = parseBusinessDate(businessDate);
  const candidate = executionDateForMonth(year, month, dayOfMonth);
  if (candidate >= businessDate) return candidate;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return executionDateForMonth(nextYear, nextMonth, dayOfMonth);
}

export function nextMonthlyExecution(currentExecutionDate: string, dayOfMonth: number) {
  const { year, month } = parseBusinessDate(currentExecutionDate);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return executionDateForMonth(nextYear, nextMonth, dayOfMonth);
}
