import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const positiveDecimalString = z
  .string()
  .trim()
  .refine((val) => {
    const num = Number(val);
    return Number.isFinite(num) && num > 0;
  }, "Giá trị phải lớn hơn 0.");

const nonNegativeDecimalString = z
  .string()
  .trim()
  .refine((val) => {
    if (val === "") return true;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0;
  }, "Giá trị không được âm.");

export const createGoldHoldingWithInitialLotSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên gợi nhớ cho khoản vàng.")
      .max(120, "Tên khoản vàng tối đa 120 ký tự."),
    brandName: z
      .string()
      .trim()
      .min(1, "Vui lòng chọn hoặc nhập thương hiệu / tiệm vàng.")
      .max(100, "Tên thương hiệu tối đa 100 ký tự."),
    productType: z.enum([
      "sjc_bar",
      "ring_9999",
      "jewelry_24k",
      "jewelry_18k",
      "other",
    ]),
    priceSourceMode: z.enum(["auto_brand", "pegged_brand", "manual"]),
    quoteProviderCode: z.string().trim().max(32).optional().nullable(),
    manualBuybackPricePerChi: nonNegativeDecimalString.optional().nullable(),
    manualSellPricePerChi: nonNegativeDecimalString.optional().nullable(),
    storageLocation: z.string().trim().max(160).optional().nullable(),
    note: z.string().trim().max(400).optional().nullable(),
    mergeMode: z
      .enum(["auto_merge", "create_separate"])
      .optional()
      .default("auto_merge"),
    // Đợt mua đầu tiên (tùy chọn hoặc mặc định tạo cùng khoản vàng)
    initialLot: z
      .object({
        fundingMode: z.enum(["from_wallet", "existing_asset"]),
        sourceWalletId: z.string().uuid().optional().nullable(),
        purchaseDate: z
          .string()
          .regex(isoDateRegex, "Ngày mua không hợp lệ."),
        quantityChi: positiveDecimalString,
        unitPricePerChi: positiveDecimalString,
        craftingFeeAmount: nonNegativeDecimalString.optional().default("0"),
        shopName: z.string().trim().max(120).optional().nullable(),
        invoiceOrSerial: z.string().trim().max(120).optional().nullable(),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.initialLot &&
      data.initialLot.fundingMode === "from_wallet" &&
      !data.initialLot.sourceWalletId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initialLot", "sourceWalletId"],
        message: "Vui lòng chọn ví để trích tiền mua vàng.",
      });
    }
  });

export const addGoldPurchaseLotSchema = z
  .object({
    holdingId: z.string().uuid("Mã khoản vàng không hợp lệ."),
    fundingMode: z.enum(["from_wallet", "existing_asset"]),
    sourceWalletId: z.string().uuid().optional().nullable(),
    purchaseDate: z.string().regex(isoDateRegex, "Ngày mua không hợp lệ."),
    quantityChi: positiveDecimalString,
    unitPricePerChi: positiveDecimalString,
    craftingFeeAmount: nonNegativeDecimalString.optional().default("0"),
    shopName: z.string().trim().max(120).optional().nullable(),
    invoiceOrSerial: z.string().trim().max(120).optional().nullable(),
    note: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.fundingMode === "from_wallet" && !data.sourceWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceWalletId"],
        message: "Vui lòng chọn ví để trích tiền mua vàng.",
      });
    }
  });

export const updateGoldPurchaseLotSchema = z
  .object({
    lotId: z.string().uuid("Mã đợt mua vàng không hợp lệ."),
    fundingMode: z.enum(["from_wallet", "existing_asset"]),
    sourceWalletId: z.string().uuid().optional().nullable(),
    purchaseDate: z.string().regex(isoDateRegex, "Ngày mua không hợp lệ."),
    quantityChi: positiveDecimalString,
    unitPricePerChi: positiveDecimalString,
    craftingFeeAmount: nonNegativeDecimalString.optional().default("0"),
    shopName: z.string().trim().max(120).optional().nullable(),
    invoiceOrSerial: z.string().trim().max(120).optional().nullable(),
    note: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.fundingMode === "from_wallet" && !data.sourceWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceWalletId"],
        message: "Vui lòng chọn ví để trích tiền mua vàng.",
      });
    }
  });

