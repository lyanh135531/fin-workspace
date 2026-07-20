"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

function applyMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  localStorage.setItem("fin-workspace-mode", mode);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("fin-workspace-mode") ?? localStorage.getItem("fin-workspace-theme");
    return saved === "light" ? "light" : "dark";
  });
  const toggle = () => { const next = mode === "dark" ? "light" : "dark"; setMode(next); applyMode(next); };
  return <button type="button" onClick={toggle} title={mode === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} className="theme-toggle icon-button" aria-label={mode === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} aria-pressed={mode === "dark"}>{mode === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>;
}
