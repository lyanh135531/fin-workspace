"use client";

import { Button } from "@/components/base";
import { useSidebar } from "@/components/ui/sidebar";
import { PanelLeft } from "lucide-react";

export function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  function toggle(): void {
    toggleSidebar();
  }

  return (
    <Button variant="icon" size="auto" className="relative size-8 min-h-8 min-w-8 shrink-0 p-0"
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Mở rộng điều hướng" : "Thu gọn điều hướng"}
      aria-pressed={collapsed}
      aria-expanded={!collapsed}
    >
      <PanelLeft size={16} strokeWidth={1.8} />
    </Button>
  );
}
