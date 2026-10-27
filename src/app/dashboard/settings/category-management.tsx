"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  FolderTree,
  Pencil,
  PiggyBank,
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
} from "@/app/dashboard/settings/category-options";
import {
  Button,
  Card,
  CategoryTreeSelect,
  ConfirmDelete,
  Empty,
  Input,
  Label,
  Select,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  Tabs,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/base";
import { cn } from "@/lib/utils";
import {
  FINANCIAL_JAR_LABELS,
  FINANCIAL_JAR_OPTIONS,
  type FinancialJarCode,
} from "@/domain";
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
  jarCode: FinancialJarCode | null;
  status: "active" | "deactive";
  transactionCount: number;
};

type DraggedCategory = Pick<Category, "id" | "parentId">;

type CategoryGroup = {
  key: FinancialJarCode | "UNASSIGNED";
  label: string;
  categories: Category[];
};

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
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
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
      jarCode: (form.get("jarCode") as FinancialJarCode) || undefined,
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
            ? "Đã bật danh mục."
            : "Đã tắt danh mục.",
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
        toast.success("Đã xóa danh mục.");
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
  const categoryGroups: CategoryGroup[] =
    filterType === "expense"
      ? [
          ...FINANCIAL_JAR_OPTIONS.map(({ value, label }) => ({
            key: value,
            label,
            categories: rootCategories.filter(
              (category) => category.jarCode === value,
            ),
          })),
          {
            key: "UNASSIGNED" as const,
            label: "Chưa gán hũ",
            categories: rootCategories.filter((category) => !category.jarCode),
          },
        ].filter((group) => group.categories.length > 0)
      : [];
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
      className="gap-4 md:gap-5"
      aria-busy={pending}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 md:items-start">
        <div className="flex min-w-0 items-center gap-2.5 md:items-start md:gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] md:size-9">
            <FolderTree size={17} />
          </div>
          <div className="min-w-0">
            <p className="hidden text-xs font-semibold text-[var(--primary)] md:block">
              Danh mục thu chi
            </p>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)] md:mt-0.5 md:text-base">
              Quản lý danh mục
            </h2>
            <p className="mt-0.5 hidden text-xs leading-relaxed text-[var(--text-secondary)] md:block">
              Quản lý và sắp xếp các danh mục thu chi của nhóm.
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="icon"
          className="shrink-0"
          aria-label="Thêm danh mục"
          title="Thêm danh mục"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          disabled={pending}
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* Tabs: Chi tiêu & Thu nhập */}
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:border-t md:border-[var(--border)] md:pt-4">
        <Tabs
          value={filterType}
          className="w-full md:max-w-sm"
          onValueChange={(value) => {
            setFilterType(value as "expense" | "income");
            setCreating(false);
            setEditing(null);
          }}
        >
          <TabsList
            variant="segmented"
            className="w-full"
            aria-label="Loại danh mục"
          >
            <TabsTrigger tone="expense" value="expense">
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span>Chi tiêu</span>
              <TabsCount className="bg-[color-mix(in_srgb,var(--expense)_14%,var(--surface))] text-[var(--expense)]">
                {categories.filter((c) => c.type === "expense").length}
              </TabsCount>
            </TabsTrigger>
            <TabsTrigger tone="income" value="income">
              <ArrowDownLeft size={14} strokeWidth={2.5} />
              <span>Thu nhập</span>
              <TabsCount className="bg-[color-mix(in_srgb,var(--income)_14%,var(--surface))] text-[var(--income)]">
                {categories.filter((c) => c.type === "income").length}
              </TabsCount>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="hidden text-xs text-[var(--text-muted)] md:block">
          <span className="hidden lg:inline">
            Kéo thả để sắp xếp thứ tự
          </span>
          <span className="lg:hidden">
            Chạm để sửa hoặc giữ kéo để sắp xếp
          </span>
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
          placement="inset"
          size={isDesktop ? "wide" : "default"}
          spacing="flush"
          elevation="flat"
        >
          <SheetHeader
            icon={FolderTree}
            title={
              editingCategory
                ? "Chỉnh sửa danh mục"
                : `Thêm danh mục ${filterType === "expense" ? "chi tiêu" : "thu nhập"}`
            }
            description={
              editingCategory
                ? "Cập nhật thông tin, màu sắc và biểu tượng của danh mục."
                : "Tạo danh mục thu chi mới cho nhóm."
            }
          />
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
              hasChildren={Boolean(
                editingCategory &&
                  categories.some((item) => item.parentId === editingCategory.id),
              )}
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
            description="Tạo danh mục thu chi mới cho nhóm."
          />
        ) : filterType === "expense" ? (
          <div className="space-y-5">
            {categoryGroups.map((group) => {
              const groupId = `category-jar-${group.key.toLowerCase()}`;
              const categoryCount = group.categories.reduce(
                (total, category) =>
                  total +
                  1 +
                  currentCategories.filter(
                    (item) => item.parentId === category.id,
                  ).length,
                0,
              );

              return (
                <section key={group.key} aria-labelledby={groupId} className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                    <PiggyBank
                      size={16}
                      className="text-[var(--primary)]"
                      aria-hidden="true"
                    />
                    <h3
                      id={groupId}
                      className="text-xs font-semibold text-[var(--foreground)]"
                    >
                      {group.label}
                    </h3>
                    <span className="ml-auto rounded-md bg-[var(--surface-secondary)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">
                      {categoryCount} danh mục
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.categories.map((category) => (
                      <CategoryNode
                        key={category.id}
                        category={category}
                        categories={currentCategories}
                        pending={pending}
                        isMobile={isMobile}
                        isDesktop={isDesktop}
                        showJarLabel={false}
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
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {rootCategories.map((category) => (
              <CategoryNode
                key={category.id}
                category={category}
                categories={currentCategories}
                pending={pending}
                isMobile={isMobile}
                isDesktop={isDesktop}
                showJarLabel
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
            ))}
          </div>
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
          className="w-52 p-1.5 [&_[data-slot=dropdown-menu-item]]:min-h-10 [&_[data-slot=dropdown-menu-item]]:gap-2 [&_[data-slot=dropdown-menu-item]]:px-2.5"
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
          <SheetContent side="bottom" spacing="flush" elevation="flat">
            <SheetHeader
              icon={Trash2}
              title="Xóa danh mục?"
              description={
                childCount > 0
                  ? `Danh mục "${category.name}" và ${childCount} danh mục con sẽ bị xóa, không thể hoàn tác.`
                  : "Hành động này không thể hoàn tác."
              }
            />
            <div className="p-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                    {category.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {category.transactionCount} giao dịch
                    {childCount > 0 && ` · ${childCount} danh mục con`}
                  </p>
                </div>
                <strong
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: category.color }}
                >
                  {category.type === "expense" ? "Chi tiêu" : "Thu nhập"}
                </strong>
              </div>
            </div>
            <SheetFooter
              onCancel={() => setDeleteConfirmOpen(false)}
              cancelLabel="Hủy"
              cancelDisabled={pending}
              onSubmit={deleteAction}
              submitLabel="Xóa danh mục"
              submitVariant="destructive"
              submitType="button"
              isSubmitting={pending}
            />
          </SheetContent>
        </Sheet>
      ) : (
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger)]">
                <Trash2 />
              </AlertDialogMedia>
              <AlertDialogTitle>Xóa danh mục?</AlertDialogTitle>
              <AlertDialogDescription>
                {childCount > 0
                  ? `Danh mục "${category.name}" và ${childCount} danh mục con sẽ bị xóa, không thể hoàn tác.`
                  : `Danh mục “${category.name}” sẽ bị xóa và không thể khôi phục.`}
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
      className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 opacity-0 transition-opacity group-hover/category-actions:opacity-100 group-focus-within/category-actions:opacity-100 lg:flex"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        variant="icon"
        size="icon"
        type="button"
        title={`Chỉnh sửa ${category.name}`}
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
        title={`${isActive ? "Tắt" : "Bật"} danh mục ${category.name}`}
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
            title={`Xóa danh mục ${category.name}`}
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
  pending,
  isMobile,
  isDesktop,
  showJarLabel,
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
  pending: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  showJarLabel: boolean;
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

  // Root category
  if (!isChild) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors">
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
                "group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)] md:px-3.5 md:py-3 lg:cursor-grab lg:pr-32 lg:active:cursor-grabbing",
                category.status === "deactive" && "opacity-50",
                draggedCategory?.id === category.id && "opacity-50",
                dropTargetId === category.id && "ring-2 ring-[var(--primary)]",
              )}
              data-category-sort-id={category.id}
              data-category-sort-parent="root"
              draggable={!pending && isDesktop}
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
            <span className="inline-flex">
              <CategoryMobileDragHandle
                category={category}
                disabled={pending}
                isMobile={!isDesktop}
                size={17}
                onDragStart={onDragStart}
                onDragTargetChange={onDragOver}
                onDrop={onPointerDrop}
                onDragCancel={onDragEnd}
              />
            </span>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl"
              style={{
                backgroundColor: `${category.color}18`,
                color: category.color,
              }}
            >
              <IconComponent size={18} />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="break-words text-sm font-semibold leading-snug text-[var(--foreground)]">
                  {category.name}
                </strong>
                {category.status === "deactive" && (
                  <span className="rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                    Đã tắt
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {category.transactionCount} giao dịch
                {hasChildren && (
                  <span className="ml-1 text-[var(--text-muted)]">
                    · {children.length} danh mục con
                  </span>
                )}
              </p>
              {showJarLabel && category.jarCode && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                  <PiggyBank size={12} aria-hidden="true" />
                  {FINANCIAL_JAR_LABELS[category.jarCode]}
                </span>
              )}
            </div>
          </div>
        </WorkspaceCategoryActionsMenu>

        {/* Children — cleanly indented tree branch from parent */}
        {hasChildren && (
          <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)]/35 px-3 py-2 md:px-4">
            <div className="ml-3 space-y-1 border-l border-[var(--border-strong)] pl-3 md:ml-5 md:pl-4">
              {children.map((child) => (
                <CategoryNode
                  key={child.id}
                  category={child}
                  categories={categories}
                  pending={pending}
                  isMobile={isMobile}
                  isDesktop={isDesktop}
                  showJarLabel={showJarLabel}
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
          </div>
        )}
      </div>
    );
  }

  // Child category — compact row with clean indentation
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
            "group relative flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface)] lg:cursor-grab lg:pr-32 lg:active:cursor-grabbing",
            category.status === "deactive" && "opacity-50",
            draggedCategory?.id === category.id && "opacity-50",
            dropTargetId === category.id && "ring-2 ring-[var(--primary)]",
          )}
          data-category-sort-id={category.id}
          data-category-sort-parent={category.parentId ?? "root"}
          draggable={!pending && isDesktop}
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
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex">
          <CategoryMobileDragHandle
            category={category}
            disabled={pending}
            isMobile={!isDesktop}
            size={15}
            onDragStart={onDragStart}
            onDragTargetChange={onDragOver}
            onDrop={onPointerDrop}
            onDragCancel={onDragEnd}
          />
        </span>
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg"
          style={{
            backgroundColor: `${category.color}16`,
            color: category.color,
          }}
        >
          <IconComponent size={14} />
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="break-words text-xs font-medium leading-snug text-[var(--foreground)] md:text-sm">
            {category.name}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
            · {category.transactionCount} giao dịch
          </span>
          {showJarLabel && category.jarCode && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <PiggyBank size={11} aria-hidden="true" />
              {FINANCIAL_JAR_LABELS[category.jarCode]}
            </span>
          )}
        </div>
      </div>
    </WorkspaceCategoryActionsMenu>
  );
}

