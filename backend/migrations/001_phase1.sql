CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  sport TEXT,
  competition_date DATE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  goal TEXT NOT NULL,
  age INT,
  weight_kg FLOAT,
  height_cm FLOAT,
  sex TEXT NOT NULL,
  experience TEXT NOT NULL,
  days_per_week INT,
  session_minutes INT,
  equipment TEXT[],
  injuries TEXT,
  sleep_hours FLOAT,
  stress_level INT,
  job_activity TEXT,
  diet_style TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_hash TEXT NOT NULL,
  tier TEXT NOT NULL,
  protocols JSONB NOT NULL,
  contraindications JSONB NOT NULL,
  sources TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_hash, tier)
);

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  tier_at_creation TEXT NOT NULL,
  profile_snapshot JSONB NOT NULL,
  mesocycle_weeks INT DEFAULT 8,
  current_week INT DEFAULT 1,
  phase TEXT DEFAULT 'accumulation',
  plan_data JSONB NOT NULL,
  nutrition JSONB NOT NULL,
  persona_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  milestone_pending BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id),
  user_id UUID REFERENCES users(id),
  week_number INT NOT NULL,
  day_number INT NOT NULL,
  pre_readiness JSONB,
  logged_exercises JSONB,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id),
  user_id UUID REFERENCES users(id),
  week_number INT NOT NULL,
  recovery_score INT,
  mood_score INT,
  sleep_avg FLOAT,
  weight_kg FLOAT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collective_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_hash TEXT NOT NULL,
  sport TEXT,
  plan_config JSONB NOT NULL,
  outcome JSONB NOT NULL,
  success_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adaptation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id),
  week_number INT NOT NULL,
  assessment TEXT,
  adjustments JSONB NOT NULL,
  flags JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
