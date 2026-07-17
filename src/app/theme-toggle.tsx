"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("fin-workspace-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("fin-workspace-theme");
    return saved === "light" ? "light" : "dark";
  });
  const toggle = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); applyTheme(next); };
  return <button type="button" onClick={toggle} title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} className="theme-toggle icon-button" aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} aria-pressed={theme === "dark"}>{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>;
}
