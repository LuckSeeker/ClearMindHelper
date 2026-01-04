-- migration: init_triggers
-- purpose: create database triggers for automated updates
-- tables affected: userprofiles, parties, drinks, alerts
-- notes: triggers maintain data integrity and cached statistics

-- ==============================================================================
-- trigger function: update_timestamp
-- ==============================================================================
-- purpose: automatically update updated_at column on row modification
-- used by: userprofiles, parties, drinks, alerts

create or replace function update_timestamp()
returns trigger as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$ language plpgsql;

-- ==============================================================================
-- apply update_timestamp trigger to tables
-- ==============================================================================

-- trigger: update userprofiles.updated_at on modification
create trigger trigger_update_userprofiles_timestamp
  before update on userprofiles
  for each row
  execute function update_timestamp();

-- trigger: update parties.updated_at on modification
create trigger trigger_update_parties_timestamp
  before update on parties
  for each row
  execute function update_timestamp();

-- trigger: update drinks.updated_at on modification
create trigger trigger_update_drinks_timestamp
  before update on drinks
  for each row
  execute function update_timestamp();

-- trigger: update alerts.updated_at on modification
create trigger trigger_update_alerts_timestamp
  before update on alerts
  for each row
  execute function update_timestamp();

-- ==============================================================================
-- trigger function: update_party_cache_on_drink_change
-- ==============================================================================
-- purpose: maintain cached statistics in parties table when drinks are modified
-- updates: total_drinks_count, total_ml_consumed
-- note: bac_estimate_max updated separately by app logic after bac calculation

create or replace function update_party_cache_on_drink_change()
returns trigger as $$
declare
  target_party_id bigint;
begin
  -- determine which party to update
  -- for insert/update: use new.party_id
  -- for delete: use old.party_id
  if tg_op = 'DELETE' then
    target_party_id := old.party_id;
  else
    target_party_id := new.party_id;
  end if;

  -- update cached statistics in parties table
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

-- ==============================================================================
-- apply party cache update triggers
-- ==============================================================================

-- trigger: update party cache when drink is added
-- fires after insert to ensure drink row exists for count/sum
create trigger trigger_update_party_cache_on_drink_insert
  after insert on drinks
  for each row
  execute function update_party_cache_on_drink_change();

-- trigger: update party cache when drink is modified
-- fires after update to ensure updated values are counted
create trigger trigger_update_party_cache_on_drink_update
  after update on drinks
  for each row
  execute function update_party_cache_on_drink_change();

-- trigger: update party cache when drink is deleted
-- fires after delete to recount remaining drinks
create trigger trigger_update_party_cache_on_drink_delete
  after delete on drinks
  for each row
  execute function update_party_cache_on_drink_change();

-- ==============================================================================
-- notes on bac_estimate_max update
-- ==============================================================================
-- bac_estimate_max in parties table should be updated by application logic
-- after bac calculation is performed and saved to baccalculations table
-- this allows for proper transaction handling and error recovery
-- 
-- suggested app logic:
-- 1. insert drink
-- 2. calculate bac (widmark formula)
-- 3. insert baccalculation
-- 4. update parties.bac_estimate_max if new bac > current max
-- 5. check threshold and create/update alerts if needed
