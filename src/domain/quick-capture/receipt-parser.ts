import Decimal from "decimal.js";

export type PaymentProviderCode =
  | "momo"
  | "vcb"
  | "tcb"
  | "mb"
  | "acb"
  | "bidv"
  | "icb"
  | "vpb"
  | "tpb"
  | "zalopay"
  | "shopeepay";

export type ParsedReceiptResult = {
  amount: Decimal | null;
  payeeName: string | null;
  payeeKey: string | null;
  note: string | null;
  externalRef: string | null;
  provider: PaymentProviderCode | null;
};

const BALANCE_OR_FEE_CONTEXT =
  /(?:số\s*dư(?:\s*[^\d\n:]{0,24})?|so\s*du(?:\s*[^\d\n:]{0,24})?|khả\s*dụng|kha\s*dung|hạn\s*mức(?:\s*[^\d\n:]{0,24})?|han\s*muc(?:\s*[^\d\n:]{0,24})?|tổng\s*phí|phí\s*(?:giao\s*dịch|dịch\s*vụ|chuyển\s*tiền)|phi\s*giao\s*dich|hoàn\s*tiền(?:\s*tối\s*đa)?|tích\s*điểm|xu\s*thưởng)\s*[:\-]?\s*$/iu;

const TRANSACTION_HEADLINE_CONTEXT =
  /(?:giao\s*dịch\s*thành\s*công|chuyển\s*(?:tiền|khoản)\s*thành\s*công|thanh\s*toán\s*thành\s*công|đã\s*chuyển(?:\s*(?:tiền|khoản))?(?:\s*thành\s*công)?|bạn\s*(?:vừa|đã)\s*(?:chuyển(?:\s*tiền)?(?:\s*thành\s*công)?|thanh\s*toán)|số\s*tiền(?:\s*giao\s*dịch|\s*chuyển|\s*thanh\s*toán)?|tổng\s*tiền(?:\s*thanh\s*toán)?)/iu;

