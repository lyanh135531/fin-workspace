"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Listener = (href: string | null) => void;
const listeners = new Set<Listener>();
let globalPendingHref: string | null = null;

function broadcastPendingHref(href: string | null) {
  globalPendingHref = href;
  listeners.forEach((listener) => listener(href));
}

export function useOptimisticNavigation() {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(globalPendingHref);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const listener: Listener = (href) => {
      setPendingHref(href);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const beginNavigation = useCallback(
    (href: string) => {
      broadcastPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  useEffect(() => {
    if (!isPending && globalPendingHref) {
      broadcastPendingHref(null);
    }
  }, [isPending]);

  return {
    pendingHref,
    beginNavigation,
  };
}
