-- Patch: ensure repasse_rules has column is_recurring for existing databases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'repasse_rules'
      AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE public.repasse_rules
      ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;
END $$;
