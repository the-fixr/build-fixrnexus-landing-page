-- Fix the increment function to properly update daily/weekly/monthly counters

CREATE OR REPLACE FUNCTION increment_oracle_call_count()
RETURNS TRIGGER AS $$
DECLARE
  last_call_date DATE;
BEGIN
  -- Get the last call date for this oracle
  SELECT DATE(last_call_at) INTO last_call_date
  FROM oracles
  WHERE id = NEW.oracle_id;

  -- Update the oracle's call counters
  UPDATE oracles
  SET
    total_api_calls = total_api_calls + 1,
    -- Reset daily counter if it's a new day, otherwise increment
    calls_today = CASE
      WHEN last_call_date IS NULL OR last_call_date < CURRENT_DATE THEN 1
      ELSE calls_today + 1
    END,
    -- Reset weekly counter if it's a new week, otherwise increment
    calls_this_week = CASE
      WHEN last_call_date IS NULL OR DATE_TRUNC('week', last_call_date) < DATE_TRUNC('week', CURRENT_DATE) THEN 1
      ELSE calls_this_week + 1
    END,
    -- Reset monthly counter if it's a new month, otherwise increment
    calls_this_month = CASE
      WHEN last_call_date IS NULL OR DATE_TRUNC('month', last_call_date) < DATE_TRUNC('month', CURRENT_DATE) THEN 1
      ELSE calls_this_month + 1
    END,
    last_call_at = NEW.created_at
  WHERE id = NEW.oracle_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
