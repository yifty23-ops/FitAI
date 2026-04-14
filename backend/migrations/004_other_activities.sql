-- Add other_activities column to profiles table
-- Captures training/sports the user does outside their stated goal
-- Used for recovery planning and weekly schedule optimization
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_activities TEXT;
