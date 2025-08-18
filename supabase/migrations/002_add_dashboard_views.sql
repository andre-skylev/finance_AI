-- Migration: Add dashboard views and functions for real-time data
-- Created: 2025-08-17

-- View for monthly expenses by category
CREATE OR REPLACE VIEW public.monthly_expenses_by_category AS
SELECT 
  t.user_id,
  c.name as category_name,
  c.color as category_color,
  DATE_TRUNC('month', t.transaction_date) as month,
  SUM(t.amount) as total_amount,
  t.currency
FROM public.transactions t
LEFT JOIN public.categories c ON t.category_id = c.id
WHERE t.type = 'expense'
GROUP BY t.user_id, c.name, c.color, DATE_TRUNC('month', t.transaction_date), t.currency
ORDER BY month DESC, total_amount DESC;

-- View for account balances with last update
CREATE OR REPLACE VIEW public.account_balances_view AS
SELECT 
  a.id,
  a.user_id,
  a.name,
  a.bank_name,
  a.account_type,
  a.balance,
  a.currency,
  a.is_active,
  COALESCE(last_transaction.last_update, a.updated_at) as last_update
FROM public.accounts a
LEFT JOIN (
  SELECT 
    account_id,
    MAX(transaction_date) as last_update
  FROM public.transactions
  GROUP BY account_id
) last_transaction ON a.id = last_transaction.account_id
WHERE a.is_active = true;

-- View for monthly cash flow
CREATE OR REPLACE VIEW public.monthly_cash_flow AS
SELECT 
  user_id,
  DATE_TRUNC('month', transaction_date) as month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net,
  currency
FROM public.transactions
GROUP BY user_id, DATE_TRUNC('month', transaction_date), currency
ORDER BY month DESC;

-- View for goal progress
CREATE OR REPLACE VIEW public.goals_progress_view AS
SELECT 
  g.*,
  CASE 
    WHEN g.target_amount > 0 THEN (g.current_amount / g.target_amount * 100)
    ELSE 0 
  END as progress_percentage,
  CASE 
    WHEN g.target_date IS NOT NULL THEN 
      GREATEST(0, (g.target_date - CURRENT_DATE))
    ELSE NULL 
  END as days_remaining
FROM public.goals g
WHERE g.is_completed = false
ORDER BY g.target_date ASC NULLS LAST;

-- View for budget vs actual spending
CREATE OR REPLACE VIEW public.budget_vs_actual AS
SELECT 
  b.id,
  b.user_id,
  b.category_id,
  c.name as category_name,
  c.color as category_color,
  b.amount as budget_amount,
  b.currency,
  b.period,
  b.start_date,
  b.end_date,
  COALESCE(spent.total_spent, 0) as spent_amount,
  CASE 
    WHEN b.amount > 0 THEN (COALESCE(spent.total_spent, 0) / b.amount * 100)
    ELSE 0 
  END as usage_percentage,
  (b.amount - COALESCE(spent.total_spent, 0)) as remaining_amount
FROM public.budgets b
LEFT JOIN public.categories c ON b.category_id = c.id
LEFT JOIN (
  SELECT 
    category_id,
    SUM(amount) as total_spent
  FROM public.transactions
  WHERE type = 'expense'
    AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY category_id
) spent ON b.category_id = spent.category_id
WHERE b.is_active = true
ORDER BY usage_percentage DESC;

-- Function to calculate net worth
CREATE OR REPLACE FUNCTION public.calculate_net_worth(user_uuid UUID)
RETURNS TABLE (
  total_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  net_worth DECIMAL(15,2),
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN a.account_type IN ('checking', 'savings', 'investment') THEN a.balance ELSE 0 END), 0) as total_assets,
    COALESCE(SUM(CASE WHEN a.account_type = 'credit' AND a.balance < 0 THEN ABS(a.balance) ELSE 0 END), 0) as total_liabilities,
    COALESCE(SUM(CASE 
      WHEN a.account_type IN ('checking', 'savings', 'investment') THEN a.balance 
      WHEN a.account_type = 'credit' THEN a.balance
      ELSE 0 
    END), 0) as net_worth,
    COALESCE(MAX(a.currency), 'EUR') as currency
  FROM public.accounts a
  WHERE a.user_id = user_uuid AND a.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent transactions
CREATE OR REPLACE FUNCTION public.get_recent_transactions(user_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  amount DECIMAL(15,2),
  currency TEXT,
  description TEXT,
  transaction_date DATE,
  type TEXT,
  category_name TEXT,
  category_color TEXT,
  account_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.amount,
    t.currency,
    t.description,
    t.transaction_date,
    t.type,
    c.name as category_name,
    c.color as category_color,
    a.name as account_name
  FROM public.transactions t
  LEFT JOIN public.categories c ON t.category_id = c.id
  LEFT JOIN public.accounts a ON t.account_id = a.id
  WHERE t.user_id = user_uuid
  ORDER BY t.transaction_date DESC, t.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update account balance after transaction
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- For new transactions
  IF TG_OP = 'INSERT' THEN
    UPDATE public.accounts 
    SET 
      balance = balance + CASE 
        WHEN NEW.type = 'income' THEN NEW.amount
        WHEN NEW.type = 'expense' THEN -NEW.amount
        ELSE 0
      END,
      updated_at = NOW()
    WHERE id = NEW.account_id;
    RETURN NEW;
  END IF;
  
  -- For updated transactions
  IF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    UPDATE public.accounts 
    SET 
      balance = balance - CASE 
        WHEN OLD.type = 'income' THEN OLD.amount
        WHEN OLD.type = 'expense' THEN -OLD.amount
        ELSE 0
      END
    WHERE id = OLD.account_id;
    
    -- Apply new transaction
    UPDATE public.accounts 
    SET 
      balance = balance + CASE 
        WHEN NEW.type = 'income' THEN NEW.amount
        WHEN NEW.type = 'expense' THEN -NEW.amount
        ELSE 0
      END,
      updated_at = NOW()
    WHERE id = NEW.account_id;
    RETURN NEW;
  END IF;
  
  -- For deleted transactions
  IF TG_OP = 'DELETE' THEN
    UPDATE public.accounts 
    SET 
      balance = balance - CASE 
        WHEN OLD.type = 'income' THEN OLD.amount
        WHEN OLD.type = 'expense' THEN -OLD.amount
        ELSE 0
      END,
      updated_at = NOW()
    WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update account balance on transaction changes
CREATE TRIGGER update_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- Grant necessary permissions
GRANT SELECT ON public.monthly_expenses_by_category TO authenticated;
GRANT SELECT ON public.account_balances_view TO authenticated;
GRANT SELECT ON public.monthly_cash_flow TO authenticated;
GRANT SELECT ON public.goals_progress_view TO authenticated;
GRANT SELECT ON public.budget_vs_actual TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_net_worth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_transactions(UUID, INTEGER) TO authenticated;
