const { createClient } = require('@supabase/supabase-js')

async function applyFix() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' })
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    console.log('Applying orphaned transactions fix...')
    
    // 1. First, let's update the get_recent_transactions function
    console.log('1. Updating get_recent_transactions function...')
    const { error: func1Error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.get_recent_transactions(user_uuid UUID, limit_count INTEGER DEFAULT 10)
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
          INNER JOIN public.accounts a ON t.account_id = a.id
          WHERE t.user_id = user_uuid 
            AND a.is_active = true
          ORDER BY t.transaction_date DESC, t.created_at DESC
          LIMIT limit_count;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    })
    
    if (func1Error) {
      console.error('Error updating get_recent_transactions:', func1Error)
    } else {
      console.log('✅ get_recent_transactions updated successfully')
    }
    
    // 2. Update monthly_expenses_by_category view
    console.log('2. Updating monthly_expenses_by_category view...')
    const { error: view1Error } = await supabase.rpc('exec_sql', {
      sql: `
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
        INNER JOIN public.accounts a ON t.account_id = a.id
        WHERE t.type = 'expense' 
          AND a.is_active = true
        GROUP BY t.user_id, c.name, c.color, DATE_TRUNC('month', t.transaction_date), t.currency
        ORDER BY month DESC, total_amount DESC;
      `
    })
    
    if (view1Error) {
      console.error('Error updating monthly_expenses_by_category:', view1Error)
    } else {
      console.log('✅ monthly_expenses_by_category updated successfully')
    }
    
    // 3. Update monthly_cash_flow view
    console.log('3. Updating monthly_cash_flow view...')
    const { error: view2Error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW public.monthly_cash_flow AS
        SELECT 
          t.user_id,
          DATE_TRUNC('month', t.transaction_date) as month,
          SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as income,
          SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as expenses,
          SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) as net,
          t.currency
        FROM public.transactions t
        INNER JOIN public.accounts a ON t.account_id = a.id
        WHERE a.is_active = true
        GROUP BY t.user_id, DATE_TRUNC('month', t.transaction_date), t.currency
        ORDER BY month DESC;
      `
    })
    
    if (view2Error) {
      console.error('Error updating monthly_cash_flow:', view2Error)
    } else {
      console.log('✅ monthly_cash_flow updated successfully')
    }
    
    console.log('\nFix applied! Dashboard should now exclude orphaned transactions.')
    
  } catch (error) {
    console.error('Fix failed:', error)
    process.exit(1)
  }
}

applyFix()
