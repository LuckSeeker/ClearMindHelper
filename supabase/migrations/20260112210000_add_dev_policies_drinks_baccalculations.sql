-- migration: add_dev_policies_drinks_baccalculations
-- purpose: temporary policies for development mode with DEFAULT_USER_ID
-- tables affected: drinks, baccalculations
-- notes: REMOVE THESE POLICIES IN PRODUCTION!

-- ==============================================================================
-- Development policies for drinks table
-- ==============================================================================
-- WARNING: These policies bypass authentication for DEFAULT_USER_ID
-- ONLY use in local development environment

-- policy: allow insert for default dev user
create policy "dev: allow insert drinks for default user"
  on drinks for insert
  to anon, authenticated
  with check (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow select for default dev user
create policy "dev: allow select drinks for default user"
  on drinks for select
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow update for default dev user
create policy "dev: allow update drinks for default user"
  on drinks for update
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  )
  with check (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow delete for default dev user
create policy "dev: allow delete drinks for default user"
  on drinks for delete
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- ==============================================================================
-- Development policies for baccalculations table
-- ==============================================================================

-- policy: allow insert for default dev user
create policy "dev: allow insert baccalculations for default user"
  on baccalculations for insert
  to anon, authenticated
  with check (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

-- policy: allow select for default dev user
create policy "dev: allow select baccalculations for default user"
  on baccalculations for select
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );
