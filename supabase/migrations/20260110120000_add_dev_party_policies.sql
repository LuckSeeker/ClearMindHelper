-- Migration: Add development policies for default user parties
-- Purpose: Allow access to parties for test user (00000000-0000-0000-0000-000000000000) without authentication
-- Date: 2026-01-10
-- NOTE: This migration is for development only and should be removed before production


-- Policy: Allow authenticated user to select own parties
CREATE POLICY "authenticated_allow_select_own_parties"
  ON parties FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- Policy: Allow authenticated user to insert own parties
CREATE POLICY "authenticated_allow_insert_own_parties"
  ON parties FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


-- Policy: Allow authenticated user to update own parties
CREATE POLICY "authenticated_allow_update_own_parties"
  ON parties FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- Policy: Allow authenticated user to delete own parties
CREATE POLICY "authenticated_allow_delete_own_parties"
  ON parties FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- Policy: Allow authenticated user to insert own events
CREATE POLICY "authenticated_allow_insert_own_events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


CREATE POLICY "authenticated_allow_select_own_events"
  ON events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
