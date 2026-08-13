"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Car,
  CircleAlert,
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
  Trash2,
  Utensils,
  Wrench,
} from "lucide-react";
import {
  type DragEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  CategoryMobileDragHandle,
  type CategoryDragItem,
} from "@/app/dashboard/settings/category-mobile-drag-handle";
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
  Input,
  Label,
  Loading,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";
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

export const CATEGORY_COLOR_PRESETS = [
  "#FF5B3D",
  "#69B7F3",
  "#F6B94A",
  "#41A862",
  "#7959C8",
  "#E58EB3",
  "#008E9B",
  "#334E8C",
  "#A66A42",
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
  const [isMobile, setIsMobile] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  function submit(form: FormData, categoryId?: string) {
    const category = {
      name: String(form.get("name") ?? ""),
      code: String(form.get("code") ?? ""),
      color: String(form.get("color") ?? CATEGORY_COLOR_PRESETS[0]),
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

  function reorderCategory(source: DraggedCategory | null, target: Category) {
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

  function handleDrop(event: DragEvent<HTMLElement>, target: Category) {
    event.preventDefault();
    event.stopPropagation();
    reorderCategory(draggedCategory, target);
  }

  function handlePointerDrop(source: CategoryDragItem, targetId: string) {
    const target = currentCategories.find((category) => category.id === targetId);
    if (!target) {
      setDraggedCategory(null);
      setDropTargetId(null);
      return;
    }
    reorderCategory(source, target);
  }

  function startCreating() {
    setCreating(true);
    setEditing(null);
  }

  return (
    <Card
      as="section"
      className="gap-0 max-sm:p-4 max-sm:ring-0"
      aria-busy={pending}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8.5 h-8.5 rounded-lg grid place-items-center text-[var(--primary)]">
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
          className="max-sm:hidden"
          onClick={startCreating}
          disabled={pending}
        >
          <Plus size={15} />
          <span className="max-sm:hidden">Thêm danh mục mẫu</span>
        </Button>
      </div>

      {/* Info banner */}

      {/* Tabs: Chi tiêu & Thu nhập ONLY (No All, No Search) */}
      <div className="flex items-center justify-between gap-3 py-4">
        <Tabs
          value={filterType}
          className="category-type-tabs max-sm:w-full"
          onValueChange={(value) => {
            setFilterType(value as "expense" | "income");
            setCreating(false);
            setEditing(null);
          }}
        >
          <TabsList
            className="category-type-switch max-sm:grid max-sm:w-full max-sm:grid-cols-2"
            aria-label="Loại danh mục"
          >
            <TabsTrigger
              value="expense"
              data-transaction-type="expense"
              className="transition-colors data-active:text-red-600 hover:text-red-600 dark:data-active:text-red-400 dark:hover:text-red-400 max-sm:justify-center"
            >
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span>Chi tiêu</span>
              <TabsCount className="bg-red-100 text-red-700 transition-colors dark:bg-red-950/80 dark:text-red-400">
                {categories.filter((c) => c.type === "expense").length}
              </TabsCount>
            </TabsTrigger>
            <TabsTrigger
              value="income"
              data-transaction-type="income"
              className="transition-colors data-active:text-emerald-600 hover:text-emerald-600 dark:data-active:text-emerald-400 dark:hover:text-emerald-400 max-sm:justify-center"
            >
              <ArrowDownLeft size={14} strokeWidth={2.5} />
              <span>Thu nhập</span>
              <TabsCount className="bg-emerald-100 text-emerald-700 transition-colors dark:bg-emerald-950/80 dark:text-emerald-400">
                {categories.filter((c) => c.type === "income").length}
              </TabsCount>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-xs text-slate-400 font-medium hidden sm:block">
          Kéo thả để thay đổi thứ tự trong cùng một cấp
        </p>
      </div>

      <Button
        variant="default"
        size="default"
        className="mb-3 w-full sm:hidden"
        onClick={startCreating}
        disabled={pending}
      >
        <Plus size={15} />
        Tạo danh mục mới
      </Button>

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
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "general-category-sheet flex h-full w-full flex-col bg-[var(--surface)] p-0 text-[var(--foreground)] sm:max-w-md",
            isMobile && "quick-transaction-sheet",
          )}
        >
          <SheetHeader
            className={cn(
              "border-b border-[var(--border)] px-4 pb-4 pt-5 sm:px-6 sm:pt-6",
              isMobile && "quick-transaction-header",
            )}
          >
            <div className={cn(isMobile && "quick-transaction-heading")}>
              {isMobile && (
                <span aria-hidden="true">
                  <FolderTree size={18} />
                </span>
              )}
              <div>
                <SheetTitle>
                  {editing ? "Chỉnh sửa danh mục mẫu" : "Thêm danh mục mẫu"}
                </SheetTitle>
                <SheetDescription>
                  {editing
                    ? "Cập nhật thông tin cho danh mục mẫu này."
                    : "Tạo danh mục để dùng lại trong các workspace."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <TemplateForm
            key={editing ?? "create"}
            defaultType={
              editing
                ? (categories.find((c) => c.id === editing)?.type ?? filterType)
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
            isMobile={isMobile}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSubmit={(form) => {
              submit(form, editing ?? undefined);
            }}
          />
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
              isMobile={isMobile}
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
              onPointerDrop={handlePointerDrop}
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
  isMobile,
  draggedCategory,
  dropTargetId,
  onEdit,
  onStatus,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onPointerDrop,
  onSubmit,
  onCancel,
}: {
  category: Category;
  categories: Category[];
  index: number;
  totalRoots: number;
  editing: string | null;
  pending: boolean;
  isMobile: boolean;
  draggedCategory: DraggedCategory | null;
  dropTargetId: string | null;
  onEdit: (id: string) => void;
  onStatus: (id: string, value: "active" | "deactive") => void;
  onDelete: (id: string) => void;
  onDragStart: (category: DraggedCategory) => void;
  onDragOver: (categoryId: string | null) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, category: Category) => void;
  onPointerDrop: (source: CategoryDragItem, targetId: string) => void;
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
        <CategoryActionsMenu
          category={category}
          childCount={children.length}
          pending={pending}
          isMobile={isMobile}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
          trigger={
            <div
              className={cn(
                "group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-3 transition-[opacity,box-shadow]",
                category.status === "deactive" && "opacity-50",
                draggedCategory?.id === category.id && "opacity-50",
                dropTargetId === category.id && "ring-2 ring-primary/60",
              )}
              data-category-sort-id={category.id}
              data-category-sort-parent="root"
              draggable={!pending && !isMobile}
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
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  onDragOver(null);
                }
              }}
              onDrop={(event) => onDrop(event, category)}
            />
          }
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
              <strong className="block truncate text-sm font-semibold text-[var(--foreground)]">
                {category.name}
              </strong>
              {hasChildren && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {children.length} danh mục con
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {isMobile && (
              <span className="category-mobile-item-hint">
                Chạm để quản lý
              </span>
            )}
            <CategoryMobileDragHandle
              category={category}
              disabled={pending}
              isMobile={isMobile}
              size={17}
              onDragStart={onDragStart}
              onDragTargetChange={onDragOver}
              onDrop={onPointerDrop}
              onDragCancel={onDragEnd}
            />
          </div>
        </CategoryActionsMenu>

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
                isMobile={isMobile}
                draggedCategory={draggedCategory}
                dropTargetId={dropTargetId}
                onEdit={onEdit}
                onStatus={onStatus}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                onPointerDrop={onPointerDrop}
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
    <CategoryActionsMenu
      category={category}
      childCount={0}
      pending={pending}
      isMobile={isMobile}
      onEdit={onEdit}
      onStatus={onStatus}
      onDelete={onDelete}
      trigger={
        <article
          className={cn(
            "group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl py-2 pl-9 pr-1 transition-[background-color,opacity,box-shadow]",
            category.status === "deactive" && "opacity-50",
            draggedCategory?.id === category.id && "opacity-50",
            dropTargetId === category.id && "ring-2 ring-primary/60",
          )}
          data-category-sort-id={category.id}
          data-category-sort-parent={category.parentId ?? "root"}
          draggable={!pending && !isMobile}
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
        />
      }
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

        <span className="truncate text-[12.5px] font-medium text-[var(--foreground)]/90">
          {category.name}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {isMobile && (
          <span className="category-mobile-item-hint">Chạm để quản lý</span>
        )}
        <CategoryMobileDragHandle
          category={category}
          disabled={pending}
          isMobile={isMobile}
          size={15}
          onDragStart={onDragStart}
          onDragTargetChange={onDragOver}
          onDrop={onPointerDrop}
          onDragCancel={onDragEnd}
        />
      </div>
    </CategoryActionsMenu>
  );
}

