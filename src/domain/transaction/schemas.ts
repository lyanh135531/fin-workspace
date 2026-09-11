import { z } from "zod";
import { businessDateSchema, idSchema, optionalTrimmedTextSchema, transactionTypeSchema } from "@/domain/common/schemas";
import { positiveMoneySchema } from "@/lib/decimal";

const creditCardAllocationSchema = z.object({
  walletId: idSchema,
  amount: positiveMoneySchema,
});

export const createTransactionSchema = z
  .object({
    walletId: idSchema,
    toWalletId: idSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionTypeSchema,
    amount: positiveMoneySchema,
    postedDate: businessDateSchema.optional(),
    allocations: z.array(creditCardAllocationSchema).min(1).max(50).optional(),
    description: optionalTrimmedTextSchema,
    date: businessDateSchema,
  })
  .superRefine(({ type, walletId, toWalletId, categoryId, allocations }, ctx) => {
    if (type === "expense" && !categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Cần chọn danh mục cho giao dịch chi tiêu.",
      });
    }
    if (type === "transfer" && !toWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWalletId"],
        message: "A destination wallet is required for transfers.",
      });
    }

    if (type !== "transfer" && toWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWalletId"],
        message: "A destination wallet is only valid for transfers.",
      });
    }

    if (type === "transfer" && walletId === toWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toWalletId"],
        message: "The source and destination wallets must be different.",
      });
    }

    if (type === "transfer" && categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Giao dịch chuyển khoản không sử dụng danh mục.",
      });
    }

    if (type !== "expense" && allocations) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allocations"],
        message: "Phân bổ nguồn trả thẻ chỉ áp dụng cho giao dịch chi tiêu.",
      });
    }

    if (allocations && new Set(allocations.map((item) => item.walletId)).size !== allocations.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allocations"],
        message: "Mỗi ví chỉ được xuất hiện một lần trong phân bổ.",
      });
    }

  });

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;

export const createCreditCardPaymentSchema = z.object({
  cardWalletId: idSchema,
  statementId: idSchema,
  date: businessDateSchema,
  description: optionalTrimmedTextSchema,
  sources: z.array(z.object({
    walletId: idSchema,
    amount: positiveMoneySchema,
  })).min(1).max(50),
}).superRefine(({ sources }, ctx) => {
  const keys = sources.map((source) => source.walletId);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sources"],
      message: "Nguồn thanh toán bị trùng.",
    });
  }
});

export const createCreditCardRefundSchema = z.object({
  originalTransactionId: idSchema,
  amount: positiveMoneySchema,
  date: businessDateSchema,
  postedDate: businessDateSchema.optional(),
  description: optionalTrimmedTextSchema,
});

export type CreateCreditCardPaymentInput = z.output<typeof createCreditCardPaymentSchema>;
export type CreateCreditCardRefundInput = z.output<typeof createCreditCardRefundSchema>;

export const changeReasonSchema = z.string().trim().max(2_000).optional().transform((reason) => reason || "Đã thông báo");

export const deleteRequestReasonSchema = z
  .string()
  .trim()
  .max(2_000)
  .optional()
  .transform((reason) => reason ?? "");
