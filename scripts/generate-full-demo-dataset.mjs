import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const OUTPUT_PATH = resolve("src/data/sample-datasets/full-demo.vi-VN.v1.json");
const SEED = 20251101;
const GENERATED_AT = "2026-07-31T23:59:59+07:00";
const WORKSPACE_REF = "workspace-family-demo";

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(SEED);
const pick = (values) => values[Math.floor(random() * values.length)];
const pad = (value) => String(value).padStart(2, "0");
const amountBetween = (minimum, maximum, step = 10_000) => {
  const steps = Math.floor((maximum - minimum) / step);
  return String(minimum + Math.floor(random() * (steps + 1)) * step);
};

const months = [
  [2025, 11],
  [2025, 12],
  [2026, 1],
  [2026, 2],
  [2026, 3],
  [2026, 4],
  [2026, 5],
  [2026, 6],
  [2026, 7],
];

const users = [
  {
    ref: "user-owner",
    source: "currentUser",
    displayName: "Minh",
    status: "active",
  },
  {
    ref: "user-lan",
    source: "synthetic",
    displayName: "Lan",
    usernameTemplate: "demo_lan_{installationId}",
    passwordStrategy: "random-unrecoverable",
    status: "active",
  },
  {
    ref: "user-guest-pending",
    source: "synthetic",
    displayName: "Hà",
    usernameTemplate: "demo_ha_{installationId}",
    passwordStrategy: "random-unrecoverable",
    status: "active",
  },
  {
    ref: "user-guest-rejected",
    source: "synthetic",
    displayName: "Tuấn",
    usernameTemplate: "demo_tuan_{installationId}",
    passwordStrategy: "random-unrecoverable",
    status: "active",
  },
];

const workspace = {
  ref: WORKSPACE_REF,
  name: "Tài chính gia đình mẫu",
  description: "Dữ liệu mô phỏng hoạt động tài chính của gia đình hai thành viên từ tháng 11/2025.",
  status: "active",
  baseCurrency: "VND",
  timeZone: "Asia/Ho_Chi_Minh",
  inviteCodeStrategy: "generate",
};

const members = [
  {
    ref: "member-minh",
    workspace: WORKSPACE_REF,
    user: "user-owner",
    role: "ADMIN",
    status: "active",
    joinedAt: "2025-10-28T09:00:00+07:00",
  },
  {
    ref: "member-lan",
    workspace: WORKSPACE_REF,
    user: "user-lan",
    role: "MEMBER",
    status: "active",
    joinedAt: "2025-11-01T10:30:00+07:00",
  },
];

const wallets = [
  {
    ref: "wallet-bank-minh",
    name: "Tài khoản nhận lương của Minh",
    description: "Tài khoản cá nhân dùng nhận lương và thanh toán chi phí của Minh.",
    openingBalance: "20000000",
    status: "active",
  },
  {
    ref: "wallet-bank-lan",
    name: "Tài khoản nhận lương của Lan",
    description: "Tài khoản cá nhân dùng nhận lương và thanh toán chi phí của Lan.",
    openingBalance: "15000000",
    status: "active",
  },
  {
    ref: "wallet-cash-minh",
    name: "Tiền mặt của Minh",
    description: "Tiền mặt dùng cho các khoản chi nhỏ hằng ngày.",
    openingBalance: "3000000",
    status: "active",
  },
  {
    ref: "wallet-cash-lan",
    name: "Tiền mặt của Lan",
    description: "Tiền mặt dùng cho chợ, di chuyển và chi tiêu cá nhân.",
    openingBalance: "2500000",
    status: "active",
  },
  {
    ref: "wallet-household",
    name: "Quỹ chi tiêu gia đình",
    description: "Tài khoản chung dùng cho nhà ở, ăn uống, con cái và hóa đơn.",
    openingBalance: "10000000",
    status: "active",
  },
  {
    ref: "wallet-savings",
    name: "Quỹ tiết kiệm dài hạn",
    description: "Khoản dự phòng khẩn cấp và tiết kiệm mục tiêu của gia đình.",
    openingBalance: "100000000",
    status: "active",
  },
  {
    ref: "wallet-credit-card",
    name: "Thẻ tín dụng gia đình",
    description: "Dư nợ thẻ dùng cho mua sắm, y tế và các khoản thanh toán trực tuyến.",
    openingBalance: "-5000000",
    status: "active",
  },
];

const workspaceWallets = wallets.map((wallet) => ({
  workspace: WORKSPACE_REF,
  wallet: wallet.ref,
}));

