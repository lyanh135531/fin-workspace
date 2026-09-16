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

export const financialGoalTrackingModeSchema = z.enum(["manual", "linked_wallet"]);
export const financialGoalStatusSchema = z.enum(["draft", "active", "completed", "cancelled"]);

const financialPlanGoalBaseSchema = z.object({
  name: z.string().trim().min(1, "Tên mục tiêu là bắt buộc.").max(160),
  targetAmount: positiveVndSchema,
  existingAmount: nonNegativeVndSchema.default(new Decimal(0)),
  targetMonth: monthSchema,
  trackingMode: financialGoalTrackingModeSchema,
  linkedWalletId: idSchema.nullable().optional(),
});

function validateGoalSource(value: { trackingMode: "manual" | "linked_wallet"; linkedWalletId?: string | null }, ctx: z.RefinementCtx) {
  if (value.trackingMode === "linked_wallet" && !value.linkedWalletId) {
    ctx.addIssue({ code: "custom", path: ["linkedWalletId"], message: "Hãy chọn ví dùng để xác nhận tiến độ." });
  }
  if (value.trackingMode === "manual" && value.linkedWalletId) {
    ctx.addIssue({ code: "custom", path: ["linkedWalletId"], message: "Mục tiêu thủ công không được liên kết ví." });
  }
}

export const financialPlanGoalInputSchema = financialPlanGoalBaseSchema.superRefine((value, ctx) => {
  if (value.existingAmount.greaterThan(value.targetAmount)) {
    ctx.addIssue({ code: "custom", path: ["existingAmount"], message: "Tiền đã xác nhận không được lớn hơn mục tiêu." });
  }
  validateGoalSource(value, ctx);
});

export const createFinancialPlanWithGoalsSchema = z.object({
  name: z.string().trim().min(1, "Tên kế hoạch là bắt buộc.").max(160),
  goals: z.array(financialPlanGoalInputSchema).min(1, "Kế hoạch phải có ít nhất một mục tiêu.").max(20),
  percentages: planJarPercentagesSchema,
});

export const createFinancialPlanGoalSchema = financialPlanGoalBaseSchema.extend({ planId: idSchema }).superRefine((value, ctx) => {
  if (value.existingAmount.greaterThan(value.targetAmount)) ctx.addIssue({ code: "custom", path: ["existingAmount"], message: "Tiền đã xác nhận không được lớn hơn mục tiêu." });
  validateGoalSource(value, ctx);
});
export const updateFinancialPlanGoalSchema = financialPlanGoalBaseSchema.omit({ existingAmount: true }).extend({ goalId: idSchema }).superRefine(validateGoalSource);
export const reorderFinancialPlanGoalsSchema = z.object({
  planId: idSchema,
  goalIds: z.array(idSchema).min(1).max(20),
});
export const financialPlanGoalIdSchema = idSchema;
export const createFinancialGoalFundingSchema = z.object({
  goalId: idSchema,
  amount: positiveVndSchema,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD."),
  note: z.string().trim().max(500).optional(),
});
export const reviewFinancialGoalFundingSchema = z.object({ entryId: idSchema, approve: z.boolean() });
export const reverseFinancialGoalFundingSchema = z.object({
  entryId: idSchema,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD."),
  note: z.string().trim().max(500).optional(),
});
export const financialPlanPreviewSchema = z.object({
  goals: z.array(financialPlanGoalInputSchema).min(1).max(20),
  monthlyFundingCapacity: nonNegativeVndSchema,
  startMonth: monthSchema,
});

export type PlanJarPercentagesInput = z.output<typeof planJarPercentagesSchema>;
export type CreateFinancialPlanInput = z.output<typeof createFinancialPlanSchema>;
export type UpdateFinancialPlanDraftInput = z.output<typeof updateFinancialPlanDraftSchema>;
export type FinancialPlanGoalInput = z.output<typeof financialPlanGoalInputSchema>;
export type CreateFinancialPlanWithGoalsInput = z.output<typeof createFinancialPlanWithGoalsSchema>;
export type CreateFinancialPlanGoalInput = z.output<typeof createFinancialPlanGoalSchema>;
export type UpdateFinancialPlanGoalInput = z.output<typeof updateFinancialPlanGoalSchema>;
