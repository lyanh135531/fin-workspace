"use client";

import { useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Tag, CheckCircle2 } from "lucide-react";
import { importCategoriesAction } from "@/app/dashboard/settings/category-actions";
import { ICON_MAP } from "@/app/dashboard/settings/global-category-management";
import { showToast } from "@/components/toast-container";

type TemplateCategory = {
  id: string;
  name: string;
  code: string;
  color: string;
  type: "income" | "expense";
  icon: string | null;
  parentId: string | null;
};

export function ImportCategoryPanel({
  templates,
  existingCodes,
}: {
  templates: TemplateCategory[];
  existingCodes: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const existingCodeSet = new Set(existingCodes);
  const importableTemplates = templates.filter((t) => !existingCodeSet.has(t.code));
  const alreadyImported = templates.filter((t) => existingCodeSet.has(t.code));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === importableTemplates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importableTemplates.map((t) => t.id)));
    }
  }

  function doImport() {
    if (selected.size === 0) return;
    start(async () => {
      const result = await importCategoriesAction([...selected]);
      if (result.ok) {
        showToast(
          `Đã import ${result.importedCount ?? 0} danh mục${
            result.skippedCount ? `, bỏ qua ${result.skippedCount} trùng mã` : ""
          }.`,
          "success"
        );
        setSelected(new Set());
      } else {
        showToast(result.message ?? "Không thể import danh mục.", "error");
      }
    });
  }

  if (templates.length === 0) {
    return (
      <section className="sunrise-card mt-4 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/15">
            <Download size={17} />
          </div>
          <div>
            <p className="settings-eyebrow">Import danh mục</p>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--foreground)]">Import từ danh mục mẫu</h2>
          </div>
        </div>
        <div className="p-6 text-center border border-dashed border-[var(--border)] rounded-xl">
          <Tag size={28} className="mx-auto text-slate-400 opacity-60 mb-2" />
          <p className="text-sm text-slate-500">Bạn chưa có danh mục mẫu nào.</p>
          <p className="text-xs text-slate-400 mt-1">Vào <strong>Cài đặt chung</strong> để tạo bộ danh mục mẫu trước.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="sunrise-card mt-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/15 shrink-0 mt-0.5">
            <Download size={17} />
          </div>
          <div>
            <p className="settings-eyebrow">Import danh mục</p>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--foreground)]">Import từ danh mục mẫu</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chọn danh mục mẫu cá nhân để copy vào workspace này. Mỗi danh mục sẽ được tạo bản sao độc lập.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {importableTemplates.length > 0 && (
            <button
              type="button"
              className="button-secondary text-xs"
              onClick={toggleAll}
              disabled={pending}
            >
              {selected.size === importableTemplates.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          )}
          <button
            className="button-primary inline-flex items-center gap-2"
            onClick={doImport}
            disabled={pending || selected.size === 0}
          >
            <Download size={17} />
            {pending ? "Đang import..." : `Import (${selected.size})`}
          </button>
        </div>
      </div>

      {/* Importable templates */}
      {importableTemplates.length > 0 && (
        <div className="mt-4 space-y-2">
          {importableTemplates.map((t) => {
            const isIncome = t.type === "income";
            const isChecked = selected.has(t.id);
            const IconComp = ICON_MAP[t.icon ?? "tag"] ?? Tag;
            return (
              <label
                key={t.id}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all ${
                  isChecked
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleOne(t.id)}
                  disabled={pending}
                  className="accent-[var(--coral)] w-4 h-4 rounded"
                />
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${t.color}22, ${t.color}11)`,
                    color: t.color,
                    border: `1px solid ${t.color}33`,
                  }}
                >
                  <IconComp size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{t.code}</span>
                    <span className="mx-1">·</span>
                    <span className={`inline-flex items-center gap-0.5 ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                      {isIncome ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                      {isIncome ? "Thu" : "Chi"}
                    </span>
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Already imported */}
      {alreadyImported.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-500" />
            Đã có trong workspace (bỏ qua)
          </p>
          <div className="space-y-1.5">
            {alreadyImported.map((t) => {
              const IconComp = ICON_MAP[t.icon ?? "tag"] ?? Tag;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 opacity-60"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${t.color}22, ${t.color}11)`,
                      color: t.color,
                    }}
                  >
                    <IconComp size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{t.code}</span>
                      <span className="mx-1">·</span>
                      <span className="text-emerald-600">Đã import</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {importableTemplates.length === 0 && alreadyImported.length > 0 && (
        <p className="mt-3 text-sm text-slate-500">Tất cả danh mục mẫu đã được import vào workspace này.</p>
      )}
    </section>
  );
}
