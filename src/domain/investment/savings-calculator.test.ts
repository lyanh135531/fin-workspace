import { describe, expect, it } from "vitest";
import {
  calculateEarlyWithdrawalInterest,
  calculateSavingsMaturityDate,
  calculateSavingsMetrics,
} from "@/domain/investment/savings-calculator";

describe("savings-calculator", () => {
  it("computes maturity date accurately across month boundaries", () => {
    expect(calculateSavingsMaturityDate("2026-04-20", 6)).toBe("2026-10-20");
    expect(calculateSavingsMaturityDate("2026-08-31", 6)).toBe("2027-02-28");
  });

  it("calculates expected maturity interest and accrued interest on a 365-day basis", () => {
    const metrics = calculateSavingsMetrics({
      currentPrincipalAmount: "100000000",
      annualInterestRate: "5.5",
      nonTermInterestRate: "0.1",
      startDate: "2026-04-20",
      maturityDate: "2026-10-20",
      businessDate: "2026-07-20",
    });

    expect(metrics.totalDays).toBe(183);
    expect(metrics.elapsedDays).toBe(91);
    expect(metrics.remainingDays).toBe(92);
    expect(metrics.isMatured).toBe(false);
    // 100.000.000 * 5.5% * 183 / 365 = 2.757.534đ
    expect(metrics.expectedMaturityInterest).toBe("2757534");
    // 100.000.000 * 5.5% * 91 / 365 = 1.371.233đ
    expect(metrics.accruedTermInterestToDate).toBe("1371233");
  });

  it("calculates non-term interest for early partial or full withdrawal", () => {
    const interest = calculateEarlyWithdrawalInterest({
      withdrawnPrincipalAmount: "40000000",
      nonTermInterestRate: "0.2",
      startDate: "2026-05-01",
      withdrawalDate: "2026-08-09",
    });
    // 100 days * 40.000.000 * 0.2% / 365 = 21.918đ
    expect(interest.toFixed(0)).toBe("21918");
  });

  it("returns zero unpaid maturity and accrued interest when interestPayoutMode is upfront", () => {
    const metrics = calculateSavingsMetrics({
      currentPrincipalAmount: "100000000",
      annualInterestRate: "5.5",
      nonTermInterestRate: "0.1",
      interestPayoutMode: "upfront",
      startDate: "2026-04-20",
      maturityDate: "2026-10-20",
      businessDate: "2026-07-20",
    });

    expect(metrics.expectedMaturityInterest).toBe("0");
    expect(metrics.accruedTermInterestToDate).toBe("0");
    expect(metrics.expectedTotalAtMaturity).toBe("100000000");
    expect(metrics.upfrontInterestAmount).toBe("2757534");
  });
});
