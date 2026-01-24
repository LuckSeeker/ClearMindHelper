-- migration: increase_bac_limit_to_5_promille
-- description: Change check constraint for baccalculations.calculated_bac to allow up to 5.00‰
-- tables affected: baccalculations

alter table baccalculations 
  drop constraint if exists baccalculations_calculated_bac_check;

alter table baccalculations 
  add constraint baccalculations_calculated_bac_check 
  check (calculated_bac between 0 and 5.00);
