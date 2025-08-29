-- Patch: add account_id to fixed_costs to select paying account
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fixed_costs'
      AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.fixed_costs
      ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Optional index to speed up joins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'fixed_costs' AND indexname = 'fixed_costs_account_id_idx'
  ) THEN
    CREATE INDEX fixed_costs_account_id_idx ON public.fixed_costs(account_id);
  END IF;
END $$;