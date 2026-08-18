type CategoryTreeItem = {
  id: string;
  parentId?: string | null;
};

type DateRangeFilter = {
  from: string;
  to: string;
} | null;

export function getMonthDateRange(date: string): Exclude<DateRangeFilter, null> {
  const [year, month] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  return {
    from: `${monthPrefix}-01`,
    to: `${monthPrefix}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function isDateInRange(
  date: string,
  dateRange: DateRangeFilter,
): boolean {
  return dateRange === null || (date >= dateRange.from && date <= dateRange.to);
}

export function getCategoryFilterIds(
  categories: CategoryTreeItem[],
  selectedCategoryId: string,
): Set<string> {
  if (!selectedCategoryId) return new Set();

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }

  const includedIds = new Set<string>();
  const pendingIds = [selectedCategoryId];
  while (pendingIds.length > 0) {
    const categoryId = pendingIds.pop();
    if (!categoryId || includedIds.has(categoryId)) continue;
    includedIds.add(categoryId);
    pendingIds.push(...(childrenByParent.get(categoryId) ?? []));
  }

  return includedIds;
}
