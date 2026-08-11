const MAX_CATEGORY_CODE_LENGTH = 80;
const PARENT_TOKEN_LENGTH = 8;

export function scopeCategoryCode(
  code: string,
  parentId: string | undefined,
): string {
  if (!parentId) return code;

  const parentToken = parentId
    .replaceAll("-", "")
    .slice(0, PARENT_TOKEN_LENGTH)
    .toUpperCase();
  const codeLength = MAX_CATEGORY_CODE_LENGTH - parentToken.length - 1;
  return `${code.slice(0, codeLength)}_${parentToken}`;
}
