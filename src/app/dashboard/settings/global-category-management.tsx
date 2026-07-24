"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  Search,

  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wrench,
  X,
  AlertCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  createTemplateCategoryAction,
  reorderTemplateCategoriesAction,
  setTemplateCategoryStatusAction,
  updateTemplateCategoryAction,
} from "@/app/dashboard/settings/general-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";

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

export const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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

export function UserCategoryTemplateManagement({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState<"expense" | "income">("expense");
  const [pending, start] = useTransition();

  function submit(form: FormData, categoryId?: string) {
    const category = {
      name: String(form.get("name") ?? ""),
      code: String(form.get("code") ?? ""),
      color: String(form.get("color") ?? COLOR_PRESETS[0]),
      type: String(form.get("type") ?? "expense") as "income" | "expense",
      icon: String(form.get("icon") ?? "tag"),
      parentId: form.get("parentId") === "none" ? undefined : (form.get("parentId") as string) || undefined,

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

  function moveRootItem(index: number, direction: "up" | "down") {
    const newRoots = [...rootCategories];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRoots.length) return;
    const [moved] = newRoots.splice(index, 1);
    newRoots.splice(targetIndex, 0, moved);

    // Flatten all items preserving new root order
    const allOrdered: Category[] = [];
    newRoots.forEach((root) => {
      allOrdered.push(root);
      allOrdered.push(...categories.filter((c) => c.parentId === root.id));
    });
    // Add other type items
    const otherTypeItems = categories.filter((c) => c.type !== filterType);
    handleReorder([...allOrdered, ...otherTypeItems]);
  }

  function moveChildItem(parentId: string, index: number, direction: "up" | "down") {
    const siblings = currentCategories.filter((c) => c.parentId === parentId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const [moved] = siblings.splice(index, 1);
    siblings.splice(targetIndex, 0, moved);

    const allOrdered: Category[] = [];
    rootCategories.forEach((root) => {
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
    <section className="sunrise-card p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--border)]">
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
          size="sm"
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
      <div className="mt-5 flex items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
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
            }}
          >
            <ArrowDownLeft size={13} />
            <span>Thu nhập ({categories.filter((c) => c.type === "income").length})</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 font-medium hidden sm:block">
          Dùng mũi tên <ChevronUp size={12} className="inline" /> <ChevronDown size={12} className="inline" /> để thay đổi thứ tự danh mục
        </p>
      </div>

      <Sheet open={creating || editing !== null} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); } }}>
        <SheetContent side="right" className="sm:max-w-md w-full flex flex-col h-full p-0 bg-[var(--surface)] text-[var(--foreground)] border-l border-[var(--border)]">
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
          <div className="flex-1 overflow-y-auto px-6">
            <TemplateForm
              key={editing ?? "create"}
              defaultType={editing ? (categories.find((c) => c.id === editing)?.type ?? filterType) : filterType}
              categories={
                editing
                  ? categories.filter((item) => item.id !== editing)
                  : categories
              }
              category={editing ? categories.find((c) => c.id === editing) : undefined}
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
      <div className="mt-5 space-y-2">
        {rootCategories.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-xl">
            <Tag size={28} className="mx-auto text-slate-400 opacity-60 mb-2" />
            <p className="text-sm font-medium text-slate-500">Chưa có danh mục mẫu {filterType === "expense" ? "Chi tiêu" : "Thu nhập"}</p>
            <p className="text-xs text-slate-400 mt-1">Tạo danh mục mới để sử dụng và import vào workspace</p>
          </div>
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
              onEdit={setEditing}
              onStatus={status}
              onMoveRoot={moveRootItem}
              onMoveChild={moveChildItem}
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
  index,
  totalRoots,
  editing,
  pending,
  onEdit,
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
  editing: string | null;
  pending: boolean;
  onEdit: (id: string) => void;
  onStatus: (id: string, value: "active" | "deactive") => void;
  onMoveRoot: (index: number, dir: "up" | "down") => void;
  onMoveChild: (parentId: string, index: number, dir: "up" | "down") => void;
  onSubmit: (form: FormData, id?: string) => void;
  onCancel: () => void;
}) {
  const children = categories.filter((item) => item.parentId === category.id);
  const IconComponent = ICON_MAP[category.icon ?? "tag"] ?? Tag;
  const isIncome = category.type === "income";

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

          <span
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl font-bold transition-transform group-hover:scale-105 shadow-inner"
            style={{
              backgroundColor: `${category.color}18`,
              color: category.color,
              border: `1px solid ${category.color}33`,
            }}
          >
            <IconComponent size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-semibold text-[var(--foreground)] truncate">
                {category.name}
              </strong>
              <span className="px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[10px] font-mono text-slate-500 font-bold border border-[var(--border)]">
                {category.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  category.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span>{category.status === "active" ? "Hoạt động" : "Đã tắt"}</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline" size="icon-sm" className="!min-h-[34px] !min-w-[34px] !p-1.5"
            onClick={() => onEdit(category.id)}
            disabled={pending}
            title="Chỉnh sửa danh mục mẫu"
            aria-label={`Chỉnh sửa ${category.name}`}
          >
            <Pencil size={15} />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(
              "!min-h-[34px] !min-w-[34px] !p-1.5",
              category.status === "active" ? "hover:text-rose-500" : "hover:text-emerald-500"
            )}
            onClick={() =>
              onStatus(category.id, category.status === "active" ? "deactive" : "active")
            }
            disabled={pending}
            title={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
            aria-label={category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
          >
            {category.status === "active" ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>

        </div>
      </article>



      {/* Children Tree Nodes */}
      {children.map((child, childIdx) => (
        <Node
          key={child.id}
          category={child}
          categories={categories}
          index={childIdx}
          totalRoots={children.length}
          editing={editing}
          pending={pending}
          onEdit={onEdit}
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

function CategoryCombobox({
  name,
  defaultValue,
  categories,
  placeholder = "Chọn danh mục...",
  searchPlaceholder = "Tìm kiếm danh mục...",
  emptyMessage = "Không tìm thấy danh mục nào.",
}: {
  name: string;
  defaultValue: string;
  categories: Category[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [search, setSearch] = useState("");

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCategory = categories.find((c) => c.id === value);
  const triggerText = selectedCategory
    ? `${selectedCategory.name} (${selectedCategory.code})`
    : "Không có (Danh mục gốc)";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} />
      <PopoverTrigger
        type="button"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between flex h-8 px-2.5 py-1 text-sm bg-transparent border border-input text-[var(--foreground)] rounded-lg transition-colors outline-none select-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 text-left items-center cursor-pointer hover:bg-[var(--surface-hover)]"
      >
        <span className="truncate">{triggerText}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>

      <PopoverContent className="w-[var(--anchor-width)] min-w-[240px] p-1 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] shadow-md rounded-lg z-50">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-1.5 bg-transparent">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs border-0 outline-none focus:outline-none focus:ring-0 p-0 text-[var(--foreground)] placeholder:text-muted-foreground no-focus-style"
          />
        </div>

        <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
          <button
            type="button"
            onClick={() => {
              setValue("none");
              setOpen(false);
              setSearch("");
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-colors cursor-pointer",
              value === "none"
                ? "bg-[var(--surface-secondary)] text-[var(--foreground)] font-semibold"
                : "hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
            )}
          >
            <span>Không có (Danh mục gốc)</span>
            {value === "none" && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
          </button>
          
          {filteredCategories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setValue(item.id);
                setOpen(false);
                setSearch("");
              }}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-colors cursor-pointer",
                value === item.id
                  ? "bg-[var(--surface-secondary)] text-[var(--foreground)] font-semibold"
                  : "hover:bg-[var(--surface-hover)] text-[var(--foreground)]"
              )}
            >
              <span className="truncate">{item.name} ({item.code})</span>
              {value === item.id && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
            </button>
          ))}

          {filteredCategories.length === 0 && search !== "" && (
            <div className="py-6 text-center text-xs text-muted-foreground">{emptyMessage}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
  const [selectedColor, setSelectedColor] = useState((category?.color ?? COLOR_PRESETS[0]).toUpperCase());
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
          <CategoryCombobox
            name="parentId"
            defaultValue={category?.parentId ?? "none"}
            categories={categories.filter(
              (item) =>
                item.status === "active" &&
                item.type === (category?.type ?? defaultType) &&
                (!category || item.id !== category.id)
            )}
          />
        </div>



        {/* Color Picker */}
        <div>
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
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
            Chọn Biểu tượng (Icon)
          </label>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
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

      <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)] mt-auto">
        <Button type="button" variant="outline" onClick={onCancel}>
          Hủy bỏ
        </Button>
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? "Đang xử lý..." : "Lưu danh mục"}
        </Button>
      </div>
    </form>

  );
}

