"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCheck,
  Download,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { importCategoriesAction } from "@/app/dashboard/settings/category-actions";
import { ICON_MAP } from "@/app/dashboard/settings/global-category-management";
import { Button, Card, Checkbox, Empty, FormPendingSkeleton, Label } from "@/components/base";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  // Mark each template as importable or already imported
  const annotated = templates.map((t) => ({
    ...t,
    isImported: existingCodeSet.has(t.code),
  }));

  const importableTemplates = annotated.filter((t) => !t.isImported);

  // Build unified tree from ALL templates
  const roots = annotated.filter((t) => !t.parentId);
  const childrenOf = (parentId: string) =>
    annotated.filter((t) => t.parentId === parentId);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const template = annotated.find((t) => t.id === id);
      if (!template || template.isImported) return next;

      if (next.has(id)) {
        next.delete(id);
        // Also uncheck importable children
        childrenOf(id).forEach((child) => {
          if (!child.isImported) next.delete(child.id);
        });
      } else {
        next.add(id);
        // Also check importable parent if exists
        if (template.parentId) {
          const parent = annotated.find((p) => p.id === template.parentId);
          if (parent && !parent.isImported) next.add(parent.id);
        }
        // Also check importable children
        childrenOf(id).forEach((child) => {
          if (!child.isImported) next.add(child.id);
        });
      }
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
        toast.success(
          `Đã import ${result.importedCount ?? 0} danh mục${
            result.skippedCount
              ? `, bỏ qua ${result.skippedCount} trùng mã`
              : ""
          }.`,
        );
        setSelected(new Set());
      } else {
        toast.error(result.message ?? "Không thể import danh mục.");
      }
    });
  }

  if (templates.length === 0) {
    return (
      <Card as="section">
        <div className="pb-4 border-b border-[var(--border)]">
          <p className="settings-eyebrow">Import danh mục</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight">
            Import từ danh mục mẫu
          </h2>
        </div>
        <Empty
          variant="compact"
          icon={Tag}
          title="Bạn chưa có danh mục mẫu"
          description={
            <>
              Vào <strong>Cài đặt chung</strong> để tạo bộ danh mục mẫu trước.
            </>
          }
          className="mt-4"
        />
      </Card>
    );
  }

  // Check if everything is already imported
  const allImported = importableTemplates.length === 0;

  return (
    <Card as="section" className="sunrise-card gap-0 p-6" aria-busy={pending}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <p className="settings-eyebrow">Import danh mục</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight">
            Import từ danh mục mẫu
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Chọn danh mục mẫu cá nhân để copy vào workspace này.
          </p>
        </div>
        {!allImported && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="icon"
              size="icon"
              onClick={toggleAll}
              disabled={pending}
              aria-label={
                selected.size === importableTemplates.length
                  ? "Bỏ chọn tất cả danh mục"
                  : "Chọn tất cả danh mục"
              }
            >
              <CheckCheck />
            </Button>
            <Button
              variant="icon"
              size="icon"
              onClick={doImport}
              disabled={pending || selected.size === 0}
              aria-label={
                pending
                  ? "Đang import danh mục"
                  : `Import ${selected.size} danh mục`
              }
            >
              <Download />
            </Button>
          </div>
        )}
      </div>
      {pending && <FormPendingSkeleton label="Đang import danh mục" className="mt-3" />}

      {/* Unified tree — all templates in hierarchy */}
      <div className="mt-4 space-y-1.5">
        {roots.map((root) => {
          const children = childrenOf(root.id);
          const RootIcon = ICON_MAP[root.icon ?? "tag"] ?? Tag;
          const isIncome = root.type === "income";
          const isChecked = selected.has(root.id);

          return (
            <div key={root.id}>
              {/* Root template item */}
              {root.isImported ? (
                /* Already imported root — non-interactive */
                <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 opacity-50">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{
                      backgroundColor: `${root.color}0d`,
                      color: root.color,
                    }}
                  >
                    <RootIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{root.name}</p>
                    <p className="text-[11px] text-emerald-500 mt-0.5 font-medium">
                      Đã import
                    </p>
                  </div>
                </div>
              ) : (
                /* Importable root — selectable */
                <Label
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition-all duration-200",
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleOne(root.id)}
                    disabled={pending}
                    aria-label={`Chọn danh mục ${root.name}`}
                  />
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{
                      backgroundColor: `${root.color}14`,
                      color: root.color,
                      boxShadow: `inset 0 0 0 1px ${root.color}20`,
                    }}
                  >
                    <RootIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{root.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5",
                          isIncome ? "text-emerald-500" : "text-rose-500",
                        )}
                      >
                        {isIncome ? (
                          <ArrowDownLeft size={10} />
                        ) : (
                          <ArrowUpRight size={10} />
                        )}
                        {isIncome ? "Thu nhập" : "Chi tiêu"}
                      </span>
                      {children.length > 0 && (
                        <span className="ml-1.5 text-slate-300 dark:text-slate-600">
                          · {children.length} danh mục con
                        </span>
                      )}
                    </p>
                  </div>
                </Label>
              )}

              {/* Child templates — tree branch */}
              {children.length > 0 && (
                <div className="ml-12 relative">
                  {children.map((child, childIdx) => {
                    const ChildIcon = ICON_MAP[child.icon ?? "tag"] ?? Tag;
                    const isLast = childIdx === children.length - 1;
                    const isChildChecked = selected.has(child.id);

                    return (
                      <div key={child.id} className="relative">
                        {/* Vertical line: top half */}
                        <div className="absolute left-2.5 top-0 h-1/2 w-px bg-[var(--border)]" />
                        {/* Vertical line: bottom half (not last) */}
                        {!isLast && (
                          <div className="absolute left-2.5 top-1/2 bottom-0 w-px bg-[var(--border)]" />
                        )}
                        {/* Horizontal branch */}
                        <div className="absolute left-2.5 top-1/2 w-5 h-px bg-[var(--border)]" />

                        {child.isImported ? (
                          /* Already imported child */
                          <div className="relative flex items-center gap-2.5 pl-8 pr-3 py-1.5 opacity-40">
                            <span
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                              style={{
                                backgroundColor: `${child.color}0d`,
                                color: child.color,
                              }}
                            >
                              <ChildIcon size={13} />
                            </span>
                            <span className="truncate text-[12.5px] font-medium">
                              {child.name}
                            </span>
                            <span className="text-[10px] text-emerald-500 font-medium shrink-0">
                              Đã import
                            </span>
                          </div>
                        ) : (
                          /* Importable child — selectable */
                          <Label
                            className={cn(
                              "relative flex items-center gap-2.5 rounded-lg pl-8 pr-3 py-2 cursor-pointer transition-all duration-150",
                            )}
                          >
                            <Checkbox
                              checked={isChildChecked}
                              onCheckedChange={() => toggleOne(child.id)}
                              disabled={pending}
                              aria-label={`Chọn danh mục ${child.name}`}
                              className="h-3.5 w-3.5"
                            />
                            <span
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                              style={{
                                backgroundColor: `${child.color}10`,
                                color: child.color,
                              }}
                            >
                              <ChildIcon size={13} />
                            </span>
                            <span className="truncate text-[12.5px] font-medium text-[var(--foreground)]/85">
                              {child.name}
                            </span>
                          </Label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allImported && (
        <Empty
          variant="inline"
          icon={CheckCircle2}
          title="Đã import toàn bộ danh mục mẫu"
          description="Không còn danh mục mới để thêm vào workspace này."
          className="mt-3"
        />
      )}
    </Card>
  );
}
