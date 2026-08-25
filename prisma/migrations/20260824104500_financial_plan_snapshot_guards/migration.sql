CREATE OR REPLACE FUNCTION "validate_plan_jar_allocation_set"()
RETURNS TRIGGER AS $$
DECLARE
  target_plan_id UUID := COALESCE(NEW.financial_plan_id, OLD.financial_plan_id);
  invalid_sets INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "FINANCIAL_PLAN" WHERE "id" = target_plan_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COUNT(*) INTO invalid_sets
  FROM (
    SELECT "effective_month"
    FROM "PLAN_JAR_ALLOCATION"
    WHERE "financial_plan_id" = target_plan_id
    GROUP BY "effective_month"
    HAVING COUNT(*) <> 6 OR SUM("percentage") <> 100
  ) invalid;
  IF invalid_sets > 0 THEN
    RAISE EXCEPTION 'Each financial plan allocation period must contain six jars totaling 100 percent';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PLAN_JAR_ALLOCATION_complete_set_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "PLAN_JAR_ALLOCATION"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_plan_jar_allocation_set"();

CREATE OR REPLACE FUNCTION "validate_financial_plan_month_jar_set"()
RETURNS TRIGGER AS $$
DECLARE
  target_month_id UUID := COALESCE(NEW.financial_plan_month_id, OLD.financial_plan_month_id);
  jar_count INTEGER;
  percentage_total DECIMAL;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "FINANCIAL_PLAN_MONTH" WHERE "id" = target_month_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COUNT(*), COALESCE(SUM("percentage"), 0)
  INTO jar_count, percentage_total
  FROM "FINANCIAL_PLAN_MONTH_JAR"
  WHERE "financial_plan_month_id" = target_month_id;
  IF jar_count <> 6 OR percentage_total <> 100 THEN
    RAISE EXCEPTION 'Each closed financial plan month must contain six jars totaling 100 percent';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "FINANCIAL_PLAN_MONTH_JAR_complete_set_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "FINANCIAL_PLAN_MONTH_JAR"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_financial_plan_month_jar_set"();

CREATE OR REPLACE FUNCTION "prevent_financial_plan_snapshot_update"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Closed financial plan snapshots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FINANCIAL_PLAN_MONTH_immutable_update_trigger"
BEFORE UPDATE ON "FINANCIAL_PLAN_MONTH"
FOR EACH ROW EXECUTE FUNCTION "prevent_financial_plan_snapshot_update"();

CREATE TRIGGER "FINANCIAL_PLAN_MONTH_JAR_immutable_update_trigger"
BEFORE UPDATE ON "FINANCIAL_PLAN_MONTH_JAR"
FOR EACH ROW EXECUTE FUNCTION "prevent_financial_plan_snapshot_update"();
