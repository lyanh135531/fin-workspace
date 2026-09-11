import { z } from "zod";
import { idSchema } from "@/domain/common/schemas";
import { INSTALLMENT_TERM_COUNTS } from "@/domain/credit-card/installments";
import { moneySchema } from "@/lib/decimal";

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
