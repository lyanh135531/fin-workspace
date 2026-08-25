import { z } from "zod";
import {
  businessDateSchema,
  idSchema,
  optionalTrimmedTextSchema,
  transactionTypeSchema,
} from "@/domain/common/schemas";
import { positiveMoneySchema } from "@/lib/decimal";

export const recurringTransactionSchema = z
  .object({
    walletId: idSchema,
    toWalletId: idSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionTypeSchema,
    amount: positiveMoneySchema,
    description: optionalTrimmedTextSchema,
    startDate: businessDateSchema,
    endDate: z.preprocess(
      (value) => value === "" || value === null ? undefined : value,
      businessDateSchema.optional(),
    ),
  })
  .superRefine(({ type, walletId, toWalletId, categoryId, startDate, endDate }, ctx) => {
    if (type === "expense" && !categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Cần chọn danh mục cho giao dịch chi tiêu định kỳ.",
      });
    }
    if (type === "transfer" && !toWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWalletId"],
        message: "Cần chọn ví nhận cho giao dịch chuyển khoản.",
      });
    }
    if (type !== "transfer" && toWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWalletId"],
        message: "Ví nhận chỉ áp dụng cho giao dịch chuyển khoản.",
      });
    }
    if (type === "transfer" && walletId === toWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWalletId"],
        message: "Ví gửi và ví nhận phải khác nhau.",
      });
    }
    if (type === "transfer" && categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Giao dịch chuyển khoản không sử dụng danh mục.",
      });
    }
    if (endDate && endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Ngày kết thúc không được trước ngày bắt đầu.",
      });
    }
  });

export const recurringTransactionStatusSchema = z.enum(["active", "deactive"]);

export type RecurringTransactionInput = z.output<typeof recurringTransactionSchema>;