export const recordGoldSaleSchema = z
  .object({
    holdingId: z.string().uuid("Mã khoản vàng không hợp lệ."),
    costMode: z.enum(["average_cost", "specific_lot"]),
    purchaseLotId: z.string().uuid().optional().nullable(),
    destinationWalletId: z
      .string()
      .uuid("Vui lòng chọn ví nhận tiền bán vàng."),
    saleDate: z.string().regex(isoDateRegex, "Ngày bán không hợp lệ."),
    quantityChi: positiveDecimalString,
    sellPricePerChi: positiveDecimalString,
    feeOrDeductionAmount: nonNegativeDecimalString.optional().default("0"),
    note: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.costMode === "specific_lot" && !data.purchaseLotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["purchaseLotId"],
        message: "Vui lòng chọn đợt mua vàng muốn bán.",
      });
    }
  });

export const updateGoldHoldingPriceSettingsSchema = z.object({
  holdingId: z.string().uuid("Mã khoản vàng không hợp lệ."),
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên gợi nhớ cho khoản vàng.")
    .max(120, "Tên khoản vàng tối đa 120 ký tự."),
  brandName: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập thương hiệu / tiệm vàng.")
    .max(100),
  priceSourceMode: z.enum(["auto_brand", "pegged_brand", "manual"]),
  quoteProviderCode: z.string().trim().max(32).optional().nullable(),
  manualBuybackPricePerChi: nonNegativeDecimalString.optional().nullable(),
  manualSellPricePerChi: nonNegativeDecimalString.optional().nullable(),
  storageLocation: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(400).optional().nullable(),
});

export const createSavingsDepositSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên sổ tiết kiệm.")
      .max(120, "Tên sổ tiết kiệm tối đa 120 ký tự."),
    bankName: z
      .string()
      .trim()
      .min(1, "Vui lòng chọn hoặc nhập tên ngân hàng.")
      .max(100),
    accountOrPassbookNumber: z.string().trim().max(80).optional().nullable(),
    fundingMode: z.enum(["from_wallet", "existing_asset"]),
    sourceWalletId: z.string().uuid().optional().nullable(),
    principalAmount: positiveDecimalString,
    annualInterestRate: positiveDecimalString,
    nonTermInterestRate: nonNegativeDecimalString.optional().default("0.1"),
    termMonths: z
      .number()
      .int()
      .min(1, "Kỳ hạn tối thiểu 1 tháng.")
      .max(120, "Kỳ hạn tối đa 120 tháng."),
    startDate: z.string().regex(isoDateRegex, "Ngày mở sổ không hợp lệ."),
    maturityDate: z
      .string()
      .regex(isoDateRegex, "Ngày đáo hạn không hợp lệ.")
      .optional()
      .nullable(),
    interestPayoutMode: z.enum(["maturity", "upfront", "monthly"]),
    maturityAction: z.enum([
      "settle_to_wallet",
      "renew_principal",
      "renew_principal_and_interest",
    ]),
    note: z.string().trim().max(400).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.fundingMode === "from_wallet" && !data.sourceWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceWalletId"],
        message: "Vui lòng chọn ví tài sản để trích tiền mở sổ tiết kiệm.",
      });
    }
  });

export const settleSavingsDepositSchema = z
  .object({
    depositId: z.string().uuid("Mã sổ tiết kiệm không hợp lệ."),
    settlementType: z.enum([
      "maturity",
      "early_full",
      "early_partial",
      "rollover",
    ]),
    settlementDate: z
      .string()
      .regex(isoDateRegex, "Ngày thực hiện không hợp lệ."),
    destinationWalletId: z.string().uuid().optional().nullable(),
    principalWithdrawnAmount: nonNegativeDecimalString.optional(),
    interestReceivedAmount: nonNegativeDecimalString.optional().default("0"),
    // Dùng khi chọn `rollover` (Tái tục kỳ hạn mới)
    rolloverMode: z
      .enum(["renew_principal", "renew_principal_and_interest"])
      .optional(),
    newTermMonths: z.number().int().min(1).max(120).optional(),
    newAnnualInterestRate: positiveDecimalString.optional(),
    note: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.settlementType !== "rollover" &&
      !data.destinationWalletId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationWalletId"],
        message: "Vui lòng chọn ví tài sản nhận tiền tất toán.",
      });
    }
    if (
      data.settlementType === "rollover" &&
      data.rolloverMode === "renew_principal" &&
      Number(data.interestReceivedAmount || 0) > 0 &&
      !data.destinationWalletId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationWalletId"],
        message: "Vui lòng chọn ví nhận tiền lãi kỳ trước khi tái tục gốc.",
      });
    }
  });
