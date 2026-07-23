"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback helper using custom DOM events if used outside Provider
    return {
      toast: {
        success: (msg: string) => dispatchToast(msg, "success"),
        error: (msg: string) => dispatchToast(msg, "error"),
        info: (msg: string) => dispatchToast(msg, "info"),
      },
      showToast: (msg: string, type: ToastType = "info") => dispatchToast(msg, type),
    };
  }
  return ctx;
}

export function showToast(message: string, type: ToastType = "info") {
  dispatchToast(message, type);
}

function dispatchToast(message: string, type: ToastType) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app-toast", { detail: { message, type } })
    );
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    if (!message) return;
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]); // keep max 5 toasts

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  useEffect(() => {
    function handleEvent(e: Event) {
      const custom = e as CustomEvent<{ message: string; type: ToastType }>;
      if (custom.detail?.message) {
        addToast(custom.detail.message, custom.detail.type ?? "info");
      }
    }
    window.addEventListener("app-toast", handleEvent);
    return () => window.removeEventListener("app-toast", handleEvent);
  }, [addToast]);

  const value = {
    toast: {
      success: (msg: string) => addToast(msg, "success"),
      error: (msg: string) => addToast(msg, "error"),
      info: (msg: string) => addToast(msg, "info"),
    },
    showToast: addToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Fixed top-right toast container */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3"
        aria-live="polite"
        aria-label="Thông báo hệ thống"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const isSuccess = item.type === "success";
  const isError = item.type === "error";

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 duration-200 ${
        isSuccess
          ? "bg-emerald-950/90 text-emerald-100 border-emerald-500/30 dark:bg-emerald-950/95 shadow-emerald-950/20"
          : isError
          ? "bg-rose-950/90 text-rose-100 border-rose-500/30 dark:bg-rose-950/95 shadow-rose-950/20"
          : "bg-slate-900/90 text-slate-100 border-slate-700/50 dark:bg-slate-900/95 shadow-slate-950/20"
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
        {isError && <AlertCircle size={18} className="text-rose-400" />}
        {!isSuccess && !isError && <Info size={18} className="text-sky-400" />}
      </span>

      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs font-semibold leading-relaxed break-words">
          {item.message}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 p-0.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        aria-label="Đóng thông báo"
      >
        <X size={14} />
      </button>
    </div>
  );
}
