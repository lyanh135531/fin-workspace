"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Plus,
  WalletCards,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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

function supportsQuickTransaction(pathname: string) {
  return (
    pathname === "/overview" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/workspace/") ||
    pathname === "/wallets" ||
    pathname === "/recurring-transactions"
  );
}

const transactionTypes: {
  value: TransactionType;
  label: string;
  icon: typeof ArrowDownLeft;
}[] = [
  { value: "expense", label: "Chi", icon: ArrowUpRight },
  { value: "income", label: "Thu", icon: ArrowDownLeft },
  { value: "transfer", label: "Chuyển", icon: ArrowLeftRight },
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
  const initialWorkspace =
    workspaces.find((workspace) => workspace.id === initialWorkspaceId) ??
    workspaces[0];
  const [open, setOpen] = useState(false);
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
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("open-quick-transaction", handleOpenEvent);
    return () =>
      window.removeEventListener("open-quick-transaction", handleOpenEvent);
  }, []);

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

  const isSupported = supportsQuickTransaction(pathname);

  if (!workspace) return null;

  const statusHint =
    date > workspace.businessDate
      ? "Giao dịch sẽ được lên lịch."
      : date < workspace.businessDate && !isAdminRole(workspace.role)
        ? "Giao dịch quá khứ sẽ chờ Admin duyệt."
        : null;
  const transferDisabled = workspace.wallets.length < 2;

  return (
    <>
      {isSupported && (
        <Button
          variant="unstyled"
          size="auto"
          type="button"
          className="dashboard-quick-entry-floating dashboard-global-quick-entry"
          onClick={() => setOpen(true)}
          aria-label="Nhập nhanh giao dịch"
        >
          <Plus size={20} />
          <span>Giao dịch</span>
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="quick-transaction-sheet">
          <SheetHeader className="quick-transaction-header">
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
          </SheetHeader>

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
                  className="quick-type-switch rounded-2xl"
                  aria-label="Loại giao dịch"
                >
                  {transactionTypes.map((item) => {
                    const Icon = item.icon;
                    const disabled =
                      item.value === "transfer" && transferDisabled;
                    return (
                      <TabsTrigger
                        key={item.value}
                        value={item.value}
                        data-transaction-type={item.value}
                        disabled={disabled}
                        className={"rounded-2xl"}
                      >
                        <Icon size={17} />
                        {item.label}
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
                        setToWalletId(
                          destinationWallet(workspace, nextWalletId),
                        );
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
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Chọn danh mục"
                      categories={categories}
                      emptyOption={{ value: "none", label: "Không chọn" }}
                    />
                  )}
                </div>
              ) : (
                <Empty
                  variant="compact"
                  icon={WalletCards}
                  title="Workspace chưa có ví hoạt động"
                  description="Tạo hoặc kích hoạt ví trước khi nhập giao dịch."
                  role="status"
                />
              )}

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

              {showDetails && (
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
                disabled={pending || !workspace.wallets.length}
                className="quick-submit"
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
        </SheetContent>
      </Sheet>
    </>
  );
}
