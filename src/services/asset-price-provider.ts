import type Decimal from "decimal.js";

/**
 * Stable boundary for the external price API that will be supplied later.
 * Providers must return the price at which the market buys from the user
 * (`bidPrice`) separately from the price charged to the user (`askPrice`).
 */
export type AssetQuote = {
  symbol: string;
  bidPrice: Decimal;
  askPrice?: Decimal;
  quoteCurrency: string;
  priceAt: Date;
  provider: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export interface AssetPriceProvider {
  getQuote(symbol: string): Promise<AssetQuote>;
}
