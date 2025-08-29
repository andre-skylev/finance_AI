-- Add credit card support to repasse_rule_sources
-- Allows a source row to refer to either a bank account (account_id) or a credit card (credit_card_id)

DO $$
BEGIN
  -- Ensure account_id is nullable (we'll enforce presence via a CHECK below)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'repasse_rule_sources' AND column_name = 'account_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.repasse_rule_sources ALTER COLUMN account_id DROP NOT NULL;
  END IF;

  -- Add column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'repasse_rule_sources' AND column_name = 'credit_card_id'
  ) THEN
    ALTER TABLE public.repasse_rule_sources ADD COLUMN credit_card_id uuid;
  END IF;

  -- Add foreign key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'repasse_rule_sources'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'credit_card_id'
  ) THEN
    ALTER TABLE public.repasse_rule_sources
      ADD CONSTRAINT repasse_rule_sources_credit_card_fk
      FOREIGN KEY (credit_card_id)
      REFERENCES public.credit_cards(id)
      ON DELETE CASCADE;
  END IF;

  -- Ensure at least one of (account_id, credit_card_id) is present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repasse_rule_sources_account_or_card_chk'
  ) THEN
    ALTER TABLE public.repasse_rule_sources
      ADD CONSTRAINT repasse_rule_sources_account_or_card_chk
      CHECK (account_id IS NOT NULL OR credit_card_id IS NOT NULL);
  END IF;

  -- Helpful index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'repasse_rule_sources' AND indexname = 'repasse_rule_sources_credit_card_id_idx'
  ) THEN
    CREATE INDEX repasse_rule_sources_credit_card_id_idx ON public.repasse_rule_sources (credit_card_id);
  END IF;
END $$;
