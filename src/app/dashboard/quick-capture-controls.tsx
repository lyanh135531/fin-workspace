"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Smartphone,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  createQuickCaptureTokenAction,
  getQuickCaptureStateAction,
  revokeQuickCaptureTokenAction,
} from "@/app/dashboard/settings/quick-capture-actions";
import {
  Button,
  ConfirmDelete,
  Input,
  Select,
  Sheet,
  SheetBackButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import { APP_ORIGIN } from "@/lib/host-routing";
import { cn } from "@/lib/utils";
import type { QuickCaptureSettingsState } from "@/services/quick-capture-service";

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "180", label: "6 tháng" },
  { value: "365", label: "1 năm" },
];

const NO_CATEGORY_VALUE = "__none__";

function subscribeNoop() {
  return () => {};
}

function getClientOrigin() {
  return window.location.origin;
}

function getServerOrigin() {
  return APP_ORIGIN;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label);
  } catch {
    toast.error("Không thể sao chép tự động trên trình duyệt này.");
  }
}

function CopyableKeyChip({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        void copyToClipboard(value, `Đã sao chép khóa "${value}".`)
      }
      title={`Chạm để sao chép "${value}"`}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
    >
      <span>{value}</span>
      <Copy size={10} className="text-[var(--text-muted)]" aria-hidden="true" />
    </button>
  );
}

