-- Add eligibility fields to jobs table
ALTER TABLE jobs ADD COLUMN min_cgpa DECIMAL(3,1) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN allowed_branches TEXT;
ALTER TABLE jobs ADD COLUMN allowed_degrees TEXT;
ALTER TABLE jobs ADD COLUMN max_backlogs INT DEFAULT 0;
ALTER TABLE jobs ADD COLUMN eligible_batches TEXT;

-- Add CGPA and backlogs to users table for eligibility check
ALTER TABLE users ADD COLUMN cgpa DECIMAL(3,1);
ALTER TABLE users ADD COLUMN backlogs INT DEFAULT 0;

-- Verify
DESCRIBE jobs;
DESCRIBE users;
