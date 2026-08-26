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
  { value: "sunrise", label: "Sunrise Family", color: "#FF5B3D" },
  { value: "ocean", label: "Ocean Calm", color: "#1677B8" },
  { value: "forest", label: "Forest Home", color: "#2F7D5B" },
  { value: "lavender", label: "Lavender Dream", color: "#7959C8" },
  { value: "midnight", label: "Midnight Finance", color: "#334E8C" },
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

        <div className="quick-transaction-scroll grid gap-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <section aria-labelledby="mobile-mode-label" className="grid gap-2.5">
            <h3
              id="mobile-mode-label"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              Chế độ hiển thị
            </h3>
            <div
              className="grid grid-cols-2 gap-2.5"
              role="radiogroup"
              aria-labelledby="mobile-mode-label"
            >
              {(
                [
                  { value: "light", label: "Sáng", icon: Sun },
                  { value: "dark", label: "Tối", icon: Moon },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const selected = mode === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectMode(item.value)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-semibold"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} aria-hidden="true" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {selected && (
                      <Check size={16} className="text-[var(--primary)]" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="mobile-theme-label" className="grid gap-2.5">
            <h3
              id="mobile-theme-label"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
            >
              Chủ đề màu
            </h3>
            <div
              className="grid gap-2"
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
                    onClick={() => selectTheme(item.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all",
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--foreground)] font-semibold"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-5 rounded-full ring-2 ring-inset ring-black/10 dark:ring-white/10 shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {selected && (
                      <Check size={16} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
                    )}
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
