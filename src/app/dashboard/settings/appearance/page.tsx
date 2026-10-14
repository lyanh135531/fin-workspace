"use client";

import { Check, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Card, PageContainer, PageHeader } from "@/components/base";
import { cn } from "@/lib/utils";

export const APPEARANCE_THEME_PRESETS = [
  {
    value: "sunrise",
    label: "Bình minh",
    subtitle: "Sunrise Family",
    description: "Sắc cam san hô ấm áp, gần gũi cho không gian tài chính gia đình.",
    primary: "#FF5B3D",
    soft: "#FFE6DE",
    surfaceLight: "#FFF8F0",
    surfaceDark: "#1A1412",
  },
  {
    value: "ocean",
    label: "Đại dương",
    subtitle: "Ocean Calm",
    description: "Sắc xanh biển điềm tĩnh, rõ ràng và dễ tập trung khi đối soát sổ sách.",
    primary: "#1677B8",
    soft: "#E4F3FE",
    surfaceLight: "#F4F9FD",
    surfaceDark: "#101822",
  },
  {
    value: "forest",
    label: "Rừng xanh",
    subtitle: "Forest Home",
    description: "Tông xanh ngọc lục bảo cân bằng, gợi cảm giác tăng trưởng bền vững.",
    primary: "#2F7D5B",
    soft: "#E3F5EC",
    surfaceLight: "#F4FAF7",
    surfaceDark: "#111A16",
  },
  {
    value: "lavender",
    label: "Oải hương",
    subtitle: "Lavender Dream",
    description: "Gam tím thanh lịch, nhẹ nhàng và tinh tế trên mọi kích thước màn hình.",
    primary: "#7959C8",
    soft: "#EFEAFD",
    surfaceLight: "#F8F6FD",
    surfaceDark: "#161320",
  },
  {
    value: "midnight",
    label: "Đêm tối",
    subtitle: "Midnight Finance",
    description: "Tông xanh chàm chuẩn mực, sắc nét cho báo cáo và phân tích tài chính.",
    primary: "#334E8C",
    soft: "#E6ECF8",
    surfaceLight: "#F5F7FC",
    surfaceDark: "#111521",
  },
] as const;

export type AppearanceThemeValue =
  (typeof APPEARANCE_THEME_PRESETS)[number]["value"];
export type AppearanceModeValue = "light" | "dark";

const MODE_OPTIONS: {
  value: AppearanceModeValue;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: "light",
    label: "Giao diện Sáng",
    description: "Nền sáng dịu mắt, độ tương phản rõ ràng khi làm việc ban ngày.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Giao diện Tối",
    description: "Giảm ánh sáng xanh, dịu mắt khi theo dõi tài chính vào buổi tối.",
    icon: Moon,
  },
];

function applyAppearance(
  theme: AppearanceThemeValue,
  mode: AppearanceModeValue,
) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  document.documentElement.style.colorScheme = mode;
  try {
    localStorage.setItem("fin-workspace-theme", theme);
    localStorage.setItem("fin-workspace-mode", mode);
  } catch {
    // Ignore storage restriction errors
  }
}

function subscribeAppearance(callback: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-mode"],
  });
  return () => observer.disconnect();
}

function getAppearanceSnapshot() {
  if (typeof document === "undefined") return "sunrise:light";
  const rawTheme = document.documentElement.dataset.theme;
  const theme = APPEARANCE_THEME_PRESETS.some((item) => item.value === rawTheme)
    ? (rawTheme as AppearanceThemeValue)
    : "sunrise";
  const mode: AppearanceModeValue =
    document.documentElement.dataset.mode === "dark" ? "dark" : "light";
  return `${theme}:${mode}`;
}

export function useWorkspaceAppearance() {
  const snapshot = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSnapshot,
    () => "sunrise:light",
  );
  const [theme, mode] = snapshot.split(":") as [
    AppearanceThemeValue,
    AppearanceModeValue,
  ];
  return {
    theme,
    mode,
    selectTheme: (nextTheme: AppearanceThemeValue) =>
      applyAppearance(nextTheme, mode),
    selectMode: (nextMode: AppearanceModeValue) =>
      applyAppearance(theme, nextMode),
  };
}