const PAYEE_INLINE_PATTERNS: RegExp[] = [
  /(?:bạn\s*(?:vừa|đã)\s*(?:chuyển(?:\s*tiền)?(?:\s*thành\s*công)?|thanh\s*toán)(?:\s+[^\n]{1,36}?)?\s+(?:đến|cho|tới))[ \t]+([^\n.(]+?)(?:\s*\(|\.\s+Số\s*dư|\.\s+Mã\s*GD|\s+vào\s+lúc|$)/iu,
  /^(?:chuyển\s*tiền\s*(?:đến|tới|cho)|thanh\s*toán\s*cho)[ \t]*(?:[:\-][ \t]*|[ \t]+)([^\n]+)$/imu,
  /^(?:tên\s*người\s*(?:thụ\s*hưởng|nhận)|người\s*(?:thụ\s*hưởng|nhận)|đơn\s*vị\s*chấp\s*nhận(?:\s*thanh\s*toán)?|nhà\s*cung\s*cấp)[ \t]*(?:[:\-][ \t]*|[ \t]+)([^\n]+)$/imu,
];

const PAYEE_LABEL_LINE =
  /^(?:tên\s*người\s*(?:thụ\s*hưởng|nhận)|người\s*(?:thụ\s*hưởng|nhận)|đơn\s*vị\s*chấp\s*nhận(?:\s*thanh\s*toán)?|nhà\s*cung\s*cấp|dịch\s*vụ|chuyển\s*(?:tiền\s*)?(?:đến|tới)|thanh\s*toán\s*cho|tới|đến)\s*:?$/iu;

const NOTE_INLINE_PATTERNS: RegExp[] = [
  /^(?:lời\s*(?:nhắn|chúc)|nội\s*dung(?:\s*chuyển\s*(?:tiền|khoản)|\s*giao\s*dịch)?|diễn\s*giải)[ \t]*(?:[:\-][ \t]*|[ \t]+)([^\n]+)$/imu,
  /\("([^"\n]{2,140})"\)/u,
];

const NOTE_LABEL_LINE =
  /^(?:lời\s*(?:nhắn|chúc)|nội\s*dung(?:\s*chuyển\s*(?:tiền|khoản)|\s*giao\s*dịch)?|diễn\s*giải|ghi\s*chú)\s*:?$/iu;

const TX_REF_INLINE =
  /(?:mã\s*giao\s*dịch|mã\s*gd|ma\s*gd|số\s*tham\s*chiếu|mã\s*tham\s*chiếu)[ \t]*(?:[:\-][ \t]*|[ \t]+)([A-Z0-9][A-Z0-9\-_]{5,39})/iu;

const TX_REF_LABEL_LINE =
  /^(?:mã\s*giao\s*dịch|mã\s*gd|ma\s*gd|số\s*tham\s*chiếu|mã\s*tham\s*chiếu)\s*:?$/iu;

const SOURCE_FUNDING_INLINE =
  /(?:nguồn\s*tiền|tài\s*khoản\s*\/?\s*thẻ|từ\s*tài\s*khoản|tài\s*khoản\s*nguồn)[ \t]*(?:[:\-][ \t]*|[ \t]+)([^\n]+)/iu;

const SOURCE_FUNDING_LABEL_LINE =
  /^(?:nguồn\s*tiền|tài\s*khoản\s*\/?\s*thẻ|từ\s*tài\s*khoản|tài\s*khoản\s*nguồn)\s*:?$/iu;

const DESTINATION_BANK_LABEL_LINE =
  /^(?:ngân\s*hàng(?:\s*(?:nhận|thụ\s*hưởng))?|tới\s*ngân\s*hàng|đến\s*ngân\s*hàng)\s*:?$/iu;

const DESTINATION_BANK_INLINE =
  /^(?:ngân\s*hàng(?:\s*(?:nhận|thụ\s*hưởng))?|tới\s*ngân\s*hàng|đến\s*ngân\s*hàng)\s*(?:[:\-]\s*|\s+).+$/imu;

const NOISE_VALUE_LINE =
  /^(?:miễn\s*phí|0\s*(?:đ|₫|vnd)|thời\s*gian(?:\s*thanh\s*toán)?|nguồn\s*tiền|tài\s*khoản\s*\/?\s*thẻ|mã\s*giao\s*dịch|ngân\s*hàng|số\s*tài\s*khoản|chi\s*tiết|trang\s*chủ|chia\s*sẻ|tiếp\s*tục|không\s*có|trống|\*{2,}\d+|\d{1,2}:\d{2})$/iu;

const PROVIDER_DETECTORS: Array<{ code: PaymentProviderCode; regex: RegExp }> = [
  { code: "momo", regex: /(?:\bmomo\b|túi\s*thần\s*tài|ví\s*trả\s*sau)/iu },
  { code: "vcb", regex: /(?:\bvietcombank\b|\bvcb\s*digibank\b|\bvcb\b)/iu },
  { code: "tcb", regex: /(?:\btechcombank\b|\btcb\b)/iu },
  { code: "mb", regex: /(?:\bmb\s*bank\b|\bmbbank\b)/iu },
  { code: "acb", regex: /(?:\bacb\s*one\b|\bngân\s*hàng\s*á\s*châu\b|\bacb\b)/iu },
  { code: "bidv", regex: /(?:\bbidv\b|\bsmartbanking\b)/iu },
  { code: "icb", regex: /(?:\bvietinbank\b|\bipay\b)/iu },
  { code: "vpb", regex: /(?:\bvpbank\b)/iu },
  { code: "tpb", regex: /(?:\btpbank\b)/iu },
  { code: "zalopay", regex: /(?:\bzalopay\b)/iu },
  { code: "shopeepay", regex: /(?:\bshopeepay\b)/iu },
];

function matchProviderInSegment(segment: string): PaymentProviderCode | null {
  for (const detector of PROVIDER_DETECTORS) {
    if (detector.regex.test(segment)) return detector.code;
  }
  return null;
}

export function normalizePayeeKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 160) : null;
}

function cleanExtractedLabel(value: string): string | null {
  const trimmed = value
    .replace(/\s+/g, " ")
    .replace(/^[•\-:]+|[•\-:]+$/g, "")
    .trim();
  if (!trimmed || trimmed.length < 2 || NOISE_VALUE_LINE.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, 180);
}

