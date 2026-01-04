-- migration: init_rls_policies
-- purpose: define row level security policies for all tables
-- tables affected: userprofiles, parties, drinks, baccalculations, userthresholds, alerts, events
-- notes: granular policies per operation (select, insert, update, delete) and per role (anon, authenticated)

-- ==============================================================================
-- userprofiles policies
-- ==============================================================================
-- rationale: users should only access their own profile data
-- no anon access - requires authentication

-- policy: authenticated users can view their own profile
create policy "authenticated users can select own profile"
  on userprofiles for select
  to authenticated
  using (user_id = auth.uid());

-- policy: authenticated users can insert their own profile
-- note: one profile per user enforced by unique constraint
create policy "authenticated users can insert own profile"
  on userprofiles for insert
  to authenticated
  with check (user_id = auth.uid());

-- policy: authenticated users can update their own profile
create policy "authenticated users can update own profile"
  on userprofiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- policy: authenticated users can delete their own profile
-- note: cascade delete handled by on delete cascade constraint
create policy "authenticated users can delete own profile"
  on userprofiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ==============================================================================
-- parties policies
-- ==============================================================================
-- rationale: users should only access their own party sessions
-- no anon access - requires authentication

-- policy: authenticated users can view their own parties
create policy "authenticated users can select own parties"
  on parties for select
  to authenticated
  using (user_id = auth.uid());

-- policy: authenticated users can create parties
create policy "authenticated users can insert own parties"
  on parties for insert
  to authenticated
  with check (user_id = auth.uid());

-- policy: authenticated users can update their own parties
-- note: used for closing party, updating cached stats, marking blackout
create policy "authenticated users can update own parties"
  on parties for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- policy: authenticated users can delete their own parties
-- note: cascade delete will remove related drinks, bac calculations, alerts
create policy "authenticated users can delete own parties"
  on parties for delete
  to authenticated
  using (user_id = auth.uid());

-- ==============================================================================
-- drinks policies
-- ==============================================================================
-- rationale: users should only access drinks in their own parties
-- no anon access - requires authentication

-- policy: authenticated users can view drinks in their parties
create policy "authenticated users can select drinks in own parties"
  on drinks for select
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can add drinks to their parties
create policy "authenticated users can insert drinks in own parties"
  on drinks for insert
  to authenticated
  with check (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can update drinks in their parties
-- note: us-006 restricts editing to last drink (enforced in app logic)
create policy "authenticated users can update drinks in own parties"
  on drinks for update
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  )
  with check (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can delete drinks in their parties
create policy "authenticated users can delete drinks in own parties"
  on drinks for delete
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- ==============================================================================
-- baccalculations policies
-- ==============================================================================
-- rationale: users should only view bac calculations for their parties
-- insert typically done by system/app logic after drink entry
-- no updates/deletes - immutable historical records

-- policy: authenticated users can view bac calculations for their parties
create policy "authenticated users can select bac calculations for own parties"
  on baccalculations for select
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can insert bac calculations for their parties
-- note: typically done by app/backend after drink entry
create policy "authenticated users can insert bac calculations for own parties"
  on baccalculations for insert
  to authenticated
  with check (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- no update/delete policies - bac calculations are immutable audit trail

-- ==============================================================================
-- userthresholds policies
-- ==============================================================================
-- rationale: users should only access their own threshold settings
-- no anon access - requires authentication

-- policy: authenticated users can view their own thresholds
create policy "authenticated users can select own thresholds"
  on userthresholds for select
  to authenticated
  using (user_id = auth.uid());

-- policy: authenticated users can insert their own thresholds
-- note: typically done by system when user marks blackout or manually adjusts
create policy "authenticated users can insert own thresholds"
  on userthresholds for insert
  to authenticated
  with check (user_id = auth.uid());

-- policy: authenticated users can update their own thresholds
-- note: typically used to set is_current = false when new threshold created
create policy "authenticated users can update own thresholds"
  on userthresholds for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- policy: authenticated users can delete their own thresholds
create policy "authenticated users can delete own thresholds"
  on userthresholds for delete
  to authenticated
  using (user_id = auth.uid());

-- ==============================================================================
-- alerts policies
-- ==============================================================================
-- rationale: users should only access alerts for their parties
-- system manages alert lifecycle (create, update is_active, send notifications)

-- policy: authenticated users can view alerts for their parties
create policy "authenticated users can select alerts for own parties"
  on alerts for select
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can insert alerts for their parties
-- note: typically done by app/backend when bac threshold conditions met
create policy "authenticated users can insert alerts for own parties"
  on alerts for insert
  to authenticated
  with check (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can update alerts in their parties
-- note: used to set is_active = false or update last_alert_sent_at
create policy "authenticated users can update alerts for own parties"
  on alerts for update
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  )
  with check (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- policy: authenticated users can delete alerts in their parties
create policy "authenticated users can delete alerts for own parties"
  on alerts for delete
  to authenticated
  using (
    party_id in (
      select id from parties where user_id = auth.uid()
    )
  );

-- ==============================================================================
-- events policies
-- ==============================================================================
-- rationale: users should only access their own telemetry events
-- insert only - immutable log entries (no update/delete)

-- policy: authenticated users can view their own events
create policy "authenticated users can select own events"
  on events for select
  to authenticated
  using (user_id = auth.uid());

-- policy: authenticated users can insert their own events
-- note: typically done by app/backend to log user actions
create policy "authenticated users can insert own events"
  on events for insert
  to authenticated
  with check (user_id = auth.uid());

-- no update/delete policies - events are immutable audit log
