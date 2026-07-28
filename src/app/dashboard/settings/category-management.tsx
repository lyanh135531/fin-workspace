"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Tag,
} from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import {
  createCategoryAction,
  reorderCategoriesAction,
  setCategoryStatusAction,
  updateCategoryAction,
} from "@/app/dashboard/settings/category-actions";
import { ICON_MAP, slugifyCode } from "@/app/dashboard/settings/global-category-management";
import {
  Button,
  Card,
  Input,
  Search,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/base";
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
      parentId: form.get("parentId") === "none" ? undefined : (form.get("parentId") as string) || undefined,
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
  const editingCategory = editing
    ? categories.find((category) => category.id === editing)
    : undefined;

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
    <Card as="section" className="sunrise-card gap-0 mt-4 p-6">
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
        <Tabs
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value as "expense" | "income");
            setCreating(false);
            setEditing(null);
            setSearchQuery("");
          }}
        >
          <TabsList>
            <TabsTrigger value="expense">
            <ArrowUpRight />
            <span>Chi tiêu</span><TabsCount>{categories.filter((c) => c.type === "expense").length}</TabsCount>
            </TabsTrigger>
            <TabsTrigger value="income">
            <ArrowDownLeft />
            <span>Thu nhập</span><TabsCount>{categories.filter((c) => c.type === "income").length}</TabsCount>
            </TabsTrigger>
          </TabsList>
        </Tabs>


        {/* Search Bar */}
        <Search
          placeholder="Tìm kiếm danh mục..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Tìm kiếm danh mục"
        />
      </div>

      <Sheet
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-14">
            <SheetTitle>
              {editingCategory
                ? "Chỉnh sửa danh mục workspace"
                : `Thêm danh mục ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`}
            </SheetTitle>
            <SheetDescription>
              {editingCategory
                ? `Cập nhật thông tin cho “${editingCategory.name}”.`
                : "Tạo danh mục mới chỉ dùng trong workspace hiện tại."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            {(creating || editingCategory) && (
              <CategoryForm
                key={editingCategory?.id ?? `create-${filterType}`}
                defaultType={editingCategory?.type ?? filterType}
                categories={
                  editingCategory
                    ? categories.filter((item) => item.id !== editingCategory.id)
                    : categories
                }
                category={editingCategory}
                pending={pending}
                onCancel={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                onSubmit={(form) => submit(form, editingCategory?.id)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

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
            onEdit={setEditing}
            onStatus={setStatus}
            onMoveRoot={moveRootItem}
            onMoveChild={moveChildItem}
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
    </Card>
  );
}

function CategoryNode({
  category,
  categories,
  index,
  totalRoots,
  pending,
  onEdit,
  onStatus,
  onMoveRoot,
  onMoveChild,
}: {
  category: Category;
  categories: Category[];
  index: number;
  totalRoots: number;
  pending: boolean;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: "active" | "deactive") => void;
  onMoveRoot: (index: number, dir: "up" | "down") => void;
  onMoveChild: (parentId: string, index: number, dir: "up" | "down") => void;
}) {
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const children = categories.filter((item) => item.parentId === category.id);

  return (
    <div className={category.parentId ? "ml-6 border-l-2 border-[var(--border)] pl-4 mt-2" : ""}>
      <article className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md">
        <div className="flex min-w-0 items-center gap-3">
          {/* Reorder Buttons */}
          <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <Button variant="unstyled" size="auto"
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
            </Button>
            <Button variant="unstyled" size="auto"
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
            </Button>
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
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline" size="icon"
            title="Chỉnh sửa"
            aria-label={`Chỉnh sửa ${category.name}`}
            onClick={() => onEdit(category.id)}
            disabled={pending}
          >
            <Pencil size={15} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              category.status === "active" ? "hover:text-rose-500" : "hover:text-emerald-500"
            )}
            onClick={() => onStatus(category.id, category.status === "active" ? "deactive" : "active")}
            disabled={pending}
            title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
          >
            {category.status === "active" ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>

        </div>
      </article>

      {children.map((child, childIdx) => (
        <CategoryNode
          key={child.id}
          category={child}
          categories={categories}
          index={childIdx}
          totalRoots={children.length}
          pending={pending}
          onEdit={onEdit}
          onStatus={onStatus}
          onMoveRoot={onMoveRoot}
          onMoveChild={onMoveChild}
        />
      ))}
    </div>
  );
}

function CategoryForm({
  defaultType,
  categories,
  category,
  pending,
  onCancel,
  onSubmit,
}: {
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

  function handleNameChange(val: string) {
    setName(val);
    if (autoCode) {
      setCode(slugifyCode(val));
    }
  }

  return (
    <form
      action={onSubmit}
      className="flex min-h-full flex-col gap-5 py-5"
    >
      <input type="hidden" name="type" value={category?.type ?? defaultType} />

      <div className="grid gap-4">
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
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Danh mục cha</label>
          <Select
            name="parentId"
            defaultValue={category?.parentId ?? "none"}
            label="Danh mục cha"
            options={[
              { value: "none", label: "Không có (Danh mục gốc)" },
              ...categories
              .filter(
                (item) =>
                  item.status === "active" &&
                  item.type === (category?.type ?? defaultType) &&
                  (!category || item.id !== category.id)
              )
              .map((item) => ({
                value: item.id,
                label: `${item.name} (${item.code})`,
              })),
            ]}
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Màu đại diện</label>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            {COLOR_PRESETS.map((color) => (
              <Button variant="unstyled" size="auto"
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
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Chọn Biểu tượng (Icon)</label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-40 overflow-y-auto p-2 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
            {ICON_LIST.map((item) => {
              const IconComp = ICON_MAP[item.id] ?? Tag;
              const isSelected = selectedIcon === item.id;
              return (
                <Button variant="unstyled" size="auto"
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
                </Button>
              );
            })}
          </div>
          <input type="hidden" name="icon" value={selectedIcon} />
        </div>
      </div>

      <div className="mt-auto flex justify-end gap-2 border-t border-border pt-4">
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
