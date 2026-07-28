export type CategoryPathNode = {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
};

export const CATEGORY_PATH_SEPARATOR = " > ";

export function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");
}

export function splitCategoryPath(value: string) {
  return value
    .split(/\s*>\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function buildCategoryPaths(categories: CategoryPathNode[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const cache = new Map<string, { names: string[]; codes: string[] }>();

  function resolve(id: string, visited = new Set<string>()): { names: string[]; codes: string[] } {
    const cached = cache.get(id);
    if (cached) return cached;
    const category = byId.get(id);
    if (!category || visited.has(id)) return { names: [], codes: [] };

    const nextVisited = new Set(visited).add(id);
    const parent = category.parentId ? resolve(category.parentId, nextVisited) : { names: [], codes: [] };
    const path = {
      names: [...parent.names, category.name],
      codes: [...parent.codes, category.code],
    };
    cache.set(id, path);
    return path;
  }

  for (const category of categories) resolve(category.id);
  return cache;
}

export function categoryPathKey(segments: string[]) {
  return segments.map(normalizeCategoryKey).join(CATEGORY_PATH_SEPARATOR);
}
