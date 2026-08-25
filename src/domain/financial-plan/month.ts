export function normalizeMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Tháng phải có định dạng YYYY-MM.");
  return value;
}

export function monthToDatabaseDate(month: string) {
  return new Date(`${normalizeMonth(month)}-01T00:00:00.000Z`);
}

export function databaseDateToMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function addMonths(month: string, amount: number) {
  if (!Number.isInteger(amount)) throw new Error("Khoảng tháng phải là số nguyên.");
  const [year, monthNumber] = normalizeMonth(month).split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

export function monthsInclusive(startMonth: string, targetMonth: string) {
  const start = normalizeMonth(startMonth);
  const target = normalizeMonth(targetMonth);
  if (target < start) throw new Error("Tháng mục tiêu không được trước tháng bắt đầu.");
  const result: string[] = [];
  for (let month = start; month <= target; month = addMonths(month, 1)) result.push(month);
  return result;
}

export function monthDateRange(month: string) {
  return { start: monthToDatabaseDate(month), end: monthToDatabaseDate(addMonths(month, 1)) };
}
