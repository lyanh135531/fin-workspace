"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GitMerge,
  Pencil,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import {
  createCategoryAction,
  mergeCategoryAction,
  reorderCategoriesAction,
  setCategoryStatusAction,
  updateCategoryAction,
} from "@/app/dashboard/settings/category-actions";
import { ICON_MAP, slugifyCode } from "@/app/dashboard/settings/global-category-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  code: string;
  color: string;
  type: "income" | "expense";
  icon: string | null;
  parentId: string | null;
  status: "active" | "deactive";
  transactionCount: number;
  recurringCount: number;
  mergedIntoId: string | null;
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

const ICON_LIST = [
  { id: "tag", label: "Nhãn" },
  { id: "utensils", label: "Ăn uống" },
  { id: "coffee", label: "Cà phê" },
  { id: "house", label: "Nhà cửa" },
  { id: "car", label: "Xe cộ" },
  { id: "fuel", label: "Xăng dầu" },
  { id: "shopping", label: "Mua sắm" },
  { id: "heart", label: "Sức khỏe" },
  { id: "work", label: "Công việc" },
  { id: "money", label: "Tiền bạc" },
  { id: "landmark", label: "Ngân hàng" },
  { id: "card", label: "Thẻ" },
  { id: "education", label: "Học tập" },
  { id: "travel", label: "Du lịch" },
  { id: "gift", label: "Quà tặng" },
  { id: "shield", label: "Bảo hiểm" },
  { id: "tech", label: "Thiết bị" },
  { id: "entertainment", label: "Giải trí" },
  { id: "sport", label: "Thể thao" },
  { id: "service", label: "Sửa chữa" },
  { id: "book", label: "Sách vở" },
];

