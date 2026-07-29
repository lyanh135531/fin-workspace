"use client"

import * as React from "react"
import { BriefcaseBusiness, Car, Coffee, Fuel, Heart, House, ShoppingBag, Tag, Utensils, WalletCards } from "lucide-react"
import { cn } from "@/lib/utils"
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectSeparator, SelectTrigger, SelectValue } from "./select"

export type CategoryTreeOption = { id: string; name: string; color?: string; icon?: string | null; parentId?: string | null; disabled?: boolean }

export type CategoryTreeSelectProps = {
  id?: string; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; name?: string
  label: string; placeholder?: string; categories: CategoryTreeOption[]; emptyOption?: { value: string; label: string }
  required?: boolean; disabled?: boolean; className?: string
}

type TreeNode = CategoryTreeOption & { children: TreeNode[] }
const CATEGORY_ICON_MAP = { tag: Tag, utensils: Utensils, coffee: Coffee, house: House, car: Car, fuel: Fuel, shopping: ShoppingBag, heart: Heart, work: BriefcaseBusiness, money: WalletCards, card: WalletCards } as const

function makeTree(categories: CategoryTreeOption[]) {
  const categoryIds = new Set(categories.map((category) => category.id))
  const childrenByParent = new Map<string, CategoryTreeOption[]>()
  const roots: CategoryTreeOption[] = []
  for (const category of categories) {
    if (category.parentId && categoryIds.has(category.parentId)) childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category])
    else roots.push(category)
  }
  const visited = new Set<string>()
  const toNode = (category: CategoryTreeOption): TreeNode | null => {
    if (visited.has(category.id)) return null
    visited.add(category.id)
    return { ...category, children: (childrenByParent.get(category.id) ?? []).map(toNode).filter((node): node is TreeNode => node !== null) }
  }
  const nodes = roots.map(toNode).filter((node): node is TreeNode => node !== null)
  for (const category of categories) {
    const node = toNode(category)
    if (node) nodes.push(node)
  }
  return nodes
}

function categoryPaths(categories: CategoryTreeOption[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return categories.map((category) => {
    const names = [category.name]
    const seen = new Set([category.id])
    let parentId = category.parentId
    while (parentId && !seen.has(parentId)) {
      const parent = byId.get(parentId)
      if (!parent) break
      names.unshift(parent.name)
      seen.add(parentId)
      parentId = parent.parentId
    }
    return { value: category.id, label: names.join(" / ") }
  })
}

function TreeItems({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return nodes.map((category) => (
    <React.Fragment key={category.id}>
      <SelectItem value={category.id} disabled={category.disabled} className={cn("category-tree-item", depth === 0 ? "category-tree-item-root" : "category-tree-item-child")} style={{ paddingLeft: `${0.75 + depth * 1.35}rem` }}>
        {depth > 0 && <span className="category-tree-branch" aria-hidden />}
        <span className="category-tree-icon" style={{ "--category-color": category.color ?? "var(--primary)" } as React.CSSProperties} aria-hidden>
          {React.createElement(CATEGORY_ICON_MAP[category.icon as keyof typeof CATEGORY_ICON_MAP] ?? Tag, { size: depth === 0 ? 15 : 14, strokeWidth: 2.1 })}
        </span>
        <span className="category-tree-name">{category.name}</span>
      </SelectItem>
      {category.children.length > 0 && <TreeItems nodes={category.children} depth={depth + 1} />}
    </React.Fragment>
  ))
}

function CategoryTreeSelect({ id, value, defaultValue, onValueChange, name, label, placeholder, categories, emptyOption, required, disabled, className }: CategoryTreeSelectProps) {
  const tree = React.useMemo(() => makeTree(categories), [categories])
  const items = React.useMemo(() => [...(emptyOption ? [emptyOption] : []), ...categoryPaths(categories)], [categories, emptyOption])
  const selectedCategory = React.useMemo(() => categories.find((category) => category.id === value), [categories, value])
  return (
    <SelectRoot id={id} value={value} defaultValue={defaultValue} onValueChange={(nextValue) => { if (nextValue !== null) onValueChange?.(String(nextValue)) }} items={items} name={name} required={required} disabled={disabled}>
      <SelectTrigger className={cn("category-tree-trigger", className)} aria-label={label}>
        <span className={cn("category-tree-trigger-mark", !selectedCategory && "is-empty")} style={{ "--category-color": selectedCategory?.color ?? "var(--text-muted)" } as React.CSSProperties} aria-hidden />
        <SelectValue placeholder={placeholder ?? label} className="category-tree-trigger-value" />
      </SelectTrigger>
      <SelectContent align="start" className="category-tree-content w-[21rem] min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-2">
        <div className="category-tree-content-heading">
          <span>Danh mục</span>
          <small>{categories.length ? `${categories.length} lựa chọn` : "Chưa có dữ liệu"}</small>
        </div>
        <SelectGroup className="category-tree-group">
          {emptyOption && <SelectItem value={emptyOption.value} className="category-tree-empty">{emptyOption.label}</SelectItem>}
          {emptyOption && tree.length > 0 && <SelectSeparator className="category-tree-separator" />}
          {tree.length > 0 ? <TreeItems nodes={tree} /> : <p className="px-2.5 py-5 text-center text-xs leading-5 text-muted-foreground">Chưa có danh mục để chọn.</p>}
        </SelectGroup>
      </SelectContent>
    </SelectRoot>
  )
}

export { CategoryTreeSelect }
