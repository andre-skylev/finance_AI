-- Dashboard layouts per user
-- Stores the ordered list of widgets and their sizes

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  layout jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_layouts_user_unique UNIQUE (user_id)
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Policies: only owner can manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dashboard_layouts' AND policyname='dashboard_layouts_select_own'
  ) THEN
    CREATE POLICY dashboard_layouts_select_own ON public.dashboard_layouts
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dashboard_layouts' AND policyname='dashboard_layouts_insert_own'
  ) THEN
    CREATE POLICY dashboard_layouts_insert_own ON public.dashboard_layouts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dashboard_layouts' AND policyname='dashboard_layouts_update_own'
  ) THEN
    CREATE POLICY dashboard_layouts_update_own ON public.dashboard_layouts
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dashboard_layouts_updated_at ON public.dashboard_layouts;
CREATE TRIGGER trg_dashboard_layouts_updated_at
BEFORE UPDATE ON public.dashboard_layouts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
