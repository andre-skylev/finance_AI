-- Add account relation for manual installments
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS account_id uuid;

DO $$ BEGIN
  ALTER TABLE public.installments
    ADD CONSTRAINT installments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_installments_account_id ON public.installments(account_id);
