import Decimal from "decimal.js";
import { z } from "zod";

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export const decimalInputSchema = z
  .union([z.string().trim().min(1), z.instanceof(Decimal)])
  .transform((value, ctx) => {
    try {
      const decimal = new Decimal(value);

      if (!decimal.isFinite() || decimal.decimalPlaces() > 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount must be a finite value with at most four decimal places.",
        });
        return z.NEVER;
      }

      return decimal;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be a valid decimal value.",
      });
      return z.NEVER;
    }
  });

export const moneySchema = decimalInputSchema;

export const positiveMoneySchema = decimalInputSchema.refine((amount) => amount.gt(0), {
  message: "Amount must be greater than zero.",
});
