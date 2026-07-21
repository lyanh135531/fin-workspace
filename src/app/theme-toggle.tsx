"use client";

import { useSyncExternalStore } from "react";
import { MonitorCog, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Mode = "light" | "dark";

function applyMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
  localStorage.setItem("fin-workspace-mode", mode);
}

function subscribeMode(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => observer.disconnect();
}

function getMode(): Mode {
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeMode, getMode, () => "light");
  return <DropdownMenu>
    <DropdownMenuTrigger render={<button type="button" title="Chọn chế độ hiển thị" className="theme-toggle icon-button" aria-label="Chọn chế độ hiển thị" />}>
      {mode === "dark" ? <Moon size={18}/> : <Sun size={18}/>}<span className="sr-only">Chế độ hiển thị</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="theme-mode-menu">
      <DropdownMenuGroup><DropdownMenuLabel className="flex items-center gap-2"><MonitorCog size={14}/>Giao diện</DropdownMenuLabel></DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={mode} onValueChange={(value) => applyMode(value as Mode)}>
        <DropdownMenuRadioItem value="light"><Sun size={15}/>Sáng</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark"><Moon size={15}/>Tối</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
