-- Drop foreign keys that reference non-existent relations (idempotent)

-- Drop FK to public.users if present (Supabase uses auth.users)
DO $$ BEGIN
  ALTER TABLE public.credit_card_transactions
    DROP CONSTRAINT IF EXISTS credit_card_transactions_user_id_fkey;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Drop FK to credit_card_statements if target table doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credit_card_statements'
  ) THEN
    ALTER TABLE public.credit_card_transactions
      DROP CONSTRAINT IF EXISTS credit_card_transactions_statement_id_fkey;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Ensure FK to credit_cards exists (best-effort)
DO $$ BEGIN
  ALTER TABLE public.credit_card_transactions
    ADD CONSTRAINT credit_card_transactions_credit_card_id_fkey
    FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE CASCADE;
EXCEPTION
  WHEN undefined_table OR duplicate_object THEN NULL;
END $$;
