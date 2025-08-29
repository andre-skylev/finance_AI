-- Per-user dashboard layout storage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_dashboard_layouts'
  ) THEN
    CREATE TABLE public.user_dashboard_layouts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      layout jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_dashboard_layouts_user_unique UNIQUE(user_id)
    );
  END IF;

  -- RLS
  ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

  -- Policies: owner-only CRUD
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layouts' AND policyname='Allow read own layout'
  ) THEN
    CREATE POLICY "Allow read own layout" ON public.user_dashboard_layouts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layouts' AND policyname='Allow upsert own layout'
  ) THEN
    CREATE POLICY "Allow upsert own layout" ON public.user_dashboard_layouts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layouts' AND policyname='Allow update own layout'
  ) THEN
    CREATE POLICY "Allow update own layout" ON public.user_dashboard_layouts
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_dashboard_layouts' AND policyname='Allow delete own layout'
  ) THEN
    CREATE POLICY "Allow delete own layout" ON public.user_dashboard_layouts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