export function detectPaymentProvider(text: string): PaymentProviderCode | null {
  const normalized = text.normalize("NFC").replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // 1. Explicit funding source field ("Nguồn tiền: Ví MoMo", "Tài khoản/Thẻ\nTúi Thần Tài")
  const sourceInline = SOURCE_FUNDING_INLINE.exec(normalized);
  if (sourceInline?.[1]) {
    const matched = matchProviderInSegment(sourceInline[1]);
    if (matched) return matched;
  }
  for (let i = 0; i < lines.length - 1; i++) {
    if (SOURCE_FUNDING_LABEL_LINE.test(lines[i] ?? "")) {
      const matched = matchProviderInSegment(lines[i + 1] ?? "");
      if (matched) return matched;
    }
  }

  // 2. Top app header / notification sender (first 2 non-clock lines)
  const nonClockHeaderLines = lines
    .filter((line) => !/^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(line))
    .slice(0, 2);
  for (const headerLine of nonClockHeaderLines) {
    const matched = matchProviderInSegment(headerLine);
    if (matched) return matched;
  }

  // 3. Full text after stripping destination-bank rows (e.g. "Ngân hàng: Vietcombank" in a Techcombank/MoMo transfer)
  const filteredLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i] ?? "";
    if (DESTINATION_BANK_LABEL_LINE.test(current)) {
      i += 1; // Skip destination bank value on next line too
      continue;
    }
    if (DESTINATION_BANK_INLINE.test(current)) {
      continue;
    }
    filteredLines.push(current);
  }

  return matchProviderInSegment(filteredLines.join("\n"));
}

function parseGroupedVndDigits(rawNumber: string): Decimal | null {
  const digitsOnly = rawNumber.replace(/[.,\s]/g, "");
  if (!/^\d{3,15}$/.test(digitsOnly)) return null;
  const amount = new Decimal(digitsOnly);
  if (amount.lte(0) || amount.gt(new Decimal("999999999999"))) return null;
  return amount;
}

