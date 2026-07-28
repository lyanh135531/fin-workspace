"use client";

import { Button } from "@/components/base";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

function applyMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  localStorage.setItem("fin-workspace-mode", mode);
}

function subscribeMode(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => observer.disconnect();
}

function getMode(): Mode {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeMode, getMode, () => "light");
  const nextMode: Mode = mode === "dark" ? "light" : "dark";
  const Icon = nextMode === "dark" ? Moon : Sun;
  const label = `Chuyển sang chế độ ${nextMode === "dark" ? "tối" : "sáng"}`;

  return (
    <Button variant="unstyled" size="auto"
      type="button"
      className="theme-toggle icon-button header-action-btn"
      aria-label={label}
      title={label}
      onClick={() => applyMode(nextMode)}
    >
      {/* Key forces remount → triggers CSS animation */}
      <span key={nextMode} className="theme-toggle-icon" aria-hidden>
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="sr-only">{label}</span>
    </Button>
  );
}
