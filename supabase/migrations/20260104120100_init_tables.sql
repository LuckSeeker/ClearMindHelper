-- migration: init_tables
-- purpose: create all core tables for ClearMindHelper application
-- tables affected: userprofiles, parties, drinks, baccalculations, userthresholds, alerts, events
-- notes: all tables have rls enabled; policies defined in separate migration

-- table: userprofiles
-- purpose: stores user physical data required for bac calculations (widmark formula)
-- one profile per user (1:1 with auth.users)
create table userprofiles (
  id bigserial primary key,
  
  -- reference to supabase auth user
  user_id uuid unique not null references auth.users(id) on delete cascade,
  
  -- physical attributes for bac calculation
  height_cm int not null check (height_cm between 50 and 250),
  weight_kg decimal(5, 2) not null check (weight_kg between 30 and 300),
  gender enum_gender not null,
  
  -- audit timestamps
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- enable row level security for userprofiles
-- policies will be defined in init_rls_policies migration
alter table userprofiles enable row level security;

-- table: parties
-- purpose: represents drinking sessions with cached bac statistics
-- one user can have many parties over time
create table parties (
  id bigserial primary key,
  
  -- reference to user
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- party time range
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone, -- nullable when party is ongoing
  
  -- party status
  status enum_party_status not null default 'ongoing',
  
  -- immutable snapshot of user profile at party start
  -- stores: {height_cm, weight_kg, gender, captured_at}
  -- immutability ensures bac calculations remain consistent even if user updates profile
  profile_snapshot jsonb not null,
  
  -- cached statistics (updated via triggers/app logic)
  bac_estimate_max decimal(4, 2) default 0.00, -- highest bac reached in this party
  total_drinks_count int default 0,             -- count of drinks consumed
  total_ml_consumed int default 0,              -- total volume in ml
  
  -- blackout tracking (us-008)
  blackout_marked boolean default false,              -- user marked memory blackout
  blackout_marked_at timestamp with time zone,        -- when blackout was marked
  
  -- audit timestamps
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- enable row level security for parties
alter table parties enable row level security;

-- table: drinks
-- purpose: individual drink entries with edit history
-- many drinks per party, ordered by consumption time
create table drinks (
  id bigserial primary key,
  
  -- references
  party_id bigint not null references parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized for rls efficiency
  
  -- drink details
  volume_ml int not null check (volume_ml > 0 and volume_ml <= 5000), -- realistic drink volumes
  abv_percent decimal(3, 1) not null check (abv_percent between 0.1 and 100), -- alcohol by volume
  
  -- consumption timestamp (must be within party time range)
  consumed_at timestamp with time zone not null,
  
  -- edit tracking (us-006: only last drink can be edited)
  original_values jsonb, -- stores {volume_ml_before, abv_percent_before} if edited
  edited_at timestamp with time zone,
  edit_count int default 0,
  
  -- ordering within party (for determining "last drink")
  order_sequence int not null,
  
  -- audit timestamps
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- enable row level security for drinks
alter table drinks enable row level security;

-- table: baccalculations
-- purpose: immutable history of bac estimates for each drink
-- one calculation per drink, stores snapshot of user profile at calculation time
create table baccalculations (
  id bigserial primary key,
  
  -- references
  party_id bigint not null references parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized for rls efficiency
  drink_id bigint not null references drinks(id) on delete cascade,
  
  -- calculated bac value (widmark formula)
  calculated_bac decimal(4, 2) not null check (calculated_bac between 0 and 0.99), -- realistic bac range
  
  -- calculation metadata
  calculation_timestamp timestamp with time zone default current_timestamp,
  algorithm_version varchar(50) default 'Widmark v1', -- for future algorithm updates
  
  -- immutable snapshot of user profile at calculation time
  -- stores: {height_cm, weight_kg, gender}
  user_profile_snapshot jsonb not null,
  
  -- additional calculation context
  time_since_first_drink_minutes int,  -- elapsed time from first drink in party
  metabolized_alcohol_g decimal(6, 2), -- grams of alcohol metabolized since first drink
  
  -- audit timestamp (no updated_at - immutable records)
  created_at timestamp with time zone default current_timestamp
);

-- enable row level security for baccalculations
alter table baccalculations enable row level security;

-- table: userthresholds
-- purpose: current and historical bac threshold values for user
-- tracks threshold changes over time (us-014: blackout-triggered adaptation)
create table userthresholds (
  id bigserial primary key,
  
  -- reference to user
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- threshold value (realistic range for algorithm stability)
  threshold_bac decimal(4, 2) not null check (threshold_bac between 0.08 and 0.50),
  
  -- current threshold flag (only one per user should be true)
  is_current boolean default true,
  
  -- change tracking
  reason enum_threshold_reason not null, -- why threshold was changed
  trigger_party_id bigint references parties(id) on delete set null, -- which party triggered change (us-014)
  
  -- audit timestamp (no updated_at - historical records)
  created_at timestamp with time zone default current_timestamp
);

-- enable row level security for userthresholds
alter table userthresholds enable row level security;

-- table: alerts
-- purpose: current alerts for approaching/exceeding bac threshold
-- one active alert per party per alert_type
create table alerts (
  id bigserial primary key,
  
  -- references
  party_id bigint not null references parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized for rls efficiency
  
  -- alert details
  alert_type enum_alert_type not null,
  is_active boolean default true, -- inactive when bac drops below threshold or party closes
  bac_at_alert decimal(4, 2) not null, -- bac value when alert was triggered
  
  -- alert timing
  triggered_at timestamp with time zone not null, -- when alert was first triggered
  last_alert_sent_at timestamp with time zone,    -- for 5-minute repeat logic (us-011)
  
  -- audit timestamps
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- enable row level security for alerts
alter table alerts enable row level security;

-- table: events
-- purpose: minimal telemetry for analytics and auditing
-- tracks key user actions and system events
create table events (
  id bigserial primary key,
  
  -- references
  user_id uuid not null references auth.users(id) on delete cascade,
  party_id bigint references parties(id) on delete set null, -- nullable for non-party events
  
  -- event type (see enum_event_type for available values)
  event_type enum_event_type not null,
  
  -- audit timestamp (no updated_at - immutable log entries)
  created_at timestamp with time zone default current_timestamp
);

-- enable row level security for events
alter table events enable row level security;
