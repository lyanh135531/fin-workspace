-- Earlier deployments already applied daily_expense_reminders before the bill
-- alert column and enabled defaults were added. Apply these changes separately.
-- IF NOT EXISTS also supports databases created from the edited migration.
ALTER TABLE "USER_REMINDER_SETTING"
ADD COLUMN IF NOT EXISTS "last_bill_alert_sent_date" VARCHAR(10);

ALTER TABLE "USER_REMINDER_SETTING"
ALTER COLUMN "noon_enabled" SET DEFAULT true,
ALTER COLUMN "evening_enabled" SET DEFAULT true;
