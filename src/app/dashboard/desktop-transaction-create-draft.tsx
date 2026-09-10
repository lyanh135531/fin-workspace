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
  Plus,
  Trash2,
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
  const isCreditCardExpense = draft.type === "expense" && selectedWallet?.kind === "credit_card";

  function allocationForCard(wallet: TransactionWalletOption, amount: string) {
    const fundingWalletId = wallet.defaultFundingWalletId ?? assetWallets[0]?.id;
    return fundingWalletId ? [{ walletId: fundingWalletId, amount }] : [];
  }

  function changeType(type: TransactionType): void {
    const currentWallet = wallets.find((wallet) => wallet.id === draft.walletId);
    const nextWallet = type !== "expense" && currentWallet?.kind === "credit_card"
      ? assetWallets[0]
      : currentWallet;
    onChange({
      type,
      walletId: nextWallet?.id ?? draft.walletId,
      categoryId: "none",
      allocations: type === "expense" && currentWallet?.kind === "credit_card"
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

        <div className="mt-6 grid grid-cols-[1.08fr_0.92fr] gap-7">
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
                Giao dịch
              </h3>
              <p className="mt-1 text-[0.68rem] text-[var(--text-muted)]">
                Số tiền và nguồn ví thực hiện.
              </p>
            </div>
            <MoneyInput
              autoFocus
              required
              disabled={busy}
              value={draft.amount}
              onValueChange={(amount) => onChange({
                amount,
                allocations: isCreditCardExpense && draft.allocations.length === 1
                  ? [{ ...draft.allocations[0], amount }]
                  : draft.allocations,
              })}
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
                  allocations: draft.type === "expense" && wallet?.kind === "credit_card"
                    ? allocationForCard(wallet, draft.amount)
                    : [],
                });
              }}
              label="Thanh toán bằng"
              options={wallets.map((item) => ({
                value: item.id,
                label: item.name,
                disabled: item.kind === "credit_card" && draft.type !== "expense",
              }))}
            />
            {isCreditCardExpense && (
              <fieldset className="space-y-3 border-t border-[var(--border)] pt-4">
                <legend className="text-xs font-semibold text-[var(--foreground)]">Nguồn trả thẻ</legend>
                <p className="text-xs text-[var(--text-muted)]">Tiền thật chỉ giảm khi thanh toán sao kê; phân bổ này xác định mỗi ví phải chịu bao nhiêu.</p>
                {draft.allocations.map((allocation, index) => (
                  <div key={`${allocation.walletId}:${index}`} className="grid grid-cols-[1fr_0.8fr_auto] items-end gap-2">
                    <Select
                      disabled={busy}
                      value={allocation.walletId}
                      onValueChange={(walletId) => onChange({
                        allocations: draft.allocations.map((item, itemIndex) => itemIndex === index ? { ...item, walletId } : item),
                      })}
                      label={`Ví nguồn ${index + 1}`}
                      options={assetWallets.map((wallet) => ({
                        value: wallet.id,
                        label: wallet.name,
                        disabled: draft.allocations.some((item, itemIndex) => itemIndex !== index && item.walletId === wallet.id),
                      }))}
                    />
                    <MoneyInput
                      disabled={busy}
                      value={allocation.amount}
                      onValueChange={(amount) => onChange({
                        allocations: draft.allocations.map((item, itemIndex) => itemIndex === index ? { ...item, amount } : item),
                      })}
                      label="Số tiền"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy || draft.allocations.length === 1}
                      aria-label={`Xóa nguồn trả thẻ ${index + 1}`}
                      onClick={() => onChange({ allocations: draft.allocations.filter((_, itemIndex) => itemIndex !== index) })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {draft.allocations.length < assetWallets.length && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      const nextWallet = assetWallets.find((wallet) => !draft.allocations.some((item) => item.walletId === wallet.id));
                      if (nextWallet) onChange({ allocations: [...draft.allocations, { walletId: nextWallet.id, amount: "" }] });
                    }}
                  >
                    <Plus aria-hidden="true" />
                    Chia thêm ví
                  </Button>
                )}
              </fieldset>
            )}
            {draft.type === "transfer" ? (
              <Select
                disabled={busy || !wallets.length}
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={wallets.map((item) => ({
                  value: item.id,
                  label: item.name,
                  disabled: item.id === draft.walletId || item.kind === "credit_card",
                }))}
              />
            ) : (
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
                emptyOption={draft.type === "expense" ? undefined : { value: "none", label: "Không chọn" }}
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
                Ngày phát sinh và nội dung nhận diện.
              </p>
            </div>
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
