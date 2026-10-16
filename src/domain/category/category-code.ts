const MAX_CATEGORY_CODE_LENGTH = 80;
const PARENT_TOKEN_LENGTH = 8;

function getParentToken(parentId: string): string {
  return parentId
    .replaceAll("-", "")
    .slice(0, PARENT_TOKEN_LENGTH)
    .toUpperCase();
}

export function unscopeCategoryCode(
  code: string,
  previousParentId: string | null | undefined,
): string {
  if (!previousParentId) return code;
  const suffix = `_${getParentToken(previousParentId)}`;
  return code.endsWith(suffix) ? code.slice(0, -suffix.length) : code;
}

export function scopeCategoryCode(
  code: string,
  parentId: string | undefined,
): string {
  if (!parentId) return code;

  const parentToken = getParentToken(parentId);
  const suffix = `_${parentToken}`;
  if (code.endsWith(suffix)) {
    return code;
  }
  const codeLength = MAX_CATEGORY_CODE_LENGTH - parentToken.length - 1;
  return `${code.slice(0, codeLength)}${suffix}`;
}

