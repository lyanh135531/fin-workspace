import { z } from "zod";
import Decimal from "decimal.js";
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

const walletAllocationSchema = z.object({
  walletId: idSchema,
  amount: positiveMoneySchema,
});

export const createWalletSchema = z.object({
  name: walletNameSchema,
  description: optionalTrimmedTextSchema,
  kind: z.enum(["asset", "credit_card"]).default("asset"),
  assetSubtype: z.enum(["cash", "bank", "e_wallet", "other"]).default("other"),
  funding: walletFundingSchema.optional(),
  creditCard: z.object({
    creditLimit: positiveMoneySchema,
    defaultFundingWalletId: idSchema,
    statementClosingDay: z.number().int().min(1).max(31),
    paymentDueDay: z.number().int().min(1).max(31),
    openingDebt: moneySchema.refine((amount) => amount.gte(0), {
      message: "Dư nợ ban đầu không được âm.",
    }),
    openingAllocations: z.array(walletAllocationSchema).max(50).default([]),
  }).optional(),
}).superRefine(({ kind, funding, creditCard }, ctx) => {
  if (kind === "asset" && creditCard) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creditCard"], message: "Ví tài sản không dùng cấu hình thẻ tín dụng." });
  }
  if (kind === "credit_card" && funding) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["funding"], message: "Thẻ tín dụng không được nạp số dư như ví tài sản." });
  }
  if (kind === "credit_card" && !creditCard) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creditCard"], message: "Thiếu cấu hình thẻ tín dụng." });
    return;
  }
  if (!creditCard) return;
  if (creditCard.openingDebt.gt(creditCard.creditLimit)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creditCard", "openingDebt"], message: "Dư nợ ban đầu không được vượt hạn mức." });
  }
  const allocations = creditCard.openingAllocations;
  if (new Set(allocations.map((item) => item.walletId)).size !== allocations.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creditCard", "openingAllocations"], message: "Mỗi ví chỉ được phân bổ một lần." });
  }
  const total = allocations.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
  if (allocations.length && !total.eq(creditCard.openingDebt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creditCard", "openingAllocations"], message: "Tổng phân bổ phải bằng dư nợ ban đầu." });
  }
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

type ParsedCreateWalletInput = z.output<typeof createWalletSchema>;
export type CreateWalletInput = Omit<ParsedCreateWalletInput, "kind" | "assetSubtype"> & {
  kind?: ParsedCreateWalletInput["kind"];
  assetSubtype?: ParsedCreateWalletInput["assetSubtype"];
};
export type UpdateWalletInput = z.output<typeof updateWalletSchema>;
export type ReorderWalletsInput = z.output<typeof reorderWalletsSchema>;
