-- Migration 007: Add UNIQUE constraints to sessions and weekly_checkins
-- Prevents duplicate session logs and check-ins (BUG-003)

-- Remove any existing duplicates before adding constraints
DELETE FROM sessions a USING sessions b
WHERE a.id > b.id
  AND a.plan_id = b.plan_id
  AND a.week_number = b.week_number
  AND a.day_number = b.day_number;

DELETE FROM weekly_checkins a USING weekly_checkins b
WHERE a.id > b.id
  AND a.plan_id = b.plan_id
  AND a.week_number = b.week_number;

-- Add unique constraints
ALTER TABLE sessions
  ADD CONSTRAINT uq_session_plan_week_day UNIQUE (plan_id, week_number, day_number);

ALTER TABLE weekly_checkins
  ADD CONSTRAINT uq_checkin_plan_week UNIQUE (plan_id, week_number);
