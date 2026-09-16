import { z } from "zod";
import { idSchema, optionalTrimmedTextSchema } from "@/domain/common/schemas";
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

export type InstallmentInput = z.output<typeof installmentInputSchema>;
export type RegisterCreditCardInstallmentInput = z.output<typeof registerCreditCardInstallmentSchema>;
export type UpdateCreditCardInput = z.output<typeof updateCreditCardSchema>;
