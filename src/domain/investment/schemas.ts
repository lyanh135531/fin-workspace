import Decimal from "decimal.js";
import { z } from "zod";
import {
  businessDateSchema,
  idSchema,
  optionalTrimmedTextSchema,
} from "@/domain/common/schemas";
import { positiveMoneySchema } from "@/lib/decimal";

const codeSchema = z.string().trim().min(1).max(40).transform((value) => value.toUpperCase());
const shortTextSchema = z.string().trim().min(1).max(120);

export const positiveQuantitySchema = z
  .union([z.string().trim().min(1), z.instanceof(Decimal)])
  .transform((value, ctx) => {
    try {
      const quantity = new Decimal(value);
      if (!quantity.isFinite() || !quantity.gt(0) || quantity.decimalPlaces() > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Số lượng phải lớn hơn 0 và có tối đa 10 chữ số thập phân.",
        });
        return z.NEVER;
      }
      return quantity;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Số lượng không hợp lệ." });
      return z.NEVER;
    }
  });

export const saveInvestmentLeafSchema = z.object({
  id: idSchema.optional(),
  parentId: idSchema,
  name: shortTextSchema,
  code: codeSchema,
  unit: z.string().trim().min(1).max(40),
  status: z.enum(["active", "deactive"]).default("active"),
});

export const createInvestmentTradeSchema = z
  .object({
    assetId: idSchema.optional(),
    categoryId: idSchema.optional(),
    walletId: idSchema,
    targetLotId: idSchema.optional(),
    side: z.enum(["buy", "sell"]),
    quantity: positiveQuantitySchema,
    executedUnitPrice: positiveMoneySchema,
    marketUnitPrice: positiveMoneySchema.optional(),
    description: optionalTrimmedTextSchema,
    date: businessDateSchema,
  })
  .superRefine(({ side, assetId, categoryId, targetLotId }, ctx) => {
    if (side === "buy" && targetLotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetLotId"],
        message: "Giao dịch mua không được chọn lô bán.",
      });
    }
    if (side === "buy" && !categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Giao dịch mua phải chọn danh mục đầu tư.",
      });
    }
    if (side === "sell" && !targetLotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetLotId"],
        message: "Giao dịch bán phải chọn một lô cụ thể.",
      });
    }
    if (side === "sell" && !assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetId"],
        message: "Giao dịch bán thiếu tài sản của lô.",
      });
    }
  });

export const recordAssetPriceSchema = z
  .object({
    assetId: idSchema,
    bidPrice: positiveMoneySchema,
    askPrice: positiveMoneySchema.optional(),
    priceAt: z.coerce.date(),
    provider: z.string().trim().min(1).max(80).default("manual"),
  })
  .superRefine(({ bidPrice, askPrice }, ctx) => {
    if (askPrice && askPrice.lt(bidPrice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["askPrice"],
        message: "Giá bán ra không được thấp hơn giá mua vào.",
      });
    }
  });

export type SaveInvestmentLeafInput = z.infer<typeof saveInvestmentLeafSchema>;
export type CreateInvestmentTradeInput = z.infer<typeof createInvestmentTradeSchema>;
export type RecordAssetPriceInput = z.infer<typeof recordAssetPriceSchema>;
