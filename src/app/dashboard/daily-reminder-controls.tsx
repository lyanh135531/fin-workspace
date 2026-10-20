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
  removeUserPushSubscriptionAction,
  saveUserPushSubscriptionAction,
  sendTestReminderNotificationAction,
  updateUserReminderSettingsAction,
} from "@/app/dashboard/settings/reminder-actions";
import { Button } from "@/components/base";
import { cn } from "@/lib/utils";
import type { UserReminderState } from "@/services/reminder-service";

type PushSupportState =
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

function detectPushSupport(): PushSupportState {
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

export function DailyReminderControls({
  initialState,
  variant = "card",
}: {
  initialState?: UserReminderState | null;
  variant?: "compact" | "card";
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
    let active = true;

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
        const json = sub.toJSON();
        if (
          json.endpoint &&
          json.keys?.p256dh &&
          json.keys?.auth &&
          (initialState?.subscriptionCount ?? 0) === 0
        ) {
          const saveRes = await saveUserPushSubscriptionAction({
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
            userAgent: navigator.userAgent,
          });
          if (!active) return;
          if (saveRes.ok) {
            setDeviceSubscribed(true);
            setState((prev) =>
              prev
                ? { ...prev, subscriptionCount: saveRes.data.subscriptionCount }
                : prev,
            );
            return;
          }
        }
        setDeviceSubscribed(Boolean(sub));
      } catch {
        if (active) setDeviceSubscribed(false);
      }
    });

    if (!initialState) {
      void getUserReminderStateAction().then((res) => {
        if (!active) return;
        if (res.ok) setOverrideState(res.data);
      });
    }

    return () => {
      active = false;
    };
  }, [initialState, setState]);

  async function requestNotificationPermissionFromGesture(): Promise<boolean> {
    const currentSupport = detectPushSupport();
    setSupport(currentSupport);

    if (currentSupport === "ios-needs-install") {
      toast.error(
        "Trên iPhone/iPad, hãy chọn Chia sẻ → Thêm vào Màn hình chính để nhận thông báo.",
      );
      return false;
    }

    if (currentSupport === "unsupported") {
      toast.error("Trình duyệt hiện tại chưa hỗ trợ thông báo đẩy.");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setSupport(permission === "denied" ? "denied" : "supported");
      toast.error("Vui lòng cho phép quyền Thông báo trên trình duyệt.");
      return false;
    }

    return true;
  }

  async function subscribeCurrentDevice(vapidPublicKey: string): Promise<boolean> {
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
        return false;
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
        return false;
      }

      setDeviceSubscribed(true);
      setState((prev) =>
        prev
          ? { ...prev, subscriptionCount: saveResult.data.subscriptionCount }
          : prev,
      );
      return true;
    } catch {
      toast.error("Không thể đăng ký nhận thông báo đẩy trên thiết bị này.");
      return false;
    }
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
                ? { ...prev, subscriptionCount: res.data.subscriptionCount }
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
        aria-label="Cài đặt nhắc ghi chi tiêu hàng ngày"
        className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3"
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <BellRing size={15} />
            </span>
            <div className="min-w-0">
              <p className="break-words text-xs font-semibold leading-snug text-[var(--foreground)]">
                Nhắc ghi chi tiêu về điện thoại
              </p>
              <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
                Chỉ nhắc khi trong ngày bạn chưa ghi giao dịch nào.
              </p>
            </div>
          </div>

          {deviceSubscribed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !state}
              onClick={handleSendTest}
              className="h-7 shrink-0 px-2.5 text-[11px]"
            >
              <Send size={12} aria-hidden="true" />
              Gửi thử
            </Button>
          )}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending || !state}
            aria-pressed={noonActive}
            onClick={() => handleToggleSlot("noon")}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
              noonActive
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <SunMedium
                size={14}
                className={
                  noonActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                }
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong className="block font-mono text-xs font-semibold tabular-nums">
                  12:30
                </strong>
                <span className="block text-[10px] text-[var(--text-muted)]">
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
              "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
              eveningActive
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
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
                <strong className="block font-mono text-xs font-semibold tabular-nums">
                  21:00
                </strong>
                <span className="block text-[10px] text-[var(--text-muted)]">
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
            Trên iPhone/iPad: chạm nút Chia sẻ và chọn Thêm vào Màn hình chính để nhận thông báo đẩy.
          </p>
        )}

        {support === "denied" && (
          <p className="mt-2 break-words text-[11px] leading-relaxed text-[var(--destructive)]">
            Trình duyệt đang chặn quyền thông báo. Hãy mở cài đặt trang web để cấp lại quyền.
          </p>
        )}

        {support === "supported" && anySlotEnabled && !deviceSubscribed && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
            <span className="min-w-0 break-words text-[11px] text-[var(--text-secondary)]">
              Thiết bị này chưa bật nhận thông báo đẩy.
            </span>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={pending || !state}
              onClick={handleEnableDeviceOnly}
              className="h-7 shrink-0 px-2.5 text-[11px]"
            >
              Bật trên máy này
            </Button>
          </div>
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
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
                aria-hidden="true"
              >
                <BellRing size={17} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-[var(--foreground)]">
                  Thông báo nhắc nhở thông minh
                </h3>
                <p className="mt-0.5 break-words text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Chỉ gửi thông báo về điện thoại nếu từ sáng đến giờ hẹn bạn chưa ghi giao dịch nào. Chạm vào thông báo sẽ mở ngay bảng Ghi giao dịch nhanh.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending || !state}
              aria-pressed={noonActive}
              onClick={() => handleToggleSlot("noon")}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
                noonActive
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    noonActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]",
                  )}
                  aria-hidden="true"
                >
                  <SunMedium size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold tabular-nums text-[var(--foreground)]">
                    12:30 Trưa
                  </p>
                  <p className="break-words text-[11px] leading-snug text-[var(--text-muted)]">
                    Nhắc ghi chi tiêu sáng & trưa
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  noonActive
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface)] text-[var(--text-muted)]",
                )}
              >
                {noonActive ? "Đang bật" : "Đang tắt"}
              </span>
            </button>

            <button
              type="button"
              disabled={pending || !state}
              aria-pressed={eveningActive}
              onClick={() => handleToggleSlot("evening")}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60",
                eveningActive
                  ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))]"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    eveningActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-muted)]",
                  )}
                  aria-hidden="true"
                >
                  <MoonStar size={16} />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold tabular-nums text-[var(--foreground)]">
                    21:00 Tối
                  </p>
                  <p className="break-words text-[11px] leading-snug text-[var(--text-muted)]">
                    Nhắc tổng kết chi tiêu cuối ngày
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  eveningActive
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface)] text-[var(--text-muted)]",
                )}
              >
                {eveningActive ? "Đang bật" : "Đang tắt"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[var(--surface-secondary)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Smartphone size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="break-words">
              {support === "ios-needs-install"
                ? "Cần thêm Felix vào Màn hình chính (Safari) để nhận thông báo trên iPhone/iPad."
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
            <div className="flex flex-wrap items-center gap-2">
              {deviceSubscribed ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || !state}
                    onClick={handleSendTest}
                    className="text-xs"
                  >
                    <Send size={13} aria-hidden="true" />
                    Gửi thử thông báo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={handleDisableCurrentDevice}
                    className="text-xs text-[var(--text-muted)]"
                  >
                    Tắt trên máy này
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={pending || !state}
                  onClick={handleEnableDeviceOnly}
                  className="text-xs"
                >
                  <BellRing size={13} aria-hidden="true" />
                  Bật thông báo trên máy này
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
