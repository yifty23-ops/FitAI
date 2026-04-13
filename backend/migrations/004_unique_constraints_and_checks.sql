-- Migration 004: Add UNIQUE constraints to prevent race-condition duplicates
-- and CHECK constraints for data integrity.

-- Prevent duplicate sessions for the same plan/week/day
ALTER TABLE sessions
  ADD CONSTRAINT unique_session_per_day UNIQUE (plan_id, week_number, day_number);

-- Prevent duplicate check-ins for the same plan/week
ALTER TABLE weekly_checkins
  ADD CONSTRAINT unique_checkin_per_week UNIQUE (plan_id, week_number);

-- Prevent multiple profiles per user
ALTER TABLE profiles
  ADD CONSTRAINT one_profile_per_user UNIQUE (user_id);

-- Ensure week numbers are positive
ALTER TABLE sessions
  ADD CONSTRAINT check_session_week_positive CHECK (week_number > 0);

ALTER TABLE sessions
  ADD CONSTRAINT check_session_day_positive CHECK (day_number > 0);

ALTER TABLE weekly_checkins
  ADD CONSTRAINT check_checkin_week_positive CHECK (week_number > 0);
