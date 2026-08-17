import Decimal from "decimal.js";

type AmountFormatOptions = {
  decimalSeparator?: string;
  groupSeparator?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

const defaultAmountFormat: Required<AmountFormatOptions> = {
  decimalSeparator: ",",
  groupSeparator: ".",
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
};

const billion = new Decimal("1000000000");

function formatDecimalAmount(
  amount: Decimal,
  options: AmountFormatOptions = {},
): string {
  const settings = { ...defaultAmountFormat, ...options };
  const fixed = amount.toFixed(settings.maximumFractionDigits);
  const [rawInteger, rawFraction] = fixed.replace("-", "").split(".");
  const sign = amount.isNegative() ? "-" : "";
  const groupedInteger = rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, settings.groupSeparator);
  const trimmedFraction = (rawFraction ?? "").replace(/0+$/, "");
  const fraction = trimmedFraction.padEnd(settings.minimumFractionDigits, "0");

  return fraction ? `${sign}${groupedInteger}${settings.decimalSeparator}${fraction}` : `${sign}${groupedInteger}`;
}

export function formatAmount(value: Decimal.Value, options: AmountFormatOptions = {}): string {
  const amount = new Decimal(value);
  if (amount.abs().greaterThanOrEqualTo(billion)) {
    return `${formatDecimalAmount(amount.dividedBy(billion), {
      ...options,
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(options.maximumFractionDigits ?? 2, 2),
    })} tỷ`;
  }

  return formatDecimalAmount(amount, options);
}

export function formatCompactAmount(value: Decimal.Value): string {
  const amount = new Decimal(value);
  const absoluteAmount = amount.abs();
  const units = [
    { threshold: new Decimal("1000000000"), label: "tỷ" },
    { threshold: new Decimal("1000000"), label: "triệu" },
    { threshold: new Decimal("1000"), label: "nghìn" },
  ];

  const unit = units.find((item) => absoluteAmount.greaterThanOrEqualTo(item.threshold));
  if (!unit) return formatAmount(amount, { maximumFractionDigits: 0 });

  return `${formatAmount(amount.dividedBy(unit.threshold), { maximumFractionDigits: 1 })} ${unit.label}`;
}