const workspaceCategories = [
  ["category-income", "Thu nhập", "INCOME", "#16A34A", "income", "wallet", null, 10],
  ["category-salary", "Lương", "INCOME_SALARY", "#22C55E", "income", "money", "category-income", 11],
  ["category-bonus", "Thưởng", "INCOME_BONUS", "#4ADE80", "income", "gift", "category-income", 12],
  ["category-other-income", "Thu nhập phụ", "INCOME_OTHER", "#10B981", "income", "plus", "category-income", 13],
  ["category-essential", "Chi phí thiết yếu", "EXPENSE_ESSENTIAL", "#F97316", "expense", "home", null, 20],
  ["category-housing", "Nhà ở", "EXPENSE_HOUSING", "#EA580C", "expense", "home", "category-essential", 21],
  ["category-utilities", "Hóa đơn & tiện ích", "EXPENSE_UTILITIES", "#0EA5E9", "expense", "service", "category-essential", 22],
  ["category-groceries", "Đi chợ & nhu yếu phẩm", "EXPENSE_GROCERIES", "#84CC16", "expense", "shopping", "category-essential", 23],
  ["category-food", "Ăn uống", "EXPENSE_FOOD", "#F59E0B", "expense", "utensils", "category-essential", 24],
  ["category-transport", "Di chuyển", "EXPENSE_TRANSPORTATION", "#8B5CF6", "expense", "car", "category-essential", 25],
  ["category-health", "Y tế & sức khỏe", "EXPENSE_HEALTH", "#EF4444", "expense", "heart", "category-essential", 26],
  ["category-insurance", "Bảo hiểm", "EXPENSE_INSURANCE", "#06B6D4", "expense", "shield", "category-essential", 27],
  ["category-family", "Gia đình & phát triển", "EXPENSE_FAMILY", "#14B8A6", "expense", "users", null, 30],
  ["category-childcare", "Con cái", "EXPENSE_CHILDCARE", "#2DD4BF", "expense", "baby", "category-family", 31],
  ["category-education", "Giáo dục", "EXPENSE_EDUCATION", "#0D9488", "expense", "education", "category-family", 32],
  ["category-gifts", "Quà tặng & đối ngoại", "EXPENSE_GIFTS", "#F43F5E", "expense", "gift", "category-family", 33],
  ["category-lifestyle", "Phong cách sống", "EXPENSE_LIFESTYLE", "#A855F7", "expense", "sparkles", null, 40],
  ["category-entertainment", "Giải trí", "EXPENSE_ENTERTAINMENT", "#9333EA", "expense", "entertainment", "category-lifestyle", 41],
  ["category-personal", "Chi tiêu cá nhân", "EXPENSE_PERSONAL", "#EC4899", "expense", "shopping", "category-lifestyle", 42],
  ["category-travel", "Du lịch", "EXPENSE_TRAVEL", "#3B82F6", "expense", "plane", "category-lifestyle", 43],
  ["category-financial", "Chi phí tài chính", "EXPENSE_FINANCIAL", "#64748B", "expense", "landmark", null, 50],
  ["category-fees", "Phí ngân hàng", "EXPENSE_FEES", "#475569", "expense", "receipt", "category-financial", 51],
].map(([ref, name, code, color, type, icon, parent, sortOrder]) => ({
  ref,
  scope: "workspace",
  workspace: WORKSPACE_REF,
  name,
  code,
  color,
  type,
  icon,
  parent,
  sortOrder,
  status: "active",
}));

const userTemplateCategories = [
  ["template-minh-coffee", "user-owner", "Cà phê làm việc", "MINH_COFFEE", "#92400E", "expense", "coffee", 10],
  ["template-minh-tech", "user-owner", "Thiết bị công nghệ", "MINH_TECH", "#334155", "expense", "laptop", 20],
  ["template-minh-freelance", "user-owner", "Thu nhập freelance", "MINH_FREELANCE", "#059669", "income", "briefcase", 30],
  ["template-minh-sport", "user-owner", "Thể thao", "MINH_SPORT", "#2563EB", "expense", "activity", 40],
  ["template-lan-beauty", "user-lan", "Chăm sóc cá nhân", "LAN_BEAUTY", "#DB2777", "expense", "sparkles", 10],
  ["template-lan-books", "user-lan", "Sách & học tập", "LAN_BOOKS", "#7C3AED", "expense", "book", 20],
  ["template-lan-side-income", "user-lan", "Thu nhập bán hàng", "LAN_SIDE_INCOME", "#16A34A", "income", "store", 30],
  ["template-lan-family", "user-lan", "Chăm sóc gia đình", "LAN_FAMILY", "#E11D48", "expense", "heart", 40],
].map(([ref, user, name, code, color, type, icon, sortOrder]) => ({
  ref,
  scope: "user",
  user,
  name,
  code,
  color,
  type,
  icon,
  parent: null,
  sortOrder,
  status: "active",
}));

const categories = [...workspaceCategories, ...userTemplateCategories];