function extractBestAmount(lines: string[], fullText: string): Decimal | null {
  type Candidate = { amount: Decimal; score: number };
  const candidates: Candidate[] = [];

  // Currency-tagged patterns: "-45.000đ", "68,500 VND", "VND 85,000", "45000đ", or OCR "55.000d"
  const suffixCurrencyRegex =
    /([+\-])?\s*((?:\d{1,3}(?:[.,]\d{3})+|\d{4,12}))\s*(?:đồng|đ|₫|vnđ|vnd)(?![\p{L}\p{N}])/giu;
  const ocrAsciiDCurrencyRegex =
    /([+\-])?\s*(\d{1,3}(?:[.,]\d{3})+)\s*d(?![\p{L}\p{N}])/giu;
  const prefixCurrencyRegex =
    /(?<![\p{L}\p{N}])(?:vnđ|vnd)\s*([+\-])?\s*((?:\d{1,3}(?:[.,]\d{3})+|\d{4,12}))(?![\p{L}\p{N}])/giu;

  const collectFromLine = (line: string, lineIndex: number) => {
    const prevLine = lineIndex > 0 ? lines[lineIndex - 1] ?? "" : "";
    const prev2Line = lineIndex > 1 ? lines[lineIndex - 2] ?? "" : "";
    const nextLine = lineIndex + 1 < lines.length ? lines[lineIndex + 1] ?? "" : "";

    const evaluateMatch = (
      matchIndex: number,
      sign: string | undefined,
      rawDigits: string,
      baseScore: number,
    ) => {
      const amount = parseGroupedVndDigits(rawDigits);
      if (!amount) return;

      const immediatePrefix = line.slice(Math.max(0, matchIndex - 40), matchIndex);
      if (BALANCE_OR_FEE_CONTEXT.test(immediatePrefix)) {
        return;
      }
      if (matchIndex <= 3 && BALANCE_OR_FEE_CONTEXT.test(prevLine)) {
        return;
      }

      let score = baseScore;
      if (sign === "-") score += 35;
      if (/[.,]\d{3}/.test(rawDigits)) score += 15;
      if (TRANSACTION_HEADLINE_CONTEXT.test(immediatePrefix)) score += 45;
      if (
        TRANSACTION_HEADLINE_CONTEXT.test(prevLine) ||
        TRANSACTION_HEADLINE_CONTEXT.test(prev2Line) ||
        TRANSACTION_HEADLINE_CONTEXT.test(nextLine)
      ) {
        score += 40;
      }
      if (line.trim().length <= 24) score += 20;
      if (lineIndex <= 6) score += 10;

      candidates.push({ amount, score });
    };

    for (const match of line.matchAll(suffixCurrencyRegex)) {
      evaluateMatch(match.index ?? 0, match[1], match[2] ?? "", 50);
    }
    for (const match of line.matchAll(ocrAsciiDCurrencyRegex)) {
      evaluateMatch(match.index ?? 0, match[1], match[2] ?? "", 42);
    }
    for (const match of line.matchAll(prefixCurrencyRegex)) {
      evaluateMatch(match.index ?? 0, match[1], match[2] ?? "", 50);
    }
  };

  lines.forEach((line, idx) => collectFromLine(line, idx));

  // Fallback: standalone grouped number adjacent to success headline (e.g. "-45.000" or "45.000")
  if (candidates.length === 0 && TRANSACTION_HEADLINE_CONTEXT.test(fullText)) {
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const m = /^([+\-])?\s*(\d{1,3}(?:[.,]\d{3})+)$/.exec(trimmed);
      if (!m) return;
      const prevLine = idx > 0 ? lines[idx - 1] ?? "" : "";
      const nextLine = idx + 1 < lines.length ? lines[idx + 1] ?? "" : "";
      if (BALANCE_OR_FEE_CONTEXT.test(prevLine)) return;
      const amount = parseGroupedVndDigits(m[2] ?? "");
      if (amount) {
        const nearHeadline =
          TRANSACTION_HEADLINE_CONTEXT.test(prevLine) ||
          TRANSACTION_HEADLINE_CONTEXT.test(nextLine);
        candidates.push({
          amount,
          score: (m[1] === "-" ? 35 : 15) + (nearHeadline ? 30 : 0),
        });
      }
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.amount ?? null;
}

function extractPayeeName(lines: string[], fullText: string): string | null {
  for (const regex of PAYEE_INLINE_PATTERNS) {
    const match = regex.exec(fullText);
    const cleaned = match?.[1] ? cleanExtractedLabel(match[1]) : null;
    if (cleaned) return cleaned;
  }

  for (let i = 0; i < lines.length - 1; i++) {
    if (PAYEE_LABEL_LINE.test(lines[i] ?? "")) {
      const nextValue = cleanExtractedLabel(lines[i + 1] ?? "");
      if (nextValue) return nextValue;
    }
  }

  return null;
}

function extractNote(lines: string[], fullText: string): string | null {
  for (const regex of NOTE_INLINE_PATTERNS) {
    const match = regex.exec(fullText);
    const cleaned = match?.[1] ? cleanExtractedLabel(match[1]) : null;
    if (cleaned) return cleaned;
  }

  for (let i = 0; i < lines.length - 1; i++) {
    if (NOTE_LABEL_LINE.test(lines[i] ?? "")) {
      const nextValue = cleanExtractedLabel(lines[i + 1] ?? "");
      if (nextValue) return nextValue;
    }
  }

  return null;
}

function extractExternalRef(lines: string[], fullText: string): string | null {
  const inline = TX_REF_INLINE.exec(fullText);
  if (inline?.[1] && /\d/.test(inline[1])) {
    return inline[1].trim().slice(0, 80);
  }

  for (let i = 0; i < lines.length - 1; i++) {
    if (TX_REF_LABEL_LINE.test(lines[i] ?? "")) {
      const candidate = (lines[i + 1] ?? "").trim();
      if (/^[A-Z0-9][A-Z0-9\-_]{5,39}$/i.test(candidate) && /\d/.test(candidate)) {
        return candidate.slice(0, 80);
      }
    }
  }

  return null;
}

export function parsePaymentReceiptText(rawText: string): ParsedReceiptResult {
  const normalized = rawText.normalize("NFC").replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const cleanedText = lines.join("\n");

  const amount = extractBestAmount(lines, cleanedText);
  const payeeName = extractPayeeName(lines, cleanedText);
  const note = extractNote(lines, cleanedText);
  const externalRef = extractExternalRef(lines, cleanedText);
  const provider = detectPaymentProvider(cleanedText);

  return {
    amount,
    payeeName,
    payeeKey: normalizePayeeKey(payeeName),
    note,
    externalRef,
    provider,
  };
}