export function CategoryManagement({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"expense" | "income">("expense");
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, start] = useTransition();

  function submit(form: FormData, id?: string) {
    const category = {
      name: String(form.get("name") ?? ""),
      code: String(form.get("code") ?? ""),
      color: String(form.get("color") ?? COLOR_PRESETS[0]),
      type: String(form.get("type") ?? "expense") as "income" | "expense",
      icon: String(form.get("icon") ?? "tag"),
      parentId: (form.get("parentId") as string) || undefined,
    };
    start(async () => {
      const result = id
        ? await updateCategoryAction({ ...category, categoryId: id })
        : await createCategoryAction(category);
      if (result.ok) {
        toast.success(id ? "Đã cập nhật danh mục." : "Đã tạo danh mục mới.");
        setEditing(null);
        setCreating(false);
      } else {
        toast.error(result.message ?? "Có lỗi xảy ra.");
      }
    });
  }

  function setStatus(id: string, status: "active" | "deactive") {
    start(async () => {
      const result = await setCategoryStatusAction(id, status);
      if (result.ok) {
        toast.success(
          status === "active" ? "Đã kích hoạt danh mục." : "Đã vô hiệu hóa danh mục."
        );
      } else {
        toast.error(result.message ?? "Không thể đổi trạng thái.");
      }
    });
  }

  function merge(sourceCategoryId: string, targetCategoryId: string) {
    start(async () => {
      const result = await mergeCategoryAction({ sourceCategoryId, targetCategoryId });
      if (result.ok) {
        toast.success(
          `Đã hợp nhất ${result.transactionCount ?? 0} giao dịch và ${result.recurringCount ?? 0} lịch định kỳ.`,
        );
        setMerging(null);
        setEditing(null);
      } else {
        toast.error(result.message ?? "Không thể hợp nhất hạng mục.");
      }
    });
  }

  function handleReorder(items: Category[]) {
    const orderedIds = items.map((c) => c.id);
    start(async () => {
      const result = await reorderCategoriesAction(orderedIds);
      if (result.ok) {
        toast.success("Đã cập nhật thứ tự danh mục.");
      } else {
        toast.error(result.message ?? "Không thể sắp xếp lại.");
      }
    });
  }

  const currentCategories = categories.filter((c) => c.type === filterType);

  // Filter by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return currentCategories;
    const q = searchQuery.toLowerCase().trim();
    return currentCategories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [currentCategories, searchQuery]);

  const rootCategories = filteredCategories.filter((c) => !c.parentId);

  function moveRootItem(index: number, direction: "up" | "down") {
    const allRoots = currentCategories.filter((c) => !c.parentId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= allRoots.length) return;
    const newRoots = [...allRoots];
    const [moved] = newRoots.splice(index, 1);
    newRoots.splice(targetIndex, 0, moved);

    const allOrdered: Category[] = [];
    newRoots.forEach((root) => {
      allOrdered.push(root);
      allOrdered.push(...categories.filter((c) => c.parentId === root.id));
    });
    const otherTypeItems = categories.filter((c) => c.type !== filterType);
    handleReorder([...allOrdered, ...otherTypeItems]);
  }

  function moveChildItem(parentId: string, index: number, direction: "up" | "down") {
    const siblings = currentCategories.filter((c) => c.parentId === parentId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const [moved] = siblings.splice(index, 1);
    siblings.splice(targetIndex, 0, moved);

    const allRoots = currentCategories.filter((c) => !c.parentId);
    const allOrdered: Category[] = [];
    allRoots.forEach((root) => {
      allOrdered.push(root);
      if (root.id === parentId) {
        allOrdered.push(...siblings);
      } else {
        allOrdered.push(...categories.filter((c) => c.parentId === root.id));
      }
    });
    const otherTypeItems = categories.filter((c) => c.type !== filterType);
    handleReorder([...allOrdered, ...otherTypeItems]);
  }

  return (
    <section className="sunrise-card mt-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Danh mục workspace</p>
          <h2 className="mt-1 text-xl font-semibold">Quản lý danh mục workspace</h2>
          <p className="mt-1 text-sm text-slate-500">
            Danh mục thuộc workspace này. Bạn có thể tạo mới hoặc import từ danh mục mẫu cá nhân.
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          disabled={pending}
        >
          <Plus size={17} />
          Thêm danh mục
        </Button>
      </div>

      {/* Tabs: Chi tiêu & Thu nhập + Search */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
        <div className="settings-segmented-control">
          <button
            type="button"
            className={`segmented-btn ${
              filterType === "expense" ? "segmented-btn-active !text-rose-600" : ""
            }`}
            onClick={() => {
              setFilterType("expense");
              setCreating(false);
              setEditing(null);
              setSearchQuery("");
            }}
          >
            <ArrowUpRight size={13} />
            <span>Chi tiêu ({categories.filter((c) => c.type === "expense").length})</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${
              filterType === "income" ? "segmented-btn-active !text-emerald-600" : ""
            }`}
            onClick={() => {
              setFilterType("income");
              setCreating(false);
              setEditing(null);
              setSearchQuery("");
            }}
          >
            <ArrowDownLeft size={13} />
            <span>Thu nhập ({categories.filter((c) => c.type === "income").length})</span>
          </button>
        </div>


        {/* Search Bar */}
        <div className="ws-category-search">
          <span className="ws-category-search-icon">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm danh mục..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Creation form */}
      {creating && (
        <CategoryForm
          title={`Thêm danh mục ${filterType === "expense" ? "Chi tiêu" : "Thu nhập"} cho workspace`}
          defaultType={filterType}
          categories={categories}
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={submit}
        />
      )}

      {/* Tree list */}
      <div className="mt-5 space-y-2">
        {rootCategories.map((category, index) => (
          <CategoryNode
            key={category.id}
            category={category}
            categories={filteredCategories}
            index={index}
            totalRoots={rootCategories.length}
            pending={pending}
            editing={editing}
            merging={merging}
            onEdit={setEditing}
            onMergeOpen={setMerging}
            onMerge={merge}
            onStatus={setStatus}
            onMoveRoot={moveRootItem}
            onMoveChild={moveChildItem}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
          />
        ))}
        {rootCategories.length === 0 && (
          <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-xl">
            <Tag size={28} className="mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="text-sm font-medium text-slate-500">
              {searchQuery
                ? `Không tìm thấy danh mục "${searchQuery}"`
                : `Chưa có danh mục ${filterType === "expense" ? "Chi tiêu" : "Thu nhập"} nào trong workspace`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? "Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm"
                : "Import từ bộ mẫu cá nhân hoặc bấm Thêm danh mục"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryNode({
  category,
  categories,
  index,
  totalRoots,
  pending,
  editing,
  merging,
  onEdit,
  onMergeOpen,
  onMerge,
  onStatus,
  onMoveRoot,
  onMoveChild,
  onSubmit,
  onCancel,
}: {
  category: Category;
  categories: Category[];
  index: number;
  totalRoots: number;
  pending: boolean;
  editing: string | null;
  merging: string | null;
  onEdit: (id: string) => void;
  onMergeOpen: (id: string | null) => void;
  onMerge: (sourceId: string, targetId: string) => void;
  onStatus: (id: string, status: "active" | "deactive") => void;
  onMoveRoot: (index: number, dir: "up" | "down") => void;
  onMoveChild: (parentId: string, index: number, dir: "up" | "down") => void;
  onSubmit: (form: FormData, id?: string) => void;
  onCancel: () => void;
}) {
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const children = categories.filter((item) => item.parentId === category.id);
  const mergeTargets = categories.filter(
    (item) =>
      item.id !== category.id &&
      item.type === category.type &&
      item.status === "active" &&
      !item.mergedIntoId,
  );

  return (
    <div className={category.parentId ? "ml-6 border-l-2 border-[var(--border)] pl-4 mt-2" : ""}>
      <article className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md">
        <div className="flex min-w-0 items-center gap-3">
          {/* Reorder Buttons */}
          <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="p-0.5 hover:text-[var(--primary)] disabled:opacity-20"
              disabled={pending || index === 0}
              onClick={() =>
                category.parentId
                  ? onMoveChild(category.parentId, index, "up")
                  : onMoveRoot(index, "up")
              }
              title="Di chuyển lên"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className="p-0.5 hover:text-[var(--primary)] disabled:opacity-20"
              disabled={pending || index === totalRoots - 1}
              onClick={() =>
                category.parentId
                  ? onMoveChild(category.parentId, index, "down")
                  : onMoveRoot(index, "down")
              }
              title="Di chuyển xuống"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Gradient Icon Badge */}
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold shadow-inner"
            style={{
              background: `linear-gradient(135deg, ${category.color}22, ${category.color}11)`,
              color: category.color,
              border: `1px solid ${category.color}33`,
            }}
          >
            <IconComponent size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-semibold truncate">{category.name}</strong>
              <span className="px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[10px] font-mono text-slate-500 font-bold border border-[var(--border)]">
                {category.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  category.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span>{category.status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}</span>
              <span>•</span>
              <span>{category.transactionCount} giao dịch</span>
              {category.recurringCount > 0 && <>
                <span>•</span>
                <span>{category.recurringCount} định kỳ</span>
              </>}
              {category.mergedIntoId && <>
                <span>•</span>
                <span className="text-amber-600">Đã hợp nhất</span>
              </>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline" size="icon-sm" className="!min-h-[34px] !min-w-[34px] !p-1.5"
            title="Chỉnh sửa"
            aria-label={`Chỉnh sửa ${category.name}`}
            onClick={() => onEdit(category.id)}
            disabled={pending || Boolean(category.mergedIntoId)}
          >
            <Pencil size={15} />
          </Button>
          {!category.mergedIntoId && (
            <Button
              variant="outline"
              size="icon-sm"
              className="!min-h-[34px] !min-w-[34px] !p-1.5"
              title="Thay thế bằng hạng mục khác"
              aria-label={`Hợp nhất ${category.name}`}
              onClick={() => onMergeOpen(merging === category.id ? null : category.id)}
              disabled={pending || mergeTargets.length === 0}
            >
              <GitMerge size={15} />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(
              "!min-h-[34px] !min-w-[34px] !p-1.5",
              category.status === "active" ? "hover:text-rose-500" : "hover:text-emerald-500"
            )}
            onClick={() => onStatus(category.id, category.status === "active" ? "deactive" : "active")}
            disabled={pending || Boolean(category.mergedIntoId)}
            title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
          >
            {category.status === "active" ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>

        </div>
      </article>

      {editing === category.id && (
        <CategoryForm
          title={`Chỉnh sửa: ${category.name}`}
          defaultType={category.type}
          categories={categories.filter((item) => item.id !== category.id)}
          category={category}
          pending={pending}
          onCancel={onCancel}
          onSubmit={(form) => onSubmit(form, category.id)}
        />
      )}

      {merging === category.id && (
        <CategoryMergeForm
          category={category}
          targets={mergeTargets}
          pending={pending}
          onCancel={() => onMergeOpen(null)}
          onMerge={onMerge}
        />
      )}

      {children.map((child, childIdx) => (
        <CategoryNode
          key={child.id}
          category={child}
          categories={categories}
          index={childIdx}
          totalRoots={children.length}
          pending={pending}
          editing={editing}
          merging={merging}
          onEdit={onEdit}
          onMergeOpen={onMergeOpen}
          onMerge={onMerge}
          onStatus={onStatus}
          onMoveRoot={onMoveRoot}
          onMoveChild={onMoveChild}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}

function CategoryForm({
  title,
  defaultType,
  categories,
  category,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string;
  defaultType: "income" | "expense";
  categories: Category[];
  category?: Category;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (form: FormData) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [autoCode, setAutoCode] = useState(!category);
  const [selectedColor, setSelectedColor] = useState(category?.color ?? COLOR_PRESETS[0]);
  const [selectedIcon, setSelectedIcon] = useState(category?.icon ?? "tag");
  const [selectedType, setSelectedType] = useState<"income" | "expense">(category?.type ?? defaultType);

  function handleNameChange(val: string) {
    setName(val);
    if (autoCode) {
      setCode(slugifyCode(val));
    }
  }

  return (
    <form
      action={onSubmit}
      className="mt-4 rounded-xl border border-[var(--primary)] bg-[var(--surface-muted)] p-5 shadow-lg space-y-4 relative overflow-hidden"
    >
      {/* Subtle accent glow */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{ backgroundColor: selectedColor }}
      />

      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] relative">
        <h3 className="font-bold text-base text-[var(--foreground)]">{title}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1">
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 relative">
        {/* Name Input */}
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Tên danh mục *</label>
          <Input
            
            name="name"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ví dụ: Ăn uống, Lương..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Loại giao dịch *</label>
          <select
            className="field"
            name="type"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value as "income" | "expense")}
          >
            <option value="expense">Chi tiêu</option>
            <option value="income">Thu nhập</option>
          </select>
          {category && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Khi đổi loại, toàn bộ hạng mục con sẽ đổi theo. Hệ thống sẽ chặn nếu dữ liệu liên kết không tương thích.
            </p>
          )}
        </div>

        {/* Code Input (Auto-generated) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-500">Mã danh mục (Code) *</label>
            <span className="text-[10px] text-slate-400">Tự động tạo từ tên</span>
          </div>
          <Input
            className="font-mono text-sm uppercase"
            name="code"
            required
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setAutoCode(false);
            }}
            placeholder="FOOD_DRINK, SALARY..."
          />
        </div>

        {/* Parent Category */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Danh mục cha</label>
          <select className="field" name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">Không có (Danh mục gốc)</option>
            {categories
              .filter(
                (item) =>
                  item.status === "active" &&
                  item.type === selectedType &&
                  (!category || item.id !== category.id)
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
          </select>
        </div>

        {/* Color Picker */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Màu đại diện</label>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  selectedColor === color ? "scale-110 border-white shadow-lg ring-2 ring-[var(--primary)]" : "border-transparent hover:scale-105"
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

        {/* Visual Icon Picker Grid */}
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Chọn Biểu tượng (Icon)</label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-40 overflow-y-auto p-2 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
            {ICON_LIST.map((item) => {
              const IconComp = ICON_MAP[item.id] ?? Tag;
              const isSelected = selectedIcon === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedIcon(item.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs gap-1 ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-bold shadow-sm"
                      : "border-transparent hover:bg-[var(--surface-muted)] text-slate-600 dark:text-slate-400"
                  }`}
                  title={item.label}
                >
                  <IconComp size={18} />
                  <span className="text-[10px] truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>
          <input type="hidden" name="icon" value={selectedIcon} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] relative">
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy bỏ
        </Button>
        <Button variant="default" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu danh mục"}
        </Button>
      </div>
    </form>
  );
}

function CategoryMergeForm({
  category,
  targets,
  pending,
  onCancel,
  onMerge,
}: {
  category: Category;
  targets: Category[];
  pending: boolean;
  onCancel: () => void;
  onMerge: (sourceId: string, targetId: string) => void;
}) {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  return (
    <section className="mt-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <GitMerge className="mt-0.5 shrink-0 text-amber-600" size={18} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Thay thế “{category.name}”</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {category.transactionCount} giao dịch, {category.recurringCount} lịch định kỳ và các hạng mục con sẽ được chuyển sang hạng mục đích. Số dư ví không thay đổi.
          </p>
          <label className="mt-3 block text-xs font-semibold text-slate-500">
            Hạng mục thay thế
            <select
              className="field mt-1"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} ({target.code})
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Hủy</Button>
            <Button
              type="button"
              variant="default"
              disabled={pending || !targetId}
              onClick={() => onMerge(category.id, targetId)}
            >
              {pending ? "Đang hợp nhất..." : "Xác nhận hợp nhất"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
