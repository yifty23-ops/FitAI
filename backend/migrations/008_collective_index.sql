-- Migration 008: Add expression indexes on collective_results JSONB fields
-- Prevents full table scan when querying by goal/experience (BUG-025)

CREATE INDEX IF NOT EXISTS idx_collective_goal ON collective_results ((plan_config->>'goal'));
CREATE INDEX IF NOT EXISTS idx_collective_experience ON collective_results ((plan_config->>'experience'));
