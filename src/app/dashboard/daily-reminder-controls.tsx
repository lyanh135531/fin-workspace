"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  BellRing,
  Check,
  MoonStar,
  Send,
  Smartphone,
  SunMedium,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getUserReminderStateAction,
  removePushSubscriptionOnLogoutAction,
  removeUserPushSubscriptionAction,
  saveUserPushSubscriptionAction,
  sendTestReminderNotificationAction,
  updateUserReminderSettingsAction,
} from "@/app/dashboard/settings/reminder-actions";
import { Button } from "@/components/base";
import { cn } from "@/lib/utils";
import type { UserReminderState } from "@/services/reminder-service";

export type PushSupportState =
  | "checking"
  | "supported"
  | "ios-needs-install"
  | "unsupported"
  | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectPushSupport(): PushSupportState {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "checking";
  }

  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    if (isIOS && !isStandalone) {
      return "ios-needs-install";
    }
    return "unsupported";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return "supported";
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) {
    await existing.update().catch(() => null);
    return existing;
  }
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function cleanupBrowserPushBeforeLogout(): Promise<void> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => null);
    if (endpoint) {
      await removePushSubscriptionOnLogoutAction(endpoint).catch(() => null);
    }
  } catch {
    // Do not block sign-out if browser push cleanup fails.
  }
}

export async function requestPushPermissionFromGesture(): Promise<{
  granted: boolean;
  support: PushSupportState;
}> {
  const currentSupport = detectPushSupport();

  if (currentSupport === "ios-needs-install") {
    toast.error(
      "Trên iPhone/iPad, hãy chọn Chia sẻ → Thêm vào Màn hình chính để nhận thông báo.",
    );
    return { granted: false, support: currentSupport };
  }

  if (currentSupport === "unsupported") {
    toast.error("Trình duyệt hiện tại chưa hỗ trợ thông báo đẩy.");
    return { granted: false, support: currentSupport };
  }

  if (Notification.permission === "granted") {
    return { granted: true, support: "supported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    const nextSupport = permission === "denied" ? "denied" : "supported";
    toast.error("Vui lòng cho phép quyền Thông báo trên trình duyệt.");
    return { granted: false, support: nextSupport };
  }

  return { granted: true, support: "supported" };
}

export async function subscribeBrowserToPush(
  vapidPublicKey: string,
): Promise<{ ok: boolean; subscriptionCount?: number; endpoints?: string[] }> {
  try {
    const registration = await ensureServiceWorkerRegistration();
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch (subscribeError) {
        if (
          subscribeError instanceof DOMException &&
          subscribeError.name === "InvalidStateError"
        ) {
          const stale = await registration.pushManager.getSubscription();
          await stale?.unsubscribe().catch(() => null);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        } else {
          throw subscribeError;
        }
      }
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      toast.error("Không thể khởi tạo khóa nhận thông báo cho thiết bị này.");
      return { ok: false };
    }

    const saveResult = await saveUserPushSubscriptionAction({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      userAgent: navigator.userAgent,
    });

    if (!saveResult.ok) {
      toast.error(saveResult.message);
      return { ok: false };
    }

    window.dispatchEvent(
      new CustomEvent("felix-reminder-device-subscribed", {
        detail: {
          subscriptionCount: saveResult.data.subscriptionCount,
          endpoints: saveResult.data.endpoints,
        },
      }),
    );

    return {
      ok: true,
      subscriptionCount: saveResult.data.subscriptionCount,
      endpoints: saveResult.data.endpoints,
    };
  } catch {
    toast.error("Không thể đăng ký nhận thông báo đẩy trên thiết bị này.");
    return { ok: false };
  }
}

