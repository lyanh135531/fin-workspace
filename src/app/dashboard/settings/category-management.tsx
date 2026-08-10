"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  FolderTree,
  GripVertical,
  Pencil,
  Plus,
  Tag,
  Trash2,
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
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  setCategoryStatusAction,
  updateCategoryAction,
} from "@/app/dashboard/settings/category-actions";
import {
  ICON_MAP,
  slugifyCode,
} from "@/app/dashboard/settings/global-category-management";
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
import { cn } from "@/lib/utils";
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

  function submit(form: FormData, id?: string) {
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
          status === "active"
            ? "Đã kích hoạt danh mục."
            : "Đã vô hiệu hóa danh mục.",
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
    <Card
      as="section"
      className="workspace-category-section gap-0"
      aria-busy={pending}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="settings-section-icon shrink-0">
            <FolderTree size={18} />
          </span>
          <div className="min-w-0">
          <p className="settings-eyebrow">Danh mục workspace</p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight">
            Quản lý danh mục
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Danh mục thuộc workspace này. Bạn có thể tạo mới hoặc import từ danh
            mục mẫu cá nhân.
          </p>
          </div>
        </div>
        <Button
          variant="default"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          disabled={pending}
          className="max-md:h-9 max-md:px-3 max-md:text-xs"
        >
          <Plus size={15} />
          <span className="max-md:hidden">Thêm danh mục</span>
          <span className="md:hidden">Thêm</span>
        </Button>
      </div>

      {/* Tabs: Chi tiêu & Thu nhập */}
      <div className="flex items-center justify-between gap-3 py-4 mb-1 border-b border-[var(--border)]">
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
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "workspace-category-editor-sheet sm:max-w-md w-full flex flex-col h-full p-0 bg-[var(--surface)] text-[var(--foreground)] border-l border-[var(--border)]",
            isMobile && "quick-transaction-sheet",
          )}
        >
          <SheetHeader className={cn("px-6 pt-6 pb-4 border-b border-[var(--border)]", isMobile && "quick-transaction-header")}>
            <div className={cn(isMobile && "quick-transaction-heading")}>
              {isMobile && <span aria-hidden="true"><FolderTree size={18} /></span>}
              <div>
                <SheetTitle>
                  {editingCategory
                    ? "Chỉnh sửa danh mục"
                    : `Thêm danh mục ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`}
                </SheetTitle>
                <SheetDescription>
                  {editingCategory
                    ? `Cập nhật thông tin cho “${editingCategory.name}”.`
                    : "Tạo danh mục mới trong workspace này."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {(creating || editingCategory) && (
            <CategoryForm
              key={editingCategory?.id ?? `create-${filterType}`}
              defaultType={editingCategory?.type ?? filterType}
              categories={editingCategory ? categories.filter((item) => item.id !== editingCategory.id) : categories}
              category={editingCategory}
              pending={pending}
              isMobile={isMobile}
              onCancel={() => { setCreating(false); setEditing(null); }}
              onSubmit={(form) => submit(form, editingCategory?.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Tree list */}
      <div>
        {rootCategories.map((category, index) => (
          <CategoryNode
            key={category.id}
            category={category}
            categories={currentCategories}
            index={index}
            totalRoots={rootCategories.length}
            pending={pending}
            isMobile={isMobile}
            draggedCategory={draggedCategory}
            dropTargetId={dropTargetId}
            onEdit={setEditing}
            onStatus={setStatus}
            onDelete={deleteCategory}
            onDragStart={setDraggedCategory}
            onDragOver={setDropTargetId}
            onDragEnd={() => {
              setDraggedCategory(null);
              setDropTargetId(null);
            }}
            onDrop={handleDrop}
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

function WorkspaceCategoryActionsMenu({
  category,
  pending,
  isMobile,
  trigger,
  children,
  onEdit,
  onStatus,
  onDelete,
}: {
  category: Category;
  pending: boolean;
  isMobile: boolean;
  trigger: ReactElement;
  children: ReactNode;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: "active" | "deactive") => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const isActive = category.status === "active";

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const deleteAction = () => {
    setDeleteConfirmOpen(false);
    onDelete(category.id);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger nativeButton={false} render={trigger}>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={4}
          className="!w-52 p-1.5 [&_[data-slot=dropdown-menu-item]]:min-h-10 [&_[data-slot=dropdown-menu-item]]:gap-2 [&_[data-slot=dropdown-menu-item]]:px-2.5"
        >
          <DropdownMenuItem disabled={pending} onClick={() => run(() => onEdit(category.id))}>
            <Pencil aria-hidden="true" />
            Chỉnh sửa
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending}
            onClick={() => run(() => onStatus(category.id, isActive ? "deactive" : "active"))}
          >
            {isActive ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {isActive ? "Tắt danh mục" : "Bật danh mục"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }}
          >
            <Trash2 aria-hidden="true" />
            Xóa danh mục
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isMobile ? (
        <Sheet open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <SheetContent side="bottom" className="ledger-mobile-review-sheet pending-delete">
            <SheetHeader className="ledger-mobile-review-header">
              <div className="ledger-mobile-review-heading">
                <span aria-hidden="true"><Trash2 size={18} /></span>
                <div>
                  <SheetTitle>Xóa danh mục?</SheetTitle>
                  <SheetDescription>Hành động này không thể hoàn tác.</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="ledger-mobile-review-body">
              <div className="ledger-mobile-review-transaction">
                <div>
                  <span>{category.name}</span>
                  <small>{category.transactionCount} giao dịch</small>
                </div>
                <strong style={{ color: category.color }}>
                  {category.type === "expense" ? "Chi tiêu" : "Thu nhập"}
                </strong>
              </div>
            </div>
            <SheetFooter className="ledger-mobile-review-actions">
              <Button variant="outline" className="ledger-mobile-review-reject" data-delete disabled={pending} onClick={() => setDeleteConfirmOpen(false)}>
                Hủy
              </Button>
              <Button variant="outline" className="ledger-mobile-review-approve" data-delete disabled={pending} onClick={deleteAction}>
                <Trash2 size={16} />
                Xóa danh mục
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-rose-500/10 text-rose-500"><Trash2 /></AlertDialogMedia>
              <AlertDialogTitle>Xóa danh mục?</AlertDialogTitle>
              <AlertDialogDescription>
                Danh mục “{category.name}” sẽ bị xóa và không thể khôi phục.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending} onClick={deleteAction}>
                <Trash2 />
                Xóa danh mục
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function CategoryNode({
  category,
  categories,
  index,
  totalRoots,
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
}: {
  category: Category;
  categories: Category[];
  index: number;
  totalRoots: number;
  pending: boolean;
  isMobile: boolean;
  draggedCategory: DraggedCategory | null;
  dropTargetId: string | null;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: "active" | "deactive") => void;
  onDelete: (id: string) => void;
  onDragStart: (category: DraggedCategory) => void;
  onDragOver: (categoryId: string | null) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, category: Category) => void;
}) {
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const children = categories.filter((item) => item.parentId === category.id);
  const isChild = category.parentId !== null;
  const hasChildren = children.length > 0;

  // Root category = mini-card
  if (!isChild) {
    return (
      <div className="rounded-xl bg-[var(--surface)] transition-all duration-200">
        <WorkspaceCategoryActionsMenu
          category={category}
          pending={pending}
          isMobile={isMobile}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
          trigger={
            <div
              className={cn(
                "group flex cursor-pointer items-center justify-between gap-3 rounded-lg py-3 px-1 transition-[opacity,box-shadow]",
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
              onDragEnd={(event) => { event.stopPropagation(); onDragEnd(); }}
              onDragOver={(event) => {
                event.stopPropagation();
                if (draggedCategory?.parentId !== null || draggedCategory.id === category.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                onDragOver(category.id);
              }}
              onDragLeave={(event) => {
                event.stopPropagation();
                if (!event.currentTarget.contains(event.relatedTarget as Node)) onDragOver(null);
              }}
              onDrop={(event) => onDrop(event, category)}
            />
          }
        >
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

          <GripVertical size={17} className="shrink-0 text-[var(--text-muted)] max-md:hidden" />
        </WorkspaceCategoryActionsMenu>

        {/* Children — tree branch from parent */}
        {hasChildren && (
          <div className="ml-2 relative">
            {children.map((child, childIdx) => (
              <CategoryNode
                key={child.id}
                category={child}
                categories={categories}
                index={childIdx}
                totalRoots={children.length}
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Child category — compact row with tree connector
  return (
    <WorkspaceCategoryActionsMenu
      category={category}
      pending={pending}
      isMobile={isMobile}
      onEdit={onEdit}
      onStatus={onStatus}
      onDelete={onDelete}
      trigger={
        <article
          className={cn(
            "group relative flex cursor-pointer items-center justify-between gap-3 rounded-lg py-2 pl-9 pr-1 transition-[background-color,opacity,box-shadow]",
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
          onDragEnd={(event) => { event.stopPropagation(); onDragEnd(); }}
          onDragOver={(event) => {
            event.stopPropagation();
            if (draggedCategory?.parentId !== category.parentId || draggedCategory.id === category.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            onDragOver(category.id);
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            if (!event.currentTarget.contains(event.relatedTarget as Node)) onDragOver(null);
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
              category.status === "active"
                ? "bg-emerald-400"
                : "bg-slate-300 dark:bg-slate-600",
            )}
            title={category.status === "active" ? "Hoạt động" : "Đã tắt"}
          />
          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium flex-shrink-0">
            {category.transactionCount} giao dịch
          </span>
        </div>
      </div>

      <GripVertical size={15} className="shrink-0 text-[var(--text-muted)] max-md:hidden" />
    </WorkspaceCategoryActionsMenu>
  );
}

function CategoryForm({
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
  const [autoCode, setAutoCode] = useState(!category);
  const [selectedColor, setSelectedColor] = useState(
    category?.color ?? COLOR_PRESETS[0],
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
      className={cn(
        "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none",
        isMobile && "quick-transaction-form",
      )}
    >
      <input type="hidden" name="type" value={category?.type ?? defaultType} />

      <div className={cn("grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6", isMobile && "quick-transaction-scroll")}>
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

      <div className={cn("mt-auto flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-6", isMobile && "quick-transaction-footer")}>
        <Button
          type="button"
          variant="outline"
          className="hover:bg-[var(--surface-secondary)] hover:text-current max-md:hidden"
          onClick={onCancel}
        >
          Hủy bỏ
        </Button>
        <Button type="submit" variant="default" disabled={pending} className={cn(isMobile && "quick-submit flex-1")}>
          {pending ? <Loading label="Đang xử lý..." /> : "Lưu danh mục"}
        </Button>
      </div>
    </form>
  );
}
