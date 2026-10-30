"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  KeyRound,
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
  TabsCount,
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

const IOS_BACK_TAP_PATH = [
  "Cài đặt",
  "Trợ năng",
  "Cảm ứng",
  "Chạm vào mặt sau",
  "Chạm hai lần",
] as const;

const NO_CATEGORY_VALUE = "__none__";
const IOS_SHORTCUT_URL_CLIENT_PATTERN =
  /^https:\/\/(?:www\.)?icloud\.com\/shortcuts\/[A-Za-z0-9_-]{8,128}\/?$/i;

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

async function copyToClipboard(value: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label);
    return true;
  } catch {
    toast.error("Không thể sao chép tự động trên trình duyệt này.");
    return false;
  }
}

function CopyableKeyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        void copyToClipboard(value, `Đã sao chép "${value}".`).then((ok) => {
          if (!ok) return;
          setCopied(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setCopied(false), 1600);
        });
      }}
      title={`Chạm để sao chép "${value}"`}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
    >
      <span>{value}</span>
      {copied ? (
        <Check size={10} className="text-[var(--success)]" aria-hidden="true" />
      ) : (
        <Copy
          size={10}
          className="text-[var(--text-muted)]"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function IosSettingsBreadcrumb() {
  return (
    <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[11px] leading-none">
      {IOS_BACK_TAP_PATH.map((step, index) => {
        const isFinal = index === IOS_BACK_TAP_PATH.length - 1;
        return (
          <span key={step} className="inline-flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                size={11}
                className="text-[var(--text-muted)]"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "rounded-md px-1.5 py-1",
                isFinal
                  ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                  : "bg-[var(--surface-secondary)] font-medium text-[var(--text-secondary)]",
              )}
            >
              {step}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function subscribeMobileViewport(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getClientIsMobile() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getServerIsMobile() {
  return false;
}

export function QuickCaptureSetupSheet({
  open,
  isMobile: isMobileProp,
  onBack,
  onClose,
}: {
  open: boolean;
  isMobile?: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  const viewportIsMobile = useSyncExternalStore(
    subscribeMobileViewport,
    getClientIsMobile,
    getServerIsMobile,
  );
  const isMobile = isMobileProp ?? viewportIsMobile;
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
  const [expiresInDays, setExpiresInDays] = useState<string>("365");
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<{
    token: string;
    name: string;
    walletName: string;
  } | null>(null);
  const [tokenCopiedFeedback, setTokenCopiedFeedback] = useState(false);
  const tokenCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phone setup guide state
  const [guidePlatform, setGuidePlatform] = useState<"ios" | "android">("ios");
  const [showManualIosSteps, setShowManualIosSteps] = useState(false);

  useEffect(() => {
    return () => {
      if (tokenCopyTimerRef.current) clearTimeout(tokenCopyTimerRef.current);
    };
  }, []);

  const markTokenCopied = useCallback(() => {
    setTokenCopiedFeedback(true);
    if (tokenCopyTimerRef.current) clearTimeout(tokenCopyTimerRef.current);
    tokenCopyTimerRef.current = setTimeout(
      () => setTokenCopiedFeedback(false),
      1800,
    );
  }, []);

  const iosShortcutTemplateUrl = useMemo(() => {
    const serverUrl = state?.available ? state.iosShortcutUrl : null;
    if (serverUrl && IOS_SHORTCUT_URL_CLIENT_PATTERN.test(serverUrl)) {
      return serverUrl;
    }
    const fallbackUrl = process.env.NEXT_PUBLIC_IOS_SHORTCUT_URL?.trim() || "";
    return IOS_SHORTCUT_URL_CLIENT_PATTERN.test(fallbackUrl) ? fallbackUrl : "";
  }, [state]);

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
    setTokenCopiedFeedback(false);
    setShowCreateForm(false);
    setShowAdvancedTokenOpts(false);
    setShowManualIosSteps(false);
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

  const selectedWalletLabel = useMemo(() => {
    if (!state || !state.available) return "";
    return (
      state.wallets.find((w) => w.id === selectedWalletId)?.name ??
      state.wallets[0]?.name ??
      ""
    );
  }, [state, selectedWalletId]);

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

  const selectedCategorySummary = useMemo(() => {
    if (selectedCategoryId === NO_CATEGORY_VALUE) return "Tự gợi ý";
    if (!state || !state.available) return "Tự gợi ý";
    return (
      state.categories.find((c) => c.id === selectedCategoryId)?.name ??
      "Tự gợi ý"
    );
  }, [state, selectedCategoryId]);

  const selectedExpirySummary = useMemo(() => {
    return (
      EXPIRY_OPTIONS.find((opt) => opt.value === expiresInDays)?.label ??
      "1 năm"
    );
  }, [expiresInDays]);

  function handleCopyBearer(rawToken: string) {
    void copyToClipboard(
      `Bearer ${rawToken}`,
      "Đã sao chép khóa xác thực.",
    ).then((ok) => {
      if (ok) markTokenCopied();
    });
  }

  function issueTokenWithClipboard(options?: { switchToIosGuide?: boolean }) {
    if (!state || !state.available) return;
    const effectiveDeviceName =
      options?.switchToIosGuide && !deviceName.trim()
        ? "iPhone cá nhân"
        : deviceName.trim();
    if (!effectiveDeviceName) {
      toast.error("Vui lòng nhập tên thiết bị.");
      return;
    }
    if (!selectedWalletId) {
      toast.error("Vui lòng chọn ví mặc định.");
      return;
    }

    // Reserve transient user activation synchronously for iOS Safari / WebKit
    let resolveClipboardBlob: ((blob: Blob) => void) | null = null;
    let rejectClipboardBlob: ((reason?: unknown) => void) | null = null;
    const clipboardWritePromise =
      typeof ClipboardItem !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.write === "function"
        ? navigator.clipboard
            .write([
              new ClipboardItem({
                "text/plain": new Promise<Blob>((resolve, reject) => {
                  resolveClipboardBlob = resolve;
                  rejectClipboardBlob = reject;
                }),
              }),
            ])
            .then(() => true)
            .catch(() => false)
        : null;

    startTransition(async () => {
      try {
        const res = await createQuickCaptureTokenAction({
          workspaceId: state.workspaceId,
          defaultWalletId: selectedWalletId,
          defaultCategoryId:
            selectedCategoryId === NO_CATEGORY_VALUE
              ? null
              : selectedCategoryId,
          name: effectiveDeviceName,
          expiresInDays: Number(expiresInDays),
        });

        if (!res.ok) {
          rejectClipboardBlob?.(new Error("token_creation_failed"));
          toast.error(res.message);
          return;
        }

        const bearerValue = `Bearer ${res.data.token}`;
        resolveClipboardBlob?.(new Blob([bearerValue], { type: "text/plain" }));
        let copied = clipboardWritePromise
          ? await clipboardWritePromise
          : false;
        if (
          !copied &&
          typeof navigator !== "undefined" &&
          typeof navigator.clipboard?.writeText === "function"
        ) {
          copied = await navigator.clipboard
            .writeText(bearerValue)
            .then(() => true)
            .catch(() => false);
        }

        if (copied) markTokenCopied();
        setNewlyCreatedToken({
          token: res.data.token,
          name: res.data.tokenInfo.name,
          walletName: res.data.tokenInfo.defaultWalletName,
        });
        setShowCreateForm(false);

        if (options?.switchToIosGuide) {
          setGuidePlatform("ios");
          setActiveTab("guide");
          toast.success(
            copied
              ? "Đã tạo & sao chép khóa. Bấm mở Phím tắt mẫu ở bước 1."
              : "Đã tạo khóa xác thực. Bấm mở Phím tắt mẫu ở bước 1.",
          );
        } else {
          toast.success(
            copied
              ? "Đã tạo & sao chép khóa xác thực."
              : "Đã tạo khóa liên kết thiết bị.",
          );
        }

        await reloadState();
      } catch {
        rejectClipboardBlob?.(new Error("token_creation_error"));
        toast.error("Không thể tạo khóa liên kết lúc này. Vui lòng thử lại.");
      }
    });
  }

  function handleCreateToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    issueTokenWithClipboard();
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

  const manualIosSteps = (
    <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-secondary)_45%,var(--surface))] text-xs leading-relaxed text-[var(--text-secondary)]">
      <li className="space-y-1.5 p-3.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
            01
          </span>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            Chụp & đọc chữ trên màn hình
          </p>
        </div>
        <p>
          Trong ứng dụng{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Phím tắt
          </strong>
          , tạo phím tắt mới và thêm 2 tác vụ:{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Chụp ảnh màn hình
          </strong>{" "}
          →{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Trích xuất văn bản từ hình ảnh
          </strong>
          .
        </p>
      </li>

      <li className="space-y-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
              02
            </span>
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
              Nhận danh sách danh mục
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void copyToClipboard(parseEndpoint, "Đã sao chép URL bước 2.")
            }
          >
            <Copy size={12} />
            URL 1
          </Button>
        </div>
        <p>
          Thêm{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Lấy nội dung của URL
          </strong>
          , dán <em>URL 1</em> và chọn phương thức{" "}
          <strong className="font-medium text-[var(--foreground)]">POST</strong>:
        </p>
        <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">Header</span>
            <span className="inline-flex items-center gap-1.5">
              <CopyableKeyChip value="Authorization" />
              <span className="text-[var(--foreground)]">= Khóa xác thực</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-1.5">
            <span className="text-[var(--text-muted)]">JSON</span>
            <span className="inline-flex items-center gap-1.5">
              <CopyableKeyChip value="text" />
              <span className="text-[var(--foreground)]">
                = Văn bản từ Hình ảnh
              </span>
            </span>
          </div>
        </div>
      </li>

      <li className="space-y-1.5 p-3.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
            03
          </span>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            Hiện bảng chọn danh mục
          </p>
        </div>
        <p>
          Thêm{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Lấy giá trị từ điển
          </strong>{" "}
          với khóa <CopyableKeyChip value="options" />, sau đó thêm{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Chọn từ danh sách
          </strong>
          .
        </p>
      </li>

      <li className="space-y-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
              04
            </span>
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
              Lưu giao dịch & gán chạm lưng
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void copyToClipboard(commitEndpoint, "Đã sao chép URL bước 4.")
            }
          >
            <Copy size={12} />
            URL 2
          </Button>
        </div>
        <p>
          Thêm{" "}
          <strong className="font-medium text-[var(--foreground)]">
            Lấy nội dung của URL
          </strong>{" "}
          lần hai, dán <em>URL 2</em> và chọn{" "}
          <strong className="font-medium text-[var(--foreground)]">POST</strong>:
        </p>
        <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-muted)]">Header</span>
            <span className="inline-flex items-center gap-1.5">
              <CopyableKeyChip value="Authorization" />
              <span className="text-[var(--foreground)]">= Khóa xác thực</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-1.5">
            <span className="text-[var(--text-muted)]">JSON</span>
            <span className="inline-flex items-center gap-1.5">
              <CopyableKeyChip value="selectedOption" />
              <span className="text-[var(--foreground)]">= Mục được chọn</span>
            </span>
          </div>
        </div>
        <IosSettingsBreadcrumb />
      </li>
    </ol>
  );

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
                {state?.available
                  ? `Sổ ${state.workspaceName} · Chạm mặt lưng lưu chi tiêu`
                  : "Chạm mặt lưng điện thoại để lưu chi tiêu"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {state === null ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
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
            {/* Non-scrolling Segmented Bar */}
            <div className="shrink-0 px-4 pt-3 pb-1 sm:px-6">
              <TabsList variant="segmented">
                <TabsTrigger value="connect">
                  Kết nối
                  {hasLinkedDevices && (
                    <TabsCount>{state.tokens.length}</TabsCount>
                  )}
                </TabsTrigger>
                <TabsTrigger value="guide">Hướng dẫn</TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable Tab Viewport */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4">
              {/* ── TAB 1: DEVICE CONNECTION ────────────────────── */}
              <TabsContent value="connect" className="space-y-3.5">
                {newlyCreatedToken && (
                  <section className="space-y-3 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_30%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
                          aria-hidden="true"
                        >
                          <KeyRound size={15} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                            {newlyCreatedToken.name}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-secondary)]">
                            Ví {newlyCreatedToken.walletName} · Chỉ hiển thị một lần
                          </p>
                        </div>
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

                    <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 pr-1.5 pl-3">
                      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--foreground)] select-all">
                        Bearer {newlyCreatedToken.token}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyBearer(newlyCreatedToken.token)}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[var(--surface-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        {tokenCopiedFeedback ? (
                          <>
                            <Check
                              size={12}
                              className="text-[var(--success)]"
                              aria-hidden="true"
                            />
                            Đã chép
                          </>
                        ) : (
                          <>
                            <Copy
                              size={12}
                              className="text-[var(--text-secondary)]"
                              aria-hidden="true"
                            />
                            Chép
                          </>
                        )}
                      </button>
                    </div>

                    {iosShortcutTemplateUrl ? (
                      <div className="space-y-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleCopyBearer(newlyCreatedToken.token)
                          }
                          render={
                            <a
                              href={iosShortcutTemplateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                          className="w-full"
                        >
                          <Smartphone size={13} />
                          Chép khóa & Cài phím tắt mẫu
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGuidePlatform("ios");
                            setActiveTab("guide");
                          }}
                          className="w-full"
                        >
                          Xem bước bật Chạm hai lần mặt sau
                          <ArrowRight size={13} />
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            handleCopyBearer(newlyCreatedToken.token)
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
                          Hướng dẫn cài
                          <ArrowRight size={13} />
                        </Button>
                      </div>
                    )}
                  </section>
                )}

                {hasLinkedDevices && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Thiết bị đang kết nối
                      </span>
                      {!showCreateForm && (
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(true)}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--primary)] transition-opacity hover:opacity-80"
                        >
                          <Plus size={13} aria-hidden="true" />
                          Thêm thiết bị
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-secondary)_45%,var(--surface))]">
                      {state.tokens.map((tok) => (
                        <div
                          key={tok.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="grid size-8.5 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                              aria-hidden="true"
                            >
                              <Smartphone size={15} />
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="size-1.5 shrink-0 rounded-full bg-[var(--success)]"
                                  aria-hidden="true"
                                />
                                <span className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                                  {tok.name}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
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
                  </section>
                )}

                {shouldRenderCreateForm && (
                  <form onSubmit={handleCreateToken} className="space-y-3">
                    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-secondary)_45%,var(--surface))] p-3.5">
                      {hasLinkedDevices && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--foreground)]">
                            Thiết bị mới
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            className="cursor-pointer text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
                          >
                            Đóng
                          </button>
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
                          label="Ví mặc định"
                          value={selectedWalletId}
                          onValueChange={setSelectedWalletId}
                          options={walletOptions}
                          placeholder="Chọn ví thanh toán"
                        />
                        <p className="px-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
                          Tự ưu tiên ví trùng tên ứng dụng thanh toán trên biên lai.
                        </p>
                      </div>

                      <div className="border-t border-[var(--border)] pt-2.5">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedTokenOpts((v) => !v)}
                          aria-expanded={showAdvancedTokenOpts}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 py-0.5 text-left text-xs transition-colors"
                        >
                          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)]">
                            <ChevronDown
                              size={13}
                              className={cn(
                                "transition-transform duration-150",
                                showAdvancedTokenOpts && "rotate-180",
                              )}
                            />
                            Tuỳ chọn nâng cao
                          </span>
                          <span className="truncate text-[11px] text-[var(--text-muted)]">
                            {selectedCategorySummary} · {selectedExpirySummary}
                          </span>
                        </button>

                        {showAdvancedTokenOpts && (
                          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                            <Select
                              label="Danh mục mặc định"
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
                    </div>

                    {iosShortcutTemplateUrl ? (
                      <div className="space-y-1">
                        <Button
                          type="button"
                          disabled={pending || walletOptions.length === 0}
                          onClick={() =>
                            issueTokenWithClipboard({ switchToIosGuide: true })
                          }
                          className="w-full"
                        >
                          <Smartphone size={15} />
                          {pending
                            ? "Đang chuẩn bị..."
                            : "Thiết lập nhanh trên iPhone"}
                        </Button>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={pending || walletOptions.length === 0}
                          className="w-full"
                        >
                          Chỉ tạo khóa kết nối (Android / thủ công)
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="submit"
                        disabled={pending || walletOptions.length === 0}
                        className="w-full"
                      >
                        <Zap size={15} />
                        {pending ? "Đang tạo khóa..." : "Tạo khóa kết nối"}
                      </Button>
                    )}
                  </form>
                )}
              </TabsContent>

              {/* ── TAB 2: STREAMLINED BENTO SETUP GUIDE ────────── */}
              <TabsContent value="guide" className="space-y-3">
                <Tabs
                  value={guidePlatform}
                  onValueChange={(val) =>
                    setGuidePlatform(val === "android" ? "android" : "ios")
                  }
                  className="gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="px-0.5 text-xs font-medium text-[var(--text-secondary)]">
                      Dòng máy của bạn
                    </span>
                    <TabsList variant="default">
                      <TabsTrigger value="ios">iPhone</TabsTrigger>
                      <TabsTrigger value="android">Android</TabsTrigger>
                    </TabsList>
                  </div>

                  {newlyCreatedToken ? (
                    <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-[color-mix(in_srgb,var(--primary)_30%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] px-3.5 py-2.5 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <KeyRound
                          size={14}
                          className="shrink-0 text-[var(--primary)]"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-[var(--foreground)]">
                          Khóa {newlyCreatedToken.name} đã sẵn sàng
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleCopyBearer(newlyCreatedToken.token)}
                      >
                        {tokenCopiedFeedback ? (
                          <Check size={12} />
                        ) : (
                          <Copy size={12} />
                        )}
                        {tokenCopiedFeedback ? "Đã chép" : "Chép khóa"}
                      </Button>
                    </div>
                  ) : !hasLinkedDevices &&
                    (guidePlatform === "android" || !iosShortcutTemplateUrl) ? (
                    <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5 text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Cấp khóa xác thực trước khi cài trên máy
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

                  {/* iOS Guide */}
                  <TabsContent value="ios" className="space-y-3">
                    {iosShortcutTemplateUrl ? (
                      <>
                        <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-secondary)_45%,var(--surface))] text-xs leading-relaxed text-[var(--text-secondary)]">
                          <li className="space-y-2.5 p-3.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-5 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
                                01
                              </span>
                              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                                Cài phím tắt mẫu & dán khóa
                              </p>
                            </div>

                            {newlyCreatedToken ? (
                              <>
                                <p>
                                  Bấm nút bên dưới để mở ứng dụng{" "}
                                  <strong className="font-medium text-[var(--foreground)]">
                                    Phím tắt
                                  </strong>
                                  , chạm{" "}
                                  <strong className="font-medium text-[var(--foreground)]">
                                    Dán
                                  </strong>{" "}
                                  khóa xác thực khi được hỏi rồi chọn{" "}
                                  <strong className="font-medium text-[var(--foreground)]">
                                    Thêm phím tắt
                                  </strong>
                                  .
                                </p>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleCopyBearer(newlyCreatedToken.token)
                                  }
                                  render={
                                    <a
                                      href={iosShortcutTemplateUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    />
                                  }
                                  className="w-full"
                                >
                                  <Smartphone size={13} />
                                  Chép khóa & Cài phím tắt mẫu
                                </Button>
                              </>
                            ) : !hasLinkedDevices ? (
                              <>
                                <p>
                                  Tạo khóa kết nối
                                  {selectedWalletLabel
                                    ? ` (mặc định ví ${selectedWalletLabel})`
                                    : ""}
                                  , sau đó mở Phím tắt mẫu và chạm{" "}
                                  <strong className="font-medium text-[var(--foreground)]">
                                    Dán
                                  </strong>{" "}
                                  khi được hỏi.
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    pending || walletOptions.length === 0
                                  }
                                  onClick={() =>
                                    issueTokenWithClipboard({
                                      switchToIosGuide: true,
                                    })
                                  }
                                  className="w-full"
                                >
                                  <Zap size={13} />
                                  {pending
                                    ? "Đang tạo khóa..."
                                    : "Tạo & chép khóa iPhone"}
                                </Button>
                              </>
                            ) : (
                              <>
                                <p>
                                  Thêm Phím tắt mẫu vào iPhone và dán khóa xác thực khi được hỏi. Nếu chưa lưu khóa cũ, bấm{" "}
                                  <strong className="font-medium text-[var(--foreground)]">
                                    Cấp khóa mới
                                  </strong>
                                  .
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    size="sm"
                                    render={
                                      <a
                                        href={iosShortcutTemplateUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      />
                                    }
                                  >
                                    <Smartphone size={13} />
                                    Tải phím tắt
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setShowCreateForm(true);
                                      setActiveTab("connect");
                                    }}
                                  >
                                    Cấp khóa mới
                                  </Button>
                                </div>
                              </>
                            )}
                          </li>

                          <li className="space-y-2 p-3.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-5 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
                                02
                              </span>
                              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                                Gán chạm hai lần mặt lưng
                              </p>
                            </div>
                            <IosSettingsBreadcrumb />
                            <p>
                              Chọn phím tắt vừa thêm và bấm{" "}
                              <strong className="font-medium text-[var(--foreground)]">
                                Luôn cho phép
                              </strong>{" "}
                              ở lần chạm đầu tiên sau khi thanh toán.
                            </p>
                          </li>
                        </ol>

                        <div className="px-1">
                          <button
                            type="button"
                            onClick={() => setShowManualIosSteps((v) => !v)}
                            aria-expanded={showManualIosSteps}
                            className="inline-flex cursor-pointer items-center gap-1.5 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                          >
                            <ChevronDown
                              size={13}
                              className={cn(
                                "transition-transform duration-150",
                                showManualIosSteps && "rotate-180",
                              )}
                            />
                            Tự tạo phím tắt thủ công (4 bước)
                          </button>

                          {showManualIosSteps && (
                            <div className="mt-2">{manualIosSteps}</div>
                          )}
                        </div>
                      </>
                    ) : (
                      manualIosSteps
                    )}
                  </TabsContent>

                  {/* Android Guide */}
                  <TabsContent value="android">
                    <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-secondary)_45%,var(--surface))] text-xs leading-relaxed text-[var(--text-secondary)]">
                      <li className="space-y-1.5 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
                            01
                          </span>
                          <p className="text-[13px] font-semibold text-[var(--foreground)]">
                            Bắt thông báo thanh toán
                          </p>
                        </div>
                        <p>
                          Trong{" "}
                          <strong className="font-medium text-[var(--foreground)]">
                            MacroDroid
                          </strong>
                          , tạo Macro mới với sự kiện{" "}
                          <strong className="font-medium text-[var(--foreground)]">
                            Nhận thông báo
                          </strong>{" "}
                          từ MoMo hoặc ứng dụng ngân hàng.
                        </p>
                      </li>

                      <li className="space-y-2 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
                              02
                            </span>
                            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
                              Tự động gửi về Felix
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void copyToClipboard(
                                commitEndpoint,
                                "Đã sao chép URL lưu giao dịch.",
                              )
                            }
                          >
                            <Copy size={12} />
                            Chép URL
                          </Button>
                        </div>
                        <p>
                          Thêm hành động{" "}
                          <strong className="font-medium text-[var(--foreground)]">
                            Yêu cầu HTTP (POST)
                          </strong>{" "}
                          với thông số:
                        </p>
                        <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[var(--text-muted)]">
                              Header
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CopyableKeyChip value="Authorization" />
                              <span className="text-[var(--foreground)]">
                                = Khóa xác thực
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-1.5">
                            <span className="text-[var(--text-muted)]">
                              Form
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CopyableKeyChip value="text" />
                              <span className="font-mono text-[var(--foreground)]">
                                = [not_title] [not_text]
                              </span>
                            </span>
                          </div>
                        </div>
                      </li>

                      <li className="space-y-1.5 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 items-center rounded-md bg-[var(--primary-soft)] px-1.5 font-mono text-[10px] font-semibold text-[var(--primary)]">
                            03
                          </span>
                          <p className="text-[13px] font-semibold text-[var(--foreground)]">
                            Bật quyền đọc thông báo
                          </p>
                        </div>
                        <p>
                          Lưu Macro và cấp quyền truy cập thông báo cho MacroDroid để giao dịch tự lưu vào đúng ví và danh mục gợi ý.
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
