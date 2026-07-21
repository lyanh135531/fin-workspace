"use client";

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
  const toggle = () => { const next = mode === "dark" ? "light" : "dark"; applyMode(next); };
  return <button type="button" onClick={toggle} title={mode === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} className="theme-toggle icon-button" aria-label={mode === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} aria-pressed={mode === "dark"}>{mode === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>;
}
