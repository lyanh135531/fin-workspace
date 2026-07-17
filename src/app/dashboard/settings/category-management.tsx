"use client";

import { useMemo, useState, useTransition } from "react";
import { BriefcaseBusiness, Car, CircleDollarSign, Heart, House, Pencil, Plus, ShoppingCart, Tag } from "lucide-react";
import { createCategoryAction, setCategoryStatusAction, updateCategoryAction } from "@/app/dashboard/settings/category-actions";

type Category = { id: string; name: string; code: string; color: string; type: "income" | "expense"; icon: string | null; parentId: string | null; system: boolean; status: "active" | "deactive"; transactionCount: number };
const icons = { tag: Tag, house: House, car: Car, shopping: ShoppingCart, heart: Heart, work: BriefcaseBusiness, money: CircleDollarSign };
type IconName = keyof typeof icons;
function iconName(value: string | null): IconName { return value && value in icons ? value as IconName : "tag"; }

export function CategoryManagement({ categories, isAdmin }: { categories: Category[]; isAdmin: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();
  const workspaceCategories = useMemo(() => categories.filter((item) => !item.system), [categories]);
  function submit(form: FormData, id?: string) {
    start(async () => {
      const input = { name: form.get("name"), code: form.get("code"), color: form.get("color"), type: form.get("type"), icon: form.get("icon"), parentId: form.get("parentId") || undefined, sortOrder: form.get("sortOrder") };
      const result = id ? await updateCategoryAction({ ...input, categoryId: id }) : await createCategoryAction(input);
      setMessage(result.ok ? (id ? "Đã cập nhật danh mục." : "Đã tạo danh mục.") : result.message);
      if (result.ok) { setEditing(null); setCreating(false); }
    });
  }
  function setStatus(id: string, status: "active" | "deactive") { start(async () => { const result = await setCategoryStatusAction(id, status); setMessage(result.ok ? (status === "active" ? "Đã kích hoạt danh mục." : "Đã vô hiệu hóa danh mục.") : result.message); }); }
  const roots = categories.filter((item) => !item.parentId);
  return <section className="sunrise-card mt-4 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Danh mục</p><h2 className="mt-1 text-xl font-semibold">Quản lý danh mục</h2><p className="mt-1 text-sm text-slate-500">Danh mục hệ thống dùng chung; danh mục riêng chỉ áp dụng cho workspace này.</p></div>{isAdmin && <button className="button-primary inline-flex items-center gap-2" onClick={() => { setCreating(true); setEditing(null); }} disabled={pending}><Plus size={17} />Thêm danh mục</button>}</div>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    {isAdmin && creating && <CategoryForm title="Thêm danh mục riêng cho workspace này" categories={workspaceCategories} pending={pending} onCancel={() => setCreating(false)} onSubmit={submit} />}
    <div className="mt-5 space-y-2">{roots.map((category) => <CategoryNode key={category.id} category={category} categories={categories} isAdmin={isAdmin} pending={pending} editing={editing} onEdit={setEditing} onStatus={setStatus} onSubmit={submit} onCancel={() => setEditing(null)} />)}{roots.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Chưa có danh mục.</p>}</div>
    {!isAdmin && <p className="mt-4 text-sm text-slate-500">Bạn có thể xem các danh mục đang áp dụng trong workspace.</p>}
  </section>;
}
function CategoryNode({ category, categories, isAdmin, pending, editing, onEdit, onStatus, onSubmit, onCancel }: { category: Category; categories: Category[]; isAdmin: boolean; pending: boolean; editing: string | null; onEdit: (id: string) => void; onStatus: (id: string, status: "active" | "deactive") => void; onSubmit: (form: FormData, id?: string) => void; onCancel: () => void }) {
  const Icon = icons[iconName(category.icon)]; const children = categories.filter((item) => item.parentId === category.id);
  return <div className={category.parentId ? "ml-5 border-l border-[var(--border)] pl-3" : ""}>
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${category.color}22`, color: category.color }}><Icon size={18} /></span><div className="min-w-0"><p className="truncate font-medium">{category.name} <span className="ml-1 text-xs font-normal text-slate-500">{category.code}</span></p><p className="text-xs text-slate-500">{category.system ? "Hệ thống · dùng chung · chỉ đọc" : "Riêng workspace này"} · {category.type === "income" ? "Thu" : "Chi"} · {category.status === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"} · {category.transactionCount} giao dịch</p></div></div>{isAdmin && !category.system && <div className="flex shrink-0 gap-2"><button className="button-secondary icon-button" title="Chỉnh sửa" aria-label={`Chỉnh sửa ${category.name}`} onClick={() => onEdit(category.id)} disabled={pending}><Pencil size={16} /></button><button className="button-secondary text-xs" onClick={() => onStatus(category.id, category.status === "active" ? "deactive" : "active")} disabled={pending}>{category.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}</button></div>}</div>
    {editing === category.id && <CategoryForm title={`Chỉnh sửa: ${category.name}`} categories={categories.filter((item) => !item.system && item.id !== category.id)} category={category} pending={pending} onCancel={onCancel} onSubmit={(form) => onSubmit(form, category.id)} />}
    {children.map((child) => <CategoryNode key={child.id} category={child} categories={categories} isAdmin={isAdmin} pending={pending} editing={editing} onEdit={onEdit} onStatus={onStatus} onSubmit={onSubmit} onCancel={onCancel} />)}
  </div>;
}
function CategoryForm({ title, categories, category, pending, onCancel, onSubmit }: { title: string; categories: Category[]; category?: Category; pending: boolean; onCancel: () => void; onSubmit: (form: FormData) => void }) {
  return <form action={onSubmit} className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2"><h3 className="font-medium sm:col-span-2">{title}</h3><input className="field" name="name" required defaultValue={category?.name} placeholder="Tên danh mục"/><input className="field" name="code" required defaultValue={category?.code} placeholder="Mã, ví dụ: FOOD"/><select className="field" name="type" defaultValue={category?.type ?? "expense"}><option value="expense">Chi</option><option value="income">Thu</option></select><select className="field" name="parentId" defaultValue={category?.parentId ?? ""}><option value="">Không có danh mục cha</option>{categories.filter((item) => item.status === "active" && (!category || item.type === category.type)).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.type === "income" ? "Thu" : "Chi"})</option>)}</select><label className="text-sm">Màu<input className="field mt-1" name="color" required defaultValue={category?.color ?? "#FF5B3D"} pattern="#[0-9A-Fa-f]{6}"/></label><label className="text-sm">Icon<select className="field mt-1" name="icon" defaultValue={iconName(category?.icon ?? null)}>{Object.keys(icons).map((name) => <option key={name} value={name}>{name}</option>)}</select></label><input className="field" name="sortOrder" type="number" min="0" defaultValue="0" placeholder="Thứ tự hiển thị"/><div className="flex items-end justify-end gap-2"><button type="button" className="button-secondary" onClick={onCancel}>Hủy</button><button className="button-primary" disabled={pending}>{pending ? "Đang lưu" : "Lưu danh mục"}</button></div></form>;
}
