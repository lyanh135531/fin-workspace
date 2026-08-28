"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function useOptimisticNavigation() {
  const router = useRouter();
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const beginNavigation = useCallback(
    (href: string) => {
      setTargetHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  return {
    pendingHref: isPending ? targetHref : null,
    beginNavigation,
  };
}
