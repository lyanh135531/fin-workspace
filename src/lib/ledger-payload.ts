export type LedgerTransactionType = "income" | "expense" | "transfer";

export type LedgerTransactionPurpose =
  | "standard"
  | "credit_card_payment"
  | "credit_card_refund"
  | "credit_card_installment_fee"
  | "investment_contribution"
  | "investment_settlement"
  | "balance_reconciliation";

export type LedgerTransactionStatus =
  | "pending"
  | "scheduled"
  | "approved"
  | "rejected";

export type HydratedLedgerItem = {
  id: string;
  amount: string;
  type: LedgerTransactionType;
  purpose?: LedgerTransactionPurpose;
  status: LedgerTransactionStatus;
  description: string | null;
  date: string;
  walletId: string;
  toWalletId: string | null;
  toWallet: string | null;
  categoryId: string | null;
  wallet: string;
  category: { name: string; color: string; icon: string | null } | null;
  member: string;
  canRequestEdit: boolean;
  canRequestDelete: boolean;
  hasPendingChange: boolean;
  pendingChangeRequestId: string | null;
  pendingChangeAction: "update" | "delete" | null;
  pendingChangeRequester: string | null;
  pendingChangeReason: string | null;
  pendingChangeDetails: {
    label: string;
    previous: string;
    proposed: string;
  }[];
  isRecurring: boolean;
  allocations?: { walletId: string; amount: string }[];
  paymentSources?: { walletId: string; amount: string }[];
};

export type CompactLedgerRow = {
  id: string;
  amount: string;
  type: LedgerTransactionType;
  purpose?: Exclude<LedgerTransactionPurpose, "standard">;
  status?: Exclude<LedgerTransactionStatus, "approved">;
  description?: string;
  /** YYYY-MM-DD */
  date: string;
  walletId: string;
  toWalletId?: string;
  categoryId?: string;
  memberId: string;
  canEdit?: true;
  canDelete?: true;
  isRecurring?: true;
  allocations?: { walletId: string; amount: string }[];
  paymentSources?: { walletId: string; amount: string }[];
  pendingChange?: {
    id: string;
    action: "update" | "delete" | null;
    requester: string | null;
    reason: string | null;
    details: {
      label: string;
      previous: string;
      proposed: string;
    }[];
  };
};

export type LedgerPayloadLookups = {
  extraWallets?: Record<string, string>;
  extraCategories?: Record<
    string,
    { name: string; color: string; icon: string | null }
  >;
  members: Record<string, string>;
};

export type CompactLedgerBundle = {
  revision: string;
  rows: CompactLedgerRow[];
  lookups: LedgerPayloadLookups;
  coveredRange: { from: string; to: string } | null;
  isCompleteHistory: boolean;
};

export function hydrateLedgerRows(
  bundle: Pick<CompactLedgerBundle, "rows" | "lookups">,
  baseWallets: ReadonlyArray<{ id: string; name: string }>,
  baseCategories: ReadonlyArray<{
    id: string;
    name: string;
    color?: string;
    icon?: string | null;
  }>,
): HydratedLedgerItem[] {
  const walletMap = new Map<string, string>();
  for (const w of baseWallets) {
    walletMap.set(w.id, w.name);
  }
  if (bundle.lookups.extraWallets) {
    for (const [id, name] of Object.entries(bundle.lookups.extraWallets)) {
      walletMap.set(id, name);
    }
  }

  const categoryMap = new Map<
    string,
    { name: string; color: string; icon: string | null }
  >();
  for (const c of baseCategories) {
    categoryMap.set(c.id, {
      name: c.name,
      color: c.color ?? "var(--text-secondary)",
      icon: c.icon ?? null,
    });
  }
  if (bundle.lookups.extraCategories) {
    for (const [id, cat] of Object.entries(bundle.lookups.extraCategories)) {
      categoryMap.set(id, cat);
    }
  }

  return bundle.rows.map((row) => {
    const pending = row.pendingChange;
    return {
      id: row.id,
      amount: row.amount,
      type: row.type,
      purpose: row.purpose ?? "standard",
      status: row.status ?? "approved",
      description: row.description ?? null,
      date: row.date,
      walletId: row.walletId,
      toWalletId: row.toWalletId ?? null,
      toWallet: row.toWalletId
        ? (walletMap.get(row.toWalletId) ?? null)
        : null,
      categoryId: row.categoryId ?? null,
      wallet: walletMap.get(row.walletId) ?? "Ví",
      category: row.categoryId
        ? (categoryMap.get(row.categoryId) ?? null)
        : null,
      member: bundle.lookups.members[row.memberId] ?? "Người dùng",
      canRequestEdit: Boolean(row.canEdit),
      canRequestDelete: Boolean(row.canDelete),
      hasPendingChange: Boolean(pending),
      pendingChangeRequestId: pending?.id ?? null,
      pendingChangeAction: pending?.action ?? null,
      pendingChangeRequester: pending?.requester ?? null,
      pendingChangeReason: pending?.reason ?? null,
      pendingChangeDetails: pending?.details ?? [],
      isRecurring: Boolean(row.isRecurring),
      allocations: row.allocations ?? [],
      paymentSources: row.paymentSources ?? [],
    };
  });
}

export function mergeHydratedLedgerRows(
  primary: HydratedLedgerItem[],
  secondary: HydratedLedgerItem[],
): HydratedLedgerItem[] {
  if (secondary.length === 0) return primary;
  const map = new Map<string, HydratedLedgerItem>();
  for (const item of primary) {
    map.set(item.id, item);
  }
  for (const item of secondary) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}
