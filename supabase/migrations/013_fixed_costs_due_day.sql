-- Migration: Add due_day column to fixed_costs for monthly alerts
-- Created: 2025-08-22

ALTER TABLE public.fixed_costs
ADD COLUMN IF NOT EXISTS due_day integer NULL;

-- No RLS changes; existing policies apply.
