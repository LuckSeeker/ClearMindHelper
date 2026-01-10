-- Migration: Add development policies for default user parties
-- Purpose: Allow access to parties for test user (00000000-0000-0000-0000-000000000000) without authentication
-- Date: 2026-01-10
-- NOTE: This migration is for development only and should be removed before production

-- Policy: Allow anonymous SELECT access to default test user's parties for development
CREATE POLICY "dev_allow_anon_select_default_user_parties"
  ON parties FOR SELECT
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000');

-- Policy: Allow anonymous INSERT access to default test user's parties for development
CREATE POLICY "dev_allow_anon_insert_default_user_parties"
  ON parties FOR INSERT
  TO anon
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000');

-- Policy: Allow anonymous UPDATE access to default test user's parties for development
CREATE POLICY "dev_allow_anon_update_default_user_parties"
  ON parties FOR UPDATE
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000');

-- Policy: Allow anonymous DELETE access to default test user's parties for development
CREATE POLICY "dev_allow_anon_delete_default_user_parties"
  ON parties FOR DELETE
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000');

-- Policy: Allow anonymous access to events for default test user for development
CREATE POLICY "dev_allow_anon_insert_default_user_events"
  ON events FOR INSERT
  TO anon
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000');

CREATE POLICY "dev_allow_anon_select_default_user_events"
  ON events FOR SELECT
  TO anon
  USING (user_id = '00000000-0000-0000-0000-000000000000');
