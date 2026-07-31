import { describe, expect, it, vi } from "vitest";
import {
  fetchCurrencyRate,
  fetchWorldGoldBaseQuote,
  frankfurterRateUrl,
  OUNCE_TO_CHI_FACTOR,
} from "@/services/world-gold-price-provider";

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("world gold price conversion", () => {
  it("builds a generic Frankfurter currency pair URL", () => {
    expect(frankfurterRateUrl("cad", "vnd"))
      .toBe("https://api.frankfurter.dev/v2/rate/CAD/VND");
  });

  it("loads a configured currency rate", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      date: "2026-07-30",
      base: "CAD",
      quote: "VND",
      rate: 19123.45,
    }));
    const now = new Date("2026-07-31T01:00:00.000Z");

    const quote = await fetchCurrencyRate(
      "cad",
      "vnd",
      fetcher as typeof fetch,
      now,
    );

    expect(quote.base).toBe("CAD");
    expect(quote.quote).toBe("VND");
    expect(quote.rate.toString()).toBe("19123.45");
    expect(quote.rateDate).toBe("2026-07-30");
    expect(quote.priceAt).toEqual(now);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rate/CAD/VND",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("uses the required ounce-to-chi factor", () => {
    expect(OUNCE_TO_CHI_FACTOR.toSignificantDigits(12).toString())
      .toBe("0.120565299632");
  });

  it("uses API buy as the only gold market reference", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        date: "2026-07-29",
        base: "USD",
        quote: "VND",
        rate: 26245,
      }))
      .mockResolvedValueOnce(response({
        success: true,
        timestamp: 1785312005,
        type: "XAUUSD",
        buy: 4045.1,
        sell: 4046.2,
      }));

    const quote = await fetchWorldGoldBaseQuote(fetcher as typeof fetch);

    expect(quote.xauApiBuyUsdPerOunce.toString()).toBe("4045.1");
    expect(quote.baseSellVndPerChi.toString()).toBe("12799652.212");
    expect(quote.exchangeRateDate).toBe("2026-07-29");
  });

  it("ignores the API sell value when it is zero", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ rate: "26245" }))
      .mockResolvedValueOnce(response({
        success: true,
        timestamp: 1785312005,
        buy: "4045.1",
        sell: 0,
      }));

    const quote = await fetchWorldGoldBaseQuote(fetcher as typeof fetch);

    expect(quote.xauApiBuyUsdPerOunce.toString()).toBe("4045.1");
    expect(quote.baseSellVndPerChi.toString()).toBe("12799652.212");
  });
});
