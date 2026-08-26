import { APP_HOSTNAME, normalizeHostname } from "@/lib/host-routing";

export const PWA_BANNER_DISMISSED_KEY = "felix.pwa.install-dismissed-at";
export const PWA_REPROMPT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export type PwaInstallMethod =
  | "native"
  | "chromium"
  | "ios"
  | "mac-safari"
  | "unsupported";

type InstallMethodInput = {
  hasNativePrompt: boolean;
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
};

export function isPwaHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === APP_HOSTNAME ||
    normalized === "localhost" ||
    normalized === "127.0.0.1"
  );
}

export function isStandaloneDisplay(
  displayModeStandalone: boolean,
  navigatorStandalone = false,
): boolean {
  return displayModeStandalone || navigatorStandalone;
}

export function parseDismissedAt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function shouldShowInstallBanner({
  eligibleHost,
  installed,
  method,
  dismissedAt,
  now,
}: {
  eligibleHost: boolean;
  installed: boolean;
  method: PwaInstallMethod;
  dismissedAt: number | null;
  now: number;
}): boolean {
  if (installed || !eligibleHost || method === "unsupported") return false;
  if (dismissedAt === null) return true;
  return now - dismissedAt >= PWA_REPROMPT_INTERVAL_MS;
}

export function detectInstallMethod({
  hasNativePrompt,
  userAgent,
  platform = "",
  maxTouchPoints = 0,
}: InstallMethodInput): PwaInstallMethod {
  if (hasNativePrompt) return "native";

  const isAppleMobile =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1);
  if (isAppleMobile) return "ios";

  const isMac = /Mac/i.test(platform) || /Macintosh/i.test(userAgent);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(userAgent);
  if (isMac && isSafari) return "mac-safari";

  const isChromium = /Chrome|Chromium|CriOS|Edg|EdgA/i.test(userAgent);
  if (isChromium) return "chromium";

  return "unsupported";
}
