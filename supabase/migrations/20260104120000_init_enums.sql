-- migration: init_enums
-- purpose: create custom enum types for ClearMindHelper application
-- tables affected: none (type definitions)
-- notes: these enums are used across multiple tables in the schema

-- enum for user gender (used in user profiles for bac calculations)
-- 'm' = male, 'f' = female
-- note: mvp supports binary gender for widmark formula; future versions may support custom constants
create type enum_gender as enum ('M', 'F');

-- enum for party session status
-- 'ongoing' = party is currently active
-- 'closed' = party has been finished by user
create type enum_party_status as enum ('ongoing', 'closed');

-- enum for threshold adjustment reason (telemetry/audit)
-- 'blackout_marked' = threshold adjusted due to user marking blackout (us-014)
-- 'manual_override' = user manually changed threshold
-- 'default' = initial default threshold set on account creation
create type enum_threshold_reason as enum ('blackout_marked', 'manual_override', 'default');

-- enum for alert types
-- 'approaching_threshold' = bac reached 90% of user's threshold (warning)
-- 'exceeded_threshold' = bac exceeded user's threshold (critical)
create type enum_alert_type as enum ('approaching_threshold', 'exceeded_threshold');

-- enum for event telemetry types
-- tracks key user actions and system events for analytics
-- minimal telemetry approach: no event_data jsonb, just event type + timestamps
create type enum_event_type as enum (
  'drink_added',              -- user added a new drink (us-005)
  'drink_edited',             -- user edited last drink (us-006)
  'party_started',            -- user started new party session (us-004)
  'party_closed',             -- user closed party session (us-007)
  'blackout_marked',          -- user marked memory blackout (us-008)
  'threshold_adjusted',       -- bac threshold was changed
  'fast_consumption_warning'  -- system detected rapid consumption pattern
);
