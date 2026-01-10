-- Migration: Add development policy for default user profile
-- Purpose: Allow access to test profile (00000000-0000-0000-0000-000000000000) without authentication
-- Date: 2026-01-10
-- NOTE: This migration is for development only and should be removed before production

-- Policy: Allow anonymous SELECT access to default test profile for development
CREATE POLICY "dev_allow_anon_access_default_profile"
  ON userprofiles FOR SELECT
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000');

-- Policy: Allow anonymous INSERT access to default test profile for development
CREATE POLICY "dev_allow_anon_insert_default_profile"
  ON userprofiles FOR INSERT
  TO anon
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000');

-- Policy: Allow anonymous UPDATE access to default test profile for development
CREATE POLICY "dev_allow_anon_update_default_profile"
  ON userprofiles FOR UPDATE
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000');