export function DailyReminderControls({
  initialState,
  variant = "card",
  highlighted = false,
}: {
  initialState?: UserReminderState | null;
  variant?: "compact" | "card";
  highlighted?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [overrideState, setOverrideState] = useState<UserReminderState | null>(
    null,
  );
  const state = overrideState ?? initialState ?? null;
  const setState = useCallback(
    (
      updater:
        | UserReminderState
        | null
        | ((prev: UserReminderState | null) => UserReminderState | null),
    ) => {
      setOverrideState((prev) => {
        const current = prev ?? initialState ?? null;
        return typeof updater === "function" ? updater(current) : updater;
      });
    },
    [initialState],
  );
  const [support, setSupport] = useState<PushSupportState>("checking");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);

  useEffect(() => {
    if (initialState) return;
    let active = true;
    void getUserReminderStateAction().then((res) => {
      if (!active) return;
      if (res.ok) setOverrideState(res.data);
    });
    return () => {
      active = false;
    };
  }, [initialState]);

  useEffect(() => {
    let active = true;

    function handleExternalSubscribe(event: Event) {
      const custom = event as CustomEvent<{
        subscriptionCount?: number;
        endpoints?: string[];
      }>;
      setDeviceSubscribed(true);
      setSupport("supported");
      const nextCount = custom.detail?.subscriptionCount;
      const nextEndpoints = custom.detail?.endpoints;
      if (typeof nextCount === "number" || Array.isArray(nextEndpoints)) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                ...(typeof nextCount === "number"
                  ? { subscriptionCount: nextCount }
                  : {}),
                ...(Array.isArray(nextEndpoints)
                  ? { endpoints: nextEndpoints }
                  : {}),
              }
            : prev,
        );
      }
    }

    window.addEventListener(
      "felix-reminder-device-subscribed",
      handleExternalSubscribe,
    );

    void Promise.resolve().then(async () => {
      const detected = detectPushSupport();
      if (!active) return;
      setSupport(detected);
      if (detected !== "supported") {
        setDeviceSubscribed(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (!active) return;
        if (!registration) {
          setDeviceSubscribed(false);
          return;
        }
        const sub = await registration.pushManager.getSubscription();
        if (!active) return;
        if (!sub) {
          setDeviceSubscribed(false);
          return;
        }
        const registeredEndpoints = state?.endpoints ?? [];
        setDeviceSubscribed(registeredEndpoints.includes(sub.endpoint));
      } catch {
        if (active) setDeviceSubscribed(false);
      }
    });

    return () => {
      active = false;
      window.removeEventListener(
        "felix-reminder-device-subscribed",
        handleExternalSubscribe,
      );
    };
  }, [state?.endpoints, setState]);

  async function requestNotificationPermissionFromGesture(): Promise<boolean> {
    const res = await requestPushPermissionFromGesture();
    setSupport(res.support);
    return res.granted;
  }

  async function subscribeCurrentDevice(vapidPublicKey: string): Promise<boolean> {
    const res = await subscribeBrowserToPush(vapidPublicKey);
    if (!res.ok) return false;
    setDeviceSubscribed(true);
    if (typeof res.subscriptionCount === "number" || Array.isArray(res.endpoints)) {
      const count = res.subscriptionCount;
      const nextEndpoints = res.endpoints;
      setState((prev) =>
        prev
          ? {
              ...prev,
              ...(typeof count === "number" ? { subscriptionCount: count } : {}),
              ...(Array.isArray(nextEndpoints) ? { endpoints: nextEndpoints } : {}),
            }
          : prev,
      );
    }
    return true;
  }

  async function handleToggleSlot(slot: "noon" | "evening") {
    if (!state) return;
    const nextNoon = slot === "noon" ? !state.noonEnabled : state.noonEnabled;
    const nextEvening =
      slot === "evening" ? !state.eveningEnabled : state.eveningEnabled;
    const turningOn =
      (slot === "noon" && nextNoon) || (slot === "evening" && nextEvening);

    const needsDeviceSubscribe =
      turningOn && (!deviceSubscribed || state.subscriptionCount === 0) && support === "supported";
    if (needsDeviceSubscribe) {
      const granted = await requestNotificationPermissionFromGesture();
      if (!granted) return;
    }

    startTransition(async () => {
      if (needsDeviceSubscribe) {
        const ok = await subscribeCurrentDevice(state.vapidPublicKey);
        if (!ok) return;
      }

      const browserTimeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || state.timeZone;

      const result = await updateUserReminderSettingsAction({
        noonEnabled: nextNoon,
        eveningEnabled: nextEvening,
        timeZone: browserTimeZone,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setState(result.data);
      toast.success(
        turningOn
          ? `Đã bật nhắc ghi chi tiêu lúc ${slot === "noon" ? "12:30" : "21:00"}.`
          : `Đã tắt nhắc ghi chi tiêu lúc ${slot === "noon" ? "12:30" : "21:00"}.`,
      );
      router.refresh();
    });
  }

  async function handleEnableDeviceOnly() {
    if (!state) return;
    const granted = await requestNotificationPermissionFromGesture();
    if (!granted) return;

    startTransition(async () => {
      const ok = await subscribeCurrentDevice(state.vapidPublicKey);
      if (!ok) return;

      if (!state.noonEnabled && !state.eveningEnabled) {
        const browserTimeZone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || state.timeZone;
        const result = await updateUserReminderSettingsAction({
          noonEnabled: true,
          eveningEnabled: true,
          timeZone: browserTimeZone,
        });
        if (result.ok) {
          setState(result.data);
        }
      }
      toast.success("Đã bật nhận thông báo trên thiết bị này.");
      router.refresh();
    });
  }

  function handleDisableCurrentDevice() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const sub = await registration?.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe().catch(() => null);
          const res = await removeUserPushSubscriptionAction(endpoint);
          if (res.ok) {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    subscriptionCount: res.data.subscriptionCount,
                    endpoints: res.data.endpoints,
                  }
                : prev,
            );
          }
        }
        setDeviceSubscribed(false);
        toast.success("Đã tắt nhận thông báo trên thiết bị này.");
        router.refresh();
      } catch {
        toast.error("Không thể hủy đăng ký thiết bị.");
      }
    });
  }

  async function handleSendTest() {
    if (!state) return;
    const needsDeviceSubscribe =
      (!deviceSubscribed || state.subscriptionCount === 0) &&
      support === "supported";
    if (needsDeviceSubscribe) {
      const granted = await requestNotificationPermissionFromGesture();
      if (!granted) return;
    }

    startTransition(async () => {
      if (needsDeviceSubscribe) {
        const ok = await subscribeCurrentDevice(state.vapidPublicKey);
        if (!ok) return;
      }

      const result = await sendTestReminderNotificationAction();
      if (result.ok) {
        toast.success("Đã gửi thông báo thử nghiệm về thiết bị của bạn.");
      } else {
        toast.error(result.message);
      }
    });
  }

  const noonActive = Boolean(state?.noonEnabled);
  const eveningActive = Boolean(state?.eveningEnabled);
  const anySlotEnabled = noonActive || eveningActive;

  if (variant === "compact") {
    return (
      <section
        id="daily-reminder-controls-compact"
        aria-label="Cài đặt nhắc ghi chi tiêu hàng ngày"
        className={cn(
          "rounded-2xl border p-3 transition-colors",
          highlighted
            ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] ring-2 ring-[var(--focus-ring)]"
            : "border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-secondary)_45%,var(--surface))]",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <BellRing size={14} />
            </span>
            <p className="break-words text-xs font-semibold text-[var(--foreground)]">
              Nhắc ghi chi tiêu
            </p>
            {state && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  anySlotEnabled
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)]",
                )}
              >
                {anySlotEnabled ? "Đang bật" : "Đang tắt"}
              </span>
            )}
          </div>

          {support === "supported" && !deviceSubscribed ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={pending || !state}
              onClick={handleEnableDeviceOnly}
            >
              Bật trên máy
            </Button>
          ) : support === "supported" && deviceSubscribed ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !state}
                onClick={handleSendTest}
              >
                <Send size={11} aria-hidden="true" />
                Gửi thử
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={handleDisableCurrentDevice}
                aria-label="Tắt nhận thông báo trên thiết bị này"
              >
                Tắt
              </Button>
            </div>
          ) : null}
        </div>

        <p className="mt-1.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
          Chỉ nhắc khi trong ngày chưa có giao dịch. Chạm vào giờ để bật/tắt:
        </p>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending || !state}
            aria-pressed={noonActive}
            onClick={() => handleToggleSlot("noon")}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
              noonActive
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SunMedium
                size={14}
                className={
                  noonActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                }
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong className="block font-mono text-xs font-bold tabular-nums leading-tight">
                  12:30
                </strong>
                <span className="block text-[10px] leading-tight text-[var(--text-muted)]">
                  Buổi trưa
                </span>
              </span>
            </span>
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border text-[10px]",
                noonActive
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] text-transparent",
              )}
              aria-hidden="true"
            >
              <Check size={10} strokeWidth={2.5} />
            </span>
          </button>

          <button
            type="button"
            disabled={pending || !state}
            aria-pressed={eveningActive}
            onClick={() => handleToggleSlot("evening")}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
              eveningActive
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MoonStar
                size={14}
                className={
                  eveningActive
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-muted)]"
                }
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong className="block font-mono text-xs font-bold tabular-nums leading-tight">
                  21:00
                </strong>
                <span className="block text-[10px] leading-tight text-[var(--text-muted)]">
                  Buổi tối
                </span>
              </span>
            </span>
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border text-[10px]",
                eveningActive
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] text-transparent",
              )}
              aria-hidden="true"
            >
              <Check size={10} strokeWidth={2.5} />
            </span>
          </button>
        </div>

        {support === "ios-needs-install" && (
          <p className="mt-2 break-words text-[11px] leading-relaxed text-[var(--warning)]">
            Trên iPhone/iPad: chạm Chia sẻ → Thêm vào Màn hình chính để nhận thông báo.
          </p>
        )}

        {support === "denied" && (
          <p className="mt-2 break-words text-[11px] leading-relaxed text-[var(--destructive)]">
            Quyền thông báo đang bị chặn. Hãy mở cài đặt trình duyệt để cấp lại quyền.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        Nhắc ghi chi tiêu hàng ngày
      </p>

      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
                aria-hidden="true"
              >
                <BellRing size={16} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                  Thông báo nhắc nhở thông minh
                </h3>
                <p className="mt-0.5 break-words text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Chỉ nhắc về điện thoại khi trong ngày chưa ghi giao dịch nào.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending || !state}
              aria-pressed={noonActive}
              onClick={() => handleToggleSlot("noon")}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
                noonActive
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    noonActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]",
                  )}
                  aria-hidden="true"
                >
                  <SunMedium size={14} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold tabular-nums text-[var(--foreground)]">
                    12:30
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Buổi trưa
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border text-[10px]",
                  noonActive
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-transparent",
                )}
                aria-hidden="true"
              >
                <Check size={10} strokeWidth={2.5} />
              </span>
            </button>

            <button
              type="button"
              disabled={pending || !state}
              aria-pressed={eveningActive}
              onClick={() => handleToggleSlot("evening")}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
                eveningActive
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    eveningActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]",
                  )}
                  aria-hidden="true"
                >
                  <MoonStar size={14} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold tabular-nums text-[var(--foreground)]">
                    21:00
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Buổi tối
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border text-[10px]",
                  eveningActive
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-transparent",
                )}
                aria-hidden="true"
              >
                <Check size={10} strokeWidth={2.5} />
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-secondary)] px-3.5 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Smartphone size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="break-words text-[11px]">
              {support === "ios-needs-install"
                ? "Thêm Felix vào Màn hình chính (Safari) để nhận thông báo."
                : support === "denied"
                  ? "Quyền thông báo đang bị chặn trên trình duyệt này."
                  : support === "unsupported"
                    ? "Trình duyệt hiện tại chưa hỗ trợ thông báo đẩy."
                    : deviceSubscribed
                      ? "Thiết bị này đã kết nối nhận thông báo."
                      : "Thiết bị này chưa bật nhận thông báo đẩy."}
            </span>
          </div>

          {support === "supported" && (
            <div className="flex flex-wrap items-center gap-1.5">
              {deviceSubscribed ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || !state}
                    onClick={handleSendTest}
                    className="h-7 px-2.5 text-[11px]"
                  >
                    <Send size={12} aria-hidden="true" />
                    Gửi thử
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={handleDisableCurrentDevice}
                    className="h-7 px-2 text-[11px] text-[var(--text-muted)]"
                  >
                    Tắt
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={pending || !state}
                  onClick={handleEnableDeviceOnly}
                  className="h-7 px-2.5 text-[11px]"
                >
                  <BellRing size={12} aria-hidden="true" />
                  Bật trên máy này
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
