-- Migration: Create global daily exchange rates cache (EUR/BRL)
-- Created: 2025-08-22

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  rate_date date PRIMARY KEY,
  eur_to_brl numeric NOT NULL,
  brl_to_eur numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure RLS is disabled so the app (anon) can read/insert globally
ALTER TABLE public.exchange_rates DISABLE ROW LEVEL SECURITY;

-- Grant permissions: allow read to anon and authenticated; allow insert/update to anon to permit caching from public API route
GRANT SELECT ON TABLE public.exchange_rates TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.exchange_rates TO anon, authenticated;

-- Helpful index on fetched_at for housekeeping if needed
CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched_at ON public.exchange_rates (fetched_at DESC);
