"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  FolderTree,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import {
  cloneElement,
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
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  setCategoryStatusAction,
  updateCategoryAction,
} from "@/app/dashboard/settings/category-actions";
import {
  CATEGORY_COLOR_PRESETS,
  ICON_MAP,
  slugifyCode,
} from "@/app/dashboard/settings/global-category-management";
import {
  Button,
  Card,
  CategoryTreeSelect,
  ConfirmDelete,
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
import { SpotlightTrigger } from "@/components/ui/spotlight-trigger";

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
  const [isDesktop, setIsDesktop] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    const updateViewport = () => {
      setIsMobile(mobileQuery.matches);
      setIsDesktop(desktopQuery.matches);
    };
    updateViewport();
    mobileQuery.addEventListener("change", updateViewport);
    desktopQuery.addEventListener("change", updateViewport);
    return () => {
      mobileQuery.removeEventListener("change", updateViewport);
      desktopQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  function submit(form: FormData, id?: string) {
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
    const target = currentCategories.find(
      (category) => category.id === targetId,
    );
    if (!target) {
      setDraggedCategory(null);
      setDropTargetId(null);
      return;
    }
    reorderCategory(source, target);
  }

  return (
    <Card
      as="section"
      className="workspace-category-section gap-0 max-sm:p-4 max-sm:ring-0"
      aria-busy={pending}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8.5 w-8.5 place-items-center rounded-lg text-[var(--primary)]">
            <FolderTree size={18} />
          </div>
          <div>
            <p className="settings-eyebrow">Danh mục của nhóm</p>
            <h2 className="mt-0.5 text-base font-bold tracking-tight">
              Quản lý danh mục
            </h2>
            <p className="mt-1 hidden text-xs leading-5 text-[var(--text-muted)] min-[901px]:block">
              Tổ chức danh mục thu chi và sắp xếp theo cấu trúc phù hợp với
              nhóm tài chính.
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="default"
          className="max-sm:hidden"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          disabled={pending}
        >
          <Plus size={15} />
          <span>Thêm danh mục</span>
        </Button>
      </div>

      {/* Tabs: Chi tiêu & Thu nhập */}
      <div className="flex items-center justify-between gap-3 py-4">
        <Tabs
          value={filterType}
          className="category-type-tabs max-sm:w-full min-[901px]:w-full min-[901px]:max-w-sm"
          onValueChange={(value) => {
            setFilterType(value as "expense" | "income");
            setCreating(false);
            setEditing(null);
          }}
        >
          <TabsList
            variant={isDesktop ? "segmented" : "default"}
            className="category-type-switch max-sm:grid max-sm:w-full max-sm:grid-cols-2"
            aria-label="Loại danh mục"
          >
            <TabsTrigger
              variant={isDesktop ? "segmented" : "default"}
              tone={isDesktop ? "expense" : undefined}
              value="expense"
              data-transaction-type="expense"
              className={cn(
                "max-sm:justify-center",
                !isDesktop &&
                  "transition-colors data-active:text-red-600 hover:text-red-600 dark:data-active:text-red-400 dark:hover:text-red-400",
              )}
            >
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span>Chi tiêu</span>
              <TabsCount className="bg-red-100 text-red-700 transition-colors dark:bg-red-950/80 dark:text-red-400">
                {categories.filter((c) => c.type === "expense").length}
              </TabsCount>
            </TabsTrigger>
            <TabsTrigger
              variant={isDesktop ? "segmented" : "default"}
              tone={isDesktop ? "income" : undefined}
              value="income"
              data-transaction-type="income"
              className={cn(
                "max-sm:justify-center",
                !isDesktop &&
                  "transition-colors data-active:text-emerald-600 hover:text-emerald-600 dark:data-active:text-emerald-400 dark:hover:text-emerald-400",
              )}
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
        onClick={() => {
          setCreating(true);
          setEditing(null);
        }}
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
          side={isDesktop ? "right" : isMobile ? "bottom" : "right"}
          placement={isDesktop ? "inset" : "edge"}
          size={isDesktop ? "wide" : "default"}
          spacing={isDesktop ? "flush" : "default"}
          elevation={isDesktop ? "flat" : "raised"}
          className={
            isDesktop
              ? undefined
              : cn(
                  "workspace-category-editor-sheet general-category-sheet flex h-full w-full flex-col bg-[var(--surface)] p-0 text-[var(--foreground)] sm:max-w-md",
                  isMobile && "quick-transaction-sheet",
                )
          }
        >
          <SheetHeader
            className={cn(
              !isDesktop &&
                "border-b border-[var(--border)] px-4 pb-4 pt-5 sm:px-6 sm:pt-6",
              isMobile && "quick-transaction-header",
              isDesktop && "px-8 pt-7 pb-[1.4rem]",
            )}
          >
            <div
              className={cn(
                isMobile && "quick-transaction-heading",
                isDesktop && "flex items-center gap-3.5 pr-12",
              )}
            >
              {(isMobile || isDesktop) && (
                <span
                  className={cn(
                    isDesktop &&
                      "grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]",
                  )}
                  aria-hidden="true"
                >
                  <FolderTree size={18} />
                </span>
              )}
              <div>
                <SheetTitle
                  className={cn(
                    isDesktop &&
                      "text-[1.3rem] font-semibold tracking-[-0.02em]",
                  )}
                >
                  {editingCategory
                    ? "Chỉnh sửa danh mục"
                    : `Thêm danh mục ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`}
                </SheetTitle>
                <SheetDescription
                  className={cn(
                    isDesktop &&
                      "mt-1 max-w-[30rem] text-[0.82rem] leading-[1.55]",
                  )}
                >
                  {editingCategory
                    ? isDesktop
                      ? "Cập nhật thông tin, màu sắc và biểu tượng của danh mục."
                      : `Cập nhật thông tin cho “${editingCategory.name}”.`
                    : isDesktop
                      ? "Tạo danh mục mới để sử dụng trong nhóm này."
                      : "Tạo danh mục mới trong nhóm này."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
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
              isMobile={isMobile}
              isDesktop={isDesktop}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
              onSubmit={(form) => submit(form, editingCategory?.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Tree list */}
      <div>
        {rootCategories.length === 0 ? (
          <Empty
            icon={Tag}
            title={`Chưa có danh mục ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`}
            description="Nhập từ bộ mẫu cá nhân hoặc tạo danh mục mới cho nhóm."
          />
        ) : (
          rootCategories.map((category, index) => (
            <CategoryNode
              key={category.id}
              category={category}
              categories={currentCategories}
              index={index}
              totalRoots={rootCategories.length}
              pending={pending}
              isMobile={isMobile}
              isDesktop={isDesktop}
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
              onPointerDrop={handlePointerDrop}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function WorkspaceCategoryActionsMenu({
  category,
  childCount,
  pending,
  isMobile,
  isDesktop,
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
  isDesktop: boolean;
  trigger: ReactElement<{ className?: string }>;
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

  if (isDesktop) {
    return (
      <div className="group/category-actions relative">
        {cloneElement(trigger, undefined, children)}
        <WorkspaceDesktopCategoryActions
          category={category}
          childCount={childCount}
          pending={pending}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
        />
      </div>
    );
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
            <DropdownMenuTrigger nativeButton={false} render={spotlightTrigger}>
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
            className="ledger-mobile-review-sheet pending-delete"
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
              <Button
                variant="outline"
                className="ledger-mobile-review-reject"
                data-delete
                disabled={pending}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Hủy
              </Button>
              <Button
                variant="outline"
                className="ledger-mobile-review-approve"
                data-delete
                disabled={pending}
                onClick={deleteAction}
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
                <Trash2 />
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
                onClick={deleteAction}
              >
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

function WorkspaceDesktopCategoryActions({
  category,
  childCount,
  pending,
  onEdit,
  onStatus,
  onDelete,
}: {
  category: Category;
  childCount: number;
  pending: boolean;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: "active" | "deactive") => void;
  onDelete: (id: string) => void;
}) {
  const isActive = category.status === "active";

  return (
    <div
      className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-2 opacity-0 transition-opacity group-hover/category-actions:opacity-100 group-focus-within/category-actions:opacity-100 min-[901px]:flex"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        variant="icon"
        size="icon"
        type="button"
        aria-label={`Chỉnh sửa ${category.name}`}
        disabled={pending}
        onClick={() => onEdit(category.id)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        variant="icon"
        size="icon"
        type="button"
        aria-label={`${isActive ? "Tắt" : "Bật"} danh mục ${category.name}`}
        disabled={pending}
        onClick={() => onStatus(category.id, isActive ? "deactive" : "active")}
      >
        {isActive ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
      <ConfirmDelete
        ariaLabel={`Xóa danh mục ${category.name}`}
        title="Xóa danh mục?"
        description={
          childCount > 0
            ? `Danh mục “${category.name}” và ${childCount} danh mục con sẽ bị xóa vĩnh viễn.`
            : `Danh mục “${category.name}” sẽ bị xóa và không thể khôi phục.`
        }
        confirmLabel="Xóa danh mục"
        disabled={pending}
        onConfirm={() => onDelete(category.id)}
        trigger={
          <Button
            variant="destructiveIcon"
            size="icon"
            type="button"
            aria-label={`Xóa danh mục ${category.name}`}
            disabled={pending}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        }
      />
    </div>
  );
}

function CategoryNode({
  category,
  categories,
  index,
  totalRoots,
  pending,
  isMobile,
  isDesktop,
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
}: {
  category: Category;
  categories: Category[];
  index: number;
  totalRoots: number;
  pending: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  draggedCategory: DraggedCategory | null;
  dropTargetId: string | null;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: "active" | "deactive") => void;
  onDelete: (id: string) => void;
  onDragStart: (category: DraggedCategory) => void;
  onDragOver: (categoryId: string | null) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLElement>, category: Category) => void;
  onPointerDrop: (source: CategoryDragItem, targetId: string) => void;
}) {
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const children = categories.filter((item) => item.parentId === category.id);
  const isChild = category.parentId !== null;
  const hasChildren = children.length > 0;

  // Root category = mini-card
  if (!isChild) {
    return (
      <div className="mt-1 rounded-xl bg-[var(--surface)] transition-all duration-200">
        <WorkspaceCategoryActionsMenu
          category={category}
          childCount={children.length}
          pending={pending}
          isMobile={isMobile}
          isDesktop={isDesktop}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
          trigger={
            <div
              className={cn(
                "group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-3 transition-opacity min-[901px]:cursor-grab min-[901px]:pr-32 min-[901px]:active:cursor-grabbing",
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
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  onDragOver(null);
              }}
              onDrop={(event) => onDrop(event, category)}
            />
          }
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden min-[901px]:inline-flex">
              <CategoryMobileDragHandle
                category={category}
                disabled={pending}
                isMobile={false}
                size={17}
                onDragStart={onDragStart}
                onDragTargetChange={onDragOver}
                onDrop={onPointerDrop}
                onDragCancel={onDragEnd}
              />
            </span>
            <span
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
              style={{
                backgroundColor: `${category.color}18`,
                color: category.color,
                ...(!isDesktop && {
                  boxShadow: `inset 0 0 0 1px ${category.color}25, 0 2px 8px -2px ${category.color}15`,
                }),
              }}
            >
              <IconComponent size={20} />
            </span>

            <div className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-[var(--foreground)]">
                {category.name}
              </strong>
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

          <div className="flex shrink-0 items-center gap-3 min-[901px]:hidden">
            {isMobile && (
              <span className="category-mobile-item-hint">Chạm để quản lý</span>
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
        </WorkspaceCategoryActionsMenu>

        {/* Children — tree branch from parent */}
        {hasChildren && (
          <div className="relative ml-2 min-[901px]:ml-7">
            {children.map((child, childIdx) => (
              <CategoryNode
                key={child.id}
                category={child}
                categories={categories}
                index={childIdx}
                totalRoots={children.length}
                pending={pending}
                isMobile={isMobile}
                isDesktop={isDesktop}
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
      childCount={0}
      pending={pending}
      isMobile={isMobile}
      isDesktop={isDesktop}
      onEdit={onEdit}
      onStatus={onStatus}
      onDelete={onDelete}
      trigger={
        <article
          className={cn(
            "group relative flex cursor-pointer items-center justify-between gap-3 rounded-xl py-2 pl-9 pr-1 transition-[background-color,opacity] min-[901px]:cursor-grab min-[901px]:pl-1 min-[901px]:pr-32 min-[901px]:active:cursor-grabbing",
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
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              onDragOver(null);
          }}
          onDrop={(event) => onDrop(event, category)}
        />
      }
    >
      {/* Vertical line: top half (always) */}
      <div className="absolute left-3.5 top-0 h-1/2 w-px bg-[var(--border)] min-[901px]:hidden" />
      {/* Vertical line: bottom half (not on last child) */}
      {index < totalRoots - 1 && (
        <div className="absolute left-3.5 top-1/2 bottom-0 w-px bg-[var(--border)] min-[901px]:hidden" />
      )}
      {/* Horizontal branch line */}
      <div className="absolute left-3.5 top-1/2 h-px w-5 bg-[var(--border)] min-[901px]:hidden" />

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="hidden min-[901px]:inline-flex">
          <CategoryMobileDragHandle
            category={category}
            disabled={pending}
            isMobile={false}
            size={15}
            onDragStart={onDragStart}
            onDragTargetChange={onDragOver}
            onDrop={onPointerDrop}
            onDragCancel={onDragEnd}
          />
        </span>
        <span
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: `${category.color}12`,
            color: category.color,
          }}
        >
          <IconComponent size={13} />
        </span>

        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[12.5px] font-medium text-[var(--foreground)]/90 truncate">
            {category.name}
          </span>
          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium flex-shrink-0">
            {category.transactionCount} giao dịch
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 min-[901px]:hidden">
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
    </WorkspaceCategoryActionsMenu>
  );
}

function CategoryForm({
  defaultType,
  categories,
  category,
  pending,
  isMobile,
  isDesktop,
  onCancel,
  onSubmit,
}: {
  defaultType: "income" | "expense";
  categories: Category[];
  category?: Category;
  pending: boolean;
  isMobile: boolean;
  isDesktop: boolean;
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
          isDesktop &&
            "grid grid-cols-[minmax(0,1fr)_16rem] content-start items-start gap-x-8 px-8 pt-6 pb-8",
        )}
      >
        <div className="contents min-[901px]:block min-[901px]:space-y-5">
          <div className="hidden min-[901px]:block">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Thông tin danh mục
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Đặt tên, chọn cấp và màu đại diện cho danh mục.
            </p>
          </div>

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

          <div className="grid gap-1">
            <Label>Màu đại diện</Label>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {CATEGORY_COLOR_PRESETS.map((color) => (
                <Button
                  variant="unstyled"
                  size="auto"
                  key={color}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-transform min-[901px]:shadow-none ${
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
        </div>

        <div className="contents min-[901px]:block min-[901px]:space-y-5">
          <div className="hidden min-[901px]:block">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Biểu tượng
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Chọn biểu tượng giúp danh mục dễ nhận biết khi sử dụng.
            </p>
          </div>

          <div className="grid gap-1">
            <Label>Chọn Biểu tượng</Label>
            <div className="category-icon-picker grid max-h-48 grid-cols-4 gap-2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 min-[901px]:max-h-[22rem]">
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
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-bold min-[901px]:shadow-none"
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
      </div>

      <div
        className={cn(
          "mt-auto flex justify-end gap-2 border-t px-4 py-3 sm:px-6",
          isMobile && "quick-transaction-footer",
          isDesktop && "px-8 py-5",
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
