-- Migration: Fixed Incomes (recurring incomes like salary, pensions)
-- Created: 2025-08-23

CREATE TABLE IF NOT EXISTS public.fixed_incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'BRL')),
  billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('weekly','monthly','yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  pay_day INTEGER CHECK (pay_day >= 1 AND pay_day <= 31), -- dia do recebimento
  next_pay_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fixed_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fixed incomes" ON public.fixed_incomes
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_incomes_user ON public.fixed_incomes(user_id);

-- trigger to maintain updated_at
-- Define the helper function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- Create trigger (safe even if already exists)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_fixed_incomes_updated_at'
  ) THEN
    -- Drop and recreate to ensure correct linkage
    EXECUTE 'DROP TRIGGER update_fixed_incomes_updated_at ON public.fixed_incomes';
  END IF;
  EXECUTE 'CREATE TRIGGER update_fixed_incomes_updated_at BEFORE UPDATE ON public.fixed_incomes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
END
$do$;
