import { z } from "zod";
import { idSchema, optionalTrimmedTextSchema } from "@/domain/common/schemas";
import { moneySchema } from "@/lib/decimal";

export const createWalletSchema = z.object({
  name: z.string().trim().min(1).max(120),
  openingBalance: moneySchema,
  description: optionalTrimmedTextSchema,
});

export const updateWalletSchema = z
  .object({
    walletId: idSchema,
    name: z.string().trim().min(1).max(120).optional(),
    description: optionalTrimmedTextSchema,
  })
  .refine(({ name, description }) => name !== undefined || description !== undefined, {
    message: "At least one wallet field must be provided.",
  });

export type CreateWalletInput = z.output<typeof createWalletSchema>;
export type UpdateWalletInput = z.output<typeof updateWalletSchema>;
