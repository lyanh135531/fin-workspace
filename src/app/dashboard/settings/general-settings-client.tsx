"use client";

import { Card, Tabs, TabsList, TabsTrigger } from "@/components/base";
import { Check, Laptop, Moon, Palette, Sun, Sparkles } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const themes = [
  {
    value: "sunrise",
    label: "Sunrise Family",
    description: "Tông cam rực rỡ, năng động & ấm áp",
    primaryColor: "#FF5B3D",
    swatches: ["#FF5B3D", "#69B7F3", "#F6B94A"],
    previewBg:
      "linear-gradient(135deg, rgba(255,91,61,0.15) 0%, rgba(105,183,243,0.1) 100%)",
  },
  {
    value: "ocean",
    label: "Ocean Calm",
    description: "Xanh biển dịu mát, tập trung & tinh tế",
    primaryColor: "#1677B8",
    swatches: ["#1677B8", "#32B8A6", "#F2B84B"],
    previewBg:
      "linear-gradient(135deg, rgba(22,119,184,0.15) 0%, rgba(50,184,166,0.1) 100%)",
  },
  {
    value: "forest",
    label: "Forest Home",
    description: "Xanh lá thiên nhiên, cân bằng & thư thái",
    primaryColor: "#2F7D5B",
    swatches: ["#2F7D5B", "#88A96B", "#D59A45"],
    previewBg:
      "linear-gradient(135deg, rgba(47,125,91,0.15) 0%, rgba(136,169,107,0.1) 100%)",
  },
  {
    value: "lavender",
    label: "Lavender Dream",
    description: "Sắc tím mộng mơ, sáng tạo & mượt mà",
    primaryColor: "#7959C8",
    swatches: ["#7959C8", "#E58EB3", "#66B8C4"],
    previewBg:
      "linear-gradient(135deg, rgba(121,89,200,0.15) 0%, rgba(229,142,179,0.1) 100%)",
  },
  {
    value: "midnight",
    label: "Midnight Finance",
    description: "Xanh đêm huyền bí, sang trọng & hiện đại",
    primaryColor: "#334E8C",
    swatches: ["#334E8C", "#008E9B", "#D6A53A"],
    previewBg:
      "linear-gradient(135deg, rgba(51,78,140,0.15) 0%, rgba(0,142,155,0.1) 100%)",
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

function getMode(): Mode {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.mode === "light" ? "light" : "dark";
}

function subscribeMode(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mode"],
  });
  return () => observer.disconnect();
}

function getTheme(): ThemeName {
  if (typeof document === "undefined") return "sunrise";
  const current = document.documentElement.dataset.theme as ThemeName;
  return themes.some((t) => t.value === current) ? current : "sunrise";
}

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function GeneralSettingsClient() {
  const mode = useSyncExternalStore<Mode>(subscribeMode, getMode, () => "dark");
  const theme = useSyncExternalStore<ThemeName>(
    subscribeTheme,
    getTheme,
    () => "sunrise",
  );

  function selectTheme(nextTheme: ThemeName) {
    applyAppearance(nextTheme, mode);
  }

  function selectMode(nextMode: Mode) {
    applyAppearance(theme, nextMode);
  }

  return (
    <Card as="section" className="gap-0 relative overflow-hidden">
      {/* Accent background glow */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500"
        style={{
          backgroundColor:
            themes.find((t) => t.value === theme)?.primaryColor || "#FF5B3D",
        }}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8.5 h-8.5 rounded-lg grid place-items-center bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <Palette size={18} />
          </div>
          <div>
            <p className="settings-eyebrow flex items-center gap-1">
              <Sparkles size={11} className="text-[var(--primary)]" />
              Tùy chỉnh giao diện
            </p>
            <h2 className="text-base font-bold tracking-tight mt-0.5">
              Chủ đề &amp; Chế độ hiển thị
            </h2>
          </div>
        </div>

        {/* Mode Segmented Switcher */}
        <Tabs value={mode} onValueChange={(value) => selectMode(value as Mode)}>
          <TabsList className="bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl">
            <TabsTrigger
              value="light"
              className="data-active:bg-white dark:data-active:bg-slate-700 data-active:shadow-sm hover:text-[var(--primary)] rounded-lg transition-all"
            >
              <Sun className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-medium">Sáng</span>
            </TabsTrigger>
            <TabsTrigger
              value="dark"
              className="data-active:bg-white dark:data-active:bg-slate-700 data-active:shadow-sm hover:text-[var(--primary)] rounded-lg transition-all"
            >
              <Moon className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-medium">Tối</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <p className="text-xs text-[var(--text-muted)] mt-3.5 leading-relaxed">
        Chọn chủ đề màu phù hợp với sở thích của bạn. Cài đặt này được đồng bộ
        tức thì trên trình duyệt thiết bị này.
      </p>

      {/* Modern High-End Theme Cards Grid */}
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
              className={cn(
                "group relative flex flex-col text-left overflow-hidden bg-[var(--surface)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none border",
                isSelected
                  ? "border-transparent shadow-lg shadow-black/5 dark:shadow-black/30"
                  : "border-black/[0.08] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 hover:-translate-y-1 hover:shadow-md",
              )}
              onClick={() => selectTheme(item.value)}
              style={
                isSelected
                  ? {
                      boxShadow: `0 0 0 2px ${item.primaryColor}, 0 12px 24px -6px ${item.primaryColor}25`,
                    }
                  : undefined
              }
            >
              {/* Mini App UI Preview Canvas */}
              <div
                className="h-28 w-full p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-300 group-hover:scale-[1.02]"
                style={{ background: item.previewBg }}
              >
                {/* Simulated macOS / App Window Titlebar */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400/80" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
                </div>

                {/* Simulated Micro App Dashboard Widgets */}
                <div className="grid grid-cols-5 gap-1.5 flex-1 pt-1.5 items-end">
                  {/* Main Widget Box */}
                  <div className="col-span-3 h-full rounded-lg bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-2 flex flex-col justify-between border border-white/40 dark:border-white/10 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="h-1.5 w-7 rounded-full bg-slate-400/50" />
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.swatches[0] }}
                      />
                    </div>
                    <div className="space-y-1">
                      <div
                        className="h-2 w-11/12 rounded-full"
                        style={{ backgroundColor: item.swatches[0] }}
                      />
                      <div className="h-1.5 w-3/4 rounded-full bg-slate-300/50 dark:bg-slate-700/50" />
                    </div>
                  </div>

                  {/* Side Widget Stack */}
                  <div className="col-span-2 h-full flex flex-col gap-1.5 justify-between">
                    <div className="flex-1 rounded-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs p-1.5 flex flex-col justify-center border border-white/30 dark:border-white/5">
                      <div
                        className="h-1.5 w-full rounded-full"
                        style={{ backgroundColor: item.swatches[1] }}
                      />
                    </div>
                    <div className="flex-1 rounded-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs p-1.5 flex flex-col justify-center border border-white/30 dark:border-white/5">
                      <div
                        className="h-1.5 w-2/3 rounded-full"
                        style={{ backgroundColor: item.swatches[2] }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Footer Info */}
              <div className="p-3.5 flex flex-col gap-2.5 bg-[var(--surface)] border-t border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs text-[var(--foreground)] tracking-tight">
                    {item.label}
                  </span>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full grid place-items-center text-xs shrink-0 transition-all duration-300",
                      isSelected
                        ? "text-white shadow-sm scale-100"
                        : "border border-slate-300 dark:border-slate-700 bg-transparent text-transparent scale-90 opacity-40 group-hover:opacity-100",
                    )}
                    style={{
                      backgroundColor: isSelected
                        ? item.primaryColor
                        : undefined,
                    }}
                  >
                    <Check size={11} strokeWidth={3.5} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {item.swatches.map((color) => (
                      <span
                        key={color}
                        className="w-3 h-3 rounded-full border border-black/10 dark:border-white/10 shadow-2xs inline-block"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-muted)] truncate">
                    {item.value.toUpperCase()}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
