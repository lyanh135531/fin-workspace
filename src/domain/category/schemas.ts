import { z } from "zod";
import { hexColorSchema, idSchema } from "@/domain/common/schemas";
import { financialJarCodeSchema } from "@/domain/financial-jar/jars";

const categoryFields = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(80).toUpperCase(),
  color: hexColorSchema,
  type: z.enum(["income", "expense"]),
  icon: z.string().trim().min(1).max(40),
  parentId: idSchema.optional(),
  jarCode: financialJarCodeSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
}).superRefine(({ type, parentId, jarCode }, ctx) => {
  if (type === "expense" && !parentId && !jarCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["jarCode"],
      message: "Danh mục chi cấp gốc bắt buộc chọn hũ tài chính.",
    });
  }
  if (type === "income" && jarCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["jarCode"],
      message: "Danh mục thu nhập không được gắn hũ tài chính.",
    });
  }
});

export const createCategorySchema = categoryFields;
export const updateCategorySchema = categoryFields.and(z.object({ categoryId: idSchema }));

export type CreateCategoryInput = z.output<typeof createCategorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;
