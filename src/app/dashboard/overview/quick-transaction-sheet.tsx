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
import { useMemo, useState, useTransition } from "react";
import { addQuickTransactionAction } from "@/app/dashboard/actions";
import {
  Button,
  Empty,
  Input,
  MoneyInput,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
    type: "income" | "expense";
  }[];
};

function supportsQuickTransaction(pathname: string) {
  return pathname === "/overview"
    || pathname === "/dashboard"
    || pathname.startsWith("/workspace/")
    || pathname === "/wallets"
    || pathname === "/recurring-transactions";
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
  const [workspaceId, setWorkspaceId] = useState(initialWorkspace?.id ?? "");
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(initialWorkspace?.wallets[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(
    initialWorkspace ? destinationWallet(initialWorkspace, initialWorkspace.wallets[0]?.id ?? "") : "",
  );
  const [categoryId, setCategoryId] = useState("none");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initialWorkspace?.businessDate ?? "");
  const [showDetails, setShowDetails] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const workspace =
    workspaces.find((candidate) => candidate.id === workspaceId) ??
    initialWorkspace;
  const categories = useMemo(
    () => workspace?.categories.filter((category) => category.type === type) ?? [],
    [type, workspace],
  );

  function chooseWorkspace(nextId: string) {
    const next = workspaces.find((candidate) => candidate.id === nextId);
    if (!next) return;
    const firstWalletId = next.wallets[0]?.id ?? "";
    const nextType = type === "transfer" && next.wallets.length < 2 ? "expense" : type;
    setWorkspaceId(next.id);
    setType(nextType);
    setWalletId(firstWalletId);
    setToWalletId(destinationWallet(next, firstWalletId));
    setCategoryId("none");
    setDate(next.businessDate);
  }

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
      const message = result.status === "pending"
        ? `Đã gửi giao dịch vào ${workspace.name} để Admin duyệt.`
        : result.status === "scheduled"
          ? `Đã lên lịch giao dịch trong ${workspace.name}.`
          : `Đã ghi nhận giao dịch trong ${workspace.name}.`;
      toast.success(message);
      resetEntry();
      if (!keepOpen) setOpen(false);
      router.refresh();
    });
  }

  if (!workspace || !supportsQuickTransaction(pathname)) return null;

  const statusHint = date > workspace.businessDate
    ? "Giao dịch sẽ được lên lịch."
    : date < workspace.businessDate && !isAdminRole(workspace.role)
      ? "Giao dịch quá khứ sẽ chờ Admin duyệt."
      : "Giao dịch sẽ được ghi nhận ngay.";
  const transferDisabled = workspace.wallets.length < 2;

  return (
    <>
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="quick-transaction-sheet"
          showCloseButton
        >
          <SheetHeader className="quick-transaction-header">
            <div className="quick-transaction-heading">
              <span><WalletCards size={18} /></span>
              <div>
                <SheetTitle>Nhập nhanh giao dịch</SheetTitle>
                <SheetDescription>
                  Chọn workspace rồi ghi nhận khoản thu, chi hoặc chuyển khoản.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form className="quick-transaction-form" onSubmit={submit}>
            <div className="quick-transaction-scroll">
              <label className="quick-field">
                <span>Workspace</span>
                <Select
                  value={workspace.id}
                  onValueChange={chooseWorkspace}
                  label="Chọn workspace"
                  options={workspaces.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              </label>

              <div className="quick-type-switch" aria-label="Loại giao dịch">
                {transactionTypes.map((item) => {
                  const Icon = item.icon;
                  const disabled = item.value === "transfer" && transferDisabled;
                  return (
                    <Button variant="unstyled" size="auto"
                      key={item.value}
                      type="button"
                      className={type === item.value ? "active" : ""}
                      disabled={disabled}
                      onClick={() => chooseType(item.value)}
                      aria-pressed={type === item.value}
                    >
                      <Icon size={17} />
                      {item.label}
                    </Button>
                  );
                })}
              </div>

              <label className="quick-amount-field">
                <span>Số tiền</span>
                <div>
                  <MoneyInput
                    autoFocus
                    value={amount}
                    onValueChange={setAmount}
                    placeholder="0"
                    aria-label="Số tiền giao dịch"
                  />
                </div>
              </label>

              {workspace.wallets.length ? (
                <div className="quick-transaction-grid">
                  <div className="quick-field">
                    <span>{type === "transfer" ? "Ví gửi" : "Ví"}</span>
                    <Select
                      value={walletId}
                      onValueChange={(nextWalletId) => {
                        setWalletId(nextWalletId);
                        if (nextWalletId === toWalletId) {
                          setToWalletId(destinationWallet(workspace, nextWalletId));
                        }
                      }}
                      label="Chọn ví"
                      options={workspace.wallets.map((wallet) => ({
                        value: wallet.id,
                        label: wallet.name,
                      }))}
                    />
                  </div>

                  {type === "transfer" ? (
                    <div className="quick-field">
                      <span>Ví nhận</span>
                      <Select
                        value={toWalletId}
                        onValueChange={setToWalletId}
                        label="Chọn ví nhận"
                        options={workspace.wallets.map((wallet) => ({
                          value: wallet.id,
                          label: wallet.name,
                          disabled: wallet.id === walletId,
                        }))}
                      />
                    </div>
                  ) : (
                    <div className="quick-field">
                      <span>Danh mục</span>
                      <Select
                        value={categoryId}
                        onValueChange={setCategoryId}
                        label="Chọn danh mục"
                        options={[
                          { value: "none", label: "Không chọn" },
                          ...categories.map((category) => ({
                            value: category.id,
                            label: category.name,
                          })),
                        ]}
                      />
                    </div>
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

              <Button variant="unstyled" size="auto"
                type="button"
                className="quick-details-toggle"
                onClick={() => setShowDetails((current) => !current)}
                aria-expanded={showDetails}
              >
                <CalendarDays size={16} />
                {showDetails ? "Ẩn thông tin bổ sung" : "Thêm nội dung hoặc đổi ngày"}
              </Button>

              {showDetails && (
                <div className="quick-details">
                  <label className="quick-field">
                    <span>Ngày giao dịch</span>
                    <Input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </label>
                  <label className="quick-field">
                    <span>Nội dung</span>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Ăn trưa, nhận lương"
                      maxLength={2_000}
                    />
                  </label>
                </div>
              )}

              <p className="quick-status-hint">{statusHint}</p>
            </div>

            <div className="quick-transaction-footer">
              <label className="quick-keep-open">
                <input
                  type="checkbox"
                  checked={keepOpen}
                  onChange={(event) => setKeepOpen(event.target.checked)}
                />
                Nhập tiếp sau khi lưu
              </label>
              <Button
                type="submit"
                disabled={pending || !workspace.wallets.length}
                className="quick-submit"
              >
                <Check size={17} />
                {pending ? "Đang lưu" : "Lưu giao dịch"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
