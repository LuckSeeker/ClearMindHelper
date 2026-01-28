-- migration: add_dev_policies_drinks_baccalculations
-- purpose: temporary policies for development mode with DEFAULT_USER_ID
-- tables affected: drinks, baccalculations
-- notes: REMOVE THESE POLICIES IN PRODUCTION!

-- ==============================================================================
-- Development policies for drinks table
-- ==============================================================================
-- WARNING: These policies bypass authentication for DEFAULT_USER_ID
-- ONLY use in local development environment


-- policy: allow insert for authenticated user
create policy "authenticated: allow insert drinks for own user"
  on drinks for insert
  to authenticated
  with check (
    user_id = auth.uid()
  );


-- policy: allow select for authenticated user
create policy "authenticated: allow select drinks for own user"
  on drinks for select
  to authenticated
  using (
    user_id = auth.uid()
  );


-- policy: allow update for authenticated user
create policy "authenticated: allow update drinks for own user"
  on drinks for update
  to authenticated
  using (
    user_id = auth.uid()
  )
  with check (
    user_id = auth.uid()
  );


-- policy: allow delete for authenticated user
create policy "authenticated: allow delete drinks for own user"
  on drinks for delete
  to authenticated
  using (
    user_id = auth.uid()
  );

-- ==============================================================================
-- Development policies for baccalculations table
-- ==============================================================================


-- policy: allow insert for authenticated user
create policy "authenticated: allow insert baccalculations for own user"
  on baccalculations for insert
  to authenticated
  with check (
    user_id = auth.uid()
  );


-- policy: allow select for authenticated user
create policy "authenticated: allow select baccalculations for own user"
  on baccalculations for select
  to authenticated
  using (
    user_id = auth.uid()
  );
