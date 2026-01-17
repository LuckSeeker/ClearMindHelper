-- Allow threshold_bac = 1.0 for anonymous user in dev
ALTER TABLE userthresholds DROP CONSTRAINT IF EXISTS userthresholds_threshold_bac_check;

ALTER TABLE userthresholds ADD CONSTRAINT userthresholds_threshold_bac_check
CHECK (threshold_bac >= 0.01 AND threshold_bac <= 5.0);
