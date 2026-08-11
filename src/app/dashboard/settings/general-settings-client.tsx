"use client";

import {
  Button,
  Card,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import {
  Check,
  ChevronRight,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
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
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const mode = useSyncExternalStore<Mode>(subscribeMode, getMode, () => "dark");
  const theme = useSyncExternalStore<ThemeName>(
    subscribeTheme,
    getTheme,
    () => "sunrise",
  );
  const selectedTheme =
    themes.find((item) => item.value === theme) ?? themes[0];

  function selectTheme(nextTheme: ThemeName) {
    applyAppearance(nextTheme, mode);
  }

  function selectMode(nextMode: Mode) {
    applyAppearance(theme, nextMode);
  }

  return (
    <Card
      as="section"
      className="relative gap-0 overflow-hidden max-sm:p-4 max-sm:ring-0"
    >
      {/* Accent background glow */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500"
        style={{
          backgroundColor:
            themes.find((t) => t.value === theme)?.primaryColor || "#FF5B3D",
        }}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 max-sm:items-start">
        <div className="flex items-center gap-2.5">
          <div className="w-8.5 h-8.5 rounded-lg grid place-items-center text-[var(--primary)]">
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
        <Tabs
          value={mode}
          onValueChange={(value) => selectMode(value as Mode)}
          className="appearance-mode-tabs max-sm:w-full"
        >
          <TabsList
            className="appearance-mode-switch rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/80 max-sm:grid max-sm:w-full max-sm:grid-cols-2"
            aria-label="Chế độ hiển thị"
          >
            <TabsTrigger
              value="light"
              className="rounded-lg transition-all data-active:bg-white data-active:shadow-sm hover:text-[var(--primary)] dark:data-active:bg-slate-700 max-sm:justify-center"
            >
              <Sun className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-medium">Sáng</span>
            </TabsTrigger>
            <TabsTrigger
              value="dark"
              className="rounded-lg transition-all data-active:bg-white data-active:shadow-sm hover:text-[var(--primary)] dark:data-active:bg-slate-700 max-sm:justify-center"
            >
              <Moon className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-medium">Tối</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <p className="mt-3.5 text-xs leading-relaxed text-[var(--text-muted)] max-sm:hidden">
        Chọn chủ đề màu phù hợp với sở thích của bạn. Cài đặt này được đồng bộ
        tức thì trên trình duyệt thiết bị này.
      </p>

      <div className="mt-3 sm:hidden">
        <Button
          variant="unstyled"
          size="auto"
          type="button"
          className="flex min-h-16 w-full items-center gap-3 rounded-3xl bg-[var(--surface-muted)] px-2.5 py-2 text-left transition-[background-color,transform] active:scale-[0.98]"
          aria-haspopup="dialog"
          onClick={() => setThemeSheetOpen(true)}
        >
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{ background: selectedTheme.previewBg }}
          >
            <span className="flex -space-x-1">
              {selectedTheme.swatches.map((color) => (
                <span
                  key={color}
                  className="h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)]"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <small className="block text-[10px] font-medium text-[var(--text-muted)]">
              Chủ đề màu
            </small>
            <strong className="mt-0.5 block truncate text-sm font-semibold text-[var(--foreground)]">
              {selectedTheme.label}
            </strong>
          </span>
          <ChevronRight
            size={17}
            className="shrink-0 text-[var(--text-muted)]"
            aria-hidden="true"
          />
        </Button>
      </div>

      <Sheet open={themeSheetOpen} onOpenChange={setThemeSheetOpen}>
        <SheetContent
          side="bottom"
          className="quick-transaction-sheet sm:hidden"
        >
          <SheetHeader className="quick-transaction-header">
            <div className="quick-transaction-heading">
              <span aria-hidden="true">
                <Palette size={18} />
              </span>
              <div>
                <SheetTitle>Chọn chủ đề màu</SheetTitle>
                <SheetDescription>
                  Màu sắc được áp dụng ngay trên thiết bị này.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div
            className="quick-transaction-scroll grid gap-1"
            role="radiogroup"
            aria-label="Chọn chủ đề màu"
          >
            {themes.map((item) => {
              const isSelected = theme === item.value;
              return (
                <Button
                  key={item.value}
                  variant="unstyled"
                  size="auto"
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-3 rounded-3xl px-2.5 py-2 text-left transition-[background-color,transform] active:scale-[0.98]",
                    isSelected
                      ? "bg-[var(--surface-muted)]"
                      : "hover:bg-[var(--surface-muted)]/60",
                  )}
                  onClick={() => {
                    selectTheme(item.value);
                    setThemeSheetOpen(false);
                  }}
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                    style={{ background: item.previewBg }}
                  >
                    <span className="flex -space-x-1">
                      {item.swatches.map((color) => (
                        <span
                          key={color}
                          className="h-3.5 w-3.5 rounded-full border-2 border-[var(--surface)]"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-semibold text-[var(--foreground)]">
                      {item.label}
                    </strong>
                    <small className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
                      {item.description}
                    </small>
                  </span>
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                      isSelected
                        ? "border-transparent text-white"
                        : "border-[var(--border)] text-transparent",
                    )}
                    style={{
                      backgroundColor: isSelected
                        ? item.primaryColor
                        : undefined,
                    }}
                  >
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <div
        className="mt-5 hidden grid-cols-1 gap-3.5 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        role="radiogroup"
        aria-label="Chọn chủ đề màu"
      >
        {themes.map((item) => {
          const isSelected = theme === item.value;
          return (
            <Button
              key={item.value}
              variant="unstyled"
              size="auto"
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={cn(
                "group rounded-xl relative flex flex-col text-left overflow-hidden bg-[var(--surface)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none border",
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
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
