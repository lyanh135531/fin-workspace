"use client";
import { LogOut, Moon, Palette, ShieldCheck, Sun } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/dashboard/settings/general-actions";
const themes = [
  { value: "sunrise", label: "Sunrise Family", swatches: ["#FF5B3D", "#69B7F3", "#F6B94A"] },
  { value: "ocean", label: "Ocean Calm", swatches: ["#1677B8", "#32B8A6", "#F2B84B"] },
  { value: "forest", label: "Forest Home", swatches: ["#2F7D5B", "#88A96B", "#D59A45"] },
  { value: "lavender", label: "Lavender Dream", swatches: ["#7959C8", "#E58EB3", "#66B8C4"] },
  { value: "midnight", label: "Midnight Finance", swatches: ["#334E8C", "#008E9B", "#D6A53A"] },
] as const;
type ThemeName = (typeof themes)[number]["value"];
type Mode = "light" | "dark";

function applyAppearance(theme: ThemeName, mode: Mode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  localStorage.setItem("fin-workspace-theme", theme);
  localStorage.setItem("fin-workspace-mode", mode);
}

export function GeneralSettingsClient({ username }: { username: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "sunrise";
    const savedTheme = localStorage.getItem("fin-workspace-theme");
    return themes.some((item) => item.value === savedTheme) ? savedTheme as ThemeName : "sunrise";
  });
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    const savedMode = localStorage.getItem("fin-workspace-mode");
    return savedMode === "light" || savedMode === "dark" ? savedMode : "dark";
  });
  function save(form: FormData) { start(async () => { const result = await changePasswordAction({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }); setMessage(result.ok ? "Đã cập nhật mật khẩu." : result.message); if (result.ok) (document.getElementById("password-form") as HTMLFormElement | null)?.reset(); }); }
  function selectTheme(nextTheme: ThemeName) { setTheme(nextTheme); applyAppearance(nextTheme, mode); }
  function selectMode(nextMode: Mode) { setMode(nextMode); applyAppearance(theme, nextMode); }
  return <><section className="sunrise-card mt-6 p-6"><div className="flex items-center gap-2"><Palette size={17}/><div><p className="settings-eyebrow">Giao diện</p><h2 className="mt-1 text-xl font-semibold">Chủ đề hiển thị</h2></div></div><p className="settings-card-copy mt-3">Chủ đề được lưu trên thiết bị này và áp dụng ngay cho toàn bộ ứng dụng.</p><div className="theme-picker mt-5" role="radiogroup" aria-label="Chọn chủ đề màu">{themes.map((item) => <button key={item.value} type="button" role="radio" aria-checked={theme === item.value} className={`theme-choice ${theme === item.value ? "theme-choice-selected" : ""}`} onClick={() => selectTheme(item.value)}><span className="theme-choice-swatches" aria-hidden="true">{item.swatches.map((color) => <i key={color} style={{ backgroundColor: color }}/>)}</span><span>{item.label}</span></button>)}</div><div className="mt-5 flex flex-wrap gap-2" aria-label="Chọn chế độ sáng tối"><button type="button" className={`button-secondary inline-flex items-center gap-2 ${mode === "light" ? "theme-mode-selected" : ""}`} aria-pressed={mode === "light"} onClick={() => selectMode("light")}><Sun size={16}/>Sáng</button><button type="button" className={`button-secondary inline-flex items-center gap-2 ${mode === "dark" ? "theme-mode-selected" : ""}`} aria-pressed={mode === "dark"} onClick={() => selectMode("dark")}><Moon size={16}/>Tối</button></div></section><section className="sunrise-card mt-6 p-6"><p className="settings-eyebrow">Tài khoản</p><h2 className="mt-1 text-xl font-semibold">{username}</h2><div className="mt-5 grid gap-6 lg:grid-cols-2"><form id="password-form" action={save} className="space-y-3"><div className="flex items-center gap-2"><ShieldCheck size={17}/><h3 className="font-medium">Đổi mật khẩu</h3></div><input className="field" required name="currentPassword" type="password" autoComplete="current-password" placeholder="Mật khẩu hiện tại"/><input className="field" required name="newPassword" type="password" minLength={12} autoComplete="new-password" placeholder="Mật khẩu mới (tối thiểu 12 ký tự)"/><p className="text-sm text-slate-500" role="status">{message}</p><button disabled={pending} className="button-primary">{pending ? "Đang lưu" : "Cập nhật mật khẩu"}</button></form><div className="border-l border-[var(--border)] pl-0 lg:pl-6"><h3 className="font-medium">Phiên đăng nhập</h3><p className="mt-2 text-sm text-slate-500">Đăng xuất khỏi thiết bị hiện tại.</p><button className="button-secondary mt-4 inline-flex items-center gap-2" onClick={() => signOut({ callbackUrl: "/sign-in" })}><LogOut size={16}/>Đăng xuất</button></div></div></section></>;
}
