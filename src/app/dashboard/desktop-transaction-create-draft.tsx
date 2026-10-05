"use client";

import {
  Button,
  CategoryTreeSelect,
  DatePicker,
  Input,
  MoneyInput,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Plus,
  Wallet,
} from "lucide-react";

export type TransactionType = "income" | "expense" | "transfer";

export type TransactionDraft = {
  description: string;
  type: TransactionType;
  categoryId: string;
  walletId: string;
  toWalletId: string;
  date: string;
  amount: string;
  allocations: Array<{ walletId: string; amount: string }>;
};

export type TransactionWalletOption = {
  id: string;
  name: string;
  kind?: "asset" | "credit_card";
  defaultFundingWalletId?: string | null;
};

export type TransactionCategoryOption = TransactionWalletOption & {
  color?: string;
  icon?: string | null;
  parentId?: string | null;
  type: "income" | "expense";
};

const transactionTypeTabs = [
  { value: "expense", label: "Chi", icon: ArrowUpRight },
  { value: "income", label: "Thu", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển", icon: ArrowLeftRight },
] satisfies {
  value: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
}[];

function defaultDestination(
  wallets: TransactionWalletOption[],
  sourceId: string,
) {
  return wallets.find((wallet) => wallet.kind !== "credit_card" && wallet.id !== sourceId)?.id ?? sourceId;
}

function categoriesForTransactionType(
  categories: TransactionCategoryOption[],
  type: TransactionType,
): TransactionCategoryOption[] {
  return type === "transfer"
    ? []
    : categories.filter((category) => category.type === type);
}

export function createTransactionDraft(
  wallets: TransactionWalletOption[],
  categories: TransactionCategoryOption[],
  businessDate: string,
): TransactionDraft {
  const walletId = wallets[0]?.id ?? "";
  return {
    description: "",
    type: "expense",
    categoryId:
      categoriesForTransactionType(categories, "expense")[0]?.id ?? "none",
    walletId,
    toWalletId: defaultDestination(wallets, walletId),
    date: businessDate,
    amount: "",
    allocations: [],
  };
}

export function transactionDraftInput(draft: TransactionDraft) {
  return {
    walletId: draft.walletId,
    toWalletId: draft.type === "transfer" ? draft.toWalletId : undefined,
    categoryId: draft.categoryId === "none" ? undefined : draft.categoryId,
    type: draft.type,
    amount: draft.amount,
    description: draft.description || undefined,
    date: draft.date,
    allocations: draft.allocations.length ? draft.allocations : undefined,
  };
}

export function DesktopTransactionCreateDraft({
  draft,
  wallets,
  categories,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: TransactionDraft;
  wallets: TransactionWalletOption[];
  categories: TransactionCategoryOption[];
  busy: boolean;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const selectedWallet = wallets.find((wallet) => wallet.id === draft.walletId);
  const assetWallets = wallets.filter((wallet) => wallet.kind !== "credit_card");
  const sortedWallets = [
    ...wallets.filter((wallet) => wallet.kind !== "credit_card"),
    ...wallets.filter((wallet) => wallet.kind === "credit_card"),
  ];
  const isCreditCardTransaction = (draft.type === "expense" || draft.type === "transfer") && selectedWallet?.kind === "credit_card";

  function walletSelectOption(
    wallet: TransactionWalletOption,
    options?: { disabled?: boolean },
  ) {
    const isCard = wallet.kind === "credit_card";
    return {
      value: wallet.id,
      label: wallet.name,
      content: (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {isCard ? (
              <CreditCard
                className="size-4 shrink-0 text-[var(--primary)]"
                aria-hidden="true"
              />
            ) : (
              <Wallet
                className="size-4 shrink-0 text-[var(--text-muted)]"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{wallet.name}</span>
          </span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              isCard
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
            }`}
          >
            {isCard ? "Thẻ tín dụng" : "Ví tài sản"}
          </span>
        </div>
      ),
      selectedContent: (
        <span className="flex min-w-0 items-center gap-2">
          {isCard ? (
            <CreditCard
              className="size-4 shrink-0 text-[var(--primary)]"
              aria-hidden="true"
            />
          ) : (
            <Wallet
              className="size-4 shrink-0 text-[var(--text-muted)]"
              aria-hidden="true"
            />
          )}
          <span className="truncate">{wallet.name}</span>
          {isCard && (
            <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
              Thẻ tín dụng
            </span>
          )}
        </span>
      ),
      disabled: options?.disabled,
    };
  }

  function allocationForCard(wallet: TransactionWalletOption, amount: string) {
    const fundingWalletId = wallet.defaultFundingWalletId ?? assetWallets[0]?.id;
    return fundingWalletId ? [{ walletId: fundingWalletId, amount }] : [];
  }

  function changeType(type: TransactionType): void {
    const currentWallet = wallets.find((wallet) => wallet.id === draft.walletId);
    const nextWallet = type === "income" && currentWallet?.kind === "credit_card"
      ? assetWallets[0]
      : currentWallet;
    onChange({
      type,
      walletId: nextWallet?.id ?? draft.walletId,
      categoryId: "none",
      allocations: (type === "expense" || type === "transfer") && currentWallet?.kind === "credit_card"
        ? allocationForCard(currentWallet, draft.amount)
        : [],
      toWalletId:
        type === "transfer"
          ? draft.toWalletId || defaultDestination(wallets, nextWallet?.id ?? draft.walletId)
          : draft.toWalletId,
    });
  }

  return (
    <section aria-label="Tạo giao dịch mới">
      <PopoverHeader className="flex-row items-start gap-3 border-b border-[var(--border)] px-2 pb-4 pt-1">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--primary)]"
          aria-hidden="true"
        >
          <Plus size={17} />
        </span>
        <div className="min-w-0 pt-0.5">
          <PopoverTitle className="text-sm font-semibold text-[var(--foreground)]">
            Tạo giao dịch mới
          </PopoverTitle>
          <PopoverDescription className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Ghi nhận khoản thu, chi hoặc chuyển tiền vào sổ giao dịch.
          </PopoverDescription>
        </div>
      </PopoverHeader>

      <div className="px-2 py-4">
        <Tabs
          value={draft.type}
          onValueChange={(value) => changeType(value as TransactionType)}
          className="gap-0"
        >
          <TabsList
            variant="navigation"
            className="grid-cols-3 gap-1"
            aria-label="Loại giao dịch"
          >
            {transactionTypeTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  variant="navigation"
                  tone={
                    tab.value === "expense"
                      ? "expense"
                      : tab.value === "income"
                        ? "income"
                        : undefined
                  }
                  disabled={
                    busy || (tab.value === "transfer" && wallets.length < 2)
                  }
                >
                  <Icon aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="mt-6 grid grid-cols-[1fr_1fr] gap-7">
          <section className="space-y-4" aria-labelledby="transaction-core-title">
            <div>
              <h3
                id="transaction-core-title"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]"
              >
                <ArrowLeftRight
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Giao dịch & Nguồn tiền
              </h3>
              <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                Số tiền và phương thức thanh toán.
              </p>
            </div>

            <MoneyInput
              autoFocus
              required
              disabled={busy}
              value={draft.amount}
              onValueChange={(amount) =>
                onChange({
                  amount,
                  allocations: isCreditCardTransaction
                    ? [
                        {
                          walletId:
                            draft.allocations[0]?.walletId ||
                            selectedWallet?.defaultFundingWalletId ||
                            assetWallets[0]?.id ||
                            "",
                          amount,
                        },
                      ]
                    : [],
                })
              }
              placeholder="0"
              label="Số tiền"
            />

            <Select
              disabled={busy || !wallets.length}
              value={draft.walletId}
              onValueChange={(walletId) => {
                const wallet = wallets.find((item) => item.id === walletId);
                onChange({
                  walletId,
                  toWalletId:
                    draft.toWalletId === walletId
                      ? defaultDestination(wallets, walletId)
                      : draft.toWalletId,
                  allocations: (draft.type === "expense" || draft.type === "transfer") && wallet?.kind === "credit_card"
                    ? allocationForCard(wallet, draft.amount)
                    : [],
                });
              }}
              label={
                draft.type === "transfer"
                  ? "Ví gửi"
                  : isCreditCardTransaction
                    ? "Thẻ thanh toán"
                    : "Thanh toán bằng"
              }
              options={sortedWallets.map((item) =>
                walletSelectOption(item, {
                  disabled: item.kind === "credit_card" && draft.type === "income",
                }),
              )}
            />

            {draft.type === "transfer" && (
              <Select
                disabled={busy || !wallets.length}
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={sortedWallets.map((item) =>
                  walletSelectOption(item, {
                    disabled: item.id === draft.walletId || item.kind === "credit_card",
                  }),
                )}
              />
            )}

            {isCreditCardTransaction && (
              <Select
                disabled={busy}
                label="Ví thanh toán thẻ"
                value={
                  draft.allocations[0]?.walletId ||
                  selectedWallet?.defaultFundingWalletId ||
                  assetWallets[0]?.id ||
                  ""
                }
                onValueChange={(walletId) => {
                  onChange({
                    allocations: [{ walletId, amount: draft.amount }],
                  });
                }}
                options={assetWallets.map((wallet) =>
                  walletSelectOption(wallet),
                )}
              />
            )}
          </section>

          <section
            className="space-y-4 border-l border-[var(--border)] pl-7"
            aria-labelledby="transaction-detail-title"
          >
            <div>
              <h3
                id="transaction-detail-title"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]"
              >
                <CalendarDays
                  className="text-[var(--primary)]"
                  size={15}
                  aria-hidden="true"
                />
                Thông tin ghi nhận
              </h3>
              <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                Danh mục phân loại, thời gian và ghi chú.
              </p>
            </div>

            {draft.type !== "transfer" && (
              <CategoryTreeSelect
                disabled={
                  busy ||
                  !categoriesForTransactionType(categories, draft.type).length
                }
                value={draft.categoryId}
                onValueChange={(categoryId) => onChange({ categoryId })}
                label="Danh mục"
                required={draft.type === "expense"}
                categories={categoriesForTransactionType(
                  categories,
                  draft.type,
                )}
                emptyOption={
                  draft.type === "expense"
                    ? undefined
                    : { value: "none", label: "Không chọn" }
                }
              />
            )}

            <DatePicker
              disabled={busy}
              label="Ngày giao dịch"
              value={draft.date}
              onValueChange={(date) => onChange({ date })}
              required
            />
            <Input
              disabled={busy}
              value={draft.description}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
              placeholder="Ăn trưa, nhận lương..."
              label="Nội dung"
            />
          </section>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-2 pt-3">
        <span className="text-xs text-[var(--text-muted)]">
          Thay đổi số dư được xử lý theo trạng thái giao dịch.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Hủy
          </Button>
          <Button variant="default" disabled={busy} onClick={onSave}>
            {busy ? "Đang lưu" : "Lưu giao dịch"}
          </Button>
        </div>
      </footer>
    </section>
  );
}

export function DesktopTransactionCreatePopoverContent({
  draft,
  wallets,
  categories,
  busy,
  side = "bottom",
  sideOffset = 8,
  onChange,
  onSave,
  onCancel,
}: {
  draft: TransactionDraft;
  wallets: TransactionWalletOption[];
  categories: TransactionCategoryOption[];
  busy: boolean;
  side?: "top" | "bottom";
  sideOffset?: number;
  onChange: (patch: Partial<TransactionDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <PopoverContent
      align="end"
      side={side}
      sideOffset={sideOffset}
      elevation="flat"
      role="dialog"
      aria-label="Tạo giao dịch mới"
      className="w-[42rem] max-w-[calc(100vw-2rem)]"
    >
      <DesktopTransactionCreateDraft
        draft={draft}
        wallets={wallets}
        categories={categories}
        busy={busy}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    </PopoverContent>
  );
}
