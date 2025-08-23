-- Migration: Budgets percent mode and enhanced monthly view
-- Created: 2025-08-23

-- 1) Extend budgets with mode and percent
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'absolute' CHECK (mode IN ('absolute','percent_income')),
  ADD COLUMN IF NOT EXISTS percent NUMERIC(5,2);

-- 2) Replace budget_vs_actual to be month-bounded and compute allowed amount
DROP VIEW IF EXISTS public.budget_vs_actual;

CREATE OR REPLACE VIEW public.budget_vs_actual AS
WITH
  month_bounds AS (
    SELECT 
      DATE_TRUNC('month', CURRENT_DATE) AS month_start,
      (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date AS month_end
  ),
  income_this_month AS (
    SELECT 
      t.user_id,
      t.currency,
      DATE_TRUNC('month', t.transaction_date) AS month,
      SUM(t.amount) AS income
    FROM public.transactions t
    WHERE t.type = 'income'
      AND DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY t.user_id, t.currency, DATE_TRUNC('month', t.transaction_date)
  ),
  spent_this_month AS (
    SELECT 
      t.user_id,
      t.category_id,
      t.currency,
      DATE_TRUNC('month', t.transaction_date) AS month,
      SUM(t.amount) AS total_spent
    FROM public.transactions t
    WHERE t.type = 'expense'
      AND DATE_TRUNC('month', t.transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY t.user_id, t.category_id, t.currency, DATE_TRUNC('month', t.transaction_date)
  )
SELECT 
  b.id,
  b.user_id,
  b.category_id,
  c.name AS category_name,
  c.color AS category_color,
  -- Allowed budget amount for the month (absolute or % of income in same currency)
  CASE 
    WHEN b.mode = 'percent_income' THEN COALESCE(i.income, 0) * (COALESCE(b.percent, 0) / 100.0)
    ELSE b.amount
  END AS budget_amount,
  b.currency,
  b.period,
  (SELECT month_start FROM month_bounds) AS start_date,
  (SELECT month_end FROM month_bounds) AS end_date,
  COALESCE(s.total_spent, 0) AS spent_amount,
  CASE 
    WHEN (CASE WHEN b.mode = 'percent_income' THEN COALESCE(i.income, 0) * (COALESCE(b.percent, 0) / 100.0) ELSE b.amount END) > 0
      THEN (COALESCE(s.total_spent, 0) / (CASE WHEN b.mode = 'percent_income' THEN COALESCE(i.income, 0) * (COALESCE(b.percent, 0) / 100.0) ELSE b.amount END)) * 100
    ELSE 0
  END AS usage_percentage
FROM public.budgets b
LEFT JOIN public.categories c ON b.category_id = c.id
LEFT JOIN income_this_month i 
  ON i.user_id = b.user_id AND i.currency = b.currency
LEFT JOIN spent_this_month s 
  ON s.user_id = b.user_id AND s.category_id = b.category_id AND s.currency = b.currency;

GRANT SELECT ON public.budget_vs_actual TO authenticated;