const recurringTransactions = [
  {
    ref: "recurring-minh-salary",
    workspace: WORKSPACE_REF,
    createdByMember: "member-minh",
    wallet: "wallet-bank-minh",
    category: "category-salary",
    type: "income",
    amount: "32000000",
    description: "Lương hàng tháng của Minh",
    dayOfMonth: 5,
    startDate: "2025-11-05",
    endDate: null,
    nextExecutionDate: "2026-08-05",
    status: "active",
  },
  {
    ref: "recurring-minh-household-fund",
    workspace: WORKSPACE_REF,
    createdByMember: "member-minh",
    wallet: "wallet-bank-minh",
    toWallet: "wallet-household",
    category: null,
    type: "transfer",
    amount: "12000000",
    description: "Đóng góp của Minh vào quỹ chi tiêu gia đình",
    dayOfMonth: 8,
    startDate: "2025-11-08",
    endDate: null,
    nextExecutionDate: "2026-08-08",
    status: "active",
  },
  {
    ref: "recurring-minh-housing",
    workspace: WORKSPACE_REF,
    createdByMember: "member-minh",
    wallet: "wallet-household",
    category: "category-housing",
    type: "expense",
    amount: "8500000",
    description: "Tiền nhà hàng tháng",
    dayOfMonth: 10,
    startDate: "2025-11-10",
    endDate: null,
    nextExecutionDate: "2026-08-10",
    status: "active",
  },
  {
    ref: "recurring-lan-salary",
    workspace: WORKSPACE_REF,
    createdByMember: "member-lan",
    wallet: "wallet-bank-lan",
    category: "category-salary",
    type: "income",
    amount: "27500000",
    description: "Lương hàng tháng của Lan",
    dayOfMonth: 7,
    startDate: "2025-11-07",
    endDate: null,
    nextExecutionDate: "2026-08-07",
    status: "active",
  },
  {
    ref: "recurring-lan-household-fund",
    workspace: WORKSPACE_REF,
    createdByMember: "member-lan",
    wallet: "wallet-bank-lan",
    toWallet: "wallet-household",
    category: null,
    type: "transfer",
    amount: "8000000",
    description: "Đóng góp vào quỹ chi tiêu gia đình",
    dayOfMonth: 9,
    startDate: "2025-11-09",
    endDate: null,
    nextExecutionDate: "2026-08-09",
    status: "active",
  },
  {
    ref: "recurring-lan-utilities",
    workspace: WORKSPACE_REF,
    createdByMember: "member-lan",
    wallet: "wallet-household",
    category: "category-utilities",
    type: "expense",
    amount: "2200000",
    description: "Điện, nước, Internet và dịch vụ gia đình",
    dayOfMonth: 15,
    startDate: "2025-11-15",
    endDate: null,
    nextExecutionDate: "2026-08-15",
    status: "active",
  },
];

const expenseProfiles = {
  "member-minh": [
    ["category-food", ["wallet-cash-minh", "wallet-credit-card"], 90_000, 550_000, "Ăn trưa và cà phê"],
    ["category-transport", ["wallet-cash-minh", "wallet-bank-minh"], 70_000, 450_000, "Xăng xe và di chuyển"],
    ["category-health", ["wallet-bank-minh", "wallet-credit-card"], 250_000, 1_800_000, "Khám sức khỏe hoặc mua thuốc"],
    ["category-groceries", ["wallet-household", "wallet-credit-card"], 350_000, 1_600_000, "Mua thực phẩm và nhu yếu phẩm"],
    ["category-entertainment", ["wallet-credit-card", "wallet-bank-minh"], 150_000, 1_200_000, "Giải trí cuối tuần"],
    ["category-personal", ["wallet-bank-minh", "wallet-credit-card"], 180_000, 1_500_000, "Chi tiêu cá nhân của Minh"],
    ["category-childcare", ["wallet-household", "wallet-credit-card"], 400_000, 2_000_000, "Chi phí chăm sóc con"],
    ["category-fees", ["wallet-bank-minh"], 20_000, 180_000, "Phí dịch vụ ngân hàng"],
  ],
  "member-lan": [
    ["category-groceries", ["wallet-household", "wallet-cash-lan"], 300_000, 1_700_000, "Đi chợ và mua nhu yếu phẩm"],
    ["category-food", ["wallet-cash-lan", "wallet-credit-card"], 80_000, 500_000, "Ăn uống ngoài gia đình"],
    ["category-transport", ["wallet-cash-lan", "wallet-bank-lan"], 60_000, 400_000, "Di chuyển và gửi xe"],
    ["category-education", ["wallet-household", "wallet-bank-lan"], 250_000, 2_200_000, "Sách và học phí"],
    ["category-gifts", ["wallet-bank-lan", "wallet-credit-card"], 200_000, 1_800_000, "Quà tặng và đối ngoại"],
    ["category-personal", ["wallet-bank-lan", "wallet-credit-card"], 150_000, 1_600_000, "Chăm sóc và chi tiêu cá nhân của Lan"],
    ["category-childcare", ["wallet-household", "wallet-credit-card"], 350_000, 2_300_000, "Đồ dùng và hoạt động cho con"],
    ["category-insurance", ["wallet-bank-lan", "wallet-household"], 500_000, 2_500_000, "Bảo hiểm gia đình"],
  ],
};

const transactions = [];

