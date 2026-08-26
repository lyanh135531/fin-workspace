import { describe, expect, it } from "vitest";

import {
  detectInstallMethod,
  isPwaHostname,
  isStandaloneDisplay,
  parseDismissedAt,
  PWA_REPROMPT_INTERVAL_MS,
  shouldShowInstallBanner,
} from "@/lib/pwa";

describe("PWA eligibility", () => {
  it("only enables the consumer app host and local development", () => {
    expect(isPwaHostname("app.felixwise.io.vn")).toBe(true);
    expect(isPwaHostname("APP.FELIXWISE.IO.VN:443")).toBe(true);
    expect(isPwaHostname("localhost")).toBe(true);
    expect(isPwaHostname("127.0.0.1")).toBe(true);
    expect(isPwaHostname("felixwise.io.vn")).toBe(false);
    expect(isPwaHostname("portal.felixwise.io.vn")).toBe(false);
  });

  it("detects standalone display from standard and iOS signals", () => {
    expect(isStandaloneDisplay(true, false)).toBe(true);
    expect(isStandaloneDisplay(false, true)).toBe(true);
    expect(isStandaloneDisplay(false, false)).toBe(false);
  });
});

describe("PWA install method", () => {
  it("prefers the native browser prompt", () => {
    expect(
      detectInstallMethod({
        hasNativePrompt: true,
        userAgent: "Mozilla/5.0 Chrome/140",
        platform: "Win32",
      }),
    ).toBe("native");
  });

  it("recognizes Edge and Chrome while the native prompt is not ready", () => {
    expect(
      detectInstallMethod({
        hasNativePrompt: false,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
        platform: "Win32",
      }),
    ).toBe("chromium");

    expect(
      detectInstallMethod({
        hasNativePrompt: false,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
      }),
    ).toBe("chromium");
  });

  it("detects iPhone, touch iPad and Safari on macOS", () => {
    expect(
      detectInstallMethod({
        hasNativePrompt: false,
        userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1",
        platform: "iPhone",
      }),
    ).toBe("ios");

    expect(
      detectInstallMethod({
        hasNativePrompt: false,
        userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");

    expect(
      detectInstallMethod({
        hasNativePrompt: false,
        userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe("mac-safari");
  });

  it("does not claim unsupported desktop browsers can install", () => {
    expect(
      detectInstallMethod({
        hasNativePrompt: false,
        userAgent: "Mozilla/5.0 Firefox/142.0",
        platform: "Win32",
      }),
    ).toBe("unsupported");
  });
});

describe("PWA banner reminder", () => {
  const now = new Date("2026-08-26T00:00:00.000Z").getTime();

  it("shows initially, stays hidden before 30 days, then returns", () => {
    const base = {
      eligibleHost: true,
      installed: false,
      method: "native" as const,
      now,
    };

    expect(shouldShowInstallBanner({ ...base, dismissedAt: null })).toBe(true);
    expect(
      shouldShowInstallBanner({
        ...base,
        dismissedAt: now - PWA_REPROMPT_INTERVAL_MS + 1,
      }),
    ).toBe(false);
    expect(
      shouldShowInstallBanner({
        ...base,
        dismissedAt: now - PWA_REPROMPT_INTERVAL_MS,
      }),
    ).toBe(true);
  });

  it("never shows when installed, off-host or unsupported", () => {
    expect(
      shouldShowInstallBanner({
        eligibleHost: true,
        installed: true,
        method: "native",
        dismissedAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      shouldShowInstallBanner({
        eligibleHost: false,
        installed: false,
        method: "native",
        dismissedAt: null,
        now,
      }),
    ).toBe(false);
    expect(
      shouldShowInstallBanner({
        eligibleHost: true,
        installed: false,
        method: "unsupported",
        dismissedAt: null,
        now,
      }),
    ).toBe(false);
  });

  it("parses only valid dismissal timestamps", () => {
    expect(parseDismissedAt(String(now))).toBe(now);
    expect(parseDismissedAt(null)).toBeNull();
    expect(parseDismissedAt("not-a-number")).toBeNull();
    expect(parseDismissedAt("-1")).toBeNull();
  });
});
