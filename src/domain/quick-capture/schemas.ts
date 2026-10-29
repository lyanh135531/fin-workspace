import { z } from "zod";
import { idSchema, optionalTrimmedTextSchema } from "@/domain/common/schemas";
import { positiveMoneySchema } from "@/lib/decimal";

const CANCEL_LABELS = new Set([
  "bỏ qua giao dịch",
  "bo qua giao dich",
  "bỏ qua",
  "bo qua",
  "❌ không ghi",
  "không ghi",
  "khong ghi",
  "đóng",
  "dong",
  "hủy",
  "huy",
  "cancel",
]);

const SOFT_ERROR_PREFIXES = ["thông báo:", "thong bao:"];

export function isQuickCaptureSoftDismissOption(
  raw: string | undefined | null,
): boolean {
  if (!raw) return false;
  const normalized = raw.normalize("NFC").trim().toLowerCase();
  if (normalized === "đóng" || normalized === "dong") return true;
  return SOFT_ERROR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isQuickCaptureCancelOption(
  raw: string | undefined | null,
): boolean {
  if (!raw) return false;
  if (isQuickCaptureSoftDismissOption(raw)) return true;
  return CANCEL_LABELS.has(raw.normalize("NFC").trim().toLowerCase());
}

const optionalIdFromShortcutSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, idSchema.optional());

const receiptTextRawSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .join("\n");
  }
  return value;
}, z.string());

const deviceNameSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng đặt tên cho thiết bị kết nối.")
  .max(80, "Tên thiết bị không vượt quá 80 ký tự.")
  .transform((value) => value.normalize("NFC"));

export const createQuickCaptureTokenSchema = z.object({
  workspaceId: idSchema,
  defaultWalletId: idSchema,
  defaultCategoryId: optionalIdFromShortcutSchema,
  name: deviceNameSchema,
  expiresInDays: z.coerce.number().int().min(7).max(365).default(90),
});

export const revokeQuickCaptureTokenSchema = z.object({
  tokenId: idSchema,
});

function normalizeShortcutRecord(
  raw: unknown,
  aliases: Record<string, string>,
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const source = raw as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  for (const [key, value] of Object.entries(source)) {
    const canonical = aliases[key.trim().toLowerCase()];
    if (canonical && normalized[canonical] === undefined) {
      normalized[canonical] = value;
    }
  }

  return normalized;
}

const PARSE_KEY_ALIASES: Record<string, string> = {
  text: "text",
  content: "text",
  body: "text",
  amount: "amount",
  payeename: "payeeName",
  payee_name: "payeeName",
};

const COMMIT_KEY_ALIASES: Record<string, string> = {
  draftid: "draftId",
  draft_id: "draftId",
  selectedoption: "selectedOption",
  selected_option: "selectedOption",
  option: "selectedOption",
  choice: "selectedOption",
  chosenitem: "selectedOption",
  chosen_item: "selectedOption",
  categoryid: "categoryId",
  category_id: "categoryId",
  walletid: "walletId",
  wallet_id: "walletId",
  text: "text",
  content: "text",
  amount: "amount",
  payeename: "payeeName",
  payee_name: "payeeName",
  note: "note",
  externalref: "externalRef",
  external_ref: "externalRef",
};

export const parseReceiptInputSchema = z.preprocess(
  (raw) => normalizeShortcutRecord(raw, PARSE_KEY_ALIASES),
  z.object({
    text: receiptTextRawSchema
      .pipe(
        z
          .string()
          .trim()
          .min(3, "Chưa đọc được nội dung biên lai trên màn hình.")
          .max(8_000, "Nội dung gửi lên vượt quá giới hạn cho phép."),
      )
      .transform((value) => value.normalize("NFC")),
    amount: positiveMoneySchema.optional(),
    payeeName: optionalTrimmedTextSchema,
  }),
);

export const commitQuickCaptureSchema = z.preprocess(
  (raw) => normalizeShortcutRecord(raw, COMMIT_KEY_ALIASES),
  z
    .object({
      draftId: optionalIdFromShortcutSchema,
      selectedOption: z
        .string()
        .trim()
        .max(200)
        .optional()
        .transform((value) => (value ? value.normalize("NFC") : undefined)),
      categoryId: optionalIdFromShortcutSchema,
      walletId: optionalIdFromShortcutSchema,
      text: z.preprocess((value) => {
        if (value === null || value === undefined) return undefined;
        if (Array.isArray(value)) {
          const joined = value
            .map((item) =>
              typeof item === "string" ? item : String(item ?? ""),
            )
            .join("\n")
            .trim();
          return joined || undefined;
        }
        if (typeof value === "string" && value.trim() === "") return undefined;
        return value;
      }, z
        .string()
        .trim()
        .max(8_000)
        .optional()
        .transform((value) => (value ? value.normalize("NFC") : undefined))),
      amount: positiveMoneySchema.optional(),
      payeeName: optionalTrimmedTextSchema,
      note: optionalTrimmedTextSchema,
      externalRef: z
        .string()
        .trim()
        .max(80)
        .optional()
        .transform((value) => value || undefined),
    })
    .superRefine((data, ctx) => {
      if (isQuickCaptureCancelOption(data.selectedOption)) {
        return;
      }
      if (
        !data.draftId &&
        !data.selectedOption &&
        !data.categoryId &&
        !data.text &&
        !data.amount
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["draftId"],
          message: "Thiếu thông tin phiên giao dịch để lưu vào sổ.",
        });
      }
    }),
);

export type CreateQuickCaptureTokenInput = z.output<typeof createQuickCaptureTokenSchema>;
export type RevokeQuickCaptureTokenInput = z.output<typeof revokeQuickCaptureTokenSchema>;
export type ParseReceiptInput = z.output<typeof parseReceiptInputSchema>;
export type CommitQuickCaptureInput = z.output<typeof commitQuickCaptureSchema>;
