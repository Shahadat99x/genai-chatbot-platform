-- Phase 5A: Persistence & History

-- 1. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    content_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Intake Jobs Table
CREATE TABLE IF NOT EXISTS intake_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id),
    status TEXT NOT NULL, -- 'queued', 'running', 'done', 'failed'
    progress INT DEFAULT 0,
    score_int INT, -- 0-100
    approval_state TEXT, -- 'auto_approved', 'needs_review'
    raw_text TEXT,
    extracted_json JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_jobs_created_at ON intake_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_jobs_approval_state ON intake_jobs(approval_state);

-- 3. Reviews Table (Placeholder for future use)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_job_id UUID REFERENCES intake_jobs(id),
    edited_text TEXT,
    reviewer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- 4. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
