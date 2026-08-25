"use client";

import { Check, Moon, Palette, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/base";
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
    ? rawTheme as AppearanceTheme
    : "sunrise";
  const mode: AppearanceMode = document.documentElement.dataset.mode === "dark"
    ? "dark"
    : "light";
  return `${theme}:${mode}`;
}

function useAppearance() {
  const snapshot = useSyncExternalStore(
    subscribeAppearance,
    getAppearance,
    () => "sunrise:light",
  );
  const [theme, mode] = snapshot.split(":") as [AppearanceTheme, AppearanceMode];
  return {
    theme,
    mode,
    selectTheme: (nextTheme: AppearanceTheme) => applyAppearance(nextTheme, mode),
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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Chế độ hiển thị</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => selectMode(value as AppearanceMode)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" />
            Sáng
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            Tối
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Chủ đề màu</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => selectTheme(value as AppearanceTheme)}
        >
          {APPEARANCE_THEMES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <span
                className="size-3 rounded-full"
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

export function MobileAppearanceControls() {
  const { theme, mode, selectTheme, selectMode } = useAppearance();

  return (
    <section className="border-t border-[var(--border)] px-3 py-4" aria-labelledby="mobile-appearance-title">
      <div className="flex items-center gap-2 px-2">
        <Palette size={16} className="text-[var(--text-secondary)]" aria-hidden="true" />
        <h2 id="mobile-appearance-title" className="text-sm font-semibold text-[var(--foreground)]">
          Giao diện
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Chế độ hiển thị">
        {([
          { value: "light", label: "Sáng", icon: Sun },
          { value: "dark", label: "Tối", icon: Moon },
        ] as const).map((item) => {
          const Icon = item.icon;
          const selected = mode === item.value;
          return (
            <Button
              key={item.value}
              variant="ghost"
              type="button"
              role="radio"
              aria-checked={selected}
              className="w-full justify-start"
              onClick={() => selectMode(item.value)}
            >
              <Icon aria-hidden="true" />
              {item.label}
              {selected && <Check className="ml-auto" aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-1" role="radiogroup" aria-label="Chủ đề màu">
        {APPEARANCE_THEMES.map((item) => {
          const selected = theme === item.value;
          return (
            <Button
              key={item.value}
              variant="ghost"
              type="button"
              role="radio"
              aria-checked={selected}
              className="w-full justify-start"
              onClick={() => selectTheme(item.value)}
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
              {selected && <Check className="ml-auto" aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
