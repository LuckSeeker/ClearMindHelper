-- Migration: Add default user profile for development
-- Purpose: Create a test user and profile for DEFAULT_USER_ID (00000000-0000-0000-0000-000000000000)
-- Date: 2026-01-08
-- NOTE: This migration is for development only and should be removed before production

-- Insert default user in auth.users first
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@example.com',
  crypt('devpassword123', gen_salt('bf')),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Insert default user profile with complete data
INSERT INTO userprofiles (
  user_id,
  height_cm,
  weight_kg,
  gender,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  175,
  70.00,
  'M',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO NOTHING;
