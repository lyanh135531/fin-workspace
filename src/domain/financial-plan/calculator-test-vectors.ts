export type MonthlyBudgetVector = {
  name: string;
  grossResources: string;
  requiredGoalAmount: string;
  eligibleExpense: string;
  expected: {
    rawGrossBudget: string;
    allocatableGrossBudget: string;
    resourceShortfall: string;
    budgetVariance: string;
    actualGoalAmountForMonth: string;
  };
};

export type FirstMonthBudgetVector = {
  name: string;
  currentWorkspaceBalance: string;
  existingGoalAmount: string;
  approvedExpenseFromMonthStart: string;
  remainingForecastIncome: string;
  requiredGoalAmount: string;
  totalEligibleExpense: string;
  expected: {
    rawGrossBudget: string;
    allocatableGrossBudget: string;
    resourceShortfall: string;
    actualGoalAmountForMonth: string;
    totalProgressAfterClose: string;
  };
};

export type MonthlySplitVector = {
  name: string;
  targetAmount: string;
  existingGoalAmount: string;
  monthCount: number;
  expectedContributions: string[];
};

export type JarAllocationVector = {
  name: string;
  allocatableGrossBudget: string;
  percentages: Record<string, string>;
  expectedAllocations: Record<string, string>;
};

export const monthlyBudgetVectors: MonthlyBudgetVector[] = [
  {
    name: "on track with recurring expenses consuming jar budget",
    grossResources: "30000000",
    requiredGoalAmount: "10000000",
    eligibleExpense: "20000000",
    expected: {
      rawGrossBudget: "20000000",
      allocatableGrossBudget: "20000000",
      resourceShortfall: "0",
      budgetVariance: "0",
      actualGoalAmountForMonth: "10000000",
    },
  },
  {
    name: "two million overspend reduces goal progress",
    grossResources: "30000000",
    requiredGoalAmount: "10000000",
    eligibleExpense: "22000000",
    expected: {
      rawGrossBudget: "20000000",
      allocatableGrossBudget: "20000000",
      resourceShortfall: "0",
      budgetVariance: "-2000000",
      actualGoalAmountForMonth: "8000000",
    },
  },
  {
    name: "two million underspend moves the plan ahead after close",
    grossResources: "30000000",
    requiredGoalAmount: "10000000",
    eligibleExpense: "18000000",
    expected: {
      rawGrossBudget: "20000000",
      allocatableGrossBudget: "20000000",
      resourceShortfall: "0",
      budgetVariance: "2000000",
      actualGoalAmountForMonth: "12000000",
    },
  },
  {
    name: "insufficient resources create shortfall without negative allocation",
    grossResources: "8000000",
    requiredGoalAmount: "10000000",
    eligibleExpense: "0",
    expected: {
      rawGrossBudget: "-2000000",
      allocatableGrossBudget: "0",
      resourceShortfall: "2000000",
      budgetVariance: "-2000000",
      actualGoalAmountForMonth: "8000000",
    },
  },
  {
    name: "goal progress never becomes negative",
    grossResources: "10000000",
    requiredGoalAmount: "10000000",
    eligibleExpense: "15000000",
    expected: {
      rawGrossBudget: "0",
      allocatableGrossBudget: "0",
      resourceShortfall: "0",
      budgetVariance: "-15000000",
      actualGoalAmountForMonth: "0",
    },
  },
];

export const firstMonthBudgetVectors: FirstMonthBudgetVector[] = [
  {
    name: "first month uses actual workspace balance",
    currentWorkspaceBalance: "20000000",
    existingGoalAmount: "0",
    approvedExpenseFromMonthStart: "0",
    remainingForecastIncome: "0",
    requiredGoalAmount: "10000000",
    totalEligibleExpense: "0",
    expected: {
      rawGrossBudget: "10000000",
      allocatableGrossBudget: "10000000",
      resourceShortfall: "0",
      actualGoalAmountForMonth: "20000000",
      totalProgressAfterClose: "20000000",
    },
  },
  {
    name: "existing goal money is excluded from spendable balance",
    currentWorkspaceBalance: "20000000",
    existingGoalAmount: "5000000",
    approvedExpenseFromMonthStart: "2000000",
    remainingForecastIncome: "0",
    requiredGoalAmount: "9500000",
    totalEligibleExpense: "2000000",
    expected: {
      rawGrossBudget: "7500000",
      allocatableGrossBudget: "7500000",
      resourceShortfall: "0",
      actualGoalAmountForMonth: "15000000",
      totalProgressAfterClose: "20000000",
    },
  },
];

export const monthlySplitVectors: MonthlySplitVector[] = [
  {
    name: "division remainder is assigned to the final month",
    targetAmount: "100000000",
    existingGoalAmount: "0",
    monthCount: 9,
    expectedContributions: [
      "11111111",
      "11111111",
      "11111111",
      "11111111",
      "11111111",
      "11111111",
      "11111111",
      "11111111",
      "11111112",
    ],
  },
];

export const jarAllocationVectors: JarAllocationVector[] = [
  {
    name: "jar rounding remainder is assigned to essential",
    allocatableGrossBudget: "10000003",
    percentages: {
      ESSENTIAL: "55",
      RESPONSIBILITY: "10",
      DEVELOPMENT: "10",
      ENJOYMENT: "10",
      INVESTMENT: "10",
      GIVING: "5",
    },
    expectedAllocations: {
      ESSENTIAL: "5500003",
      RESPONSIBILITY: "1000000",
      DEVELOPMENT: "1000000",
      ENJOYMENT: "1000000",
      INVESTMENT: "1000000",
      GIVING: "500000",
    },
  },
];

export const crossJarVector = {
  name: "one jar may exceed while the total plan stays on track",
  allocations: {
    ESSENTIAL: "11000000",
    RESPONSIBILITY: "2000000",
    DEVELOPMENT: "2000000",
    ENJOYMENT: "2000000",
    INVESTMENT: "2000000",
    GIVING: "1000000",
  },
  expenses: {
    ESSENTIAL: "13000000",
    RESPONSIBILITY: "2000000",
    DEVELOPMENT: "2000000",
    ENJOYMENT: "0",
    INVESTMENT: "2000000",
    GIVING: "1000000",
  },
  expectedEssentialRemaining: "-2000000",
  expectedTotalRemaining: "0",
  expectedPlanCarry: "0",
} as const;
