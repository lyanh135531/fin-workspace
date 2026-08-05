import { z } from "zod";
import { idSchema, optionalTrimmedTextSchema } from "@/domain/common/schemas";
import { moneySchema, positiveMoneySchema } from "@/lib/decimal";

const walletNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform((name) => name.normalize("NFC"));

const walletFundingSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("income"),
    amount: moneySchema.refine((amount) => amount.gte(0), {
      message: "Income funding amount must be zero or greater.",
    }),
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

export const reorderWalletsSchema = z.object({
  walletIds: z.array(idSchema).min(1).refine(
    (walletIds) => new Set(walletIds).size === walletIds.length,
    { message: "Wallet order must not contain duplicate wallets." },
  ),
});

export type CreateWalletInput = z.output<typeof createWalletSchema>;
export type UpdateWalletInput = z.output<typeof updateWalletSchema>;
export type ReorderWalletsInput = z.output<typeof reorderWalletsSchema>;
