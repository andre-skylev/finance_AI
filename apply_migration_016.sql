-- Execute this to apply the migration 016_fix_orphaned_transactions.sql

-- 1. Update get_recent_transactions function to exclude transactions from inactive accounts
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
  INNER JOIN public.accounts a ON t.account_id = a.id  -- Changed from LEFT JOIN to INNER JOIN
  WHERE t.user_id = user_uuid 
    AND a.is_active = true  -- Only show transactions from active accounts
  ORDER BY t.transaction_date DESC, t.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update monthly_expenses_by_category view to exclude transactions from inactive accounts
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
INNER JOIN public.accounts a ON t.account_id = a.id  -- Added INNER JOIN to filter active accounts
WHERE t.type = 'expense' 
  AND a.is_active = true  -- Only include transactions from active accounts
GROUP BY t.user_id, c.name, c.color, DATE_TRUNC('month', t.transaction_date), t.currency
ORDER BY month DESC, total_amount DESC;

-- 3. Update monthly_cash_flow view to exclude transactions from inactive accounts
CREATE OR REPLACE VIEW public.monthly_cash_flow AS
SELECT 
  t.user_id,
  DATE_TRUNC('month', t.transaction_date) as month,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as income,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as expenses,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) as net,
  t.currency
FROM public.transactions t
INNER JOIN public.accounts a ON t.account_id = a.id  -- Added INNER JOIN to filter active accounts
WHERE a.is_active = true  -- Only include transactions from active accounts
GROUP BY t.user_id, DATE_TRUNC('month', t.transaction_date), t.currency
ORDER BY month DESC;

-- 4. Update budget_vs_actual view to exclude transactions from inactive accounts
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
    t.category_id,
    SUM(t.amount) as total_spent
  FROM public.transactions t
  INNER JOIN public.accounts a ON t.account_id = a.id  -- Added INNER JOIN to filter active accounts
  WHERE t.type = 'expense'
    AND t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    AND a.is_active = true  -- Only include transactions from active accounts
  GROUP BY t.category_id
) spent ON b.category_id = spent.category_id
WHERE b.is_active = true
ORDER BY usage_percentage DESC;

-- 5. Add a cleanup function to remove orphaned transactions (optional, for manual cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_transactions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Count and delete transactions that reference non-existent or inactive accounts
  WITH orphaned_transactions AS (
    SELECT t.id 
    FROM public.transactions t
    LEFT JOIN public.accounts a ON t.account_id = a.id
    WHERE a.id IS NULL OR a.is_active = false
  )
  DELETE FROM public.transactions 
  WHERE id IN (SELECT id FROM orphaned_transactions);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the cleanup function to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_transactions() TO authenticated;

-- Add a comment explaining the fix
COMMENT ON FUNCTION public.get_recent_transactions(UUID, INTEGER) IS 'Returns recent transactions from active accounts only, preventing orphaned transactions from appearing in dashboard';
COMMENT ON FUNCTION public.cleanup_orphaned_transactions() IS 'Removes transactions that reference deleted or inactive accounts - use with caution';
