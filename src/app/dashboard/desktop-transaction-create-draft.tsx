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
  Split,
  Trash2,
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
  const isCreditCardExpense = draft.type === "expense" && selectedWallet?.kind === "credit_card";

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
              options={sortedWallets.map((item) =>
                walletSelectOption(item, {
                  disabled: item.kind === "credit_card" && draft.type !== "expense",
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

            {isCreditCardExpense && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 space-y-2.5">
                {draft.allocations.length <= 1 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                        <CreditCard size={13} className="text-[var(--primary)]" aria-hidden="true" />
                        Ví trả nợ thẻ
                      </span>
                      {assetWallets.length > 1 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const nextWallet = assetWallets.find(
                              (w) => w.id !== draft.allocations[0]?.walletId,
                            );
                            if (nextWallet) {
                              onChange({
                                allocations: [
                                  {
                                    walletId:
                                      draft.allocations[0]?.walletId ||
                                      assetWallets[0].id,
                                    amount: "",
                                  },
                                  { walletId: nextWallet.id, amount: "" },
                                ],
                              });
                            }
                          }}
                          className="text-[11px] font-medium text-[var(--primary)] hover:underline cursor-pointer"
                        >
                          + Chia nhiều ví
                        </button>
                      )}
                    </div>
                    <Select
                      disabled={busy}
                      value={
                        draft.allocations[0]?.walletId ||
                        selectedWallet?.defaultFundingWalletId ||
                        assetWallets[0]?.id
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
                    <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                      Tiền trong ví chỉ bị trừ khi bạn thanh toán thẻ.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                        <Split size={13} className="text-[var(--primary)]" aria-hidden="true" />
                        Phân bổ ví trả nợ thẻ ({draft.allocations.length} ví)
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const primaryWalletId =
                            draft.allocations[0]?.walletId ||
                            selectedWallet?.defaultFundingWalletId ||
                            assetWallets[0]?.id;
                          onChange({
                            allocations: primaryWalletId
                              ? [{ walletId: primaryWalletId, amount: draft.amount }]
                              : [],
                          });
                        }}
                        className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--foreground)] hover:underline cursor-pointer"
                      >
                        Thu gọn (1 ví)
                      </button>
                    </div>

                    <div className="space-y-2">
                      {draft.allocations.map((allocation, index) => (
                        <div
                          key={`${allocation.walletId}:${index}`}
                          className="grid grid-cols-[1fr_0.85fr_auto] items-end gap-2"
                        >
                          <Select
                            disabled={busy}
                            value={allocation.walletId}
                            onValueChange={(walletId) =>
                              onChange({
                                allocations: draft.allocations.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, walletId } : item,
                                ),
                              })
                            }
                            label={index === 0 ? "Ví nguồn" : undefined}
                            options={assetWallets.map((wallet) =>
                              walletSelectOption(wallet, {
                                disabled: draft.allocations.some(
                                  (item, itemIndex) =>
                                    itemIndex !== index && item.walletId === wallet.id,
                                ),
                              }),
                            )}
                          />
                          <MoneyInput
                            disabled={busy}
                            value={allocation.amount}
                            onValueChange={(amount) =>
                              onChange({
                                allocations: draft.allocations.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, amount } : item,
                                ),
                              })
                            }
                            label={index === 0 ? "Số tiền" : undefined}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy || draft.allocations.length === 1}
                            aria-label={`Xóa nguồn trả thẻ ${index + 1}`}
                            onClick={() =>
                              onChange({
                                allocations: draft.allocations.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {draft.allocations.length < assetWallets.length && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="h-8 text-xs gap-1 w-full"
                        onClick={() => {
                          const nextWallet = assetWallets.find(
                            (wallet) =>
                              !draft.allocations.some(
                                (item) => item.walletId === wallet.id,
                              ),
                          );
                          if (nextWallet)
                            onChange({
                              allocations: [
                                ...draft.allocations,
                                { walletId: nextWallet.id, amount: "" },
                              ],
                            });
                        }}
                      >
                        <Plus size={13} aria-hidden="true" />
                        Chia thêm ví
                      </Button>
                    )}
                  </>
                )}
              </div>
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
