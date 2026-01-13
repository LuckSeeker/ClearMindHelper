-- migration: add_update_policy_baccalculations
-- description: Add missing UPDATE policy for baccalculations table (dev mode)
-- tables affected: baccalculations

-- ==============================================================================
-- Development policy for baccalculations UPDATE
-- ==============================================================================

-- policy: allow update for default dev user
create policy "dev: allow update baccalculations for default user"
  on baccalculations for update
  to anon, authenticated
  using (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  )
  with check (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );
