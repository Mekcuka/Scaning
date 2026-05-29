ALTER TABLE project_ranking_settings
  ADD COLUMN IF NOT EXISTS default_expert_values JSON NOT NULL
  DEFAULT '{"risk": 5, "reliability": 5, "time_months": 12}';

ALTER TABLE project_ranking_settings
  ADD COLUMN IF NOT EXISTS ahp_pairwise JSON NOT NULL DEFAULT '{}';