function addRecurringOccurrence({ year, month, member, wallet, toWallet = null, category = null, type, amount, day, description, recurringTransaction }) {
  const period = `${year}-${pad(month)}`;
  transactions.push({
    ref: `transaction-${period}-${recurringTransaction.replace("recurring-", "")}`,
    member,
    wallet,
    toWallet,
    category,
    type,
    workflowStatus: "approved",
    amount,
    description,
    date: `${period}-${pad(day)}`,
    recurringTransaction,
    recurringPeriod: period,
  });
}

function addVariableTransactions(year, month, monthIndex, member) {
  const period = `${year}-${pad(month)}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isMinh = member === "member-minh";
  const memberSlug = isMinh ? "minh" : "lan";
  const minhTransferPlans = [
    { toWallet: "wallet-cash-minh", amount: amountBetween(2_000_000, 4_500_000, 100_000), description: "Rút tiền mặt cho chi tiêu cá nhân" },
    { toWallet: "wallet-credit-card", amount: amountBetween(8_000_000, 12_000_000, 100_000), description: "Thanh toán dư nợ thẻ tín dụng" },
    { toWallet: "wallet-savings", amount: amountBetween(3_000_000, 6_000_000, 100_000), description: "Bổ sung quỹ tiết kiệm dài hạn" },
  ];
  const lanTransferPlans = [
    { toWallet: "wallet-cash-lan", amount: amountBetween(2_000_000, 4_000_000, 100_000), description: "Rút tiền mặt cho chi tiêu cá nhân" },
    { toWallet: "wallet-savings", amount: amountBetween(1_500_000, 3_500_000, 100_000), description: "Bổ sung quỹ dự phòng gia đình" },
    { toWallet: "wallet-cash-lan", amount: amountBetween(2_000_000, 4_000_000, 100_000), description: "Rút tiền mặt cho chi tiêu cá nhân" },
  ];
  const transferPlan = isMinh
    ? minhTransferPlans[monthIndex % minhTransferPlans.length]
    : lanTransferPlans[monthIndex % lanTransferPlans.length];

  transactions.push({
    ref: `transaction-${period}-${memberSlug}-variable-01`,
    member,
    wallet: isMinh ? "wallet-bank-minh" : "wallet-bank-lan",
    toWallet: transferPlan.toWallet,
    category: null,
    type: "transfer",
    workflowStatus: "approved",
    amount: transferPlan.amount,
    description: transferPlan.description,
    date: `${period}-${pad(2 + Math.floor(random() * Math.min(20, lastDay - 2)))}`,
    recurringTransaction: null,
    recurringPeriod: null,
  });

  transactions.push({
    ref: `transaction-${period}-${memberSlug}-variable-02`,
    member,
    wallet: isMinh ? "wallet-bank-minh" : "wallet-bank-lan",
    toWallet: null,
    category: monthIndex % 3 === 0 ? "category-bonus" : "category-other-income",
    type: "income",
    workflowStatus: "approved",
    amount: amountBetween(500_000, 3_500_000, 50_000),
    description: monthIndex % 3 === 0 ? "Thưởng hoặc khoản thu bổ sung" : "Hoàn tiền và thu nhập phụ",
    date: `${period}-${pad(3 + Math.floor(random() * Math.min(22, lastDay - 3)))}`,
    recurringTransaction: null,
    recurringPeriod: null,
  });

  for (let slot = 2; slot < 12; slot += 1) {
    const [category, walletOptions, minimum, maximum, description] = pick(expenseProfiles[member]);
    let workflowStatus = "approved";
    if (monthIndex === months.length - 1 && slot === 11) workflowStatus = "pending";
    if (member === "member-lan" && monthIndex % 3 === 1 && slot === 10) workflowStatus = "rejected";

    transactions.push({
      ref: `transaction-${period}-${memberSlug}-variable-${pad(slot + 1)}`,
      member,
      wallet: pick(walletOptions),
      toWallet: null,
      category,
      type: "expense",
      workflowStatus,
      amount: amountBetween(minimum, maximum),
      description,
      date: `${period}-${pad(1 + Math.floor(random() * lastDay))}`,
      recurringTransaction: null,
      recurringPeriod: null,
    });
  }
}

for (const [monthIndex, [year, month]] of months.entries()) {
  addRecurringOccurrence({ year, month, member: "member-minh", wallet: "wallet-bank-minh", category: "category-salary", type: "income", amount: "32000000", day: 5, description: "Lương hàng tháng của Minh", recurringTransaction: "recurring-minh-salary" });
  addRecurringOccurrence({ year, month, member: "member-minh", wallet: "wallet-bank-minh", toWallet: "wallet-household", type: "transfer", amount: "12000000", day: 8, description: "Đóng góp của Minh vào quỹ chi tiêu gia đình", recurringTransaction: "recurring-minh-household-fund" });
  addRecurringOccurrence({ year, month, member: "member-minh", wallet: "wallet-household", category: "category-housing", type: "expense", amount: "8500000", day: 10, description: "Tiền nhà hàng tháng", recurringTransaction: "recurring-minh-housing" });
  addRecurringOccurrence({ year, month, member: "member-lan", wallet: "wallet-bank-lan", category: "category-salary", type: "income", amount: "27500000", day: 7, description: "Lương hàng tháng của Lan", recurringTransaction: "recurring-lan-salary" });
  addRecurringOccurrence({ year, month, member: "member-lan", wallet: "wallet-bank-lan", toWallet: "wallet-household", type: "transfer", amount: "8000000", day: 9, description: "Đóng góp vào quỹ chi tiêu gia đình", recurringTransaction: "recurring-lan-household-fund" });
  addRecurringOccurrence({ year, month, member: "member-lan", wallet: "wallet-household", category: "category-utilities", type: "expense", amount: "2200000", day: 15, description: "Điện, nước, Internet và dịch vụ gia đình", recurringTransaction: "recurring-lan-utilities" });
  addVariableTransactions(year, month, monthIndex, "member-minh");
  addVariableTransactions(year, month, monthIndex, "member-lan");
}

transactions.push(
  {
    ref: "transaction-future-2026-08-family-trip",
    member: "member-minh",
    wallet: "wallet-savings",
    toWallet: null,
    category: "category-travel",
    type: "expense",
    workflowStatus: "scheduled",
    amount: "12000000",
    description: "Chi phí chuyến đi gia đình dự kiến",
    date: "2026-08-02",
    recurringTransaction: null,
    recurringPeriod: null,
  },
  {
    ref: "transaction-future-2026-08-freelance",
    member: "member-minh",
    wallet: "wallet-bank-minh",
    toWallet: null,
    category: "category-other-income",
    type: "income",
    workflowStatus: "scheduled",
    amount: "6500000",
    description: "Khoản thanh toán freelance dự kiến",
    date: "2026-08-18",
    recurringTransaction: null,
    recurringPeriod: null,
  },
  {
    ref: "transaction-future-2026-09-savings",
    member: "member-minh",
    wallet: "wallet-bank-minh",
    toWallet: "wallet-savings",
    category: null,
    type: "transfer",
    workflowStatus: "scheduled",
    amount: "3000000",
    description: "Bổ sung tiết kiệm sau thưởng",
    date: "2026-09-02",
    recurringTransaction: null,
    recurringPeriod: null,
  },
  {
    ref: "transaction-future-2026-08-tuition",
    member: "member-lan",
    wallet: "wallet-household",
    toWallet: null,
    category: "category-education",
    type: "expense",
    workflowStatus: "scheduled",
    amount: "4500000",
    description: "Học phí đầu năm học",
    date: "2026-08-12",
    recurringTransaction: null,
    recurringPeriod: null,
  },
  {
    ref: "transaction-future-2026-08-insurance",
    member: "member-lan",
    wallet: "wallet-bank-lan",
    toWallet: null,
    category: "category-insurance",
    type: "expense",
    workflowStatus: "scheduled",
    amount: "2800000",
    description: "Gia hạn bảo hiểm sức khỏe",
    date: "2026-08-25",
    recurringTransaction: null,
    recurringPeriod: null,
  },
  {
    ref: "transaction-future-2026-09-side-income",
    member: "member-lan",
    wallet: "wallet-bank-lan",
    toWallet: null,
    category: "category-other-income",
    type: "income",
    workflowStatus: "scheduled",
    amount: "2200000",
    description: "Thu nhập bán hàng dự kiến",
    date: "2026-09-05",
    recurringTransaction: null,
    recurringPeriod: null,
  },
);

transactions.sort((left, right) => left.date.localeCompare(right.date) || left.ref.localeCompare(right.ref));

const walletBalances = new Map(wallets.map((wallet) => [wallet.ref, BigInt(wallet.openingBalance)]));
for (const transaction of transactions) {
  if (transaction.workflowStatus !== "approved") continue;
  const amount = BigInt(transaction.amount);
  if (transaction.type === "income") {
    walletBalances.set(transaction.wallet, walletBalances.get(transaction.wallet) + amount);
  } else if (transaction.type === "expense") {
    walletBalances.set(transaction.wallet, walletBalances.get(transaction.wallet) - amount);
  } else {
    walletBalances.set(transaction.wallet, walletBalances.get(transaction.wallet) - amount);
    walletBalances.set(transaction.toWallet, walletBalances.get(transaction.toWallet) + amount);
  }
}

for (const wallet of wallets) {
  wallet.currentBalance = walletBalances.get(wallet.ref).toString();
}

function transactionSnapshot(ref) {
  const transaction = transactions.find((item) => item.ref === ref);
  if (!transaction) throw new Error(`Missing transaction for snapshot: ${ref}`);
  return {
    wallet: transaction.wallet,
    toWallet: transaction.toWallet,
    category: transaction.category,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date,
    workflowStatus: transaction.workflowStatus,
  };
}

function proposedTransactionSnapshot(ref) {
  const snapshot = transactionSnapshot(ref);
  delete snapshot.workflowStatus;
  return snapshot;
}

const approvedChangeTransactionRef = "transaction-2026-05-lan-variable-03";
const approvedChangePreviousData = transactionSnapshot(approvedChangeTransactionRef);
const approvedChangeTransaction = transactions.find((transaction) => transaction.ref === approvedChangeTransactionRef);
approvedChangeTransaction.description = "Chi phí gia đình đã được đối soát";

const transactionChangeRequests = [
  {
    ref: "change-request-approved",
    transaction: approvedChangeTransactionRef,
    requesterMember: "member-lan",
    reviewerMember: "member-minh",
    previousData: approvedChangePreviousData,
    proposedData: {
      action: "update",
      reason: "Điều chỉnh lại mô tả giao dịch cho rõ ràng.",
      transaction: proposedTransactionSnapshot(approvedChangeTransactionRef),
    },
    status: "approved",
    createdAt: "2026-05-25T20:15:00+07:00",
    reviewedAt: "2026-05-26T08:30:00+07:00",
  },
  {
    ref: "change-request-rejected",
    transaction: "transaction-2026-06-lan-variable-04",
    requesterMember: "member-lan",
    reviewerMember: "member-minh",
    previousData: transactionSnapshot("transaction-2026-06-lan-variable-04"),
    proposedData: {
      action: "delete",
      reason: "Nghi ngờ giao dịch bị nhập trùng.",
    },
    status: "rejected",
    createdAt: "2026-06-22T19:00:00+07:00",
    reviewedAt: "2026-06-23T07:45:00+07:00",
  },
  {
    ref: "change-request-pending",
    transaction: "transaction-2026-07-lan-variable-05",
    requesterMember: "member-lan",
    reviewerMember: null,
    previousData: transactionSnapshot("transaction-2026-07-lan-variable-05"),
    proposedData: {
      action: "update",
      reason: "Cần điều chỉnh số tiền theo hóa đơn thực tế.",
      transaction: {
        ...proposedTransactionSnapshot("transaction-2026-07-lan-variable-05"),
        amount: "720000",
      },
    },
    status: "pending",
    createdAt: "2026-07-30T21:10:00+07:00",
    reviewedAt: null,
  },
];

const workspaceJoinRequests = [
  {
    ref: "join-request-lan-approved",
    workspace: WORKSPACE_REF,
    requester: "user-lan",
    reviewer: "user-owner",
    role: "MEMBER",
    status: "approved",
    createdAt: "2025-10-31T18:00:00+07:00",
    respondedAt: "2025-11-01T10:30:00+07:00",
  },
  {
    ref: "join-request-ha-pending",
    workspace: WORKSPACE_REF,
    requester: "user-guest-pending",
    reviewer: null,
    role: null,
    status: "pending",
    createdAt: "2026-07-30T14:20:00+07:00",
    respondedAt: null,
  },
  {
    ref: "join-request-tuan-rejected",
    workspace: WORKSPACE_REF,
    requester: "user-guest-rejected",
    reviewer: "user-owner",
    role: null,
    status: "rejected",
    createdAt: "2026-06-12T09:15:00+07:00",
    respondedAt: "2026-06-13T08:10:00+07:00",
  },
];

const auditLogs = [
  ["audit-dataset-installed", "user-owner", "sample_dataset.installed", "workspace", WORKSPACE_REF, "2025-10-28T09:00:00+07:00", { datasetKey: "family-finance-full-demo", datasetVersion: 1, seed: SEED }],
  ["audit-workspace-created", "user-owner", "workspace.created", "workspace", WORKSPACE_REF, "2025-10-28T09:00:01+07:00", { creatorRole: "ADMIN", sampleData: true }],
  ["audit-wallet-bank-minh", "user-owner", "wallet.created", "wallet", "wallet-bank-minh", "2025-10-28T09:05:00+07:00", { openingBalance: "20000000" }],
  ["audit-wallet-bank-lan", "user-owner", "wallet.created", "wallet", "wallet-bank-lan", "2025-10-28T09:06:00+07:00", { openingBalance: "15000000" }],
  ["audit-wallet-household", "user-owner", "wallet.created", "wallet", "wallet-household", "2025-10-28T09:07:00+07:00", { openingBalance: "10000000" }],
  ["audit-member-approved", "user-owner", "workspace.join_request_approved", "workspace_join_request", "join-request-lan-approved", "2025-11-01T10:30:00+07:00", { assignedRole: "MEMBER" }],
  ["audit-recurring-salary-created", "user-owner", "recurring_transaction.created", "recurring_transaction", "recurring-minh-salary", "2025-11-02T08:00:00+07:00", { frequency: "monthly" }],
  ["audit-recurring-utilities-created", "user-lan", "recurring_transaction.created", "recurring_transaction", "recurring-lan-utilities", "2025-11-02T08:10:00+07:00", { frequency: "monthly" }],
  ["audit-change-approved", "user-owner", "transaction.update_approved", "transaction", "transaction-2026-05-lan-variable-03", "2026-05-26T08:30:00+07:00", { changeRequest: "change-request-approved" }],
  ["audit-change-rejected", "user-owner", "transaction.delete_rejected", "transaction", "transaction-2026-06-lan-variable-04", "2026-06-23T07:45:00+07:00", { changeRequest: "change-request-rejected" }],
  ["audit-join-rejected", "user-owner", "workspace.join_request_rejected", "workspace_join_request", "join-request-tuan-rejected", "2026-06-13T08:10:00+07:00", { reason: "Chưa xác minh được thành viên" }],
  ["audit-transaction-pending", "user-lan", "transaction.created", "transaction", "transaction-2026-07-lan-variable-12", "2026-07-30T20:00:00+07:00", { workflowStatus: "pending" }],
  ["audit-change-pending", "user-lan", "transaction.update_requested", "transaction", "transaction-2026-07-lan-variable-05", "2026-07-30T21:10:00+07:00", { changeRequest: "change-request-pending" }],
  ["audit-future-created", "user-owner", "transaction.created", "transaction", "transaction-future-2026-08-family-trip", "2026-07-31T09:00:00+07:00", { workflowStatus: "scheduled" }],
  ["audit-invite-requested", "user-guest-pending", "workspace.join_requested", "workspace_join_request", "join-request-ha-pending", "2026-07-30T14:20:00+07:00", { source: "invite_code" }],
].map(([ref, actorUser, action, entityType, entityRef, createdAt, metadata]) => ({
  ref,
  workspace: WORKSPACE_REF,
  actorUser,
  action,
  entityType,
  entityRef,
  metadata,
  createdAt,
}));

const monthlyTransactionCounts = Object.fromEntries(months.map(([year, month]) => {
  const period = `${year}-${pad(month)}`;
  const records = transactions.filter((transaction) => transaction.date.startsWith(period));
  return [period, {
    total: records.length,
    byMember: {
      "member-minh": records.filter((transaction) => transaction.member === "member-minh").length,
      "member-lan": records.filter((transaction) => transaction.member === "member-lan").length,
    },
  }];
}));

const dataset = {
  formatVersion: 1,
  key: "family-finance-full-demo",
  name: "Dữ liệu mẫu đầy đủ cho gia đình hai thành viên",
  locale: "vi-VN",
  generatedAt: GENERATED_AT,
  deterministicSeed: SEED,
  dateRange: {
    from: "2025-11-01",
    through: "2026-07-31",
    futureThrough: "2026-09-05",
  },
  importRules: {
    identifiers: "Resolve ref fields to generated UUID values during import.",
    currentUser: "Replace source=currentUser with the authenticated user; never create or overwrite that user's password.",
    syntheticUsers: "Generate an unguessable password, store only its Argon2 hash, and discard the password.",
    money: "Amounts are decimal strings. Recalculate wallet currentBalance with Decimal.js and verify against the supplied value.",
    transactionality: "Install every section inside one Prisma transaction and roll back the entire sample workspace on failure.",
    idempotency: "Use key + formatVersion + current user to reopen an existing sample workspace instead of duplicating it.",
  },
  roleReferences: ["ADMIN", "MEMBER"],
  users,
  workspaces: [workspace],
  workspaceMembers: members,
  wallets,
  workspaceWallets,
  categories,
  recurringTransactions,
  transactions,
  transactionChangeRequests,
  workspaceJoinRequests,
  auditLogs,
  coverage: {
    tables: {
      ROLE: 2,
      USERS: users.length,
      WORKSPACES: 1,
      WORKSPACE_MEMBERS: members.length,
      WALLETS: wallets.length,
      WORKSPACE_WALLET: workspaceWallets.length,
      CATEGORY: categories.length,
      RECURRING_TRANSACTION: recurringTransactions.length,
      TRANSACTION: transactions.length,
      TRANSACTION_CHANGE_REQUEST: transactionChangeRequests.length,
      WORKSPACE_JOIN_REQUEST: workspaceJoinRequests.length,
      AUDIT_LOG: auditLogs.length,
    },
    monthlyTransactions: monthlyTransactionCounts,
    futureTransactions: transactions.filter((transaction) => transaction.workflowStatus === "scheduled").length,
    transactionTypes: Object.fromEntries(["income", "expense", "transfer"].map((type) => [type, transactions.filter((transaction) => transaction.type === type).length])),
    workflowStatuses: Object.fromEntries(["approved", "pending", "scheduled", "rejected"].map((status) => [status, transactions.filter((transaction) => transaction.workflowStatus === status).length])),
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(`Dataset validation failed: ${message}`);
}

function assertUniqueRefs(sectionName, records) {
  const refs = records.map((record) => record.ref);
  assert(refs.every(Boolean), `${sectionName} contains a record without ref`);
  assert(new Set(refs).size === refs.length, `${sectionName} contains duplicate refs`);
}

for (const [sectionName, records] of Object.entries({
  users,
  workspaces: dataset.workspaces,
  workspaceMembers: members,
  wallets,
  categories,
  recurringTransactions,
  transactions,
  transactionChangeRequests,
  workspaceJoinRequests,
  auditLogs,
})) {
  assertUniqueRefs(sectionName, records);
}

assert(members.length === 2, "the sample workspace must contain exactly two members");
assert(members.filter((member) => member.role === "ADMIN").length === 1, "the workspace must have exactly one ADMIN");
assert(members.filter((member) => member.role === "MEMBER").length === 1, "the workspace must have exactly one MEMBER");

for (const [period, counts] of Object.entries(monthlyTransactionCounts)) {
  assert(counts.total === 30, `${period} must contain exactly 30 transactions`);
  assert(counts.byMember["member-minh"] === 15, `${period} must contain 15 Minh transactions`);
  assert(counts.byMember["member-lan"] === 15, `${period} must contain 15 Lan transactions`);
}

const userRefs = new Set(users.map((user) => user.ref));
const memberRefs = new Set(members.map((member) => member.ref));
const walletRefs = new Set(wallets.map((wallet) => wallet.ref));
const workspaceCategoryByRef = new Map(workspaceCategories.map((category) => [category.ref, category]));
const recurringRefs = new Set(recurringTransactions.map((recurring) => recurring.ref));
const transactionRefs = new Set(transactions.map((transaction) => transaction.ref));

for (const transaction of transactions) {
  assert(memberRefs.has(transaction.member), `${transaction.ref} refers to an unknown member`);
  assert(walletRefs.has(transaction.wallet), `${transaction.ref} refers to an unknown source wallet`);
  if (transaction.type === "transfer") {
    assert(transaction.toWallet && walletRefs.has(transaction.toWallet), `${transaction.ref} transfer requires a valid destination wallet`);
    assert(transaction.wallet !== transaction.toWallet, `${transaction.ref} cannot transfer to the same wallet`);
    assert(transaction.category === null, `${transaction.ref} transfer must not have a category`);
  } else {
    assert(transaction.toWallet === null, `${transaction.ref} ${transaction.type} must not have a destination wallet`);
    const category = workspaceCategoryByRef.get(transaction.category);
    assert(category, `${transaction.ref} refers to an unknown workspace category`);
    assert(category.type === transaction.type, `${transaction.ref} category type does not match transaction type`);
  }
  if (transaction.recurringTransaction) {
    assert(recurringRefs.has(transaction.recurringTransaction), `${transaction.ref} refers to an unknown recurring transaction`);
    assert(transaction.recurringPeriod === transaction.date.slice(0, 7), `${transaction.ref} recurring period must match its date`);
  } else {
    assert(transaction.recurringPeriod === null, `${transaction.ref} has a recurring period without a recurring transaction`);
  }
}

for (const recurring of recurringTransactions) {
  assert(memberRefs.has(recurring.createdByMember), `${recurring.ref} refers to an unknown creator`);
  assert(walletRefs.has(recurring.wallet), `${recurring.ref} refers to an unknown wallet`);
  if (recurring.type === "transfer") {
    assert(recurring.toWallet && walletRefs.has(recurring.toWallet), `${recurring.ref} transfer requires a destination wallet`);
    assert(recurring.category === null, `${recurring.ref} transfer must not have a category`);
  } else {
    const category = workspaceCategoryByRef.get(recurring.category);
    assert(category?.type === recurring.type, `${recurring.ref} category type does not match its type`);
  }
}

for (const request of transactionChangeRequests) {
  assert(transactionRefs.has(request.transaction), `${request.ref} refers to an unknown transaction`);
  assert(memberRefs.has(request.requesterMember), `${request.ref} refers to an unknown requester member`);
  assert(request.reviewerMember === null || memberRefs.has(request.reviewerMember), `${request.ref} refers to an unknown reviewer member`);
}

for (const request of workspaceJoinRequests) {
  assert(userRefs.has(request.requester), `${request.ref} refers to an unknown requester user`);
  assert(request.reviewer === null || userRefs.has(request.reviewer), `${request.ref} refers to an unknown reviewer user`);
}

for (const wallet of wallets) {
  if (wallet.ref !== "wallet-credit-card") {
    assert(BigInt(wallet.currentBalance) >= 0n, `${wallet.ref} should not have a negative sample balance`);
  }
}

assert(dataset.coverage.futureTransactions === 6, "the dataset must contain six future transactions");
assert(transactions.filter((transaction) => transaction.type === "income").length > 0, "income coverage is required");
assert(transactions.filter((transaction) => transaction.type === "expense").length > 0, "expense coverage is required");
assert(transactions.filter((transaction) => transaction.type === "transfer").length > 0, "transfer coverage is required");
assert(users.every((user) => !("password" in user) && !("passwordHash" in user)), "the JSON must not contain credentials");

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: OUTPUT_PATH,
  transactions: transactions.length,
  monthlyTransactionCounts,
  futureTransactions: dataset.coverage.futureTransactions,
  wallets: wallets.map(({ ref, currentBalance }) => ({ ref, currentBalance })),
}, null, 2));