export function AppearanceSettingsSection() {
  const { theme, mode, selectTheme, selectMode } = useWorkspaceAppearance();
  const activeTheme =
    APPEARANCE_THEME_PRESETS.find((item) => item.value === theme) ??
    APPEARANCE_THEME_PRESETS[0];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Light / Dark Mode Selector */}
      <Card as="section" className="gap-4">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              {mode === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                Chế độ hiển thị
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Chuyển đổi giữa nền sáng và nền tối trên thiết bị hiện tại.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]">
            <span
              className="size-2 rounded-full bg-[var(--primary)]"
              aria-hidden="true"
            />
            {mode === "dark" ? "Đang dùng: Tối" : "Đang dùng: Sáng"}
          </span>
        </div>

        <div
          className="grid gap-3 md:grid-cols-2 md:gap-4"
          role="radiogroup"
          aria-label="Chọn chế độ hiển thị"
        >
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = mode === option.value;
            const isDarkPreview = option.value === "dark";

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => selectMode(option.value)}
                className={cn(
                  "group flex flex-col gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] md:p-4",
                  isSelected
                    ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]",
                )}
              >
                {/* Visual Preview Miniature */}
                <div
                  className="overflow-hidden rounded-lg border p-3"
                  style={{
                    backgroundColor: isDarkPreview
                      ? activeTheme.surfaceDark
                      : activeTheme.surfaceLight,
                    borderColor: isDarkPreview
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(23,35,60,0.12)",
                  }}
                  aria-hidden="true"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: activeTheme.primary }}
                      />
                      <span
                        className="h-2 w-16 rounded-full"
                        style={{
                          backgroundColor: isDarkPreview
                            ? "rgba(255,255,255,0.75)"
                            : "rgba(23,35,60,0.75)",
                        }}
                      />
                    </div>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: activeTheme.soft,
                        color: activeTheme.primary,
                      }}
                    >
                      VND
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((col) => (
                      <div
                        key={col}
                        className="rounded-md border p-2"
                        style={{
                          backgroundColor: isDarkPreview
                            ? "rgba(255,255,255,0.05)"
                            : "#FFFFFF",
                          borderColor: isDarkPreview
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(23,35,60,0.08)",
                        }}
                      >
                        <div
                          className="h-1.5 w-8 rounded-full"
                          style={{
                            backgroundColor: isDarkPreview
                              ? "rgba(255,255,255,0.35)"
                              : "rgba(23,35,60,0.3)",
                          }}
                        />
                        <div
                          className="mt-1.5 h-2 w-12 rounded-full"
                          style={{
                            backgroundColor:
                              col === 1
                                ? activeTheme.primary
                                : isDarkPreview
                                  ? "rgba(255,255,255,0.8)"
                                  : "rgba(23,35,60,0.8)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border",
                        isSelected
                          ? "border-[color-mix(in_srgb,var(--primary)_30%,var(--border))] bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
                      )}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {option.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {option.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--text-on-primary)]"
                        : "border-[var(--border-strong)] bg-[var(--surface)] text-transparent",
                    )}
                    aria-hidden="true"
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 5 Theme Cards */}
      <Card as="section" className="gap-4">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
              aria-hidden="true"
            >
              <Palette size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                Chủ đề màu sắc
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Lựa chọn 1 trong 5 bảng màu đặc trưng cho không gian tài chính của bạn.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]">
            <Sparkles size={13} className="text-[var(--primary)]" aria-hidden="true" />
            <span>{activeTheme.label}</span>
          </span>
        </div>

        <div
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 md:gap-4"
          role="radiogroup"
          aria-label="Chọn chủ đề màu sắc"
        >
          {APPEARANCE_THEME_PRESETS.map((preset) => {
            const isSelected = theme === preset.value;
            const previewBg =
              mode === "dark" ? preset.surfaceDark : preset.surfaceLight;

            return (
              <button
                key={preset.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => selectTheme(preset.value)}
                className={cn(
                  "group flex flex-col justify-between gap-3.5 rounded-xl border p-3.5 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] md:p-4",
                  isSelected
                    ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <div className="space-y-3">
                  {/* Palette & Mini Card Preview */}
                  <div
                    className="overflow-hidden rounded-lg border p-3"
                    style={{
                      backgroundColor: previewBg,
                      borderColor:
                        mode === "dark"
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(23,35,60,0.1)",
                    }}
                    aria-hidden="true"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="size-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.soft }}
                        />
                      </div>
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: preset.primary,
                          color: "#FFFFFF",
                        }}
                      >
                        {preset.label}
                      </span>
                    </div>

                    <div
                      className="mt-2.5 flex items-center justify-between rounded-md border px-2.5 py-2"
                      style={{
                        backgroundColor:
                          mode === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF",
                        borderColor:
                          mode === "dark"
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(23,35,60,0.08)",
                      }}
                    >
                      <div className="space-y-1">
                        <div
                          className="h-1.5 w-14 rounded-full"
                          style={{
                            backgroundColor:
                              mode === "dark"
                                ? "rgba(255,255,255,0.45)"
                                : "rgba(23,35,60,0.35)",
                          }}
                        />
                        <div
                          className="h-2 w-20 rounded-full"
                          style={{ backgroundColor: preset.primary }}
                        />
                      </div>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: preset.primary }}
                      />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          {preset.label}
                        </h3>
                        <p className="text-[11px] font-medium text-[var(--text-muted)]">
                          {preset.subtitle}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          isSelected
                            ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "bg-[var(--surface-secondary)] text-[var(--text-muted)]",
                        )}
                      >
                        {isSelected ? (
                          <>
                            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                            <span>Đang chọn</span>
                          </>
                        ) : (
                          <span>Chọn</span>
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {preset.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function AppearanceSettingsPage() {
  return (
    <PageContainer className="space-y-4 p-4 md:space-y-5 md:p-5 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-5">
        <PageHeader
          title="Giao diện & Chủ đề"
          description="Tùy chỉnh chế độ hiển thị sáng tối và chọn bảng màu yêu thích cho không gian tài chính."
          eyebrow="Cài đặt nhóm"
          border={false}
        />
        <AppearanceSettingsSection />
      </div>
    </PageContainer>
  );
}
