-- Phase 2: Add missing indexes and CASCADE constraints
-- Run: psql $DATABASE_URL -f backend/migrations/003_indexes_and_cascade.sql

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sessions_plan_week ON sessions(plan_id, week_number);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_plan_week ON weekly_checkins(plan_id, week_number);
CREATE INDEX IF NOT EXISTS idx_plans_user_active ON plans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_adaptations_plan ON adaptation_log(plan_id);
CREATE INDEX IF NOT EXISTS idx_collective_hash ON collective_results(profile_hash);
CREATE INDEX IF NOT EXISTS idx_collective_sport ON collective_results(sport);
CREATE INDEX IF NOT EXISTS idx_research_cache_hash_tier ON research_cache(profile_hash, tier);

-- Add ON DELETE CASCADE to foreign keys
-- Sessions -> Plans
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_plan_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

-- Weekly Checkins -> Plans
ALTER TABLE weekly_checkins DROP CONSTRAINT IF EXISTS weekly_checkins_plan_id_fkey;
ALTER TABLE weekly_checkins ADD CONSTRAINT weekly_checkins_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

-- Adaptation Log -> Plans
ALTER TABLE adaptation_log DROP CONSTRAINT IF EXISTS adaptation_log_plan_id_fkey;
ALTER TABLE adaptation_log ADD CONSTRAINT adaptation_log_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

-- Chat Messages -> Plans
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_plan_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

-- Profiles -> Users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
