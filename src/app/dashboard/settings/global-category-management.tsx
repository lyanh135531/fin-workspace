"use client";

import {
  Eye,
  EyeOff,
  FolderTree,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Tag,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  createGlobalCategoryAction,
  setGlobalCategoryStatusAction,
  updateGlobalCategoryAction,
  verifyGlobalCategoryPasswordAction,
} from "@/app/dashboard/settings/general-actions";

type Category = {
  id: string;
  name: string;
  code: string;
  color: string;
  type: "income" | "expense";
  icon: string | null;
  parentId: string | null;
  sortOrder?: number;
  status: "active" | "deactive";
  transactionCount: number;
};

const COLOR_PRESETS = [
  "#FF5B3D",
  "#69B7F3",
  "#F6B94A",
  "#41A862",
  "#7959C8",
  "#E58EB3",
  "#008E9B",
  "#334E8C",
];

export function GlobalCategoryManagement({ categories }: { categories: Category[] }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState<{ text: string; success?: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, start] = useTransition();

  function verify() {
    start(async () => {
      const result = await verifyGlobalCategoryPasswordAction(password);
      setUnlocked(result.ok);
      setMessage({
        text: result.ok
          ? "Đã mở thực thi quản lý danh mục hệ thống cho phiên làm việc này."
          : (result.message ?? "Mật khẩu không chính xác."),
        success: result.ok,
      });
    });
  }

  function submit(form: FormData, categoryId?: string) {
    const category = {
      name: form.get("name"),
      code: form.get("code"),
      color: form.get("color"),
      type: form.get("type"),
      icon: form.get("icon"),
      parentId: form.get("parentId") || undefined,
      sortOrder: form.get("sortOrder"),
    };
    start(async () => {
      const result = categoryId
        ? await updateGlobalCategoryAction({ password, category: { ...category, categoryId } })
        : await createGlobalCategoryAction({ password, category });
      setMessage({
        text: result.ok ? "Đã lưu danh mục hệ thống." : (result.message ?? "Không thể lưu thay đổi."),
        success: result.ok,
      });
      if (result.ok) {
        setCreating(false);
        setEditing(null);
      }
    });
  }

  function status(id: string, value: "active" | "deactive") {
    start(async () => {
      const result = await setGlobalCategoryStatusAction({
        password,
        categoryId: id,
        status: value,
      });
      setMessage({
        text: result.ok ? "Đã cập nhật trạng thái danh mục." : (result.message ?? "Không thể thay đổi trạng thái."),
        success: result.ok,
      });
    });
  }

  // Filter root categories
  const filteredCategories = categories.filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchSelf = c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query);
      const matchChild = categories.some(
        (child) =>
          child.parentId === c.id &&
          (child.name.toLowerCase().includes(query) || child.code.toLowerCase().includes(query))
      );
      return matchSelf || matchChild;
    }
    return true;
  });

  const rootCategories = filteredCategories.filter((c) => !c.parentId);

  return (
    <section className="sunrise-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <FolderTree size={20} />
          </div>
          <div>
            <p className="settings-eyebrow">Category Hệ Thống</p>
            <h2 className="text-xl font-bold tracking-tight mt-0.5">
              Danh mục dùng chung
            </h2>
          </div>
        </div>

        <button
          className="button-primary inline-flex items-center gap-2"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          disabled={!unlocked || pending}
          title={!unlocked ? "Vui lòng xác nhận mật khẩu Admin để mở khóa" : undefined}
        >
          <Plus size={18} />
          Thêm danh mục chung
        </button>
      </div>

      {/* Password Security Verification Panel */}
      <div className={`mt-5 p-4 rounded-xl border transition-all ${
        unlocked
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
          : "bg-[var(--surface-muted)] border-[var(--border)]"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 ${
              unlocked ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            }`}>
              {unlocked ? <ShieldCheck size={20} /> : <Lock size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {unlocked ? "Đã mở khóa thao tác Admin" : "Xác minh quyền quản trị"}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  unlocked ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}>
                  {unlocked ? "Mở khóa" : "Yêu cầu mật khẩu"}
                </span>
              </div>
              <p className="text-xs opacity-80 mt-0.5">
                Các danh mục hệ thống áp dụng cho tất cả Workspace. Cần xác thực mật khẩu trước khi thêm hoặc chỉnh sửa.
              </p>
            </div>
          </div>

          {/* Password Input form */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              className="field min-w-48 sm:w-64 text-sm"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setUnlocked(false);
              }}
              placeholder="Nhập mật khẩu xác thực..."
              autoComplete="off"
              disabled={pending}
            />
            <button
              type="button"
              className="button-secondary text-sm whitespace-nowrap"
              onClick={verify}
              disabled={!password || pending}
            >
              {pending ? "Đang xử lý..." : unlocked ? "Mở lại" : "Xác nhận"}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-3 pt-3 border-t border-black/5 dark:border-white/10 text-xs flex items-center gap-2 ${
            message.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            {message.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Toolbar: Search & Filter Tabs */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-muted)] rounded-xl border border-[var(--border)]">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "all"
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            }`}
            onClick={() => setFilterType("all")}
          >
            Tất cả ({categories.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              filterType === "income"
                ? "bg-[var(--surface)] text-emerald-600 shadow-sm"
                : "text-[var(--text-secondary)] hover:text-emerald-600"
            }`}
            onClick={() => setFilterType("income")}
          >
            <ArrowDownLeft size={13} />
            Thu nhập ({categories.filter((c) => c.type === "income").length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              filterType === "expense"
                ? "bg-[var(--surface)] text-rose-600 shadow-sm"
                : "text-[var(--text-secondary)] hover:text-rose-600"
            }`}
            onClick={() => setFilterType("expense")}
          >
            <ArrowUpRight size={13} />
            Chi tiêu ({categories.filter((c) => c.type === "expense").length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="field pl-9 py-1.5 text-xs"
            placeholder="Tìm danh mục..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearchQuery("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Form: Adding Category */}
      {creating && unlocked && (
        <GlobalForm
          title="Thêm danh mục hệ thống mới"
          categories={categories}
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={submit}
        />
      )}

      {/* Category Tree List */}
      <div className="mt-5 space-y-2.5">
        {rootCategories.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-xl">
            <Tag size={28} className="mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="text-sm font-medium text-slate-500">Không tìm thấy danh mục chung nào phù hợp</p>
          </div>
        ) : (
          rootCategories.map((category) => (
            <Node
              key={category.id}
              category={category}
              categories={categories}
              editing={editing}
              pending={pending}
              unlocked={unlocked}
              onEdit={setEditing}
              onStatus={status}
              onSubmit={submit}
              onCancel={() => setEditing(null)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Node({
  category,
  categories,
  editing,
  pending,
  unlocked,
  onEdit,
  onStatus,
  onSubmit,
  onCancel,
}: {
  category: Category;
  categories: Category[];
  editing: string | null;
  pending: boolean;
  unlocked: boolean;
  onEdit: (id: string) => void;
  onStatus: (id: string, value: "active" | "deactive") => void;
  onSubmit: (form: FormData, id?: string) => void;
  onCancel: () => void;
}) {
  const children = categories.filter((item) => item.parentId === category.id);
  const isIncome = category.type === "income";

  return (
    <div className={category.parentId ? "ml-6 border-l-2 border-[var(--border)] pl-4 mt-2" : ""}>
      <article className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl font-bold transition-transform group-hover:scale-105 shadow-inner"
            style={{
              backgroundColor: `${category.color}18`,
              color: category.color,
              border: `1px solid ${category.color}33`,
            }}
          >
            <Tag size={19} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-semibold text-[var(--foreground)] truncate">
                {category.name}
              </strong>
              <span className="px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[10px] font-mono text-slate-500 font-bold border border-[var(--border)]">
                {category.code}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-0.5 ${
                  isIncome
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                }`}
              >
                {isIncome ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                {isIncome ? "Thu nhập" : "Chi tiêu"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  category.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span>{category.status === "active" ? "Hoạt động" : "Đã tắt"}</span>
              <span>•</span>
              <span><strong>{category.transactionCount}</strong> giao dịch liên kết</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            className="button-secondary icon-button !min-h-[36px] !min-w-[36px] !p-1.5"
            onClick={() => onEdit(category.id)}
            disabled={!unlocked || pending}
            title={!unlocked ? "Vui lòng mở khóa Admin" : "Chỉnh sửa danh mục"}
            aria-label={`Chỉnh sửa ${category.name}`}
          >
            <Pencil size={15} />
          </button>
          <button
            className={`button-secondary icon-button !min-h-[36px] !min-w-[36px] !p-1.5 ${
              category.status === "active" ? "hover:text-rose-500" : "hover:text-emerald-500"
            }`}
            onClick={() =>
              onStatus(category.id, category.status === "active" ? "deactive" : "active")
            }
            disabled={!unlocked || pending}
            title={
              !unlocked
                ? "Vui lòng mở khóa Admin"
                : category.status === "active"
                ? "Vô hiệu hóa"
                : "Kích hoạt"
            }
            aria-label={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
          >
            {category.status === "active" ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </article>

      {/* Editing Form */}
      {editing === category.id && unlocked && (
        <GlobalForm
          title={`Chỉnh sửa danh mục: ${category.name}`}
          categories={categories.filter((item) => item.id !== category.id)}
          category={category}
          pending={pending}
          onCancel={onCancel}
          onSubmit={(form) => onSubmit(form, category.id)}
        />
      )}

      {/* Children Tree Nodes */}
      {children.map((child) => (
        <Node
          key={child.id}
          category={child}
          categories={categories}
          editing={editing}
          pending={pending}
          unlocked={unlocked}
          onEdit={onEdit}
          onStatus={onStatus}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}

function GlobalForm({
  title,
  categories,
  category,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string;
  categories: Category[];
  category?: Category;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (form: FormData) => void;
}) {
  const [selectedColor, setSelectedColor] = useState(category?.color ?? COLOR_PRESETS[0]);

  return (
    <form
      action={onSubmit}
      className="mt-4 rounded-xl border border-[var(--primary)] bg-[var(--surface-muted)] p-5 shadow-lg space-y-4"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <h3 className="font-bold text-base text-[var(--foreground)]">{title}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-1"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Tên danh mục *</label>
          <input
            className="field"
            name="name"
            required
            defaultValue={category?.name}
            placeholder="Ví dụ: Ăn uống, Lương..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Mã danh mục (Code) *</label>
          <input
            className="field font-mono text-sm"
            name="code"
            required
            defaultValue={category?.code}
            placeholder="FOOD_DRINK, SALARY..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Loại phân loại</label>
          <select className="field" name="type" defaultValue={category?.type ?? "expense"}>
            <option value="expense">Chi tiêu (Expense)</option>
            <option value="income">Thu nhập (Income)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Danh mục cha</label>
          <select className="field" name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">Không có (Danh mục gốc)</option>
            {categories
              .filter(
                (item) =>
                  item.status === "active" &&
                  (!category || item.type === category.type)
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
            Màu đại diện
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  selectedColor === color ? "scale-110 border-white shadow-md ring-2 ring-[var(--primary)]" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
            <input
              type="color"
              name="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
            />
          </div>
          <input type="hidden" name="color" value={selectedColor} />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Mã Icon</label>
          <input
            className="field"
            name="icon"
            required
            defaultValue={category?.icon ?? "tag"}
            placeholder="tag, wallet, shopping-bag..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Thứ tự sắp xếp</label>
          <input
            className="field"
            name="sortOrder"
            type="number"
            min="0"
            defaultValue={category?.sortOrder ?? 0}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
        <button type="button" className="button-secondary text-sm" onClick={onCancel}>
          Hủy bỏ
        </button>
        <button className="button-primary text-sm" disabled={pending}>
          {pending ? "Đang xử lý..." : "Lưu danh mục"}
        </button>
      </div>
    </form>
  );
}

