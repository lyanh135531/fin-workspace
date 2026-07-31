import Decimal from "decimal.js";
import { z } from "zod";
import { AppError } from "@/lib/errors";

export const FRANKFURTER_USD_VND_URL = "https://api.frankfurter.dev/v2/rate/USD/VND";
export const VANG_TODAY_XAUUSD_URL = "https://www.vang.today/api/prices?type=XAUUSD";
export const GRAMS_PER_TROY_OUNCE = new Decimal("31.1034768");
export const GRAMS_PER_CHI = new Decimal("3.75");
export const OUNCE_TO_CHI_FACTOR = GRAMS_PER_CHI.div(GRAMS_PER_TROY_OUNCE);

const apiDecimalSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    const decimal = new Decimal(String(value));
    if (!decimal.isFinite()) throw new Error("not finite");
    return decimal;
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Giá trị số từ API không hợp lệ." });
    return z.NEVER;
  }
});

const exchangeRateResponseSchema = z.object({
  date: z.string().optional(),
  base: z.string().optional(),
  quote: z.string().optional(),
  rate: apiDecimalSchema.refine((rate) => rate.gt(0), "Tỷ giá USD/VND phải lớn hơn 0."),
});

const goldPriceRecordSchema = z.object({
  buy: apiDecimalSchema.refine((price) => price.gt(0), "Giá mua XAUUSD phải lớn hơn 0."),
  timestamp: z.number().optional(),
  current_time: z.number().optional(),
  update_time: z.number().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  type: z.string().optional(),
  type_code: z.string().optional(),
});

type Fetcher = typeof fetch;

export type WorldGoldBaseQuote = {
  usdVndRate: Decimal;
  xauApiBuyUsdPerOunce: Decimal;
  baseSellVndPerChi: Decimal;
  priceAt: Date;
  exchangeRateDate: string | null;
};

export type CurrencyRateQuote = {
  base: string;
  quote: string;
  rate: Decimal;
  rateDate: string | null;
  priceAt: Date;
};

function extractGoldRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if ("buy" in root) return root;
  if (root.prices && typeof root.prices === "object" && !Array.isArray(root.prices)) {
    const xau = (root.prices as Record<string, unknown>).XAUUSD;
    if (xau && typeof xau === "object" && !Array.isArray(xau)) {
      return { ...xau as Record<string, unknown>, timestamp: root.timestamp };
    }
  }
  if (Array.isArray(root.data)) {
    const record = root.data.find((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const row = item as Record<string, unknown>;
      return row.type === "XAUUSD" || row.type_code === "XAUUSD";
    });
    if (record && typeof record === "object" && !Array.isArray(record)) return record;
  }
  return null;
}

async function fetchJson(fetcher: Fetcher, url: string, signal: AbortSignal) {
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new AppError("EXTERNAL_SERVICE_ERROR", `Nguồn giá trả về HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

export function frankfurterRateUrl(base: string, quote = "VND") {
  const normalizedBase = base.trim().toUpperCase();
  const normalizedQuote = quote.trim().toUpperCase();
  if (
    !/^[A-Z]{3}$/.test(normalizedBase)
    || !/^[A-Z]{3}$/.test(normalizedQuote)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Mã tiền tệ phải gồm đúng 3 ký tự.",
    );
  }
  return `https://api.frankfurter.dev/v2/rate/${normalizedBase}/${normalizedQuote}`;
}

export async function fetchCurrencyRate(
  base: string,
  quote = "VND",
  fetcher: Fetcher = fetch,
  now = new Date(),
): Promise<CurrencyRateQuote> {
  const normalizedBase = base.trim().toUpperCase();
  const normalizedQuote = quote.trim().toUpperCase();
  let response: unknown;
  try {
    response = await fetchJson(
      fetcher,
      frankfurterRateUrl(normalizedBase, normalizedQuote),
      AbortSignal.timeout(10_000),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "EXTERNAL_SERVICE_ERROR",
      `Không thể lấy tỷ giá ${normalizedBase}/${normalizedQuote}: ${error instanceof Error ? error.message : "unknown"}.`,
    );
  }
  const parsed = exchangeRateResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AppError(
      "EXTERNAL_SERVICE_ERROR",
      `Response tỷ giá ${normalizedBase}/${normalizedQuote} không hợp lệ.`,
    );
  }
  return {
    base: parsed.data.base?.toUpperCase() ?? normalizedBase,
    quote: parsed.data.quote?.toUpperCase() ?? normalizedQuote,
    rate: parsed.data.rate,
    rateDate: parsed.data.date ?? null,
    priceAt: now,
  };
}

export async function fetchWorldGoldBaseQuote(
  fetcher: Fetcher = fetch,
  now = new Date(),
): Promise<WorldGoldBaseQuote> {
  const signal = AbortSignal.timeout(10_000);
  let responses: [unknown, unknown];
  try {
    responses = await Promise.all([
      fetchJson(fetcher, FRANKFURTER_USD_VND_URL, signal),
      fetchJson(fetcher, VANG_TODAY_XAUUSD_URL, signal),
    ]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "EXTERNAL_SERVICE_ERROR",
      `Không thể lấy tỷ giá hoặc giá vàng thế giới: ${error instanceof Error ? error.message : "unknown"}.`,
    );
  }

  const exchange = exchangeRateResponseSchema.safeParse(responses[0]);
  if (!exchange.success) {
    throw new AppError("EXTERNAL_SERVICE_ERROR", "Response tỷ giá USD/VND không hợp lệ.");
  }
  const rawGold = extractGoldRecord(responses[1]);
  const gold = goldPriceRecordSchema.safeParse(rawGold);
  if (!gold.success) {
    throw new AppError("EXTERNAL_SERVICE_ERROR", "Response giá XAUUSD không hợp lệ.");
  }

  const sourceTimestamp = gold.data.timestamp
    ?? gold.data.current_time
    ?? gold.data.update_time;
  const priceAt = sourceTimestamp && Number.isFinite(sourceTimestamp)
    ? new Date(sourceTimestamp * 1_000)
    : now;
  const baseSell = gold.data.buy
    .times(exchange.data.rate)
    .times(OUNCE_TO_CHI_FACTOR)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return {
    usdVndRate: exchange.data.rate,
    xauApiBuyUsdPerOunce: gold.data.buy,
    baseSellVndPerChi: baseSell,
    priceAt,
    exchangeRateDate: exchange.data.date ?? null,
  };
}
