"use client"

import * as React from "react"
import { BriefcaseBusiness, Car, Coffee, Fuel, Heart, House, ShoppingBag, Tag, Utensils, WalletCards } from "lucide-react"
import { cn } from "@/lib/utils"
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectSeparator, SelectTrigger, SelectValue } from "./select"
import { Label } from "./label"

export type CategoryTreeOption = { id: string; name: string; color?: string; icon?: string | null; parentId?: string | null; disabled?: boolean }

export type CategoryTreeSelectProps = {
  id?: string; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; name?: string
  label?: string; placeholder?: string; categories: CategoryTreeOption[]; emptyOption?: { value: string; label: string }
  required?: boolean; disabled?: boolean; className?: string
}

type TreeNode = CategoryTreeOption & { children: TreeNode[] }
const CATEGORY_ICON_MAP = { tag: Tag, utensils: Utensils, coffee: Coffee, house: House, car: Car, fuel: Fuel, shopping: ShoppingBag, heart: Heart, work: BriefcaseBusiness, money: WalletCards, card: WalletCards } as const

function CategoryIcon({ category, size, className }: { category: CategoryTreeOption; size: number; className?: string }) {
  const Icon = CATEGORY_ICON_MAP[category.icon as keyof typeof CATEGORY_ICON_MAP] ?? Tag
  return (
    <span
      className={cn("category-tree-icon", className)}
      style={{ "--category-color": category.color ?? "var(--primary)" } as React.CSSProperties}
      aria-hidden
    >
      <Icon
        size={size}
        strokeWidth={2}
        style={{ color: "var(--category-color)" }}
      />
    </span>
  )
}

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
        <CategoryIcon category={category} size={depth === 0 ? 14 : 13} />
        <span className="category-tree-name">{category.name}</span>
      </SelectItem>
      {category.children.length > 0 && <TreeItems nodes={category.children} depth={depth + 1} />}
    </React.Fragment>
  ))
}

function CategoryTreeSelect({ id, value, defaultValue, onValueChange, name, label, placeholder, categories, emptyOption, required, disabled, className }: CategoryTreeSelectProps) {
  const tree = React.useMemo(() => makeTree(categories), [categories])
  const items = React.useMemo(() => [...(emptyOption ? [emptyOption] : []), ...categoryPaths(categories)], [categories, emptyOption])
  const generatedId = React.useId()
  const selectId = id ?? (label ? generatedId : undefined)
  const select = (
    <SelectRoot id={selectId} value={value} defaultValue={defaultValue} onValueChange={(nextValue) => { if (nextValue !== null) onValueChange?.(String(nextValue)) }} items={items} name={name} required={required} disabled={disabled}>
      <SelectTrigger id={selectId} className={cn("category-tree-trigger", className)} aria-label={label}>
        <SelectValue placeholder={placeholder ?? label} className="category-tree-trigger-value">
          {(selectedValue: string | null) => {
            const selectedCategory = categories.find((category) => category.id === selectedValue)
            if (selectedCategory) {
              return (
                <>
                  <CategoryIcon category={selectedCategory} size={13} className="category-tree-trigger-icon" />
                  <span className="category-tree-name">{selectedCategory.name}</span>
                </>
              )
            }
            if (emptyOption?.value === selectedValue) return emptyOption.label
            return placeholder ?? label
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="category-tree-content min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden">
        <SelectGroup className="category-tree-group">
          {emptyOption && <SelectItem value={emptyOption.value} className="category-tree-empty">{emptyOption.label}</SelectItem>}
          {emptyOption && tree.length > 0 && <SelectSeparator className="category-tree-separator" />}
          {tree.length > 0 ? <TreeItems nodes={tree} /> : <p className="px-2.5 py-5 text-center text-xs leading-5 text-muted-foreground">Chưa có danh mục để chọn.</p>}
        </SelectGroup>
      </SelectContent>
    </SelectRoot>
  )
  if (!label) return select
  return (
    <div className="grid gap-1">
      <Label required={required}>{label}</Label>
      {select}
    </div>
  )
}

export { CategoryTreeSelect }
