import { z } from "zod";
import { hexColorSchema, idSchema } from "@/domain/common/schemas";

const categoryFields = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(80).toUpperCase(),
  color: hexColorSchema,
  type: z.enum(["income", "expense"]),
  icon: z.string().trim().min(1).max(40),
  parentId: idSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createCategorySchema = categoryFields;
export const updateCategorySchema = categoryFields.extend({ categoryId: idSchema });
export const mergeCategorySchema = z.object({
  sourceCategoryId: idSchema,
  targetCategoryId: idSchema,
});

export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;
export type MergeCategoryInput = z.output<typeof mergeCategorySchema>;
