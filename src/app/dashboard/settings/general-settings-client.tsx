"use client";

import { Check, Laptop, Moon, Palette, Sun, Sparkles } from "lucide-react";
import { useState } from "react";

const themes = [
  {
    value: "sunrise",
    label: "Sunrise Family",
    description: "Tông cam rực rỡ, năng động & ấm áp",
    primaryColor: "#FF5B3D",
    swatches: ["#FF5B3D", "#69B7F3", "#F6B94A"],
    previewBg: "linear-gradient(135deg, rgba(255,91,61,0.15) 0%, rgba(105,183,243,0.1) 100%)",
  },
  {
    value: "ocean",
    label: "Ocean Calm",
    description: "Xanh biển dịu mát, tập trung & tinh tế",
    primaryColor: "#1677B8",
    swatches: ["#1677B8", "#32B8A6", "#F2B84B"],
    previewBg: "linear-gradient(135deg, rgba(22,119,184,0.15) 0%, rgba(50,184,166,0.1) 100%)",
  },
  {
    value: "forest",
    label: "Forest Home",
    description: "Xanh lá thiên nhiên, cân bằng & thư thái",
    primaryColor: "#2F7D5B",
    swatches: ["#2F7D5B", "#88A96B", "#D59A45"],
    previewBg: "linear-gradient(135deg, rgba(47,125,91,0.15) 0%, rgba(136,169,107,0.1) 100%)",
  },
  {
    value: "lavender",
    label: "Lavender Dream",
    description: "Sắc tím mộng mơ, sáng tạo & mượt mà",
    primaryColor: "#7959C8",
    swatches: ["#7959C8", "#E58EB3", "#66B8C4"],
    previewBg: "linear-gradient(135deg, rgba(121,89,200,0.15) 0%, rgba(229,142,179,0.1) 100%)",
  },
  {
    value: "midnight",
    label: "Midnight Finance",
    description: "Xanh đêm huyền bí, sang trọng & hiện đại",
    primaryColor: "#334E8C",
    swatches: ["#334E8C", "#008E9B", "#D6A53A"],
    previewBg: "linear-gradient(135deg, rgba(51,78,140,0.15) 0%, rgba(0,142,155,0.1) 100%)",
  },
] as const;

type ThemeName = (typeof themes)[number]["value"];
type Mode = "light" | "dark";

function applyAppearance(theme: ThemeName, mode: Mode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  localStorage.setItem("fin-workspace-theme", theme);
  localStorage.setItem("fin-workspace-mode", mode);
}

export function GeneralSettingsClient() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "sunrise";
    const savedTheme = localStorage.getItem("fin-workspace-theme");
    return themes.some((item) => item.value === savedTheme)
      ? (savedTheme as ThemeName)
      : "sunrise";
  });

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    const savedMode = localStorage.getItem("fin-workspace-mode");
    return savedMode === "light" || savedMode === "dark" ? savedMode : "dark";
  });

  function selectTheme(nextTheme: ThemeName) {
    setTheme(nextTheme);
    applyAppearance(nextTheme, mode);
  }

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    applyAppearance(theme, nextMode);
  }

  return (
    <section className="sunrise-card p-6 relative overflow-hidden">
      {/* Accent background glow */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{
          backgroundColor:
            themes.find((t) => t.value === theme)?.primaryColor || "#FF5B3D",
        }}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <Palette size={20} />
          </div>
          <div>
            <p className="settings-eyebrow flex items-center gap-1">
              <Sparkles size={12} className="text-[var(--primary)]" />
              Tùy chỉnh giao diện
            </p>
            <h2 className="text-xl font-bold tracking-tight mt-0.5">
              Chủ đề &amp; Chế độ hiển thị
            </h2>
          </div>
        </div>

        {/* Mode Segmented Switcher */}
        <div className="settings-segmented-control">
          <button
            type="button"
            className={`segmented-btn ${mode === "light" ? "segmented-btn-active" : ""}`}
            onClick={() => selectMode("light")}
          >
            <Sun size={15} />
            <span>Sáng</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${mode === "dark" ? "segmented-btn-active" : ""}`}
            onClick={() => selectMode("dark")}
          >
            <Moon size={15} />
            <span>Tối</span>
          </button>
        </div>
      </header>

      <p className="settings-card-copy mt-4 text-slate-500 dark:text-slate-400">
        Chọn chủ đề màu phù hợp với sở thích của bạn. Cài đặt này được đồng bộ tức thì trên trình duyệt thiết bị này.
      </p>

      {/* Theme Cards Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 mt-5"
        role="radiogroup"
        aria-label="Chọn chủ đề màu"
      >
        {themes.map((item) => {
          const isSelected = theme === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`theme-preview-card ${isSelected ? "theme-preview-card-selected" : ""}`}
              onClick={() => selectTheme(item.value)}
            >
              {/* Mini UI Simulation Canvas */}
              <div
                className="theme-mini-canvas"
                style={{ background: item.previewBg }}
              >
                <div className="mini-canvas-header">
                  <div className="mini-dot" style={{ backgroundColor: item.swatches[0] }} />
                  <div className="mini-bar" />
                </div>
                <div className="mini-canvas-body">
                  <div className="mini-card flex-1">
                    <div
                      className="mini-card-accent"
                      style={{ backgroundColor: item.swatches[0] }}
                    />
                    <div className="mini-line w-3/4" />
                    <div className="mini-line w-1/2 opacity-50" />
                  </div>
                  <div className="mini-card flex-1">
                    <div
                      className="mini-card-accent"
                      style={{ backgroundColor: item.swatches[1] }}
                    />
                    <div className="mini-line w-2/3" />
                  </div>
                </div>
              </div>

              {/* Theme Footer Info */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="text-left min-w-0">
                  <span className="font-semibold text-sm block truncate text-[var(--foreground)]">
                    {item.label}
                  </span>
                  <div className="flex gap-1 mt-1.5">
                    {item.swatches.map((color) => (
                      <span
                        key={color}
                        className="w-3 h-3 rounded-full border border-black/10 dark:border-white/20 inline-block"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-full grid place-items-center text-xs transition-all ${
                    isSelected
                      ? "bg-[var(--primary)] text-white shadow-sm scale-100"
                      : "bg-transparent text-transparent scale-75"
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