export function QuickCaptureSummaryCard({
  onOpenSetup,
}: {
  onOpenSetup: () => void;
}) {
  const [state, setState] = useState<QuickCaptureSettingsState | null>(null);

  useEffect(() => {
    let active = true;
    void getQuickCaptureStateAction().then((res) => {
      if (!active) return;
      if (res.ok) setState(res.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const activeTokenCount = state && state.available ? state.tokens.length : 0;

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        Tự động hóa
      </p>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <button
          type="button"
          onClick={onOpenSetup}
          className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Zap size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                Ghi nhanh từ biên lai
              </h3>
              <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                Chạm mặt lưng điện thoại sau khi thanh toán để chọn danh mục và lưu ngay
              </p>
            </div>
          </div>

          {state === null ? (
            <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {activeTokenCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                  <BadgeCheck size={11} aria-hidden="true" />
                  Đang bật
                </span>
              )}
              <ChevronRight
                size={16}
                className="text-[var(--text-muted)]"
                aria-hidden="true"
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export function QuickCaptureSetupSheet({
  open,
  isMobile = false,
  onBack,
  onClose,
}: {
  open: boolean;
  isMobile?: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  const origin = useSyncExternalStore(
    subscribeNoop,
    getClientOrigin,
    getServerOrigin,
  );
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<QuickCaptureSettingsState | null>(null);
  const [activeTab, setActiveTab] = useState<string>("connect");

  // Device connection form state (raw token kept strictly in component memory)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvancedTokenOpts, setShowAdvancedTokenOpts] = useState(false);
  const [deviceName, setDeviceName] = useState("iPhone cá nhân");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string>(NO_CATEGORY_VALUE);
  const [expiresInDays, setExpiresInDays] = useState<string>("90");
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<{
    token: string;
    name: string;
    walletName: string;
  } | null>(null);

  // Phone setup guide state
  const [guidePlatform, setGuidePlatform] = useState<"ios" | "android">("ios");
  const iosShortcutTemplateUrl =
    process.env.NEXT_PUBLIC_IOS_SHORTCUT_URL?.trim() || "";

  const reloadState = useCallback(async () => {
    const res = await getQuickCaptureStateAction();
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setState(res.data);
    if (res.data.available && res.data.wallets.length > 0) {
      const wallets = res.data.wallets;
      setSelectedWalletId((prev) => {
        if (prev && wallets.some((w) => w.id === prev)) {
          return prev;
        }
        const momoWallet = wallets.find((w) => /\bmomo\b/i.test(w.name));
        return (momoWallet ?? wallets[0])!.id;
      });
    }
  }, []);

  const resetTransientState = useCallback(() => {
    setNewlyCreatedToken(null);
    setShowCreateForm(false);
    setShowAdvancedTokenOpts(false);
    setActiveTab("connect");
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    void getQuickCaptureStateAction().then((res) => {
      if (!mounted) return;
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setState(res.data);
      if (res.data.available && res.data.wallets.length > 0) {
        const momoWallet = res.data.wallets.find((w) =>
          /\bmomo\b/i.test(w.name),
        );
        setSelectedWalletId((momoWallet ?? res.data.wallets[0])!.id);
      }
    });
    return () => {
      mounted = false;
    };
  }, [open]);

  const parseEndpoint = `${origin}/api/quick-capture/parse`;
  const commitEndpoint = `${origin}/api/quick-capture/commit`;

  const walletOptions = useMemo(() => {
    if (!state || !state.available) return [];
    return state.wallets.map((w) => ({
      value: w.id,
      label: w.name,
    }));
  }, [state]);

  const categoryOptions = useMemo(() => {
    if (!state || !state.available) {
      return [{ value: NO_CATEGORY_VALUE, label: "Tự gợi ý theo người nhận" }];
    }
    return [
      { value: NO_CATEGORY_VALUE, label: "Tự gợi ý theo người nhận" },
      ...state.categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    ];
  }, [state]);

  function handleCreateToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state || !state.available) return;
    if (!deviceName.trim()) {
      toast.error("Vui lòng nhập tên thiết bị.");
      return;
    }
    if (!selectedWalletId) {
      toast.error("Vui lòng chọn ví trừ tiền mặc định.");
      return;
    }

    startTransition(async () => {
      const res = await createQuickCaptureTokenAction({
        workspaceId: state.workspaceId,
        defaultWalletId: selectedWalletId,
        defaultCategoryId:
          selectedCategoryId === NO_CATEGORY_VALUE ? null : selectedCategoryId,
        name: deviceName,
        expiresInDays: Number(expiresInDays),
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      setNewlyCreatedToken({
        token: res.data.token,
        name: res.data.tokenInfo.name,
        walletName: res.data.tokenInfo.defaultWalletName,
      });
      setShowCreateForm(false);
      toast.success("Đã tạo khóa liên kết thiết bị.");
      await reloadState();
    });
  }

  function handleRevokeToken(tokenId: string) {
    startTransition(async () => {
      const res = await revokeQuickCaptureTokenAction(tokenId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Đã thu hồi liên kết thiết bị.");
      await reloadState();
    });
  }

  const hasLinkedDevices =
    state?.available === true && state.tokens.length > 0;
  const shouldRenderCreateForm =
    state?.available === true && (!hasLinkedDevices || showCreateForm);

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetTransientState();
          onClose();
        }
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        placement="inset"
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader>
          <div className="flex items-center gap-2.5">
            {onBack && (
              <SheetBackButton
                onBack={() => {
                  resetTransientState();
                  onBack();
                }}
              />
            )}
            <span
              className="grid size-8.5 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Zap size={16} />
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-[15px] sm:text-base">
                Ghi nhanh từ biên lai
              </SheetTitle>
              <SheetDescription className="truncate">
                Chạm mặt lưng điện thoại để lưu chi tiêu
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {state === null ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : !state.available ? (
          <div className="p-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-xs leading-relaxed text-[var(--text-secondary)]">
              Vui lòng tạo hoặc tham gia một nhóm tài chính trước khi thiết lập ghi nhanh trên điện thoại.
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(String(val))}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            {/* Non-scrolling 2-Tab Segmented Bar */}
            <div className="shrink-0 px-4 pt-3.5 pb-1 sm:px-6">
              <TabsList variant="segmented">
                <TabsTrigger value="connect">Kết nối</TabsTrigger>
                <TabsTrigger value="guide">Hướng dẫn</TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable Tab Viewport */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4">
              {/* ── TAB 1: CLEAN PASSKEY-STYLE DEVICE CONNECTION ── */}
              <TabsContent value="connect" className="space-y-4">
                <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-secondary)] px-3.5 py-2.5 text-xs">
                  <span className="text-[var(--text-muted)]">Sổ ghi nhận</span>
                  <span className="truncate font-semibold text-[var(--foreground)]">
                    {state.workspaceName}
                  </span>
                </div>

                {newlyCreatedToken && (
                  <section className="space-y-3 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          Khóa xác thực · {newlyCreatedToken.name}
                        </p>
                        <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                          Chỉ hiển thị một lần. Sao chép khóa này trước khi chuyển sang bước cài đặt.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        onClick={() => setNewlyCreatedToken(null)}
                        aria-label="Đóng khung khóa xác thực"
                      >
                        <X />
                      </Button>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-[11px] break-all select-all text-[var(--foreground)]">
                      Bearer {newlyCreatedToken.token}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          void copyToClipboard(
                            `Bearer ${newlyCreatedToken.token}`,
                            "Đã sao chép khóa xác thực.",
                          )
                        }
                      >
                        <Copy size={13} />
                        Sao chép khóa
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("guide")}
                      >
                        Xem hướng dẫn cài
                        <ArrowRight size={13} />
                      </Button>
                    </div>
                  </section>
                )}

                {hasLinkedDevices && (
                  <div className="space-y-2.5">
                    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                      {state.tokens.map((tok) => (
                        <div
                          key={tok.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="grid size-8.5 shrink-0 place-items-center rounded-xl bg-[var(--surface-secondary)] text-[var(--text-secondary)]"
                              aria-hidden="true"
                            >
                              <Smartphone size={15} />
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                                  {tok.name}
                                </span>
                                <span className="shrink-0 rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                                  {tok.tokenPrefix}•••
                                </span>
                              </div>
                              <p className="truncate text-[11px] tabular-nums text-[var(--text-muted)]">
                                {tok.defaultWalletName}
                                {tok.lastUsedAt
                                  ? ` · Dùng ${formatShortDate(tok.lastUsedAt)}`
                                  : ` · Hạn ${formatShortDate(tok.expiresAt)}`}
                              </p>
                            </div>
                          </div>

                          <ConfirmDelete
                            ariaLabel={`Thu hồi kết nối ${tok.name}`}
                            title="Thu hồi liên kết thiết bị?"
                            description={`Thiết bị "${tok.name}" sẽ ngừng gửi giao dịch vào sổ cho đến khi được cấp khóa mới.`}
                            confirmLabel="Thu hồi"
                            onConfirm={() => handleRevokeToken(tok.id)}
                            trigger={
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={pending}
                                aria-label={`Thu hồi ${tok.name}`}
                              >
                                Thu hồi
                              </Button>
                            }
                          />
                        </div>
                      ))}
                    </div>

                    {!showCreateForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateForm(true)}
                        className="w-full"
                      >
                        <Plus size={14} />
                        Liên kết thêm thiết bị
                      </Button>
                    )}
                  </div>
                )}

                {shouldRenderCreateForm && (
                  <form
                    onSubmit={handleCreateToken}
                    className={cn(
                      "space-y-3.5",
                      hasLinkedDevices &&
                        "border-t border-[var(--border)] pt-4",
                    )}
                  >
                    {hasLinkedDevices && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          Thiết bị mới
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateForm(false)}
                        >
                          Hủy
                        </Button>
                      </div>
                    )}

                    <Input
                      label="Tên thiết bị"
                      id="qc-device-name"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="Ví dụ: iPhone cá nhân"
                      maxLength={80}
                    />

                    <div className="space-y-1.5">
                      <Select
                        label="Ví trừ tiền mặc định"
                        value={selectedWalletId}
                        onValueChange={setSelectedWalletId}
                        options={walletOptions}
                        placeholder="Chọn ví thanh toán"
                      />
                      <p className="text-[11px] leading-snug text-[var(--text-muted)]">
                        Tự động ưu tiên ví trùng tên ứng dụng thanh toán (MoMo, VCB, Techcombank...).
                      </p>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedTokenOpts((v) => !v)}
                        className="inline-flex cursor-pointer items-center gap-1 py-0.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
                      >
                        <ChevronDown
                          size={14}
                          className={cn(
                            "transition-transform duration-150",
                            showAdvancedTokenOpts && "rotate-180",
                          )}
                        />
                        Tùy chọn nâng cao
                      </button>

                      {showAdvancedTokenOpts && (
                        <div className="mt-2.5 grid gap-3 rounded-2xl bg-[var(--surface-secondary)] p-3.5">
                          <Select
                            label="Danh mục mặc định khi chưa có gợi ý"
                            value={selectedCategoryId}
                            onValueChange={setSelectedCategoryId}
                            options={categoryOptions}
                          />
                          <Select
                            label="Thời hạn hiệu lực"
                            value={expiresInDays}
                            onValueChange={setExpiresInDays}
                            options={EXPIRY_OPTIONS}
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-1">
                      <Button
                        type="submit"
                        disabled={pending || walletOptions.length === 0}
                        className="w-full"
                      >
                        {pending ? "Đang tạo khóa..." : "Tạo khóa liên kết"}
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>

              {/* ── TAB 2: PRODUCTION-READY END-USER GUIDE ──────── */}
              <TabsContent value="guide" className="space-y-4">
                {newlyCreatedToken ? (
                  <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] px-3.5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        Khóa xác thực · {newlyCreatedToken.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-secondary)]">
                        Bấm chép lại bất cứ lúc nào sau khi dán liên kết
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        void copyToClipboard(
                          `Bearer ${newlyCreatedToken.token}`,
                          "Đã sao chép khóa xác thực.",
                        )
                      }
                    >
                      <Copy size={12} />
                      Chép khóa
                    </Button>
                  </div>
                ) : !hasLinkedDevices ? (
                  <div className="flex items-center justify-between gap-2.5 rounded-2xl bg-[var(--surface-secondary)] px-3.5 py-2.5 text-xs">
                    <span className="text-[var(--text-secondary)]">
                      Tạo khóa xác thực cho máy trước khi cài đặt
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("connect")}
                    >
                      Tạo khóa
                    </Button>
                  </div>
                ) : null}

                <Tabs
                  value={guidePlatform}
                  onValueChange={(val) =>
                    setGuidePlatform(val === "android" ? "android" : "ios")
                  }
                  className="gap-4"
                >
                  <TabsList variant="underline">
                    <TabsTrigger value="ios">iPhone (iOS)</TabsTrigger>
                    <TabsTrigger value="android">Android</TabsTrigger>
                  </TabsList>

                  {/* iOS Self-Contained 4-Step Guide */}
                  <TabsContent value="ios" className="space-y-4">
                    {iosShortcutTemplateUrl && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--foreground)]">
                            Phím tắt mẫu có sẵn
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                            Thêm nhanh vào iPhone rồi dán khóa xác thực khi được hỏi
                          </p>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          render={
                            <a
                              href={iosShortcutTemplateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          Tải phím tắt
                        </Button>
                      </div>
                    )}

                    <ol className="relative ml-2.5 space-y-4 border-l border-[var(--border)] pl-5 text-xs leading-relaxed text-[var(--text-secondary)]">
                      <li className="relative">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          1
                        </span>
                        <p className="font-semibold text-[var(--foreground)]">
                          Chụp & đọc chữ trên màn hình
                        </p>
                        <p className="mt-0.5">
                          Mở ứng dụng <strong className="font-medium text-[var(--foreground)]">Phím tắt</strong> <span className="text-[var(--text-muted)]">(Shortcuts)</span>, tạo phím tắt mới và thêm lần lượt:
                        </p>
                        <div className="mt-1.5 rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-[11px]">
                          <p>
                            1. <strong className="font-medium text-[var(--foreground)]">Chụp ảnh màn hình</strong> <span className="text-[var(--text-muted)]">(Take Screenshot)</span>
                          </p>
                          <p className="mt-1">
                            2. <strong className="font-medium text-[var(--foreground)]">Trích xuất văn bản từ hình ảnh</strong> <span className="text-[var(--text-muted)]">(Extract Text from Image)</span>
                          </p>
                        </div>
                      </li>

                      <li className="relative space-y-1.5">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          2
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--foreground)]">
                            Nhận danh sách danh mục
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void copyToClipboard(
                                parseEndpoint,
                                "Đã sao chép liên kết bước 2.",
                              )
                            }
                          >
                            <Copy size={12} />
                            Chép liên kết 1
                          </Button>
                        </div>
                        <p>
                          Thêm <strong className="font-medium text-[var(--foreground)]">Lấy nội dung của URL</strong> <span className="text-[var(--text-muted)]">(Get Contents of URL)</span>, dán <em>Liên kết 1</em>, mở mũi tên chi tiết chọn phương thức <strong className="font-medium text-[var(--foreground)]">POST</strong>:
                        </p>
                        <div className="space-y-1.5 rounded-xl bg-[var(--surface-secondary)] px-3 py-2.5 text-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[var(--text-muted)]">
                              Tiêu đề (Headers)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CopyableKeyChip value="Authorization" />
                              <span className="text-[var(--foreground)]">
                                = Khóa xác thực
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border)] pt-1.5">
                            <span className="text-[var(--text-muted)]">
                              Nội dung (JSON)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CopyableKeyChip value="text" />
                              <span className="text-[var(--foreground)]">
                                = Văn bản từ Hình ảnh
                              </span>
                            </span>
                          </div>
                        </div>
                      </li>

                      <li className="relative">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          3
                        </span>
                        <p className="font-semibold text-[var(--foreground)]">
                          Hiện bảng chọn trên màn hình
                        </p>
                        <p className="mt-0.5">
                          Thêm <strong className="font-medium text-[var(--foreground)]">Lấy giá trị từ điển</strong> <span className="text-[var(--text-muted)]">(Get Dictionary Value)</span> với khóa <CopyableKeyChip value="options" />, rồi thêm tiếp <strong className="font-medium text-[var(--foreground)]">Chọn từ danh sách</strong> <span className="text-[var(--text-muted)]">(Choose from List)</span>.
                        </p>
                      </li>

                      <li className="relative space-y-1.5">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          4
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--foreground)]">
                            Lưu vào sổ & gán chạm mặt lưng
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void copyToClipboard(
                                commitEndpoint,
                                "Đã sao chép liên kết lưu giao dịch.",
                              )
                            }
                          >
                            <Copy size={12} />
                            Chép liên kết 2
                          </Button>
                        </div>
                        <p>
                          Thêm <strong className="font-medium text-[var(--foreground)]">Lấy nội dung của URL</strong> lần hai, dán <em>Liên kết 2</em> và đổi sang <strong className="font-medium text-[var(--foreground)]">POST</strong>:
                        </p>
                        <div className="space-y-1.5 rounded-xl bg-[var(--surface-secondary)] px-3 py-2.5 text-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[var(--text-muted)]">
                              Tiêu đề (Headers)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CopyableKeyChip value="Authorization" />
                              <span className="text-[var(--foreground)]">
                                = Khóa xác thực
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border)] pt-1.5">
                            <span className="text-[var(--text-muted)]">
                              Nội dung (JSON)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CopyableKeyChip value="selectedOption" />
                              <span className="text-[var(--foreground)]">
                                = Mục được chọn
                              </span>
                            </span>
                          </div>
                        </div>
                        <p className="pt-0.5">
                          Cuối cùng vào <strong className="font-medium text-[var(--foreground)]">Cài đặt → Trợ năng → Cảm ứng → Chạm vào mặt sau → Chạm hai lần</strong>, chọn phím tắt vừa tạo. Lần đầu chạy hãy bấm <strong className="font-medium text-[var(--foreground)]">Luôn cho phép</strong> khi iPhone hỏi quyền kết nối.
                        </p>
                      </li>
                    </ol>
                  </TabsContent>

                  {/* Android Foolproof Form-Encoded Guide */}
                  <TabsContent value="android">
                    <ol className="relative ml-2.5 space-y-4 border-l border-[var(--border)] pl-5 text-xs leading-relaxed text-[var(--text-secondary)]">
                      <li className="relative">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          1
                        </span>
                        <p className="font-semibold text-[var(--foreground)]">
                          Bắt thông báo thanh toán
                        </p>
                        <p className="mt-0.5">
                          Trong ứng dụng <strong className="font-medium text-[var(--foreground)]">MacroDroid</strong>, tạo Macro mới với sự kiện <strong className="font-medium text-[var(--foreground)]">Nhận thông báo</strong> <span className="text-[var(--text-muted)]">(Notification Received)</span> từ <strong className="font-medium text-[var(--foreground)]">MoMo</strong> hoặc ứng dụng ngân hàng.
                        </p>
                      </li>

                      <li className="relative space-y-1.5">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          2
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--foreground)]">
                            Tự động gửi về sổ Felix
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void copyToClipboard(
                                commitEndpoint,
                                "Đã sao chép liên kết lưu giao dịch.",
                              )
                            }
                          >
                            <Copy size={12} />
                            Chép liên kết
                          </Button>
                        </div>
                        <p>
                          Thêm hành động <strong className="font-medium text-[var(--foreground)]">Yêu cầu HTTP</strong> <span className="text-[var(--text-muted)]">(HTTP Request)</span>, dán liên kết vừa chép và chọn phương thức <strong className="font-medium text-[var(--foreground)]">POST</strong>:
                        </p>
                        <div className="space-y-1.5 rounded-xl bg-[var(--surface-secondary)] px-3 py-2.5 text-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[var(--text-muted)]">
                              Header
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CopyableKeyChip value="Authorization" />
                              <span className="text-[var(--foreground)]">
                                = Khóa xác thực
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border)] pt-1.5">
                            <span className="text-[var(--text-muted)]">
                              Tham số (Form)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CopyableKeyChip value="text" />
                              <span className="font-mono text-[var(--foreground)]">
                                = [not_title] [not_text]
                              </span>
                            </span>
                          </div>
                        </div>
                      </li>

                      <li className="relative">
                        <span className="absolute -left-[29px] top-0.5 grid size-4.5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] font-semibold text-[var(--foreground)]">
                          3
                        </span>
                        <p className="font-semibold text-[var(--foreground)]">
                          Bật quyền đọc thông báo
                        </p>
                        <p className="mt-0.5">
                          Lưu Macro và cấp quyền truy cập thông báo cho MacroDroid. Mỗi khi chuyển khoản hoặc thanh toán MoMo thành công, giao dịch sẽ tự động ghi vào đúng ví và danh mục gợi ý.
                        </p>
                      </li>
                    </ol>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
