-- Migration: Remove username column from users table
-- Run this migration after updating the Prisma schema

-- Drop the unique constraint on username first
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- Drop the username column
ALTER TABLE users DROP COLUMN IF EXISTS username;

