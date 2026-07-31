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
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  setCategoryStatusAction,
  updateCategoryAction,
} from "@/app/dashboard/settings/category-actions";
import { ICON_MAP, slugifyCode } from "@/app/dashboard/settings/global-category-management";
import {
  Button,
  Card,
  CategoryTreeSelect,
  Empty,
  Input,
  Label,
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
import { ConfirmDelete } from "@/components/base/confirm-delete";

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

  function deleteCategory(id: string) {
    start(async () => {
      const result = await deleteCategoryAction(id);
      if (result.ok) {
        toast.success("Đã xóa danh mục thành công.");
      } else {
        toast.error(result.message ?? "Không thể xóa danh mục.");
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

  const rootCategories = currentCategories.filter((c) => !c.parentId);
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
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <p className="settings-eyebrow">Danh mục workspace</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight">Quản lý danh mục workspace</h2>
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
          <Plus size={15} />
          Thêm danh mục
        </Button>
      </div>

      {/* Tabs: Chi tiêu & Thu nhập */}
      <div className="mt-4 flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <Tabs
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value as "expense" | "income");
            setCreating(false);
            setEditing(null);
          }}
        >
          <TabsList>
            <TabsTrigger
              value="expense"
              className="data-active:text-red-600 dark:data-active:text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span>Chi tiêu</span>
              <TabsCount className="[button[data-active]_&]:bg-red-100 dark:[button[data-active]_&]:bg-red-950/80 [button[data-active]_&]:text-red-700 dark:[button[data-active]_&]:text-red-400 [button:hover_&]:bg-red-100 dark:[button:hover_&]:bg-red-950/80 [button:hover_&]:text-red-700 dark:[button:hover_&]:text-red-400 transition-colors">
                {categories.filter((c) => c.type === "expense").length}
              </TabsCount>
            </TabsTrigger>
            <TabsTrigger
              value="income"
              className="data-active:text-emerald-600 dark:data-active:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <ArrowDownLeft size={14} strokeWidth={2.5} />
              <span>Thu nhập</span>
              <TabsCount className="[button[data-active]_&]:bg-emerald-100 dark:[button[data-active]_&]:bg-emerald-950/80 [button[data-active]_&]:text-emerald-700 dark:[button[data-active]_&]:text-emerald-400 [button:hover_&]:bg-emerald-100 dark:[button:hover_&]:bg-emerald-950/80 [button:hover_&]:text-emerald-700 dark:[button:hover_&]:text-emerald-400 transition-colors">
                {categories.filter((c) => c.type === "income").length}
              </TabsCount>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-xs text-slate-400 font-medium hidden sm:block">
          Dùng mũi tên <ChevronUp size={12} className="inline" /> <ChevronDown size={12} className="inline" /> để thay đổi thứ tự
        </p>
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
        <SheetContent side="right" className="sm:max-w-md w-full flex flex-col h-full p-0 bg-[var(--surface)] text-[var(--foreground)] border-l border-[var(--border)]">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
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
          <div className="flex-1 overflow-y-auto px-6">
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
      <div className="mt-4">
        {rootCategories.map((category, index) => (
          <CategoryNode
            key={category.id}
            category={category}
            categories={currentCategories}
            index={index}
            totalRoots={rootCategories.length}
            pending={pending}
            onEdit={setEditing}
            onStatus={setStatus}
            onDelete={deleteCategory}
            onMoveRoot={moveRootItem}
            onMoveChild={moveChildItem}
          />
        ))}
        {rootCategories.length === 0 && (
          <Empty
            icon={Tag}
            title={`Chưa có danh mục ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`}
            description="Import từ bộ mẫu cá nhân hoặc tạo danh mục mới cho workspace."
          />
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
  onDelete,
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
  onDelete: (id: string) => void;
  onMoveRoot: (index: number, dir: "up" | "down") => void;
  onMoveChild: (parentId: string, index: number, dir: "up" | "down") => void;
}) {
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const children = categories.filter((item) => item.parentId === category.id);
  const isChild = category.parentId !== null;
  const hasChildren = children.length > 0;

  // Root category = mini-card
  if (!isChild) {
    return (
      <div
        className="rounded-xl bg-[var(--surface)] transition-all duration-200 hover:bg-[var(--surface-muted)]/40"
      >
        <div className="group flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Icon — large, prominent */}
            <span
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
              style={{
                backgroundColor: `${category.color}18`,
                color: category.color,
                boxShadow: `inset 0 0 0 1px ${category.color}25, 0 2px 8px -2px ${category.color}15`,
              }}
            >
              <IconComponent size={20} />
            </span>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <strong className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {category.name}
                </strong>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium leading-none",
                    category.status === "active"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500"
                  )}
                >
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full",
                      category.status === "active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                    )}
                  />
                  {category.status === "active" ? "Hoạt động" : "Đã tắt"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {category.transactionCount} giao dịch
                {hasChildren && (
                  <span className="ml-1 text-slate-300 dark:text-slate-600">
                    · {children.length} danh mục con
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center">
              <Button variant="unstyled" size="auto"
                className="text-slate-300 hover:text-[var(--primary)] dark:text-slate-600 disabled:opacity-20 transition-colors p-1"
                disabled={pending || index === 0}
                onClick={() => onMoveRoot(index, "up")}
                title="Di chuyển lên" aria-label="Di chuyển lên"
              >
                <ChevronUp size={16} />
              </Button>
              <Button variant="unstyled" size="auto"
                className="text-slate-300 hover:text-[var(--primary)] dark:text-slate-600 disabled:opacity-20 transition-colors p-1"
                disabled={pending || index === totalRoots - 1}
                onClick={() => onMoveRoot(index, "down")}
                title="Di chuyển xuống" aria-label="Di chuyển xuống"
              >
                <ChevronDown size={16} />
              </Button>
            </div>
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <Button variant="unstyled" size="auto"
              className="text-slate-400 hover:text-[var(--foreground)] transition-colors p-1"
              onClick={() => onEdit(category.id)} disabled={pending}
              title="Chỉnh sửa" aria-label={`Chỉnh sửa ${category.name}`}
            >
              <Pencil size={15} />
            </Button>
            <Button variant="unstyled" size="auto"
              className={cn("text-slate-400 transition-colors p-1",
                category.status === "active"
                  ? "hover:text-amber-500"
                  : "hover:text-emerald-500"
              )}
              onClick={() => onStatus(category.id, category.status === "active" ? "deactive" : "active")}
              disabled={pending}
              title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
            >
              {category.status === "active" ? <EyeOff size={15} /> : <Eye size={15} />}
            </Button>
            <ConfirmDelete
              ariaLabel={`Xóa danh mục ${category.name}`}
              title="Xóa danh mục?"
              description="Hành động này không thể hoàn tác. Các danh mục con cũng sẽ bị xóa theo."
              onConfirm={() => onDelete(category.id)}
              disabled={pending}
              className="!w-auto !h-auto !bg-transparent hover:!bg-transparent text-slate-400 hover:!text-rose-500 transition-colors p-1 [&_svg]:size-[15px]"
            />
          </div>
        </div>

        {/* Children — tree branch from parent */}
        {hasChildren && (
          <div className="ml-7 pb-1 relative">
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
                onDelete={onDelete}
                onMoveRoot={onMoveRoot}
                onMoveChild={onMoveChild}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Child category — compact row with tree connector
  return (
    <article className="group relative flex items-center justify-between gap-3 pl-8 pr-3.5 py-2 transition-colors duration-150 hover:bg-[var(--surface-muted)]/30 rounded-lg">
      {/* Vertical line: top half (always) */}
      <div className="absolute left-2.5 top-0 h-1/2 w-px bg-[var(--border)]" />
      {/* Vertical line: bottom half (not on last child) */}
      {index < totalRoots - 1 && (
        <div className="absolute left-2.5 top-1/2 bottom-0 w-px bg-[var(--border)]" />
      )}
      {/* Horizontal branch line */}
      <div className="absolute left-2.5 top-1/2 w-5 h-px bg-[var(--border)]" />

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: `${category.color}12`,
            color: category.color,
          }}
        >
          <IconComponent size={13} />
        </span>

        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-[var(--foreground)]/90 truncate">
            {category.name}
          </span>
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full flex-shrink-0",
              category.status === "active" ? "bg-emerald-400" : "bg-slate-300 dark:bg-slate-600"
            )}
            title={category.status === "active" ? "Hoạt động" : "Đã tắt"}
          />
          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium flex-shrink-0">
            {category.transactionCount} giao dịch
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button variant="unstyled" size="auto"
          className="text-slate-300 hover:text-[var(--primary)] dark:text-slate-600 disabled:opacity-20 transition-colors p-1"
          disabled={pending || index === 0}
          onClick={() => onMoveChild(category.parentId!, index, "up")}
          title="Di chuyển lên" aria-label="Di chuyển lên"
        >
          <ChevronUp size={14} />
        </Button>
        <Button variant="unstyled" size="auto"
          className="text-slate-300 hover:text-[var(--primary)] dark:text-slate-600 disabled:opacity-20 transition-colors p-1"
          disabled={pending || index === totalRoots - 1}
          onClick={() => onMoveChild(category.parentId!, index, "down")}
          title="Di chuyển xuống" aria-label="Di chuyển xuống"
        >
          <ChevronDown size={14} />
        </Button>
        <div className="w-px h-3 bg-[var(--border)] mx-0.5" />
        <Button variant="unstyled" size="auto"
          className="text-slate-400 hover:text-[var(--foreground)] transition-colors p-1"
          onClick={() => onEdit(category.id)} disabled={pending}
          title="Chỉnh sửa" aria-label={`Chỉnh sửa ${category.name}`}
        >
          <Pencil size={13} />
        </Button>
        <Button variant="unstyled" size="auto"
          className={cn("text-slate-400 transition-colors p-1",
            category.status === "active" ? "hover:text-amber-500" : "hover:text-emerald-500"
          )}
          onClick={() => onStatus(category.id, category.status === "active" ? "deactive" : "active")}
          disabled={pending}
          title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
        >
          {category.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}
        </Button>
        <ConfirmDelete
          ariaLabel={`Xóa danh mục ${category.name}`}
          title="Xóa danh mục?"
          description="Hành động này không thể hoàn tác."
          onConfirm={() => onDelete(category.id)}
          disabled={pending}
          className="!w-auto !h-auto !bg-transparent hover:!bg-transparent text-slate-400 hover:!text-rose-500 transition-colors p-1 [&_svg]:size-[13px]"
        />
      </div>
    </article>
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
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-5 py-4 flex flex-col h-full bg-transparent border-0 shadow-none mt-0"
    >
      <input type="hidden" name="type" value={category?.type ?? defaultType} />

      <div className="grid gap-4">
        {/* Name Input */}
        <div>
          <Input
            label="Tên danh mục"
            name="name"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ăn uống, Lương..."
          />
        </div>

        {/* Code Input (Auto-generated) */}
        <div>
          <Input
            label={"Mã danh mục"}
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
          <CategoryTreeSelect
            name="parentId"
            defaultValue={category?.parentId ?? "none"}
            label="Danh mục cha"
            emptyOption={{ value: "none", label: "Không có" }}
            categories={categories
              .filter(
                (item) =>
                  item.status === "active" &&
                  item.type === (category?.type ?? defaultType) &&
                  (!category || item.id !== category.id) &&
                  !item.parentId
              )
            }
          />
        </div>

        {/* Color Picker */}
        <div className="grid gap-1">
          <Label>
            Màu đại diện
          </Label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {COLOR_PRESETS.map((color) => (
              <Button variant="unstyled" size="auto"
                key={color}
                type="button"
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  selectedColor === color ? "scale-110 border-white shadow-md ring-2 ring-[var(--primary)]" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color.toUpperCase())}
              />
            ))}
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value.toUpperCase())}
              className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
            />
          </div>
          <input type="hidden" name="color" value={selectedColor} />
        </div>

        {/* Visual Icon Picker Grid */}
        <div className="grid gap-1">
          <Label>
            Chọn Biểu tượng
          </Label>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
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

      <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)] mt-auto">
        <Button type="button" variant="outline" className="hover:bg-[var(--surface-secondary)] hover:text-current" onClick={onCancel}>
          Hủy bỏ
        </Button>
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? "Đang xử lý..." : "Lưu danh mục"}
        </Button>
      </div>
    </form>
  );
}
