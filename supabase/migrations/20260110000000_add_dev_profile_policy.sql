-- Migration: Add development policy for default user profile
-- Purpose: Allow access to test profile (00000000-0000-0000-0000-000000000000) without authentication
-- Date: 2026-01-10
-- NOTE: This migration is for development only and should be removed before production

-- Policy: Allow anonymous access to default test profile for development
-- This bypasses RLS for the specific test user UUID
CREATE POLICY "dev_allow_anon_access_default_profile"
  ON userprofiles FOR SELECT
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000');
