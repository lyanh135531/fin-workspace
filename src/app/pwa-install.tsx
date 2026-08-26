"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Download, MonitorDown, Share2, Smartphone } from "lucide-react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/base";
import {
  detectInstallMethod,
  isPwaHostname,
  isStandaloneDisplay,
  parseDismissedAt,
  PWA_BANNER_DISMISSED_KEY,
  type PwaInstallMethod,
  shouldShowInstallBanner,
} from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type WindowWithInstallPrompt = Window & {
  __felixPwaInstallPrompt?: BeforeInstallPromptEvent | null;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  showAccountAction: boolean;
  showBanner: boolean;
  dismissBanner: () => void;
  requestInstall: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);
const MOBILE_INSTALL_SHEET_QUERY = "(max-width: 760px)";

function subscribeToMobileInstallSheet(callback: () => void): () => void {
  const mediaQuery = window.matchMedia(MOBILE_INSTALL_SHEET_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileInstallSheetSnapshot(): boolean {
  return window.matchMedia(MOBILE_INSTALL_SHEET_QUERY).matches;
}

function getServerMobileInstallSheetSnapshot(): boolean {
  return false;
}

function useMobileInstallSheet(): boolean {
  return useSyncExternalStore(
    subscribeToMobileInstallSheet,
    getMobileInstallSheetSnapshot,
    getServerMobileInstallSheetSnapshot,
  );
}

function saveDismissedAt(timestamp: number): void {
  try {
    window.localStorage.setItem(PWA_BANNER_DISMISSED_KEY, String(timestamp));
  } catch {
    // Installation remains available when storage is blocked.
  }
}

function clearDismissedAt(): void {
  try {
    window.localStorage.removeItem(PWA_BANNER_DISMISSED_KEY);
  } catch {
    // Nothing else is required when storage is blocked.
  }
}

export function PwaInstallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [eligibleHost, setEligibleHost] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [method, setMethod] = useState<PwaInstallMethod>("unsupported");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [bannerSuppressed, setBannerSuppressed] = useState(false);
  const [guideMethod, setGuideMethod] =
    useState<PwaInstallMethod>("unsupported");

  useEffect(() => {
    const hostIsEligible = isPwaHostname(window.location.hostname);

    if (!hostIsEligible) {
      const initializationTimer = window.setTimeout(() => {
        setEligibleHost(false);
        setCurrentTime(Date.now());
        setReady(true);
      }, 0);
      return () => window.clearTimeout(initializationTimer);
    }

    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const windowWithInstallPrompt = window as WindowWithInstallPrompt;
    const capturedPrompt = windowWithInstallPrompt.__felixPwaInstallPrompt;
    const standalone = isStandaloneDisplay(
      window.matchMedia("(display-mode: standalone)").matches,
      navigatorWithStandalone.standalone === true,
    );
    let storedDismissedAt: number | null = null;
    try {
      storedDismissedAt = parseDismissedAt(
        window.localStorage.getItem(PWA_BANNER_DISMISSED_KEY),
      );
    } catch {
      storedDismissedAt = null;
    }

    const initialMethod = detectInstallMethod({
      hasNativePrompt: Boolean(capturedPrompt),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
    const initializationTimer = window.setTimeout(() => {
      setEligibleHost(true);
      setInstalled(standalone);
      setDismissedAt(storedDismissedAt);
      setCurrentTime(Date.now());
      setMethod(initialMethod);
      setDeferredPrompt(capturedPrompt ?? null);
      setReady(true);
    }, 0);

    function handleBeforeInstallPrompt(event: Event): void {
      event.preventDefault();
      const installPrompt = event as BeforeInstallPromptEvent;
      windowWithInstallPrompt.__felixPwaInstallPrompt = installPrompt;
      setDeferredPrompt(installPrompt);
      setMethod("native");
    }

    function handleAppInstalled(): void {
      setInstalled(true);
      setDeferredPrompt(null);
      windowWithInstallPrompt.__felixPwaInstallPrompt = null;
      setGuideOpen(false);
      clearDismissedAt();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {
          // The website remains fully usable if service worker registration fails.
        });
    }

    return () => {
      window.clearTimeout(initializationTimer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    const timestamp = Date.now();
    setDismissedAt(timestamp);
    setCurrentTime(timestamp);
    saveDismissedAt(timestamp);
  }, []);

  const requestInstall = useCallback(async () => {
    if (installed || !eligibleHost) return;
    setBannerSuppressed(true);

    if (method === "native" && deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      (window as WindowWithInstallPrompt).__felixPwaInstallPrompt = null;
      setMethod(
        detectInstallMethod({
          hasNativePrompt: false,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
        }),
      );

      if (choice.outcome === "accepted") {
        setInstalled(true);
        clearDismissedAt();
      } else {
        dismissBanner();
      }
      return;
    }

    setGuideMethod(method);
    setGuideOpen(true);
  }, [deferredPrompt, dismissBanner, eligibleHost, installed, method]);

  const value = useMemo<PwaInstallContextValue>(() => {
    const canInstall =
      ready && eligibleHost && !installed && method !== "unsupported";

    return {
      canInstall,
      isInstalled: installed,
      showAccountAction: ready && eligibleHost && !installed,
      showBanner:
        ready &&
        !bannerSuppressed &&
        shouldShowInstallBanner({
          eligibleHost,
          installed,
          method,
          dismissedAt,
          now: currentTime,
        }),
      dismissBanner,
      requestInstall,
    };
  }, [
    dismissedAt,
    dismissBanner,
    bannerSuppressed,
    currentTime,
    eligibleHost,
    installed,
    method,
    ready,
    requestInstall,
  ]);

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      <InstallGuideSheet
        method={guideMethod}
        open={guideOpen}
        onOpenChange={setGuideOpen}
      />
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall(): PwaInstallContextValue {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error("usePwaInstall must be used inside PwaInstallProvider.");
  }
  return context;
}

export function PwaInstallBanner() {
  const isMobile = useMobileInstallSheet();
  const { canInstall, dismissBanner, requestInstall, showBanner } =
    usePwaInstall();

  return (
    <Sheet
      open={canInstall && showBanner}
      onOpenChange={(open) => {
        if (!open) dismissBanner();
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "center"}
        placement="inset"
        size="default"
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader className="px-6 pb-2 pt-6">
          <SheetTitle className="text-lg font-semibold">
            Cài Felix trên thiết bị này
          </SheetTitle>
          <SheetDescription className="mt-2 leading-6">
            Cài đặt ngay để truy cập nhanh, quản lý tài chính tiện lợi mọi lúc
            mọi nơi.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter className="flex-row px-6 pb-6 pt-4">
          <Button
            type="button"
            variant="landing"
            size="lg"
            onClick={() => void requestInstall()}
          >
            <Download aria-hidden="true" />
            Cài đặt
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={dismissBanner}
          >
            Để sau
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function InstallGuideSheet({
  method,
  open,
  onOpenChange,
}: {
  method: PwaInstallMethod;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useMobileInstallSheet();
  const content = installGuideContent(method);
  const Icon = content.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "center"}
        placement="inset"
        size={isMobile ? "default" : "wide"}
        spacing="flush"
        elevation="flat"
      >
        <SheetHeader className="px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-start gap-4 pr-8">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Icon size={20} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold">
                {content.title}
              </SheetTitle>
              <SheetDescription className="mt-1 leading-6">
                {content.description}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          {content.steps.length > 0 && (
            <ol className="space-y-4 text-sm leading-6 text-[var(--text-secondary)]">
              {content.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 sm:px-8 sm:pb-8">
          <Button
            type="button"
            variant="landing"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Đã hiểu
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function installGuideContent(method: PwaInstallMethod): {
  title: string;
  description: string;
  steps: string[];
  icon: typeof Smartphone;
} {
  if (method === "ios") {
    return {
      title: "Cài Felix trên iPhone hoặc iPad",
      description: "Apple yêu cầu thêm ứng dụng web từ menu Chia sẻ.",
      steps: [
        "Mở Felix trong Safari.",
        "Chạm nút Chia sẻ trên thanh công cụ.",
        "Chọn Thêm vào Màn hình chính.",
        "Bật Mở dưới dạng ứng dụng web, sau đó chạm Thêm.",
      ],
      icon: Share2,
    };
  }

  if (method === "mac-safari") {
    return {
      title: "Cài Felix trên Mac",
      description:
        "Safari trên macOS Sonoma 14 trở lên có thể lưu Felix như một ứng dụng riêng.",
      steps: [
        "Mở menu File hoặc nút Chia sẻ trong Safari.",
        "Chọn Add to Dock.",
        "Xác nhận tên Felix và chọn Add.",
      ],
      icon: MonitorDown,
    };
  }

  if (method === "chromium") {
    return {
      title: "Chưa thể mở hộp thoại cài đặt",
      description:
        "Edge hoặc Chrome chưa cấp quyền mở hộp thoại cài đặt cho trang này.",
      steps: [
        "Tải lại trang và chờ biểu tượng cài ứng dụng xuất hiện ở cuối thanh địa chỉ.",
        "Trên Edge, bạn cũng có thể mở menu …, chọn Ứng dụng, rồi chọn Cài đặt Felix.",
      ],
      icon: MonitorDown,
    };
  }

  return {
    title: "Trình duyệt chưa hỗ trợ cài đặt",
    description:
      "Hãy mở Felix bằng Chrome hoặc Edge. Trên iPhone và iPad, hãy dùng Safari.",
    steps: [],
    icon: Download,
  };
}
