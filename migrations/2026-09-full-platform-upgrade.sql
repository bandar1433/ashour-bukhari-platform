-- Development migration for the full platform upgrade.
-- DO NOT apply automatically to production. Review and run only when the upgrade is approved.

CREATE TABLE IF NOT EXISTS library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name text NOT NULL,
  title text NOT NULL,
  teacher_name text,
  description text,
  youtube_url text NOT NULL,
  duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE circles ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS start_time_source text NOT NULL DEFAULT 'makkah_asr_plus_70';

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS circle_id uuid REFERENCES circles(id);
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'center';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS max_points integer NOT NULL DEFAULT 100;

ALTER TABLE news_events ADD COLUMN IF NOT EXISTS image_data text;
ALTER TABLE news_events ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE news_events ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES centers(id);

CREATE TABLE IF NOT EXISTS guardian_report_preferences (
  guardian_id uuid PRIMARY KEY REFERENCES guardians(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','monthly','quarterly','half_yearly','yearly')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

