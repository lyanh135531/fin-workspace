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
};

export type TransactionWalletOption = {
  id: string;
  name: string;
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
  return wallets.find((wallet) => wallet.id !== sourceId)?.id ?? sourceId;
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
  function changeType(type: TransactionType): void {
    onChange({
      type,
      categoryId: "none",
      toWalletId:
        type === "transfer"
          ? draft.toWalletId || defaultDestination(wallets, draft.walletId)
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
              onValueChange={(amount) => onChange({ amount })}
              placeholder="0"
              label="Số tiền"
            />
            <Select
              disabled={busy || !wallets.length}
              value={draft.walletId}
              onValueChange={(walletId) =>
                onChange({
                  walletId,
                  toWalletId:
                    draft.toWalletId === walletId
                      ? defaultDestination(wallets, walletId)
                      : draft.toWalletId,
                })
              }
              label="Ví thực hiện"
              options={wallets.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            {draft.type === "transfer" ? (
              <Select
                disabled={busy || !wallets.length}
                value={draft.toWalletId}
                onValueChange={(toWalletId) => onChange({ toWalletId })}
                label="Ví nhận"
                options={wallets.map((item) => ({
                  value: item.id,
                  label: item.name,
                  disabled: item.id === draft.walletId,
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
                categories={categoriesForTransactionType(
                  categories,
                  draft.type,
                )}
                emptyOption={{ value: "none", label: "Không chọn" }}
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
