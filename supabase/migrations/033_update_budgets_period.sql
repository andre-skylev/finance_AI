-- Extend allowed values for budgets.period to support semiannual and one-time/custom ranges
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_period_check;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_period_check
  CHECK (period = ANY (ARRAY['weekly','monthly','yearly','semiannual','one_time','custom']));
