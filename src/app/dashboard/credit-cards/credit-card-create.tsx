"use client";

import Decimal from "decimal.js";
import { CreditCard, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { createManagedWalletAction } from "@/app/dashboard/wallets/actions";
import {
  Button,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Textarea,
} from "@/components/base";

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
  const [creditLimit, setCreditLimit] = useState("");
  const [openingDebt, setOpeningDebt] = useState("");
  const [fundingWalletId, setFundingWalletId] = useState(
    fundingWallets[0]?.id ?? "",
  );
  const [statementClosingDay, setStatementClosingDay] = useState("25");
  const [paymentDueDay, setPaymentDueDay] = useState("10");

  if (!canManage) return null;

  function close() {
    setOpen(false);
    setCreditLimit("");
    setOpeningDebt("");
    setFundingWalletId(fundingWallets[0]?.id ?? "");
    setStatementClosingDay("25");
    setPaymentDueDay("10");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const debt = new Decimal(openingDebt || 0);

    startTransition(async () => {
      const result = await createManagedWalletAction({
        name: data.get("name"),
        description: data.get("description") || undefined,
        kind: "credit_card",
        creditCard: {
          creditLimit,
          defaultFundingWalletId: fundingWalletId,
          statementClosingDay: Number(statementClosingDay),
          paymentDueDay: Number(paymentDueDay),
          openingDebt: openingDebt || "0",
          openingAllocations: debt.gt(0)
            ? [{ walletId: fundingWalletId, amount: openingDebt }]
            : [],
        },
      });

      if (!result.ok) {
        toast.error(result.message ?? "Không thể tạo thẻ tín dụng.");
        return;
      }

      toast.success("Đã tạo thẻ tín dụng.");
      form.reset();
      close();
      router.refresh();
    });
  }

  const unavailable = fundingWallets.length === 0;

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
          placement={isDesktop ? "inset" : "edge"}
          size="wide"
          spacing="flush"
          elevation="flat"
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

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:p-6 md:grid-cols-2 md:gap-8">
              <section className="grid content-start gap-4" aria-labelledby="new-card-details">
                <div>
                  <h2 id="new-card-details" className="text-sm font-semibold text-[var(--foreground)]">
                    Thông tin thẻ
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Dùng tên giúp phân biệt ngân hàng hoặc mục đích sử dụng.
                  </p>
                </div>
                <Input
                  autoFocus
                  label="Tên thẻ"
                  name="name"
                  required
                  maxLength={120}
                  placeholder="Visa mua sắm, Mastercard cá nhân..."
                />
                <Textarea
                  label="Ghi chú (tuỳ chọn)"
                  name="description"
                  rows={3}
                  maxLength={2000}
                  placeholder="Mục đích sử dụng thẻ..."
                />
                <MoneyInput
                  label={`Hạn mức (${currency})`}
                  value={creditLimit}
                  onValueChange={setCreditLimit}
                  required
                />
                <MoneyInput
                  label={`Dư nợ ban đầu (${currency})`}
                  value={openingDebt}
                  onValueChange={setOpeningDebt}
                />
              </section>

              <section className="grid content-start gap-4 border-t border-[var(--border)] pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0" aria-labelledby="new-card-cycle">
                <div>
                  <h2 id="new-card-cycle" className="text-sm font-semibold text-[var(--foreground)]">
                    Thanh toán và sao kê
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    Ví nguồn chỉ bị trừ khi thanh toán sao kê, không bị trừ lúc quẹt thẻ.
                  </p>
                </div>
                <Select
                  label="Ví mặc định thanh toán"
                  value={fundingWalletId}
                  onValueChange={setFundingWalletId}
                  options={fundingWallets.map((wallet) => ({
                    value: wallet.id,
                    label: wallet.name,
                  }))}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Ngày chốt sao kê"
                    type="number"
                    min={1}
                    max={31}
                    value={statementClosingDay}
                    onChange={(event) => setStatementClosingDay(event.target.value)}
                    required
                  />
                  <Input
                    label="Ngày thanh toán"
                    type="number"
                    min={1}
                    max={31}
                    value={paymentDueDay}
                    onChange={(event) => setPaymentDueDay(event.target.value)}
                    required
                  />
                </div>
                <p className="text-xs leading-5 text-[var(--text-muted)]">
                  Nếu có dư nợ ban đầu, toàn bộ khoản này được quy cho ví mặc định. Các giao dịch mới vẫn có thể chia trách nhiệm cho nhiều ví.
                </p>
              </section>
            </div>

            <SheetFooter
              onCancel={close}
              submitLabel="Tạo thẻ"
              isSubmitting={pending}
              submittingLabel="Đang tạo..."
              submitDisabled={
                !creditLimit ||
                !fundingWalletId ||
                !statementClosingDay ||
                !paymentDueDay
              }
              submitType="submit"
            />
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