function CategoryForm({
  defaultType,
  categories,
  category,
  hasChildren = false,
  pending,
  isDesktop,
  onCancel,
  onSubmit,
}: {
  defaultType: "income" | "expense";
  categories: Category[];
  category?: Category;
  hasChildren?: boolean;
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
  const [parentId, setParentId] = useState(category?.parentId ?? "none");
  const [selectedJarCode, setSelectedJarCode] = useState<FinancialJarCode | "">(
    category?.jarCode ?? "",
  );
  const categoryType = category?.type ?? defaultType;
  const inheritedJarCode =
    parentId === "none"
      ? null
      : (categories.find((item) => item.id === parentId)?.jarCode ?? null);

  function handleNameChange(val: string) {
    setName(val);
    if (!category) {
      const slug = slugifyCode(val);
      if (slug) {
        setCode(slug);
      } else if (val.trim().length > 0) {
        const hex = Array.from(val.trim())
          .map((c) => c.codePointAt(0)?.toString(16).toUpperCase() ?? "")
          .join("")
          .slice(0, 12);
        setCode(`DANH_MUC_${hex}`);
      } else {
        setCode("");
      }
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-transparent"
    >
      <input type="hidden" name="type" value={category?.type ?? defaultType} />
      <input type="hidden" name="code" value={code} />

      <div
        className={cn(
          "flex flex-1 flex-col gap-3.5 overflow-y-auto p-4 md:gap-4 md:p-5",
          isDesktop &&
            "lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:content-start lg:items-start lg:gap-x-6 lg:p-6",
        )}
      >
        <div className="contents lg:block lg:space-y-4">
          <div className="hidden lg:block">
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
              value={parentId}
              disabled={hasChildren}
              onValueChange={(newParentId) => {
                if (hasChildren) return;
                setParentId(newParentId);
                if (newParentId !== "none") {
                  const selectedParent = categories.find(
                    (item) => item.id === newParentId,
                  );
                  if (selectedParent?.jarCode) {
                    setSelectedJarCode(selectedParent.jarCode);
                  }
                }
              }}
              label="Danh mục cha"
              emptyOption={{ value: "none", label: "Không chọn (Danh mục cha)" }}
              categories={categories.filter(
                (item) =>
                  item.status === "active" &&
                  item.type === (category?.type ?? defaultType) &&
                  (!category || item.id !== category.id) &&
                  !item.parentId,
              )}
            />
            {hasChildren && (
              <>
                <input type="hidden" name="parentId" value="none" />
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  Danh mục đang có danh mục con nên luôn giữ ở cấp danh mục gốc.
                </p>
              </>
            )}
          </div>

          {categoryType === "expense" &&
            (parentId === "none" ? (
              <div>
                <Select
                  name="jarCode"
                  value={selectedJarCode || undefined}
                  onValueChange={(value) =>
                    setSelectedJarCode(value as FinancialJarCode)
                  }
                  label="Hũ tài chính"
                  placeholder="Chọn hũ tài chính"
                  options={FINANCIAL_JAR_OPTIONS}
                  required
                />
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  Chi tiêu thuộc danh mục này sẽ tính vào hũ đã chọn.
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Hũ tài chính</Label>
                <div
                  className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-sm text-[var(--foreground)]"
                  aria-label={`Kế thừa hũ ${inheritedJarCode ? FINANCIAL_JAR_LABELS[inheritedJarCode] : "chưa xác định"} từ danh mục cha`}
                >
                  <PiggyBank
                    size={15}
                    className="text-[var(--text-secondary)]"
                    aria-hidden="true"
                  />
                  <span>
                    {inheritedJarCode
                      ? FINANCIAL_JAR_LABELS[inheritedJarCode]
                      : "Chưa xác định"}
                  </span>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">
                    Kế thừa từ danh mục cha
                  </span>
                </div>
              </div>
            ))}

          <div className="grid gap-1.5">
            <Label>Màu đại diện</Label>
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORY_COLOR_PRESETS.map((color) => (
                <Button
                  variant="unstyled"
                  size="auto"
                  key={color}
                  type="button"
                  aria-label={`Chọn màu ${color}`}
                  className={`size-7 rounded-full border-2 transition-transform cursor-pointer ${
                    selectedColor === color
                      ? "scale-110 border-[var(--surface)] ring-2 ring-[var(--primary)]"
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

        <div className="contents lg:block lg:space-y-4">
          <div className="hidden lg:block">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Biểu tượng
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Chọn biểu tượng giúp danh mục dễ nhận biết khi sử dụng.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Chọn biểu tượng</Label>
            <div className="grid max-h-36 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 md:max-h-48 lg:max-h-[22rem]">
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
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                        : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <IconComp size={18} />
                    <span className="max-w-full break-words text-center text-[10px] leading-snug">
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

      <SheetFooter
        onCancel={onCancel}
        cancelLabel="Hủy"
        submitLabel="Lưu danh mục"
        isSubmitting={pending}
        submittingLabel="Đang xử lý..."
        submitType="submit"
      />
    </form>
  );
}
