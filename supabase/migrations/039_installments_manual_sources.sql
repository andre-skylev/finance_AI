-- Add support columns for manual installments (direct debit / financing)
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR' CHECK (currency IN ('EUR','BRL','USD'));

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'financing' CHECK (source_type IN ('direct_debit','financing'));
