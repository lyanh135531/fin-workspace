import { z } from "zod";
import Decimal from "decimal.js";
import { businessDateSchema, idSchema, optionalTrimmedTextSchema } from "@/domain/common/schemas";
import { INSTALLMENT_TERM_COUNTS } from "@/domain/credit-card/installments";
import { moneySchema, positiveMoneySchema } from "@/lib/decimal";

const statementDaySchema = z.number().int().min(1).max(31);

export const updateCreditCardSchema = z.object({
  cardWalletId: idSchema,
  name: z.string().trim().min(1).max(120).transform((name) => name.normalize("NFC")),
  description: optionalTrimmedTextSchema,
  creditLimit: positiveMoneySchema,
  defaultFundingWalletId: idSchema,
  statementClosingDay: statementDaySchema,
  paymentDueDay: statementDaySchema,
});

const termCountSchema = z.number().int().refine(
  (value): value is (typeof INSTALLMENT_TERM_COUNTS)[number] => INSTALLMENT_TERM_COUNTS.includes(value as never),
  { message: "Số kỳ trả góp không được hỗ trợ." },
);

export const installmentInputSchema = z.object({
  termCount: termCountSchema,
  feeAmount: moneySchema.refine((amount) => amount.gte(0), { message: "Phí trả góp không được âm." }),
});

export const registerCreditCardInstallmentSchema = installmentInputSchema.extend({
  transactionId: idSchema,
});

const importedInstallmentAllocationSchema = z.object({
  walletId: idSchema,
  amount: positiveMoneySchema,
});

export const importCreditCardInstallmentSchema = z.object({
  cardWalletId: idSchema,
  description: z.string().trim().min(1).max(120).transform((value) => value.normalize("NFC")),
  termCount: z.number().int().min(2).max(60),
  paidTermCount: z.number().int().min(0),
  remainingAmount: positiveMoneySchema,
  firstStatementDate: businessDateSchema,
  balanceMode: z.enum(["included_opening_debt", "add_to_balance"]),
  allocations: z.array(importedInstallmentAllocationSchema).min(1).max(50),
}).superRefine((value, ctx) => {
  if (value.paidTermCount >= value.termCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paidTermCount"],
      message: "Số kỳ đã trả phải nhỏ hơn tổng số kỳ.",
    });
  }
  if (new Set(value.allocations.map((item) => item.walletId)).size !== value.allocations.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allocations"],
      message: "Mỗi ví chỉ được phân bổ một lần.",
    });
  }
  const total = value.allocations.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
  if (!total.eq(value.remainingAmount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allocations"],
      message: "Tổng phân bổ phải bằng dư nợ trả góp còn lại.",
    });
  }
});

export const deleteImportedCreditCardInstallmentSchema = z.object({
  planId: idSchema,
});

export const deleteCreditCardResolutionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("void_transactions"),
  }),
  z.object({
    action: z.literal("migrate_transactions"),
    targetWalletId: idSchema,
  }),
]);

export const deleteCreditCardSchema = z.object({
  cardWalletId: idSchema,
  resolution: deleteCreditCardResolutionSchema.optional(),
});

export type InstallmentInput = z.output<typeof installmentInputSchema>;
export type RegisterCreditCardInstallmentInput = z.output<typeof registerCreditCardInstallmentSchema>;
export type ImportCreditCardInstallmentInput = z.output<typeof importCreditCardInstallmentSchema>;
export type UpdateCreditCardInput = z.output<typeof updateCreditCardSchema>;
export type DeleteCreditCardResolution = z.output<typeof deleteCreditCardResolutionSchema>;
export type DeleteCreditCardInput = z.output<typeof deleteCreditCardSchema>;
