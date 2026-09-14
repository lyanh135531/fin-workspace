"use client";

import Decimal from "decimal.js";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  CreditCard,
  Info,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { createManagedWalletAction } from "@/app/dashboard/wallets/actions";
import {
  CardBrandBadge,
  detectCardBrand,
} from "@/app/dashboard/wallets/credit-card-overview";
import {
  Button,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/base";
import { formatAmount } from "@/lib/format";

type FundingWallet = { id: string; name: string };

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia("(min-width: 901px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function desktopSnapshot() {
  return window.matchMedia("(min-width: 901px)").matches;
}

function serverDesktopSnapshot() {
  return false;
}

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `Ngày ${i + 1}`,
}));

function calculateGraceDays(closingDay: number, dueDay: number): number {
  if (isNaN(closingDay) || isNaN(dueDay)) return 45;
  if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) return 45;
  let daysAfterClosing = 0;
  if (dueDay > closingDay) {
    daysAfterClosing = dueDay - closingDay;
  } else {
    daysAfterClosing = 30 - closingDay + dueDay;
  }
  return 30 + daysAfterClosing;
}

function CreditCardLivePreview({
  name,
  limit,
  currency,
  statementClosingDay,
  paymentDueDay,
}: {
  name: string;
  limit: string;
  currency: string;
  statementClosingDay: string;
  paymentDueDay: string;
}) {
  const brand = useMemo(() => detectCardBrand(name), [name]);

  const displayLimit = useMemo(() => {
    if (!limit || limit === "0") return "Chưa đặt hạn mức";
    try {
      return `${formatAmount(new Decimal(limit))} ${currency}`;
    } catch {
      return "Chưa đặt hạn mức";
    }
  }, [limit, currency]);

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-secondary)] via-[var(--surface)] to-[var(--surface-secondary)] p-4 text-[var(--foreground)] transition-all select-none"
    >
      {/* Subtle ambient gradients */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--primary)]/10 blur-xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-28 w-28 rounded-full bg-[var(--primary)]/5 blur-xl" />

      {/* Top row: Chip + Contactless + Brand tag */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* EMV Chip graphic */}
          <div className="grid h-5 w-7 place-items-center rounded border border-[var(--border)] bg-amber-500/15">
            <div className="grid h-3 w-4.5 grid-cols-2 grid-rows-2 gap-0.5 opacity-70">
              <span className="rounded-tl border-b border-r border-amber-600/50" />
              <span className="rounded-tr border-b border-l border-amber-600/50" />
              <span className="rounded-bl border-t border-r border-amber-600/50" />
              <span className="rounded-br border-t border-l border-amber-600/50" />
            </div>
          </div>
          {/* Contactless waves */}
          <svg
            className="h-3.5 w-3.5 text-[var(--text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8.5 16.5a5 5 0 0 1 0-9" />
            <path d="M12 19a8.5 8.5 0 0 0 0-14" />
            <path d="M15.5 21.5a12 12 0 0 0 0-19" />
          </svg>
        </div>
        <CardBrandBadge brand={brand} />
      </div>

      {/* Card Name and masked number */}
      <div className="relative z-10 my-2.5">
        <p className="truncate text-base font-semibold tracking-wide text-[var(--foreground)]">
          {name.trim() || "Tên thẻ của bạn"}
        </p>
        <p className="mt-0.5 font-mono text-[11px] tracking-widest text-[var(--text-muted)]">
          ••••  ••••  ••••  ••••
        </p>
      </div>

      {/* Bottom row: Limit & Cycle */}
      <div className="relative z-10 flex items-end justify-between border-t border-[var(--border)] pt-2 text-xs">
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
            Hạn mức
          </span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">
            {displayLimit}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
            Chu kỳ
          </span>
          <span className="font-medium text-[var(--text-secondary)] tabular-nums text-[11px]">
            Chốt: {statementClosingDay || "--"} · Hạn: {paymentDueDay || "--"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CreditCardCreate({
  currency,
  canManage,
  fundingWallets,
}: {
  currency: string;
  canManage: boolean;
  fundingWallets: FundingWallet[];
}) {
  const router = useRouter();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"card" | "billing">("card");
  const [step2EnteredAt, setStep2EnteredAt] = useState(0);

  const [cardName, setCardName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [hasOpeningDebt, setHasOpeningDebt] = useState(false);
  const [openingDebt, setOpeningDebt] = useState("");
  const [fundingWalletId, setFundingWalletId] = useState(
    fundingWallets[0]?.id ?? "",
  );
  const [statementClosingDay, setStatementClosingDay] = useState("25");
  const [paymentDueDay, setPaymentDueDay] = useState("10");

  const debtToggleId = useId();

  if (!canManage) return null;

  function close() {
    setOpen(false);
    setActiveTab("card");
    setStep2EnteredAt(0);
    setCardName("");
    setCreditLimit("");
    setHasOpeningDebt(false);
    setOpeningDebt("");
    setFundingWalletId(fundingWallets[0]?.id ?? "");
    setStatementClosingDay("25");
    setPaymentDueDay("10");
  }

  const isDebtExceeded = useMemo(() => {
    if (!hasOpeningDebt || !openingDebt || !creditLimit) return false;
    try {
      const debt = new Decimal(openingDebt);
      const limit = new Decimal(creditLimit);
      return debt.gt(limit);
    } catch {
      return false;
    }
  }, [hasOpeningDebt, openingDebt, creditLimit]);

  const closingNum = Number(statementClosingDay);
  const dueNum = Number(paymentDueDay);
  const isInvalidDays =
    !statementClosingDay ||
    !paymentDueDay ||
    closingNum < 1 ||
    closingNum > 31 ||
    dueNum < 1 ||
    dueNum > 31;

  const graceDays = useMemo(
    () => calculateGraceDays(closingNum, dueNum),
    [closingNum, dueNum],
  );

  const unavailable = fundingWallets.length === 0;

  // Step 1 readiness: Valid card name and positive credit limit
  const isStep1Valid =
    cardName.trim().length > 0 &&
    Boolean(creditLimit) &&
    new Decimal(creditLimit || 0).gt(0);

  // Overall form readiness
  const isSubmitDisabled =
    !isStep1Valid ||
    !fundingWalletId ||
    isInvalidDays ||
    isDebtExceeded ||
    unavailable;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // On mobile, if on card tab, advance to billing tab and NEVER submit
    if (!isDesktop && activeTab === "card") {
      if (isStep1Valid) {
        setActiveTab("billing");
        setStep2EnteredAt(Date.now());
      }
      return;
    }

    // Safety guard: prevent accidental immediate submission (ghost click) within 400ms of entering billing tab
    if (!isDesktop && Date.now() - step2EnteredAt < 400) {
      return;
    }

    if (!isDesktop && activeTab !== "billing") {
      return;
    }

    if (isSubmitDisabled) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const finalOpeningDebt = hasOpeningDebt ? openingDebt : "";
    const debt = new Decimal(finalOpeningDebt || 0);

    startTransition(async () => {
      const result = await createManagedWalletAction({
        name: cardName || data.get("name"),
        description: data.get("description") || undefined,
        kind: "credit_card",
        creditCard: {
          creditLimit,
          defaultFundingWalletId: fundingWalletId,
          statementClosingDay: Number(statementClosingDay),
          paymentDueDay: Number(paymentDueDay),
          openingDebt: finalOpeningDebt || "0",
          openingAllocations: debt.gt(0)
            ? [
                {
                  assetWalletId: fundingWalletId,
                  allocatedAmount: finalOpeningDebt,
                },
              ]
            : [],
        },
      });

      if (!result.ok) {
        toast.error(result.message ?? "Không thể tạo thẻ.");
        return;
      }

      toast.success("Đã tạo thẻ tín dụng thành công");
      form.reset();
      close();
      router.refresh();
    });
  }

  // Card information fields (Step 1)
  const cardFields = (
    <>
      <CreditCardLivePreview
        name={cardName}
        limit={creditLimit}
        currency={currency}
        statementClosingDay={statementClosingDay}
        paymentDueDay={paymentDueDay}
      />

      <div className="space-y-1.5">
        <Input
          autoFocus
          label="Tên thẻ"
          name="name"
          required
          maxLength={120}
          value={cardName}
          onChange={(event) => setCardName(event.target.value)}
          placeholder="VD: Techcombank Visa, VIB Cash Back..."
        />
      </div>

      <div className="space-y-1.5">
        <MoneyInput
          label={`Hạn mức tín dụng (${currency})`}
          value={creditLimit}
          onValueChange={setCreditLimit}
          placeholder="0"
          required
        />
      </div>
    </>
  );

  // Billing cycle & settlement wallet fields (Step 2)
  const billingFields = (
    <>
      {/* Billing Cycle */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-2.5">
          <Select
            label="Ngày chốt sao kê"
            value={statementClosingDay}
            onValueChange={setStatementClosingDay}
            options={DAY_OPTIONS}
            contentClassName="max-h-48"
            required
          />
          <Select
            label="Hạn thanh toán"
            value={paymentDueDay}
            onValueChange={setPaymentDueDay}
            options={DAY_OPTIONS}
            contentClassName="max-h-48"
            required
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-0.5">
          <span className="flex items-center gap-1">
            <Sparkles size={12} className="text-amber-500" aria-hidden="true" />
            Thời gian miễn lãi
          </span>
          <span className="font-semibold text-[var(--primary)] tabular-nums">
            ~{graceDays} ngày
          </span>
        </div>
      </div>

      {/* Default Funding Wallet */}
      <div className="space-y-1">
        <Select
          label="Ví trích nợ sao kê"
          value={fundingWalletId}
          onValueChange={setFundingWalletId}
          options={fundingWallets.map((wallet) => ({
            value: wallet.id,
            label: wallet.name,
          }))}
          required
        />
        <p className="text-[11px] text-[var(--text-muted)] px-0.5">
          Chỉ trừ tiền ví khi bạn bấm &ldquo;Thanh toán sao kê&rdquo;, không trừ khi quẹt thẻ.
        </p>
      </div>

      {/* Progressive Disclosure: Opening Debt */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3 space-y-2">
        <label
          htmlFor={debtToggleId}
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[var(--foreground)]">
              Thẻ đã có dư nợ từ trước?
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Dành cho thẻ đang chi tiêu trước khi nhập vào Felix.
            </p>
          </div>
          <input
            id={debtToggleId}
            type="checkbox"
            checked={hasOpeningDebt}
            onChange={(e) => {
              setHasOpeningDebt(e.target.checked);
              if (!e.target.checked) setOpeningDebt("");
            }}
            className="size-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--focus-ring)] cursor-pointer shrink-0"
          />
        </label>

        {hasOpeningDebt && (
          <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
            <MoneyInput
              label={`Dư nợ ban đầu (${currency})`}
              value={openingDebt}
              onValueChange={setOpeningDebt}
              placeholder="0"
            />
            {isDebtExceeded && (
              <div
                role="alert"
                className="flex items-center gap-1.5 text-xs text-[var(--destructive)]"
              >
                <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                <span>Dư nợ ban đầu không được vượt quá hạn mức thẻ.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optional Note */}
      <div>
        <Textarea
          label="Ghi chú (tuỳ chọn)"
          name="description"
          rows={2}
          maxLength={2000}
          placeholder="Mục đích sử dụng, ưu đãi hoàn tiền..."
        />
      </div>
    </>
  );

  return (
    <>
      <Button
        type="button"
        disabled={unavailable}
        title={unavailable ? "Cần có ít nhất một ví tài sản đang hoạt động" : undefined}
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" />
        Thêm thẻ
      </Button>

      <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          placement="inset"
          size="wide"
          spacing="flush"
          elevation="flat"
          className="max-h-[82dvh] sm:max-h-none data-[side=bottom]:inset-x-3 data-[side=bottom]:bottom-3 data-[side=bottom]:max-w-lg data-[side=bottom]:mx-auto sm:data-[side=bottom]:inset-x-auto"
        >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={submit}
            aria-busy={pending}
          >
            <SheetHeader
              icon={CreditCard}
              title="Tạo thẻ tín dụng"
              description="Thiết lập hạn mức, chu kỳ sao kê và ví thanh toán mặc định."
            />

            {/* Mobile Layout: Uses standard Base Tabs with TabsContent (matching financial-plans-manager) */}
            {!isDesktop ? (
              <div className="flex-1 overflow-y-auto p-4 overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as "card" | "billing")}
                  className="w-full"
                >
                  <TabsList variant="segmented" className="w-full">
                    <TabsTrigger
                      value="card"
                      variant="segmented"
                      className="flex-1 gap-1.5"
                    >
                      <CreditCard className="size-3.5" aria-hidden="true" />
                      <span>1. Thông tin thẻ</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="billing"
                      variant="segmented"
                      disabled={!isStep1Valid}
                      className="flex-1 gap-1.5"
                    >
                      <Calendar className="size-3.5" aria-hidden="true" />
                      <span>2. Sao kê & Ví</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="card" className="mt-4 space-y-4">
                    {cardFields}
                  </TabsContent>

                  <TabsContent value="billing" className="mt-4 space-y-4">
                    {billingFields}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              /* Desktop Layout: 2-column side-by-side */
              <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 sm:p-6 md:grid-cols-2 md:gap-8 overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="space-y-4">
                  {cardFields}
                </div>
                <div className="space-y-4 md:border-l md:border-[var(--border)] md:pl-8">
                  {billingFields}
                </div>
              </div>
            )}

            {/* Standard SheetFooter (Mobile: Single action, Cancel hidden by base SheetFooter convention) */}
            <SheetFooter
              onCancel={close}
              cancelLabel="Hủy"
              submitLabel={
                isDesktop
                  ? pending
                    ? "Đang tạo..."
                    : creditLimit
                      ? `Tạo thẻ • Hạn mức ${formatAmount(creditLimit)} ${currency}`
                      : "Tạo thẻ tín dụng"
                  : activeTab === "card"
                    ? "Tiếp tục"
                    : pending
                      ? "Đang tạo thẻ..."
                      : "Hoàn tất tạo thẻ"
              }
              isSubmitting={pending}
              submittingLabel={isDesktop ? "Đang tạo..." : "Đang tạo thẻ..."}
              submitDisabled={
                !isDesktop && activeTab === "card"
                  ? !isStep1Valid
                  : isSubmitDisabled || pending
              }
              onSubmit={
                !isDesktop && activeTab === "card"
                  ? () => {
                      if (isStep1Valid) {
                        setActiveTab("billing");
                        setStep2EnteredAt(Date.now());
                      }
                    }
                  : undefined
              }
              submitType={!isDesktop && activeTab === "card" ? "button" : "submit"}
            />
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
