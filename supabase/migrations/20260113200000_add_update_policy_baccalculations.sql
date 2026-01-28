-- migration: add_update_policy_baccalculations
-- description: Add missing UPDATE policy for baccalculations table (dev mode)
-- tables affected: baccalculations

-- ==============================================================================
-- Development policy for baccalculations UPDATE
-- ==============================================================================


-- policy: allow update for authenticated user
create policy "authenticated: allow update baccalculations for own user"
  on baccalculations for update
  to authenticated
  using (
    user_id = auth.uid()
  )
  with check (
    user_id = auth.uid()
  );
