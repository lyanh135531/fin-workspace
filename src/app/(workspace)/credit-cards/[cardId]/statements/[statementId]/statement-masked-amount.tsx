"use client";

import { formatAmount } from "@/lib/format";
import { usePrivacyMask } from "@/lib/privacy-mask";

export function StatementAmount({
  value,
  prefix,
}: {
  value: string;
  prefix?: string;
}) {
  const privacyMasked = usePrivacyMask();
  return (
    <>
      {!privacyMasked && prefix ? prefix : ""}
      {formatAmount(value)}
    </>
  );
}
