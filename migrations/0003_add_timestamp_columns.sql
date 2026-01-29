-- Add timestamp columns for arrived_at and empty_at to cars table
-- These track when cars were marked as arrived and completed/empty

ALTER TABLE cars ADD COLUMN arrived_at TEXT DEFAULT NULL;
ALTER TABLE cars ADD COLUMN empty_at TEXT DEFAULT NULL;

-- Backfill arrived_at from audit_log where field_changed = 'arrived' and new_value = 'true'
UPDATE cars SET arrived_at = (
  SELECT timestamp FROM audit_log 
  WHERE audit_log.car_id = cars.id 
  AND audit_log.field_changed = 'arrived' 
  AND audit_log.new_value = 'true'
  ORDER BY timestamp DESC LIMIT 1
) WHERE arrived = 1 AND arrived_at IS NULL;

-- Backfill empty_at from audit_log where field_changed = 'empty' and new_value = 'true'  
UPDATE cars SET empty_at = (
  SELECT timestamp FROM audit_log 
  WHERE audit_log.car_id = cars.id 
  AND audit_log.field_changed = 'empty' 
  AND audit_log.new_value = 'true'
  ORDER BY timestamp DESC LIMIT 1
) WHERE empty = 1 AND empty_at IS NULL;
