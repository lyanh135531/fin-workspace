"use client";

import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

export type PendingNavigationSnapshot = {
  href: string;
  fromPathname: string;
} | null;

const PENDING_NAVIGATION_TIMEOUT_MS = 8_000;

type Listener = () => void;
const listeners = new Set<Listener>();
let globalPendingSnapshot: PendingNavigationSnapshot = null;
let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearSafetyTimeout() {
  if (safetyTimeoutId !== null) {
    clearTimeout(safetyTimeoutId);
    safetyTimeoutId = null;
  }
}

function setGlobalPendingSnapshot(next: PendingNavigationSnapshot) {
  clearSafetyTimeout();
  globalPendingSnapshot = next;
  if (next !== null) {
    safetyTimeoutId = setTimeout(() => {
      safetyTimeoutId = null;
      if (globalPendingSnapshot === next) {
        globalPendingSnapshot = null;
        listeners.forEach((listener) => listener());
      }
    }, PENDING_NAVIGATION_TIMEOUT_MS);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PendingNavigationSnapshot {
  return globalPendingSnapshot;
}

function getServerSnapshot(): PendingNavigationSnapshot {
  return null;
}

export function stripHrefQueryAndHash(href: string): string {
  return href.split("?")[0].split("#")[0];
}

export function resolveOptimisticPendingHref(
  snapshot: PendingNavigationSnapshot,
  currentPathname: string,
): string | null {
  if (!snapshot) return null;
  const cleanCurrent = stripHrefQueryAndHash(currentPathname);
  const cleanTarget = stripHrefQueryAndHash(snapshot.href);

  // As soon as the router commits the target route (or any route change away from origin),
  // hand back active-highlight ownership to `usePathname()` in the exact same render pass.
  if (cleanCurrent === cleanTarget || cleanCurrent !== snapshot.fromPathname) {
    return null;
  }

  return snapshot.href;
}

export function useOptimisticNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pendingHref = resolveOptimisticPendingHref(snapshot, pathname);

  useEffect(() => {
    if (
      globalPendingSnapshot &&
      resolveOptimisticPendingHref(globalPendingSnapshot, pathname) === null
    ) {
      clearSafetyTimeout();
      globalPendingSnapshot = null;
    }
  }, [pathname]);

  const beginNavigation = useCallback(
    (href: string) => {
      const cleanCurrent = stripHrefQueryAndHash(pathname);
      const cleanTarget = stripHrefQueryAndHash(href);

      if (cleanTarget === cleanCurrent) {
        if (globalPendingSnapshot !== null) {
          setGlobalPendingSnapshot(null);
        }
        if (href.includes("?") || href.includes("#")) {
          startTransition(() => {
            router.push(href);
          });
        }
        return;
      }

      setGlobalPendingSnapshot({
        href,
        fromPathname: cleanCurrent,
      });
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router],
  );

  return {
    pendingHref,
    beginNavigation,
  };
}
