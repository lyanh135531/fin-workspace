"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "fin-sidebar-collapsed";

export function SidebarToggle() {
  /* Read initial state from the DOM attribute set by the inline script in layout.tsx.
     This avoids the flash where useState(false) → useEffect reads localStorage → re-render. */
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.dataset.sidebarCollapsed === "true";
    }
    return false;
  });

  /* ── Sync React state → DOM attribute ── */
  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(collapsed);
  }, [collapsed]);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <button
      className="dashboard-sidebar-toggle"
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"}
      aria-pressed={collapsed}
      aria-expanded={!collapsed}
    >
      {collapsed
        ? <PanelLeftOpen size={16} strokeWidth={1.8} />
        : <PanelLeftClose size={16} strokeWidth={1.8} />}
    </button>
  );
}
