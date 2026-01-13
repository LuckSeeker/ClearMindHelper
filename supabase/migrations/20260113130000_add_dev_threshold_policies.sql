-- migration: add_dev_threshold_policies
-- purpose: allow default dev user to manage userthresholds during development
-- note: this is a development-only policy for testing without authentication

-- ==============================================================================
-- development policy for userthresholds
-- ==============================================================================

-- policy: allow default dev user to select thresholds
create policy "dev user can select thresholds"
  on userthresholds for select
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- policy: allow default dev user to insert thresholds
create policy "dev user can insert thresholds"
  on userthresholds for insert
  to anon, authenticated
  with check (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- policy: allow default dev user to update thresholds
create policy "dev user can update thresholds"
  on userthresholds for update
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000000'::uuid)
  with check (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- policy: allow default dev user to delete thresholds
create policy "dev user can delete thresholds"
  on userthresholds for delete
  to anon, authenticated
  using (user_id = '00000000-0000-0000-0000-000000000000'::uuid);
