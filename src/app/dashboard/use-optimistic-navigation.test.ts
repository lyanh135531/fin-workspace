import { describe, expect, it } from "vitest";

import {
  resolveOptimisticPendingHref,
  stripHrefQueryAndHash,
} from "@/app/dashboard/use-optimistic-navigation";

describe("useOptimisticNavigation helpers", () => {
  it("strips query string and hash fragments cleanly", () => {
    expect(stripHrefQueryAndHash("/wallets?tab=cards#top")).toBe("/wallets");
    expect(stripHrefQueryAndHash("/workspace/ws-1?action=new-transaction")).toBe(
      "/workspace/ws-1",
    );
  });

  it("keeps pendingHref active while current pathname is still on the origin route", () => {
    expect(
      resolveOptimisticPendingHref(
        { href: "/wallets", fromPathname: "/overview" },
        "/overview",
      ),
    ).toBe("/wallets");
  });

  it("clears pendingHref synchronously as soon as pathname reaches the target route", () => {
    expect(
      resolveOptimisticPendingHref(
        { href: "/wallets?tab=cards", fromPathname: "/overview" },
        "/wallets",
      ),
    ).toBeNull();
  });

  it("clears pendingHref when pathname moves to any third route (e.g. Back/Forward)", () => {
    expect(
      resolveOptimisticPendingHref(
        { href: "/wallets", fromPathname: "/overview" },
        "/financial-plans",
      ),
    ).toBeNull();
  });

  it("returns null when no pending navigation snapshot exists", () => {
    expect(resolveOptimisticPendingHref(null, "/overview")).toBeNull();
  });
});
