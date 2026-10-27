import Decimal from "decimal.js";

const ZERO = new Decimal(0);
const DAYS_IN_YEAR = new Decimal(365);
const HUNDRED = new Decimal(100);

export const POPULAR_VIETNAM_BANKS = [
  "Vietcombank",
  "Techcombank",
  "MB Bank",
  "VPBank",
  "ACB",
  "BIDV",
  "VietinBank",
  "Agribank",
  "TPBank",
  "VIB",
  "Sacombank",
  "HDBank",
  "Cake by VPBank",
  "Timo",
  "SHB",
  "SeABank",
  "OCB",
  "MSB",
  "LPBank",
  "Ngân hàng khác",
] as const;

export const SAVINGS_TERM_MONTH_OPTIONS = [
  1, 2, 3, 6, 9, 12, 13, 15, 18, 24, 36,
] as const;

export const SAVINGS_PAYOUT_MODE_LABELS: Record<
  "maturity" | "upfront" | "monthly",
  string
> = {
  maturity: "Lãi cuối kỳ",
  upfront: "Lãi đầu kỳ",
  monthly: "Lãi định kỳ hàng tháng",
};

export const SAVINGS_MATURITY_ACTION_LABELS: Record<
  "settle_to_wallet" | "renew_principal" | "renew_principal_and_interest",
  string
> = {
  settle_to_wallet: "Tất toán gốc & lãi về ví",
  renew_principal: "Tái tục gốc, nhận lãi về ví",
  renew_principal_and_interest: "Tái tục cả gốc lẫn lãi",
};

function parseIsoDateUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

export function diffDaysBetweenIsoDates(
  fromIsoDate: string,
  toIsoDate: string,
): number {
  const fromUtc = parseIsoDateUtc(fromIsoDate);
  const toUtc = parseIsoDateUtc(toIsoDate);
  const diffMs = toUtc.getTime() - fromUtc.getTime();
  return Math.round(diffMs / 86_400_000);
}

/**
 * Cộng số tháng kỳ hạn vào ngày mở sổ (`startDate` YYYY-MM-DD) chuẩn lịch ngân hàng.
 */
export function calculateSavingsMaturityDate(
  startDateIso: string,
  termMonths: number,
): string {
  const [year, month, day] = startDateIso.slice(0, 10).split("-").map(Number);
  const safeMonths = Math.max(1, Math.trunc(termMonths));
  const targetMonthIndex = month - 1 + safeMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const maxDayInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, maxDayInTargetMonth);

  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export type SavingsMetricsInput = {
  currentPrincipalAmount: Decimal.Value;
  annualInterestRate: Decimal.Value;
  nonTermInterestRate?: Decimal.Value;
  interestPayoutMode?: "maturity" | "upfront" | "monthly";
  startDate: string;
  maturityDate: string;
  businessDate: string;
};

export type SavingsMetricsResult = {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  progressPct: number;
  isMatured: boolean;
  isDueSoon: boolean;
  expectedMaturityInterest: string;
  expectedTotalAtMaturity: string;
  accruedTermInterestToDate: string;
  earlyLiquidationInterestToDate: string;
  upfrontInterestAmount: string;
};

/**
 * Tính lãi dự kiến cuối kỳ, lãi tích lũy đến hôm nay và lãi không kỳ hạn nếu rút trước hạn
 * theo chuẩn 365 ngày/năm của các ngân hàng Việt Nam.
 */
export function calculateSavingsMetrics(
  input: SavingsMetricsInput,
): SavingsMetricsResult {
  const principal = Decimal.max(
    new Decimal(input.currentPrincipalAmount || 0),
    ZERO,
  );
  const annualRate = Decimal.max(
    new Decimal(input.annualInterestRate || 0),
    ZERO,
  );
  const nonTermRate = Decimal.max(
    new Decimal(input.nonTermInterestRate ?? 0.1),
    ZERO,
  );

  const rawTotalDays = Math.max(
    1,
    diffDaysBetweenIsoDates(input.startDate, input.maturityDate),
  );
  const rawElapsedDays = diffDaysBetweenIsoDates(
    input.startDate,
    input.businessDate,
  );
  const elapsedDays = Math.min(Math.max(0, rawElapsedDays), rawTotalDays);
  const remainingDays = Math.max(
    0,
    diffDaysBetweenIsoDates(input.businessDate, input.maturityDate),
  );
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((elapsedDays / rawTotalDays) * 100)),
  );

  const fullTermInterest = principal
    .mul(annualRate)
    .div(HUNDRED)
    .mul(rawTotalDays)
    .div(DAYS_IN_YEAR)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const isUpfront = input.interestPayoutMode === "upfront";
  const expectedMaturityInterest = isUpfront ? ZERO : fullTermInterest;

  const accruedTermInterestToDate = isUpfront
    ? ZERO
    : principal
        .mul(annualRate)
        .div(HUNDRED)
        .mul(elapsedDays)
        .div(DAYS_IN_YEAR)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const actualDaysHeld = Math.max(0, rawElapsedDays);
  const earlyLiquidationInterestToDate = principal
    .mul(nonTermRate)
    .div(HUNDRED)
    .mul(actualDaysHeld)
    .div(DAYS_IN_YEAR)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const isMatured = input.businessDate.slice(0, 10) >= input.maturityDate.slice(0, 10);
  const isDueSoon = !isMatured && remainingDays >= 0 && remainingDays <= 5;

  return {
    totalDays: rawTotalDays,
    elapsedDays,
    remainingDays,
    progressPct,
    isMatured,
    isDueSoon,
    expectedMaturityInterest: expectedMaturityInterest.toFixed(0),
    expectedTotalAtMaturity: principal.plus(expectedMaturityInterest).toFixed(0),
    accruedTermInterestToDate: accruedTermInterestToDate.toFixed(0),
    earlyLiquidationInterestToDate: earlyLiquidationInterestToDate.toFixed(0),
    upfrontInterestAmount: isUpfront ? fullTermInterest.toFixed(0) : "0",
  };
}

/**
 * Tính lãi không kỳ hạn cho phần vốn gốc rút trước hạn (hỗ trợ rút gốc một phần hoặc toàn bộ).
 */
export function calculateEarlyWithdrawalInterest(params: {
  withdrawnPrincipalAmount: Decimal.Value;
  nonTermInterestRate: Decimal.Value;
  startDate: string;
  withdrawalDate: string;
}): Decimal {
  const withdrawn = Decimal.max(
    new Decimal(params.withdrawnPrincipalAmount || 0),
    ZERO,
  );
  const rate = Decimal.max(new Decimal(params.nonTermInterestRate || 0), ZERO);
  const daysHeld = Math.max(
    0,
    diffDaysBetweenIsoDates(params.startDate, params.withdrawalDate),
  );
  return withdrawn
    .mul(rate)
    .div(HUNDRED)
    .mul(daysHeld)
    .div(DAYS_IN_YEAR)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}
