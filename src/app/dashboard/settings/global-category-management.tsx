"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Car,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Dumbbell,
  Eye,
  EyeOff,
  Film,
  FolderTree,
  Fuel,
  Gift,
  GraduationCap,
  GripVertical,
  Heart,
  House,
  Landmark,
  Pencil,
  Plane,
  Plus,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wrench,
} from "lucide-react";
import { type DragEvent, useState, useTransition } from "react";
import {
  createTemplateCategoryAction,
  deleteTemplateCategoryAction,
  reorderTemplateCategoriesAction,
  setTemplateCategoryStatusAction,
  updateTemplateCategoryAction,
} from "@/app/dashboard/settings/general-actions";
import {
  Button,
  Card,
  CategoryTreeSelect,
  Empty,
  FormPendingSkeleton,
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
import { ConfirmDelete } from "@/components/base/confirm-delete";
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
  sortOrder?: number;
  status: "active" | "deactive";
};

type DraggedCategory = Pick<Category, "id" | "parentId">;

function moveItem<T extends { id: string }>(
  items: T[],
  sourceId: string,
  targetId: string,
): T[] {
  const sourceIndex = items.findIndex(({ id }) => id === sourceId);
  const targetIndex = items.findIndex(({ id }) => id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const movedItem = items[sourceIndex];
  const remainingItems = [
    ...items.slice(0, sourceIndex),
    ...items.slice(sourceIndex + 1),
  ];
  return [
    ...remainingItems.slice(0, targetIndex),
    movedItem,
    ...remainingItems.slice(targetIndex),
  ];
}

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

export const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  tag: Tag,
  utensils: Utensils,
  coffee: Coffee,
  house: House,
  car: Car,
  fuel: Fuel,
  shopping: ShoppingBag,
  heart: Heart,
  work: Briefcase,
  money: CircleDollarSign,
  landmark: Landmark,
  card: CreditCard,
  education: GraduationCap,
  travel: Plane,
  utilities: Sparkles,
  gift: Gift,
  shield: Shield,
  tech: Smartphone,
  entertainment: Film,
  sport: Dumbbell,
  service: Wrench,
  book: BookOpen,
};

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

export function slugifyCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s_]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

