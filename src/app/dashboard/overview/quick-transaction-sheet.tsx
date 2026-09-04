"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  WalletCards,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { addQuickTransactionAction } from "@/app/dashboard/actions";
import {
  Button,
  CategoryTreeSelect,
  DatePicker,
  Empty,
  Loading,
  MoneyInput,
  Select,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TransactionType = "income" | "expense" | "transfer";
export type QuickWorkspace = {
  id: string;
  name: string;
  currency: string;
  businessDate: string;
  role: string;
  wallets: { id: string; name: string }[];
  categories: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    parentId: string | null;
    type: "income" | "expense";
  }[];
};

function subscribeDesktop(callback: () => void) {
  const mediaQuery = window.matchMedia("(min-width: 1024px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function getDesktopServerSnapshot() {
  return false;
}

const transactionTypes: {
  value: TransactionType;
  label: string;
  icon: typeof ArrowDownLeft;
}[] = [
  { value: "expense", label: "Chi tiêu", icon: ArrowUpRight },
  { value: "income", label: "Thu nhập", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển tiền", icon: ArrowLeftRight },
];

function destinationWallet(workspace: QuickWorkspace, walletId: string) {
  return workspace.wallets.find((wallet) => wallet.id !== walletId)?.id ?? "";
}

function isAdminRole(role: string) {
  return role === "ADMIN";
}

export function QuickTransactionSheet({
  initialWorkspaceId,
  workspaces,
}: {
  initialWorkspaceId: string;
  workspaces: QuickWorkspace[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  const shouldOpenFromQuery = searchParams.get("action") === "new-transaction";
  const initialWorkspace =
    workspaces.find((workspace) => workspace.id === initialWorkspaceId) ??
    workspaces[0];
  const [open, setOpen] = useState(shouldOpenFromQuery);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(
    initialWorkspace?.wallets[0]?.id ?? "",
  );
  const [toWalletId, setToWalletId] = useState(
    initialWorkspace
      ? destinationWallet(
          initialWorkspace,
          initialWorkspace.wallets[0]?.id ?? "",
        )
      : "",
  );
  const [categoryId, setCategoryId] = useState("none");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initialWorkspace?.businessDate ?? "");
  const [showDetails, setShowDetails] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handleOpenEvent(event: Event) {
      if (event instanceof CustomEvent && event.detail?.type) {
        const nextType = event.detail.type as TransactionType;
        setType(nextType);
        if (nextType === "transfer" && initialWorkspace) {
          setToWalletId(destinationWallet(initialWorkspace, walletId));
        }
      }
      setOpen(true);
    }
    window.addEventListener("open-quick-transaction", handleOpenEvent);
    return () =>
      window.removeEventListener("open-quick-transaction", handleOpenEvent);
  }, [initialWorkspace, walletId]);

  useEffect(() => {
    if (!shouldOpenFromQuery) return;

    setOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("action");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, shouldOpenFromQuery]);

  const workspace = initialWorkspace;
  const categories = useMemo(
    () =>
      workspace?.categories.filter((category) => category.type === type) ?? [],
    [type, workspace],
  );

  function chooseType(nextType: TransactionType) {
    if (!workspace) return;
    setType(nextType);
    setCategoryId("none");
    if (nextType === "transfer") {
      setToWalletId(destinationWallet(workspace, walletId));
    }
  }

  function resetEntry() {
    setAmount("");
    setDescription("");
    setCategoryId("none");
    setDate(workspace?.businessDate ?? "");
    setShowDetails(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!workspace || !walletId || !amount.trim()) {
      toast.error("Hãy chọn ví và nhập số tiền.");
      return;
    }
    if (type === "transfer" && (!toWalletId || toWalletId === walletId)) {
      toast.error("Hãy chọn một ví nhận khác ví gửi.");
      return;
    }

    startTransition(async () => {
      const result = await addQuickTransactionAction(workspace.id, {
        walletId,
        toWalletId: type === "transfer" ? toWalletId : undefined,
        categoryId: categoryId === "none" ? undefined : categoryId,
        type,
        amount,
        description: description || undefined,
        date,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không thể lưu giao dịch.");
        return;
      }
      const message =
        result.status === "pending"
          ? `Đã gửi giao dịch vào ${workspace.name} để Admin duyệt.`
          : result.status === "scheduled"
            ? `Đã lên lịch giao dịch trong ${workspace.name}.`
            : `Đã ghi nhận giao dịch trong ${workspace.name}.`;
      toast.success(message);
      resetEntry();
      setOpen(false);
      router.refresh();
    });
  }

  if (!workspace) return null;

  const statusHint =
    date > workspace.businessDate
      ? "Giao dịch sẽ được lên lịch."
      : date < workspace.businessDate && !isAdminRole(workspace.role)
        ? "Giao dịch quá khứ sẽ chờ Admin duyệt."
        : null;
  const transferDisabled = workspace.wallets.length < 2;

  const transactionForm = (
    <form
      className="quick-transaction-form"
      onSubmit={submit}
      aria-busy={pending}
    >
      <div className="quick-transaction-scroll">
        <Tabs
          value={type}
          onValueChange={(value) => chooseType(value as TransactionType)}
          className="quick-type-tabs"
        >
          <TabsList
            variant="navigation"
            className="grid-cols-3"
            aria-label="Loại giao dịch"
          >
            {transactionTypes.map((item) => {
              const Icon = item.icon;
              const disabled = item.value === "transfer" && transferDisabled;
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  tone={
                    item.value === "expense"
                      ? "expense"
                      : item.value === "income"
                        ? "income"
                        : undefined
                  }
                  disabled={disabled}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <MoneyInput
          label="Số tiền"
          wrapperClassName="quick-amount-field"
          autoFocus
          value={amount}
          onValueChange={setAmount}
          placeholder="0"
          aria-label="Số tiền giao dịch"
        />

        {workspace.wallets.length ? (
          <div className="quick-transaction-grid">
            <Select
              label={type === "transfer" ? "Ví gửi" : "Ví"}
              value={walletId}
              onValueChange={(nextWalletId) => {
                setWalletId(nextWalletId);
                if (nextWalletId === toWalletId) {
                  setToWalletId(destinationWallet(workspace, nextWalletId));
                }
              }}
              placeholder="Chọn ví"
              options={workspace.wallets.map((wallet) => ({
                value: wallet.id,
                label: wallet.name,
              }))}
            />

            {type === "transfer" ? (
              <Select
                label="Ví nhận"
                value={toWalletId}
                onValueChange={setToWalletId}
                placeholder="Chọn ví nhận"
                options={workspace.wallets.map((wallet) => ({
                  value: wallet.id,
                  label: wallet.name,
                  disabled: wallet.id === walletId,
                }))}
              />
            ) : (
              <CategoryTreeSelect
                label="Danh mục"
                required={type === "expense"}
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Chọn danh mục"
                categories={categories}
                emptyOption={type === "expense" ? undefined : { value: "none", label: "Không chọn" }}
              />
            )}
          </div>
        ) : (
          <Empty
            variant="compact"
            icon={WalletCards}
            title="Nhóm chưa có ví hoạt động"
            description="Tạo hoặc kích hoạt ví trước khi nhập giao dịch."
            role="status"
          />
        )}

        {!isDesktop && (
          <Button
            variant="unstyled"
            size="auto"
            type="button"
            className="quick-details-toggle"
            onClick={() => setShowDetails((current) => !current)}
            aria-expanded={showDetails}
          >
            <CalendarDays size={16} />
            {showDetails
              ? "Ẩn thông tin bổ sung"
              : "Thêm nội dung hoặc đổi ngày"}
          </Button>
        )}

        {(isDesktop || showDetails) && (
          <div className="quick-details">
            <DatePicker
              label="Ngày giao dịch"
              value={date}
              onValueChange={setDate}
            />
            <Textarea
              label="Nội dung"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ăn trưa, nhận lương"
              maxLength={2_000}
            />
          </div>
        )}

        {statusHint && <p className="quick-status-hint">{statusHint}</p>}
      </div>

      <div className="quick-transaction-footer">
        <Button
          type="submit"
          size="lg"
          disabled={pending || !workspace.wallets.length}
          className="quick-submit w-full md:w-auto"
        >
          {pending ? (
            <Loading label="Đang lưu..." />
          ) : (
            <>
              <Check size={17} />
              Lưu giao dịch
            </>
          )}
        </Button>
      </div>
    </form>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        elevation="flat"
        className="quick-transaction-sheet"
      >
        <SheetHeader className="quick-transaction-header">
          <div className="flex items-center justify-between">
            <div className="quick-transaction-heading">
              <span>
                <WalletCards size={18} />
              </span>
              <div>
                <SheetTitle>Nhập nhanh giao dịch</SheetTitle>
                <SheetDescription>
                  Ghi nhận nhanh khoản thu, chi hoặc chuyển khoản.
                </SheetDescription>
              </div>
            </div>
            <SheetClose
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] cursor-pointer"
              aria-label="Đóng"
            >
              <X size={18} />
            </SheetClose>
          </div>
        </SheetHeader>
        {transactionForm}
      </SheetContent>
    </Sheet>
  );
}
