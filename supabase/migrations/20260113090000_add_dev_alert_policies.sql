-- migration: add_dev_alert_policies
-- purpose: temporary policies for development mode with DEFAULT_USER_ID
-- tables affected: alerts
-- notes: REMOVE THESE POLICIES IN PRODUCTION!

-- ============================================================================== 
-- Development policies for alerts table
-- ============================================================================== 
-- WARNING: These policies bypass authentication for DEFAULT_USER_ID
-- ONLY use in local development environment

-- policy: allow insert for default dev user
create policy "dev: allow insert alerts for default user"
  on alerts for insert
  to anon, authenticated
  with check (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow select for default dev user
create policy "dev: allow select alerts for default user"
  on alerts for select
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow update for default dev user
create policy "dev: allow update alerts for default user"
  on alerts for update
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  )
  with check (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow delete for default dev user
create policy "dev: allow delete alerts for default user"
  on alerts for delete
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );
