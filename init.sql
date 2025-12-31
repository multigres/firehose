-- Firehose Demo Database Schema
-- Run: psql -h localhost -U postgres -d pooler_demo -f init.sql

-- Create users table for read/write operations
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    username   VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Create index on id (primary key handles this, but being explicit)
-- The primary key already creates a unique index

-- Seed with 100,000 users for read operations
INSERT INTO users (username, email)
SELECT
    'user_' || i,
    'user_' || i || '@example.com'
FROM generate_series(1, 100000) AS i
ON CONFLICT DO NOTHING;

-- Analyze table for query planner
ANALYZE users;
