"use client";

import { useSyncExternalStore } from "react";

export const PRIVACY_MASK_STORAGE_KEY = "fin-workspace-privacy-masked";
export const PRIVACY_MASK_EVENT = "fin-workspace-privacy-mask-change";

export function getStoredPrivacyMask(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRIVACY_MASK_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function subscribePrivacyMask(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PRIVACY_MASK_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(PRIVACY_MASK_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function togglePrivacyMask(): void {
  if (typeof window === "undefined") return;
  try {
    const nextMasked = !getStoredPrivacyMask();
    window.localStorage.setItem(PRIVACY_MASK_STORAGE_KEY, String(nextMasked));
    document.documentElement.dataset.privacyMasked = String(nextMasked);
    window.dispatchEvent(new Event(PRIVACY_MASK_EVENT));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function usePrivacyMask(): boolean {
  return useSyncExternalStore(
    subscribePrivacyMask,
    getStoredPrivacyMask,
    () => false,
  );
}
