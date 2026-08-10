import { z } from "zod";
import { businessDateSchema, idSchema, optionalTrimmedTextSchema, transactionTypeSchema } from "@/domain/common/schemas";
import { positiveMoneySchema } from "@/lib/decimal";

export const createTransactionSchema = z
  .object({
    walletId: idSchema,
    toWalletId: idSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionTypeSchema,
    amount: positiveMoneySchema,
    description: optionalTrimmedTextSchema,
    date: businessDateSchema,
  })
  .superRefine(({ type, walletId, toWalletId }, ctx) => {
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

  });

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;

export const changeReasonSchema = z.string().trim().max(2_000).optional().transform((reason) => reason || "Đã thông báo");

export const deleteRequestReasonSchema = z
  .string()
  .trim()
  .max(2_000)
  .optional()
  .transform((reason) => reason ?? "");
