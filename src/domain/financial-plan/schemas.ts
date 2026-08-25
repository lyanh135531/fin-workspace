import { z } from "zod";
import Decimal from "decimal.js";
import { FINANCIAL_JAR_CODES, financialJarCodeSchema } from "@/domain/financial-jar/jars";
import { idSchema } from "@/domain/common/schemas";
import { decimalInputSchema } from "@/lib/decimal";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng phải có định dạng YYYY-MM.");
const vndSchema = decimalInputSchema.refine((value) => value.isInteger(), "Số tiền phải là số nguyên VND.");
const positiveVndSchema = vndSchema.refine((value) => value.greaterThan(0), "Số tiền phải lớn hơn 0.");
const nonNegativeVndSchema = vndSchema.refine((value) => value.greaterThanOrEqualTo(0), "Số tiền không được âm.");
const percentageSchema = decimalInputSchema
  .refine((value) => value.greaterThanOrEqualTo(0) && value.lessThanOrEqualTo(100), "Tỷ lệ phải từ 0 đến 100%.")
  .refine((value) => value.decimalPlaces() <= 2, "Tỷ lệ chỉ được có tối đa hai chữ số thập phân.");

export const planJarPercentagesSchema = z.record(financialJarCodeSchema, percentageSchema).superRefine((value, ctx) => {
  if (Object.keys(value).length !== FINANCIAL_JAR_CODES.length) {
    ctx.addIssue({ code: "custom", message: "Phải cung cấp đủ tỷ lệ cho sáu hũ." });
    return;
  }
  const total = FINANCIAL_JAR_CODES.reduce((sum, jarCode) => sum.plus(value[jarCode]), value.ESSENTIAL.minus(value.ESSENTIAL));
  if (!total.equals(100)) ctx.addIssue({ code: "custom", message: "Tổng tỷ lệ sáu hũ phải bằng chính xác 100%." });
});

export const createFinancialPlanSchema = z.object({
  name: z.string().trim().min(1, "Tên kế hoạch là bắt buộc.").max(160),
  targetAmount: positiveVndSchema,
  existingGoalAmount: nonNegativeVndSchema.default(new Decimal(0)),
  targetMonth: monthSchema,
  percentages: planJarPercentagesSchema,
}).refine((value) => value.existingGoalAmount.lessThanOrEqualTo(value.targetAmount), {
  path: ["existingGoalAmount"], message: "Tiền đã dành sẵn không được lớn hơn mục tiêu.",
});

export const updateFinancialPlanDraftSchema = createFinancialPlanSchema.extend({ planId: idSchema });
export const financialPlanIdSchema = idSchema;
export const updateFinancialPlanDeadlineSchema = z.object({ planId: idSchema, targetMonth: monthSchema });
export const updateFinancialPlanAllocationSchema = z.object({ planId: idSchema, percentages: planJarPercentagesSchema });

export type PlanJarPercentagesInput = z.output<typeof planJarPercentagesSchema>;
export type CreateFinancialPlanInput = z.output<typeof createFinancialPlanSchema>;
export type UpdateFinancialPlanDraftInput = z.output<typeof updateFinancialPlanDraftSchema>;
