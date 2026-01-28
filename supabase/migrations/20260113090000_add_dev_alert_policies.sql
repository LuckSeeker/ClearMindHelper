-- migration: add_dev_alert_policies
-- purpose: temporary policies for development mode with DEFAULT_USER_ID
-- tables affected: alerts
-- notes: REMOVE THESE POLICIES IN PRODUCTION!

-- ============================================================================== 
-- Development policies for alerts table
-- ============================================================================== 
-- WARNING: These policies bypass authentication for DEFAULT_USER_ID
-- ONLY use in local development environment


-- policy: allow insert for authenticated user
create policy "authenticated: allow insert alerts for own user"
  on alerts for insert
  to authenticated
  with check (
    user_id = auth.uid()
  );


-- policy: allow select for authenticated user
create policy "authenticated: allow select alerts for own user"
  on alerts for select
  to authenticated
  using (
    user_id = auth.uid()
  );


-- policy: allow update for authenticated user
create policy "authenticated: allow update alerts for own user"
  on alerts for update
  to authenticated
  using (
    user_id = auth.uid()
  )
  with check (
    user_id = auth.uid()
  );


-- policy: allow delete for authenticated user
create policy "authenticated: allow delete alerts for own user"
  on alerts for delete
  to authenticated
  using (
    user_id = auth.uid()
  );
