-- Any returned row is a cutover blocker. This report never mutates financial data.
WITH ledger AS (
  SELECT o."card_wallet_id",
         COALESCE(SUM(o."amount"), 0) - COALESCE(SUM(a.paid), 0) AS outstanding
  FROM "CREDIT_CARD_OBLIGATION_ENTRY" o
  LEFT JOIN (
    SELECT "obligation_entry_id", SUM("amount") AS paid
    FROM "CREDIT_CARD_PAYMENT_ALLOCATION" GROUP BY "obligation_entry_id"
  ) a ON a."obligation_entry_id" = o."id"
  GROUP BY o."card_wallet_id"
)
SELECT 'card_balance' AS invariant, w."id"::text AS entity_id,
       w."current_balance"::text AS expected, COALESCE(l.outstanding, 0)::text AS actual
FROM "WALLETS" w LEFT JOIN ledger l ON l."card_wallet_id" = w."id"
WHERE w."kind" = 'credit_card' AND w."current_balance" <> COALESCE(l.outstanding, 0);
