import { describe, expect, it } from "vitest";
import {
  detectPaymentProvider,
  normalizePayeeKey,
  parsePaymentReceiptText,
} from "@/domain/quick-capture/receipt-parser";
import {
  commitQuickCaptureSchema,
  createQuickCaptureTokenSchema,
  parseReceiptInputSchema,
} from "@/domain/quick-capture/schemas";

describe("parsePaymentReceiptText", () => {
  it("parses iOS Live Text OCR from MoMo payment success screen while ignoring available balance and free fee", () => {
    const rawOcr = `
      9:41
      Giao dịch thành công
      -45.000đ
      Chuyển tiền đến
      NGUYỄN VĂN AN
      Lời nhắn
      Com trua van phong
      Thời gian thanh toán
      29/10/2026 - 12:15
      Mã giao dịch
      71829304112
      Nguồn tiền
      Ví MoMo
      Phí giao dịch
      Miễn phí
      Số dư khả dụng: 2.450.000đ
    `;

    const parsed = parsePaymentReceiptText(rawOcr);

    expect(parsed.amount?.toFixed(0)).toBe("45000");
    expect(parsed.payeeName).toBe("NGUYỄN VĂN AN");
    expect(parsed.payeeKey).toBe("NGUYEN VAN AN");
    expect(parsed.note).toBe("Com trua van phong");
    expect(parsed.externalRef).toBe("71829304112");
    expect(parsed.provider).toBe("momo");
  });

  it("parses MoMo VietQR bank transfer without confusing receiving Vietcombank with funding MoMo wallet", () => {
    const momoVietQrOcr = `
      9:45
      Giao dịch thành công
      55.000d
      Tên người nhận NGUYEN VAN B
      Ngân hàng Vietcombank
      Số tài khoản ****8899
      Nội dung chuyển tiền Thanh toan cafe sang
      Tài khoản/Thẻ Ví MoMo
      Mã giao dịch 70123456789
      Tổng phí Miễn phí
    `;

    const parsed = parsePaymentReceiptText(momoVietQrOcr);

    expect(parsed.amount?.toFixed(0)).toBe("55000");
    expect(parsed.payeeName).toBe("NGUYEN VAN B");
    expect(parsed.note).toBe("Thanh toan cafe sang");
    expect(parsed.externalRef).toBe("70123456789");
    expect(parsed.provider).toBe("momo");
  });

  it("detects Techcombank source app even when destination bank is Vietcombank", () => {
    const tcbToVcbOcr = `
      Techcombank
      Đã chuyển thành công
      VND 320,000
      Người nhận
      TRAN THI BICH
      Ngân hàng nhận
      Vietcombank
      Nội dung chuyển tiền: Mua trai cay
      Số tham chiếu
      TCB20261029001
    `;

    const parsed = parsePaymentReceiptText(tcbToVcbOcr);

    expect(parsed.amount?.toFixed(0)).toBe("320000");
    expect(parsed.payeeName).toBe("TRAN THI BICH");
    expect(parsed.note).toBe("Mua trai cay");
    expect(parsed.externalRef).toBe("TCB20261029001");
    expect(parsed.provider).toBe("tcb");
  });

  it("parses Android single-line MoMo push notification without mistaking balance for amount", () => {
    const notification =
      'MoMo: Bạn vừa chuyển 68.000đ đến HIGHLANDS COFFEE ("Cafe sang"). Số dư ví: 1.320.000đ. Mã GD: MM9988776655';

    const parsed = parsePaymentReceiptText(notification);

    expect(parsed.amount?.toFixed(0)).toBe("68000");
    expect(parsed.payeeName).toBe("HIGHLANDS COFFEE");
    expect(parsed.payeeKey).toBe("HIGHLANDS COFFEE");
    expect(parsed.note).toBe("Cafe sang");
    expect(parsed.externalRef).toBe("MM9988776655");
    expect(parsed.provider).toBe("momo");
  });

  it("parses Vietcombank Digibank transfer receipt screen", () => {
    const vcbOcr = `
      VCB Digibank
      Chuyển khoản thành công
      125,000 VND
      Tên người thụ hưởng
      CONG TY TNHH GRAB VIET NAM
      Nội dung
      GrabBike di hop
      Mã giao dịch: FT26302918273
      Số dư cuối: 15,890,000 VND
    `;

    const parsed = parsePaymentReceiptText(vcbOcr);

    expect(parsed.amount?.toFixed(0)).toBe("125000");
    expect(parsed.payeeName).toBe("CONG TY TNHH GRAB VIET NAM");
    expect(parsed.note).toBe("GrabBike di hop");
    expect(parsed.externalRef).toBe("FT26302918273");
    expect(parsed.provider).toBe("vcb");
  });

  it("returns null amount when text only contains balance or unrelated text", () => {
    const nonReceipt = `
      Số dư khả dụng: 5.000.000đ
      Hạn mức còn lại: 20.000.000đ
    `;

    const parsed = parsePaymentReceiptText(nonReceipt);
    expect(parsed.amount).toBeNull();
  });

  it("normalizes Vietnamese diacritics and punctuation in payeeKey", () => {
    expect(normalizePayeeKey("  Phở   Đình - Quận 1!! ")).toBe("PHO DINH QUAN 1");
    expect(detectPaymentProvider("Thanh toán qua Túi Thần Tài")).toBe("momo");
    expect(detectPaymentProvider("MB Bank - Giao dịch thành công")).toBe("mb");
  });
});

describe("quick capture schemas", () => {
  it("validates token creation input and applies default expiry", () => {
    const parsed = createQuickCaptureTokenSchema.parse({
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      defaultWalletId: "550e8400-e29b-41d4-a716-446655440001",
      name: "  iPhone 15 Pro  ",
    });

    expect(parsed.name).toBe("iPhone 15 Pro");
    expect(parsed.expiresInDays).toBe(90);
    expect(parsed.defaultCategoryId).toBeUndefined();
  });

  it("accepts both string and string[] from iOS Shortcuts Extract Text", () => {
    expect(() => parseReceiptInputSchema.parse({ text: "ab" })).toThrow();
    const fromLines = parseReceiptInputSchema.parse({
      text: ["Giao dịch thành công", "-45.000đ", "Ví MoMo"],
    });
    expect(fromLines.text).toContain("-45.000đ");
  });

  it("handles empty draftId string when user selects Đóng / Bỏ qua in iOS Shortcuts", () => {
    expect(() => commitQuickCaptureSchema.parse({})).toThrow();

    const softDismiss = commitQuickCaptureSchema.parse({
      draftId: "",
      selectedOption: "Đóng",
    });
    expect(softDismiss.draftId).toBeUndefined();
    expect(softDismiss.selectedOption).toBe("Đóng");

    const byDraft = commitQuickCaptureSchema.parse({
      draftId: "550e8400-e29b-41d4-a716-446655440002",
      selectedOption: "Ăn uống · Gợi ý",
    });
    expect(byDraft.selectedOption).toBe("Ăn uống · Gợi ý");

    const linearShortcutCommit = commitQuickCaptureSchema.parse({
      SelectedOption: "Ăn uống · Gợi ý",
    });
    expect(linearShortcutCommit.draftId).toBeUndefined();
    expect(linearShortcutCommit.selectedOption).toBe("Ăn uống · Gợi ý");

    const capitalizedParse = parseReceiptInputSchema.parse({
      Text: "Giao dịch thành công -45.000đ Ví MoMo",
    });
    expect(capitalizedParse.text).toContain("-45.000đ");
  });
});
