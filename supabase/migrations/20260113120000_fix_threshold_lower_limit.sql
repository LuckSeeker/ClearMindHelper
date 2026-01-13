-- migration: fix threshold lower limit
-- purpose: allow threshold_bac values > 0 instead of >= 0.08
-- issue: users with low BAC during blackout couldn't create threshold

-- ==============================================================================
-- update userthresholds table constraint
-- ==============================================================================
-- remove old constraint and add new one with lower limit > 0

alter table userthresholds
drop constraint if exists userthresholds_threshold_bac_check;

alter table userthresholds
add constraint userthresholds_threshold_bac_check 
check (threshold_bac > 0 and threshold_bac <= 0.99);

-- note: changed from (0.08 - 0.50) to (0.01 - 0.99)
-- this allows realistic thresholds for blackout marking at any BAC level