function CategoryActionsMenu({
  category,
  childCount,
  pending,
  isMobile,
  trigger,
  children,
  onEdit,
  onStatus,
  onDelete,
}: {
  category: Category;
  childCount: number;
  pending: boolean;
  isMobile: boolean;
  trigger: ReactElement<{ className?: string }>;
  children: ReactNode;
  onEdit: (id: string) => void;
  onStatus: (id: string, value: "active" | "deactive") => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const isActive = category.status === "active";
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <SpotlightTrigger
          open={menuOpen}
          onOpenChange={setMenuOpen}
          render={trigger}
          dismissLabel="Đóng menu thao tác danh mục"
        >
          {(spotlightTrigger) => (
            <DropdownMenuTrigger
              nativeButton={false}
              render={spotlightTrigger}
            >
              {children}
            </DropdownMenuTrigger>
          )}
        </SpotlightTrigger>
        <DropdownMenuContent
          align={isMobile ? "center" : "end"}
          side="bottom"
          sideOffset={4}
          className="category-context-menu !w-52 p-1.5 [&_[data-slot=dropdown-menu-item]]:min-h-10 [&_[data-slot=dropdown-menu-item]]:gap-2 [&_[data-slot=dropdown-menu-item]]:px-2.5"
        >
          <DropdownMenuItem
            disabled={pending}
            onClick={() => run(() => onEdit(category.id))}
          >
            <Pencil aria-hidden="true" />
            Chỉnh sửa
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onClick={() =>
              run(() => onStatus(category.id, isActive ? "deactive" : "active"))
            }
          >
            {isActive ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
            {isActive ? "Tắt danh mục" : "Bật danh mục"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setMenuOpen(false);
              setDeleteConfirmOpen(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            Xóa danh mục
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isMobile ? (
        <Sheet open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <SheetContent
            side="bottom"
            className="category-delete-confirm ledger-mobile-review-sheet pending-delete"
            aria-label={`Xác nhận xóa danh mục ${category.name}`}
          >
            <SheetHeader className="ledger-mobile-review-header">
              <div className="ledger-mobile-review-heading">
                <span aria-hidden="true">
                  <Trash2 size={18} />
                </span>
                <div>
                  <SheetTitle>Xóa danh mục?</SheetTitle>
                  <SheetDescription>
                    Hành động này không thể hoàn tác.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="ledger-mobile-review-body">
              <div className="category-delete-target">
                <span
                  className="category-delete-target-icon"
                  style={{
                    backgroundColor: `${category.color}18`,
                    color: category.color,
                    boxShadow: `inset 0 0 0 1px ${category.color}25`,
                  }}
                  aria-hidden="true"
                >
                  <IconComponent size={20} />
                </span>
                <div className="category-delete-target-copy">
                  <strong>{category.name}</strong>
                  <span>
                    {category.type === "expense" ? "Chi tiêu" : "Thu nhập"}
                    {childCount > 0 && ` · ${childCount} danh mục con`}
                  </span>
                </div>
              </div>

              <div className="category-delete-warning" role="note">
                <CircleAlert size={17} aria-hidden="true" />
                <p>
                  {childCount > 0
                    ? `Danh mục này và ${childCount} danh mục con sẽ bị xóa vĩnh viễn.`
                    : "Danh mục này sẽ bị xóa vĩnh viễn."}
                </p>
              </div>
            </div>

            <SheetFooter className="ledger-mobile-review-actions">
              <Button
                variant="outline"
                className="ledger-mobile-review-approve"
                data-delete
                disabled={pending}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onDelete(category.id);
                }}
              >
                <Trash2 size={16} />
                Xóa danh mục
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-rose-500/10 text-rose-500">
                <Trash2 aria-hidden="true" />
              </AlertDialogMedia>
              <AlertDialogTitle>Xóa danh mục?</AlertDialogTitle>
              <AlertDialogDescription>
                Danh mục “{category.name}” sẽ bị xóa và không thể khôi phục.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onDelete(category.id);
                }}
              >
                <Trash2 aria-hidden="true" />
                Xóa danh mục
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function TemplateForm({
  defaultType,
  categories,
  category,
  pending,
  isMobile,
  onCancel,
  onSubmit,
}: {
  defaultType: "income" | "expense";
  categories: Category[];
  category?: Category;
  pending: boolean;
  isMobile: boolean;
  onCancel: () => void;
  onSubmit: (form: FormData) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [selectedColor, setSelectedColor] = useState(
    (category?.color ?? CATEGORY_COLOR_PRESETS[0]).toUpperCase(),
  );
  const [selectedIcon, setSelectedIcon] = useState(category?.icon ?? "tag");

  function handleNameChange(val: string) {
    setName(val);
    if (!category) {
      setCode(slugifyCode(val));
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className={cn(
        "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none",
        isMobile && "quick-transaction-form",
      )}
    >
      <input type="hidden" name="type" value={category?.type ?? defaultType} />
      <input type="hidden" name="code" value={code} />

      <div
        className={cn(
          "flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6",
          isMobile && "quick-transaction-scroll",
        )}
      >
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
            {CATEGORY_COLOR_PRESETS.map((color) => (
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
          </div>
          <input type="hidden" name="color" value={selectedColor} />
        </div>

        {/* Visual Icon Picker Grid */}
        <div className="grid gap-1">
          <Label>Chọn Biểu tượng</Label>
          <div className="category-icon-picker grid max-h-48 grid-cols-4 gap-2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
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
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs gap-1 ${
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

      <div
        className={cn(
          "mt-auto flex justify-end gap-2 border-t px-4 py-3 sm:px-6",
          isMobile && "quick-transaction-footer",
        )}
      >
        <Button
          type="button"
          variant="outline"
          className="hover:text-current max-sm:hidden"
          onClick={onCancel}
        >
          Hủy bỏ
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={pending}
          className={cn(isMobile && "quick-submit flex-1")}
        >
          {pending ? <Loading label="Đang xử lý..." /> : "Lưu danh mục"}
        </Button>
      </div>
    </form>
  );
}
