"use client";

import { Check, Moon, Palette, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const APPEARANCE_THEMES = [
  { value: "sunrise", label: "Sunrise Family", shortLabel: "Sunrise", color: "#FF5B3D" },
  { value: "ocean", label: "Ocean Calm", shortLabel: "Ocean", color: "#1677B8" },
  { value: "forest", label: "Forest Home", shortLabel: "Forest", color: "#2F7D5B" },
  { value: "lavender", label: "Lavender Dream", shortLabel: "Lavender", color: "#7959C8" },
  { value: "midnight", label: "Midnight Finance", shortLabel: "Midnight", color: "#334E8C" },
] as const;

type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]["value"];
type AppearanceMode = "light" | "dark";

function applyAppearance(theme: AppearanceTheme, mode: AppearanceMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  document.documentElement.style.colorScheme = mode;
  localStorage.setItem("fin-workspace-theme", theme);
  localStorage.setItem("fin-workspace-mode", mode);
}

function subscribeAppearance(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-mode"],
  });
  return () => observer.disconnect();
}

function getAppearance() {
  const rawTheme = document.documentElement.dataset.theme;
  const theme = APPEARANCE_THEMES.some((item) => item.value === rawTheme)
    ? (rawTheme as AppearanceTheme)
    : "sunrise";
  const mode: AppearanceMode =
    document.documentElement.dataset.mode === "dark" ? "dark" : "light";
  return `${theme}:${mode}`;
}

function useAppearance() {
  const snapshot = useSyncExternalStore(
    subscribeAppearance,
    getAppearance,
    () => "sunrise:light",
  );
  const [theme, mode] = snapshot.split(":") as [
    AppearanceTheme,
    AppearanceMode,
  ];
  return {
    theme,
    mode,
    selectTheme: (nextTheme: AppearanceTheme) =>
      applyAppearance(nextTheme, mode),
    selectMode: (nextMode: AppearanceMode) => applyAppearance(theme, nextMode),
  };
}

export function AppearanceMenu() {
  const { theme, mode, selectTheme, selectMode } = useAppearance();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="icon"
            size="icon"
            type="button"
            aria-label="Cài đặt giao diện"
            title="Cài đặt giao diện"
          />
        }
      >
        <Palette aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2">
        <div className="px-2 pb-2 pt-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Giao diện
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Tùy chỉnh chế độ và màu sắc.
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => selectMode(value as AppearanceMode)}
          className="py-1"
        >
          <DropdownMenuLabel className="px-2 pb-1.5 pt-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Chế độ hiển thị
          </DropdownMenuLabel>
          <div className="grid grid-cols-2 gap-1">
            <DropdownMenuRadioItem
              value="light"
              className="min-h-10 justify-center px-3 py-2.5 pr-8 font-medium data-checked:bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] data-checked:text-[var(--primary)]"
            >
              <Sun aria-hidden="true" />
              Sáng
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value="dark"
              className="min-h-10 justify-center px-3 py-2.5 pr-8 font-medium data-checked:bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] data-checked:text-[var(--primary)]"
            >
              <Moon aria-hidden="true" />
              Tối
            </DropdownMenuRadioItem>
          </div>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => selectTheme(value as AppearanceTheme)}
          className="py-1 space-y-1"
        >
          <DropdownMenuLabel className="px-2 pb-1.5 pt-1 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Chủ đề màu
          </DropdownMenuLabel>
          {APPEARANCE_THEMES.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              className="min-h-10 gap-2.5 px-2.5 py-2 pr-8 font-medium data-checked:bg-[color-mix(in_srgb,var(--primary)_10%,var(--surface))] data-checked:text-[var(--foreground)]"
            >
              <span
                className="size-4 rounded-full ring-1 ring-inset ring-[var(--border)]"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileAppearanceSheet() {
  const { theme, mode, selectTheme, selectMode } = useAppearance();
  const currentTheme =
    APPEARANCE_THEMES.find((item) => item.value === theme) ??
    APPEARANCE_THEMES[0];

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="icon"
            size="icon"
            type="button"
            aria-label="Mở cài đặt giao diện"
            title="Cài đặt giao diện"
          />
        }
      >
        <Palette aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="quick-transaction-sheet"
        aria-label="Cài đặt giao diện"
      >
        <SheetHeader className="quick-transaction-header">
          <div className="quick-transaction-heading">
            <span>
              <Palette size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <SheetTitle>Giao diện</SheetTitle>
              <SheetDescription>Tùy chỉnh chế độ và màu sắc.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="quick-transaction-scroll grid gap-5 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* 1. Chế độ hiển thị: Segmented Control chuẩn iOS */}
          <section aria-labelledby="mobile-mode-label" className="grid gap-2">
            <h3
              id="mobile-mode-label"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              Chế độ hiển thị
            </h3>
            <Tabs
              value={mode}
              onValueChange={(val) => selectMode(val as AppearanceMode)}
              className="w-full gap-0"
            >
              <TabsList
                variant="segmented"
                className="grid w-full grid-cols-2 h-10.5"
                aria-label="Chọn chế độ hiển thị"
              >
                <TabsTrigger
                  value="light"
                  className="gap-2 text-xs font-medium cursor-pointer"
                >
                  <Sun size={15} aria-hidden="true" />
                  <span>Sáng</span>
                </TabsTrigger>
                <TabsTrigger
                  value="dark"
                  className="gap-2 text-xs font-medium cursor-pointer"
                >
                  <Moon size={15} aria-hidden="true" />
                  <span>Tối</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </section>

          {/* 2. Chủ đề màu: Color Swatches dạng bảng màu tinh tế */}
          <section aria-labelledby="mobile-theme-label" className="grid gap-2.5">
            <div className="flex items-center justify-between">
              <h3
                id="mobile-theme-label"
                className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Chủ đề màu
              </h3>
              <span className="text-xs font-medium text-[var(--primary)]">
                {currentTheme.label}
              </span>
            </div>

            <div
              className="grid grid-cols-5 gap-1 pt-1"
              role="radiogroup"
              aria-labelledby="mobile-theme-label"
            >
              {APPEARANCE_THEMES.map((item) => {
                const selected = theme === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={item.label}
                    onClick={() => selectTheme(item.value)}
                    className="group flex flex-col items-center gap-1.5 py-1 text-center touch-manipulation focus:outline-none cursor-pointer"
                  >
                    <span
                      className={cn(
                        "size-11 rounded-full flex items-center justify-center transition-all duration-200",
                        selected
                          ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)] scale-105"
                          : "opacity-80 hover:opacity-100 hover:scale-105 active:scale-95",
                      )}
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    >
                      {selected && (
                        <Check
                          size={18}
                          className="text-white drop-shadow-none"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[0.68rem] tracking-tight transition-colors truncate max-w-full",
                        selected
                          ? "font-semibold text-[var(--foreground)]"
                          : "font-medium text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]",
                      )}
                    >
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
