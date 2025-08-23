-- Simple fix: Just update the get_recent_transactions function
-- This is the main function used by the dashboard that shows orphaned transactions

-- First, drop the existing function
DROP FUNCTION IF EXISTS public.get_recent_transactions(UUID, INTEGER);

-- Recreate with INNER JOIN to exclude orphaned transactions
CREATE FUNCTION public.get_recent_transactions(user_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
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
  INNER JOIN public.accounts a ON t.account_id = a.id  -- INNER JOIN ensures only active accounts
  WHERE t.user_id = user_uuid 
    AND a.is_active = true  -- Only show transactions from active accounts
  ORDER BY t.transaction_date DESC, t.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_recent_transactions(UUID, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_recent_transactions(UUID, INTEGER) IS 'Returns recent transactions from active accounts only, preventing orphaned transactions from appearing in dashboard';
