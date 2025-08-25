-- Allow a new mode for budgets: percent_profit (percentage of monthly profit)
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_mode_check;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_mode_check
  CHECK (mode IN ('absolute', 'percent_income', 'percent_profit'));