export function UserCategoryTemplateManagement({
  categories,
}: {
  categories: Category[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState<"expense" | "income">("expense");
  const [draggedCategory, setDraggedCategory] =
    useState<DraggedCategory | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData, categoryId?: string) {
    const category = {
      name: String(form.get("name") ?? ""),
      code: String(form.get("code") ?? ""),
      color: String(form.get("color") ?? COLOR_PRESETS[0]),
      type: String(form.get("type") ?? "expense") as "income" | "expense",
      icon: String(form.get("icon") ?? "tag"),
      parentId:
        form.get("parentId") === "none"
          ? undefined
          : (form.get("parentId") as string) || undefined,
    };
    start(async () => {
      const result = categoryId
        ? await updateTemplateCategoryAction({ ...category, categoryId })
        : await createTemplateCategoryAction(category);
      if (result.ok) {
        toast.success("Đã lưu danh mục mẫu.");
        setCreating(false);
        setEditing(null);
      } else {
        toast.error(result.message ?? "Không thể lưu thay đổi.");
      }
    });
  }

  function status(id: string, value: "active" | "deactive") {
    start(async () => {
      const result = await setTemplateCategoryStatusAction({
        categoryId: id,
        status: value,
      });
      if (result.ok) {
        toast.success("Đã cập nhật trạng thái danh mục.");
      } else {
        toast.error(result.message ?? "Không thể thay đổi trạng thái.");
      }
    });
  }

  function deleteItem(categoryId: string) {
    start(async () => {
      const result = await deleteTemplateCategoryAction(categoryId);
      if (result.ok) {
        toast.success("Đã xóa danh mục mẫu.");
        if (editing === categoryId) {
          setEditing(null);
        }
      } else {
        toast.error(result.message ?? "Không thể xóa danh mục.");
      }
    });
  }

  function handleReorder(items: Category[]) {
    const orderedIds = items.map((c) => c.id);
    start(async () => {
      const result = await reorderTemplateCategoriesAction(orderedIds);
      if (result.ok) {
        toast.success("Đã cập nhật thứ tự danh mục.");
      } else {
        toast.error(result.message ?? "Không thể sắp xếp lại.");
      }
    });
  }

  const currentCategories = categories.filter((c) => c.type === filterType);
  const rootCategories = currentCategories.filter((c) => !c.parentId);

  function reorderRoots(sourceId: string, targetId: string) {
    const newRoots = moveItem(rootCategories, sourceId, targetId);
    if (newRoots === rootCategories) return;
    const allOrdered: Category[] = [];
    newRoots.forEach((root) => {
      allOrdered.push(root);
      allOrdered.push(...categories.filter((c) => c.parentId === root.id));
    });
    const otherTypeItems = categories.filter((c) => c.type !== filterType);
    handleReorder([...allOrdered, ...otherTypeItems]);
  }

  function reorderChildren(
    parentId: string,
    sourceId: string,
    targetId: string,
  ) {
    const siblings = currentCategories.filter((c) => c.parentId === parentId);
    const reorderedSiblings = moveItem(siblings, sourceId, targetId);
    if (reorderedSiblings === siblings) return;

    const allOrdered: Category[] = [];
    rootCategories.forEach((root) => {
      allOrdered.push(root);
      if (root.id === parentId) {
        allOrdered.push(...reorderedSiblings);
      } else {
        allOrdered.push(...categories.filter((c) => c.parentId === root.id));
      }
    });
    const otherTypeItems = categories.filter((c) => c.type !== filterType);
    handleReorder([...allOrdered, ...otherTypeItems]);
  }

  function handleDrop(event: DragEvent<HTMLElement>, target: Category) {
    event.preventDefault();
    event.stopPropagation();
    const source = draggedCategory;
    setDraggedCategory(null);
    setDropTargetId(null);
    if (
      !source ||
      source.id === target.id ||
      source.parentId !== target.parentId
    ) {
      return;
    }

    if (source.parentId === null) {
      reorderRoots(source.id, target.id);
      return;
    }
    reorderChildren(source.parentId, source.id, target.id);
  }

  return (
    <Card as="section" className="gap-0" aria-busy={pending}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8.5 h-8.5 rounded-lg grid place-items-center bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <FolderTree size={18} />
          </div>
          <div>
            <p className="settings-eyebrow">Danh mục mẫu</p>
            <h2 className="text-base font-bold tracking-tight mt-0.5">
              Danh mục mẫu cá nhân
            </h2>
          </div>
        </div>

        <Button
          variant="default"
          size="default"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          disabled={pending}
        >
          <Plus size={15} />
          Thêm danh mục mẫu
        </Button>
      </div>

      {/* Info banner */}

      {/* Tabs: Chi tiêu & Thu nhập ONLY (No All, No Search) */}
      <div className="flex items-center justify-between gap-3 py-4 border-b border-[var(--border)]">
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
          Kéo thả để thay đổi thứ tự trong cùng một cấp
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
        <SheetContent
          side="right"
          className="sm:max-w-md w-full flex flex-col h-full p-0 bg-[var(--surface)] text-[var(--foreground)] border-l border-[var(--border)]"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
            <SheetTitle>
              {editing ? "Chỉnh sửa danh mục mẫu" : "Thêm danh mục mẫu"}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? "Cập nhật thông tin chi tiết cho danh mục mẫu cá nhân này."
                : "Tạo một danh mục mẫu mới để nhập vào các workspace khi cần thiết."}
            </SheetDescription>
          </SheetHeader>
          {pending && (
            <FormPendingSkeleton
              label="Đang lưu danh mục mẫu"
              className="mx-6 mt-3"
            />
          )}
          <div className="flex-1 overflow-y-auto px-6">
            <TemplateForm
              key={editing ?? "create"}
              defaultType={
                editing
                  ? (categories.find((c) => c.id === editing)?.type ??
                    filterType)
                  : filterType
              }
              categories={
                editing
                  ? categories.filter((item) => item.id !== editing)
                  : categories
              }
              category={
                editing ? categories.find((c) => c.id === editing) : undefined
              }
              pending={pending}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
              onSubmit={(form) => {
                submit(form, editing ?? undefined);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Category Tree List */}
      <div>
        {rootCategories.length === 0 ? (
          <Empty
            icon={Tag}
            title={`Chưa có danh mục mẫu ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`}
            description="Tạo danh mục mẫu mới để sử dụng và import vào workspace."
          />
        ) : (
          rootCategories.map((category, index) => (
            <Node
              key={category.id}
              category={category}
              categories={categories}
              index={index}
              totalRoots={rootCategories.length}
              editing={editing}
              pending={pending}
              draggedCategory={draggedCategory}
              dropTargetId={dropTargetId}
              onEdit={setEditing}
              onStatus={status}
              onDelete={deleteItem}
              onDragStart={setDraggedCategory}
              onDragOver={setDropTargetId}
              onDragEnd={() => {
                setDraggedCategory(null);
                setDropTargetId(null);
              }}
              onDrop={handleDrop}
              onSubmit={submit}
              onCancel={() => setEditing(null)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function Node({
  category,
  categories,
  index,
  totalRoots,
  editing,
  pending,
  draggedCategory,
  dropTargetId,
  onEdit,
  onStatus,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onSubmit,
  onCancel,
}: {
  category: Category;
  categories: Category[];
  index: number;
  totalRoots: number;
  editing: string | null;
  pending: boolean;
  draggedCategory: DraggedCategory | null;
  dropTargetId: string | null;
  onEdit: (id: string) => void;
  onStatus: (id: string, value: "active" | "deactive") => void;
  onDelete: (id: string) => void;
  onDragStart: (category: DraggedCategory) => void;
  onDragOver: (categoryId: string | null) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, category: Category) => void;
  onSubmit: (form: FormData, id?: string) => void;
  onCancel: () => void;
}) {
  const children = categories.filter((item) => item.parentId === category.id);
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const isChild = category.parentId !== null;
  const hasChildren = children.length > 0;

  // Root category = mini-card style
  if (!isChild) {
    return (
      <div className="mt-1 rounded-xl bg-[var(--surface)] transition-all duration-200">
        {/* Root row */}
        <div
          className={cn(
            "group flex cursor-grab items-center justify-between gap-3 rounded-lg py-3 px-1 transition-[opacity,box-shadow] active:cursor-grabbing",
            draggedCategory?.id === category.id && "opacity-50",
            dropTargetId === category.id && "ring-2 ring-primary/60",
          )}
          draggable={!pending}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", category.id);
            onDragStart({ id: category.id, parentId: null });
          }}
          onDragEnd={(event) => {
            event.stopPropagation();
            onDragEnd();
          }}
          onDragOver={(event) => {
            event.stopPropagation();
            if (
              draggedCategory?.parentId !== null ||
              draggedCategory.id === category.id
            )
              return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            onDragOver(category.id);
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              onDragOver(null);
            }
          }}
          onDrop={(event) => onDrop(event, category)}
        >
          {/* Left: icon + info */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Icon — large, prominent, with tinted bg + ring */}
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

            {/* Text info */}
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
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500",
                  )}
                >
                  <span
                    className={cn(
                      "w-1 h-1 rounded-full",
                      category.status === "active"
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600",
                    )}
                  />
                  {category.status === "active" ? "Hoạt động" : "Đã tắt"}
                </span>
              </div>
              {hasChildren && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {children.length} danh mục con
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <span
              className="grid min-h-10 place-items-center px-1 text-[var(--text-muted)]"
              title={`Kéo để sắp xếp ${category.name} cùng các danh mục con`}
            >
              <GripVertical size={17} />
            </span>
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <Button
              variant="icon"
              size="auto"
              onClick={() => onEdit(category.id)}
              disabled={pending}
              title="Chỉnh sửa"
              aria-label={`Chỉnh sửa ${category.name}`}
            >
              <Pencil size={15} />
            </Button>
            <Button
              variant="icon"
              size="auto"
              onClick={() =>
                onStatus(
                  category.id,
                  category.status === "active" ? "deactive" : "active",
                )
              }
              disabled={pending}
              title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
            >
              {category.status === "active" ? (
                <EyeOff size={15} />
              ) : (
                <Eye size={15} />
              )}
            </Button>
            <ConfirmDelete
              ariaLabel={`Xóa danh mục ${category.name}`}
              title="Xóa danh mục?"
              description="Hành động này không thể hoàn tác."
              onConfirm={() => onDelete(category.id)}
              disabled={pending}
            />
          </div>
        </div>

        {/* Children — tree branch from parent */}
        {hasChildren && (
          <div className="ml-2 relative">
            {children.map((child, childIdx) => (
              <Node
                key={child.id}
                category={child}
                categories={categories}
                index={childIdx}
                totalRoots={children.length}
                editing={editing}
                pending={pending}
                draggedCategory={draggedCategory}
                dropTargetId={dropTargetId}
                onEdit={onEdit}
                onStatus={onStatus}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                onSubmit={onSubmit}
                onCancel={onCancel}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Child category — compact row with tree connector
  return (
    <article
      className={cn(
        "group relative flex cursor-grab items-center justify-between gap-3 rounded-xl py-2 pl-9 pr-1 transition-[background-color,opacity,box-shadow] active:cursor-grabbing",
        draggedCategory?.id === category.id && "opacity-50",
        dropTargetId === category.id && "ring-2 ring-primary/60",
      )}
      draggable={!pending}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", category.id);
        onDragStart({ id: category.id, parentId: category.parentId });
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
      onDragOver={(event) => {
        event.stopPropagation();
        if (
          draggedCategory?.parentId !== category.parentId ||
          draggedCategory.id === category.id
        )
          return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver(category.id);
      }}
      onDragLeave={(event) => {
        event.stopPropagation();
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          onDragOver(null);
        }
      }}
      onDrop={(event) => onDrop(event, category)}
    >
      {/* Vertical line: top half (always) */}
      <div className="absolute left-3.5 top-0 h-1/2 w-px bg-[var(--border)]" />
      {/* Vertical line: bottom half (not on last child) */}
      {index < totalRoots - 1 && (
        <div className="absolute left-3.5 top-1/2 bottom-0 w-px bg-[var(--border)]" />
      )}
      {/* Horizontal branch line */}
      <div className="absolute left-3.5 top-1/2 w-5 h-px bg-[var(--border)]" />

      <div className="flex min-w-0 items-center gap-2.5">
        {/* Child icon */}
        <span
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: `${category.color}12`,
            color: category.color,
          }}
        >
          <IconComponent size={13} />
        </span>

        {/* Name + status dot */}
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-[var(--foreground)]/90 truncate">
            {category.name}
          </span>
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full flex-shrink-0",
              category.status === "active"
                ? "bg-emerald-400"
                : "bg-slate-300 dark:bg-slate-600",
            )}
            title={category.status === "active" ? "Hoạt động" : "Đã tắt"}
          />
        </div>
      </div>

      {/* Child actions — minimal */}
      <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <span
          className="grid min-h-10 place-items-center px-1 text-[var(--text-muted)]"
          title={`Kéo để sắp xếp ${category.name} trong cùng danh mục cha`}
        >
          <GripVertical size={17} />
        </span>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <Button
          variant="icon"
          size="auto"
          onClick={() => onEdit(category.id)}
          disabled={pending}
          title="Chỉnh sửa"
          aria-label={`Chỉnh sửa ${category.name}`}
        >
          <Pencil size={13} />
        </Button>
        <Button
          variant="icon"
          size="auto"
          onClick={() =>
            onStatus(
              category.id,
              category.status === "active" ? "deactive" : "active",
            )
          }
          disabled={pending}
          title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
        >
          {category.status === "active" ? (
            <EyeOff size={13} />
          ) : (
            <Eye size={13} />
          )}
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

function TemplateForm({
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
  const [autoCode, setAutoCode] = useState(!category); // Auto-generate code when creating new
  const [selectedColor, setSelectedColor] = useState(
    (category?.color ?? COLOR_PRESETS[0]).toUpperCase(),
  );
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

      <div className="flex flex-col gap-4">
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
            categories={categories.filter(
              (item) =>
                item.status === "active" &&
                item.type === (category?.type ?? defaultType) &&
                (!category || item.id !== category.id) &&
                !item.parentId,
            )}
          />
        </div>

        {/* Color Picker */}
        <div className="grid gap-1">
          <Label>Màu đại diện</Label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {COLOR_PRESETS.map((color) => (
              <Button
                variant="unstyled"
                size="auto"
                key={color}
                type="button"
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  selectedColor === color
                    ? "scale-110 border-white shadow-md ring-2 ring-[var(--primary)]"
                    : "border-transparent"
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
          <Label>Chọn Biểu tượng</Label>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
            {ICON_LIST.map((item) => {
              const IconComp = ICON_MAP[item.id] ?? Tag;
              const isSelected = selectedIcon === item.id;
              return (
                <Button
                  variant="unstyled"
                  size="auto"
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
                  <span className="text-[10px] truncate max-w-full">
                    {item.label}
                  </span>
                </Button>
              );
            })}
          </div>
          <input type="hidden" name="icon" value={selectedIcon} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t mt-auto">
        <Button
          type="button"
          variant="outline"
          className="hover:text-current"
          onClick={onCancel}
        >
          Hủy bỏ
        </Button>
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? "Đang xử lý..." : "Lưu danh mục"}
        </Button>
      </div>
    </form>
  );
}
