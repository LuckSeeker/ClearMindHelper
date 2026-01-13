-- migration: fix trigger to preserve bac_estimate_max
-- purpose: prevent trigger from overwriting bac_estimate_max when updating drink counts
-- issue: trigger was resetting bac_estimate_max, causing incorrect values

-- ==============================================================================
-- update trigger function: update_party_cache_on_drink_change
-- ==============================================================================
-- changes: preserve bac_estimate_max during updates

create or replace function update_party_cache_on_drink_change()
returns trigger as $$
declare
  target_party_id bigint;
  current_bac_max numeric;
begin
  -- determine which party to update
  -- for insert/update: use new.party_id
  -- for delete: use old.party_id
  if tg_op = 'DELETE' then
    target_party_id := old.party_id;
  else
    target_party_id := new.party_id;
  end if;

  -- get current bac_estimate_max to preserve it
  select bac_estimate_max into current_bac_max
  from parties
  where id = target_party_id;

  -- update cached statistics in parties table
  -- preserve bac_estimate_max as it's managed by application logic
  update parties
  set
    total_drinks_count = (
      select count(*)
      from drinks
      where party_id = target_party_id
    ),
    total_ml_consumed = (
      select coalesce(sum(volume_ml), 0)
      from drinks
      where party_id = target_party_id
    ),
    bac_estimate_max = current_bac_max,
    updated_at = current_timestamp
  where id = target_party_id;

  -- return appropriate value based on operation
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;
