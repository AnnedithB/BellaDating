-- Migration: Add photo verification fields to users table
-- This migration adds is_photo_verified, photo_verification_attempts, and photo_verified_at columns

-- Add is_photo_verified column (defaults to false)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_photo_verified BOOLEAN NOT NULL DEFAULT false;

-- Add photo_verification_attempts column (defaults to 0)
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_verification_attempts INTEGER NOT NULL DEFAULT 0;

-- Add photo_verified_at column (nullable timestamp)
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_verified_at TIMESTAMP;



















