-- migration: add_dev_threshold_policies
-- purpose: allow default dev user to manage userthresholds during development
-- note: this is a development-only policy for testing without authentication

-- ==============================================================================
-- development policy for userthresholds
-- ==============================================================================


-- policy: allow select for authenticated user
create policy "authenticated: allow select userthresholds for own user"
  on userthresholds for select
  to authenticated
  using (user_id = auth.uid());


-- policy: allow insert for authenticated user
create policy "authenticated: allow insert userthresholds for own user"
  on userthresholds for insert
  to authenticated
  with check (user_id = auth.uid());


-- policy: allow update for authenticated user
create policy "authenticated: allow update userthresholds for own user"
  on userthresholds for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- policy: allow delete for authenticated user
create policy "authenticated: allow delete userthresholds for own user"
  on userthresholds for delete
  to authenticated
  using (user_id = auth.uid());
