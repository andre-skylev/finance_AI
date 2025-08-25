-- Add USD support to exchange_rates
ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS eur_to_usd numeric,
  ADD COLUMN IF NOT EXISTS usd_to_eur numeric,
  ADD COLUMN IF NOT EXISTS usd_to_brl numeric,
  ADD COLUMN IF NOT EXISTS brl_to_usd numeric;

-- Optional: initialize inverse pairs where possible
UPDATE public.exchange_rates
SET usd_to_eur = CASE WHEN eur_to_usd IS NOT NULL AND eur_to_usd <> 0 THEN 1/eur_to_usd ELSE usd_to_eur END,
    brl_to_usd = CASE WHEN usd_to_brl IS NOT NULL AND usd_to_brl <> 0 THEN 1/usd_to_brl ELSE brl_to_usd END;
