UPDATE "RECURRING_TRANSACTION"
SET
  "day_of_month" = EXTRACT(DAY FROM "start_date")::INTEGER,
  "next_execution_date" = (
    DATE_TRUNC('month', "next_execution_date")
    + (
      LEAST(
        EXTRACT(DAY FROM "start_date")::INTEGER,
        EXTRACT(
          DAY FROM (
            DATE_TRUNC('month', "next_execution_date")
            + INTERVAL '1 month'
            - INTERVAL '1 day'
          )
        )::INTEGER
      ) - 1
    ) * INTERVAL '1 day'
  )::DATE;
