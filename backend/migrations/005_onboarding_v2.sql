-- Migration 005: Onboarding V2 — Enhanced profile fields
-- All new columns are nullable for backward compatibility with existing profiles.

-- profiles table: training history
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_age_years INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_recency TEXT;

-- profiles table: goal specificity
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_sub_category TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_est TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_deadline DATE;

-- profiles table: safety screen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS injury_ortho_history TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_pain_level INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chair_stand_proxy BOOLEAN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overhead_reach_proxy BOOLEAN;

-- profiles table: training setup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_days_specific TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS exercise_blacklist TEXT[];

-- profiles table: lifestyle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS protein_intake_check TEXT;

-- profiles table: strength benchmarks (Pro+ only, JSONB: {"weight": number, "reps": number})
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_max_bench JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_max_squat JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_max_deadlift JSONB;

-- users table: elite sport-specific fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS sport_phase TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sport_weekly_hours INTEGER;

-- CHECK constraints for new numeric fields
ALTER TABLE profiles ADD CONSTRAINT check_training_age_years
  CHECK (training_age_years >= 0 AND training_age_years <= 50);

ALTER TABLE profiles ADD CONSTRAINT check_current_pain_level
  CHECK (current_pain_level >= 0 AND current_pain_level <= 10);

ALTER TABLE users ADD CONSTRAINT check_sport_weekly_hours
  CHECK (sport_weekly_hours >= 0 AND sport_weekly_hours <= 40);
