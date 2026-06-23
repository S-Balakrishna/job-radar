-- Run this in your Supabase SQL Editor

-- Companies table: career pages you want to track
CREATE TABLE companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  career_url TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_scraped TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' -- active | paused
);

-- Jobs table: all jobs found
CREATE TABLE jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  location TEXT,
  description TEXT,
  experience_mentioned TEXT,
  priority INTEGER DEFAULT 2, -- 1 = data/analyst role, 2 = other early career
  found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  application_status TEXT DEFAULT 'new', -- new | applied | rejected | saved
  is_notified BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security (open for now, lock down later)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON companies FOR ALL USING (true);
CREATE POLICY "Allow all" ON jobs FOR ALL USING (true);

-- Index for fast lookups
CREATE INDEX jobs_priority_idx ON jobs(priority);
CREATE INDEX jobs_status_idx ON jobs(application_status);
CREATE INDEX jobs_found_at_idx ON jobs(found_at DESC);
