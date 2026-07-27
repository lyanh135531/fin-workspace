import { z } from "zod";
import { idSchema, optionalTrimmedTextSchema } from "@/domain/common/schemas";
import { positiveMoneySchema } from "@/lib/decimal";

const walletNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform((name) => name.normalize("NFC"));

const walletFundingSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("income"),
    amount: positiveMoneySchema,
  }),
  z.object({
    type: z.literal("transfer"),
    amount: positiveMoneySchema,
    sourceWalletId: idSchema,
  }),
]);

export const createWalletSchema = z.object({
  name: walletNameSchema,
  description: optionalTrimmedTextSchema,
  funding: walletFundingSchema.optional(),
});

export const updateWalletSchema = z
  .object({
    walletId: idSchema,
    name: walletNameSchema.optional(),
    description: optionalTrimmedTextSchema,
  })
  .refine(({ name, description }) => name !== undefined || description !== undefined, {
    message: "At least one wallet field must be provided.",
  });

export type CreateWalletInput = z.output<typeof createWalletSchema>;
export type UpdateWalletInput = z.output<typeof updateWalletSchema>;
