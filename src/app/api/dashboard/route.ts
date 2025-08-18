import { createClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    switch (type) {
      case 'net-worth':
        return await getNetWorth(supabase, user.id)
      
      case 'account-balances':
        return await getAccountBalances(supabase, user.id)
      
      case 'expenses-by-category':
        return await getExpensesByCategory(supabase, user.id)
      
      case 'cash-flow':
        return await getCashFlow(supabase, user.id)
      
      case 'recent-transactions':
        const limit = parseInt(searchParams.get('limit') || '5')
        return await getRecentTransactions(supabase, user.id, limit)
      
      case 'financial-kpis':
        return await getFinancialKPIs(supabase, user.id)
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getNetWorth(supabase: any, userId: string) {
  try {
    // Get net worth data
    const { data, error } = await supabase.rpc('calculate_net_worth', {
      user_uuid: userId
    })

    if (error) {
      console.error('Error calculating net worth:', error)
      return NextResponse.json({ error: 'Failed to calculate net worth' }, { status: 500 })
    }

    // Get historical data (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: historicalData, error: historyError } = await supabase
      .from('monthly_cash_flow')
      .select('*')
      .eq('user_id', userId)
      .gte('month', sixMonthsAgo.toISOString())
      .order('month', { ascending: true })

    if (historyError) {
      console.error('Error fetching historical data:', historyError)
    }

    // Calculate cumulative net worth over time
    let runningBalance = data[0]?.net_worth || 0
    const netWorthHistory = historicalData?.map((month: any) => {
      runningBalance += month.net
      return {
        month: new Date(month.month).toLocaleDateString('pt-PT', { month: 'short' }),
        value: runningBalance
      }
    }) || []

    return NextResponse.json({
      current: data[0] || { net_worth: 0, total_assets: 0, total_liabilities: 0, currency: 'EUR' },
      history: netWorthHistory
    })
  } catch (error) {
    console.error('Error in getNetWorth:', error)
    return NextResponse.json({ error: 'Failed to get net worth data' }, { status: 500 })
  }
}

async function getAccountBalances(supabase: any, userId: string) {
  try {
    const { data: accounts, error } = await supabase
      .from('account_balances_view')
      .select('*')
      .eq('user_id', userId)
      .order('balance', { ascending: false })

    if (error) {
      console.error('Error fetching account balances:', error)
      return NextResponse.json({ error: 'Failed to fetch account balances' }, { status: 500 })
    }

    return NextResponse.json({ accounts: accounts || [] })
  } catch (error) {
    console.error('Error in getAccountBalances:', error)
    return NextResponse.json({ error: 'Failed to get account balances' }, { status: 500 })
  }
}

async function getExpensesByCategory(supabase: any, userId: string) {
  try {
    // Get current month's expenses
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const { data: expenses, error } = await supabase
      .from('monthly_expenses_by_category')
      .select('*')
      .eq('user_id', userId)
      .gte('month', currentMonth.toISOString())
      .order('total_amount', { ascending: false })

    if (error) {
      console.error('Error fetching expenses by category:', error)
      return NextResponse.json({ error: 'Failed to fetch expenses by category' }, { status: 500 })
    }

    // Format data for chart
    const formattedData = expenses?.map((expense: any) => ({
      name: expense.category_name || 'Sem Categoria',
      value: parseFloat(expense.total_amount),
      color: expense.category_color || '#6b7280'
    })) || []

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    console.error('Error in getExpensesByCategory:', error)
    return NextResponse.json({ error: 'Failed to get expenses by category' }, { status: 500 })
  }
}

async function getCashFlow(supabase: any, userId: string) {
  try {
    // Get last 6 months of cash flow
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: cashFlow, error } = await supabase
      .from('monthly_cash_flow')
      .select('*')
      .eq('user_id', userId)
      .gte('month', sixMonthsAgo.toISOString())
      .order('month', { ascending: true })

    if (error) {
      console.error('Error fetching cash flow:', error)
      return NextResponse.json({ error: 'Failed to fetch cash flow' }, { status: 500 })
    }

    // Format data for chart
    const formattedData = cashFlow?.map((month: any) => ({
      month: new Date(month.month).toLocaleDateString('pt-PT', { month: 'short' }),
      income: parseFloat(month.income),
      expenses: parseFloat(month.expenses),
      net: parseFloat(month.net)
    })) || []

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    console.error('Error in getCashFlow:', error)
    return NextResponse.json({ error: 'Failed to get cash flow data' }, { status: 500 })
  }
}

async function getRecentTransactions(supabase: any, userId: string, limit: number) {
  try {
    const { data: transactions, error } = await supabase.rpc('get_recent_transactions', {
      user_uuid: userId,
      limit_count: limit
    })

    if (error) {
      console.error('Error fetching recent transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch recent transactions' }, { status: 500 })
    }

    return NextResponse.json({ transactions: transactions || [] })
  } catch (error) {
    console.error('Error in getRecentTransactions:', error)
    return NextResponse.json({ error: 'Failed to get recent transactions' }, { status: 500 })
  }
}

async function getFinancialKPIs(supabase: any, userId: string) {
  try {
    // Get current month data
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Get this month's transactions
    const { data: thisMonthTransactions, error: thisMonthError } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('transaction_date', currentMonth.toISOString().split('T')[0])
      .lt('transaction_date', nextMonth.toISOString().split('T')[0])

    if (thisMonthError) {
      console.error('Error fetching this month transactions:', thisMonthError)
    }

    // Get last month data for comparison
    const lastMonth = new Date(currentMonth)
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    const { data: lastMonthTransactions, error: lastMonthError } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('transaction_date', lastMonth.toISOString().split('T')[0])
      .lt('transaction_date', currentMonth.toISOString().split('T')[0])

    if (lastMonthError) {
      console.error('Error fetching last month transactions:', lastMonthError)
    }

    // Calculate KPIs
    const thisMonthIncome = thisMonthTransactions
      ?.filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0

    const thisMonthExpenses = thisMonthTransactions
      ?.filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0

    const lastMonthIncome = lastMonthTransactions
      ?.filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0

    const lastMonthExpenses = lastMonthTransactions
      ?.filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0

    // Calculate growth rates
    const incomeGrowth = lastMonthIncome > 0 
      ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 
      : 0

    const expenseGrowth = lastMonthExpenses > 0 
      ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
      : 0

    const savingsRate = thisMonthIncome > 0 
      ? ((thisMonthIncome - thisMonthExpenses) / thisMonthIncome) * 100 
      : 0

    // Get total net worth
    const { data: netWorthData } = await supabase.rpc('calculate_net_worth', {
      user_uuid: userId
    })

    const kpis = {
      totalBalance: netWorthData?.[0]?.net_worth || 0,
      totalBalanceChange: 0, // TODO: Calculate based on historical data
      monthlyIncome: thisMonthIncome,
      monthlyIncomeChange: incomeGrowth,
      monthlyExpenses: thisMonthExpenses,
      monthlyExpensesChange: expenseGrowth,
      savingsRate: savingsRate,
      savingsRateChange: 0 // TODO: Calculate based on historical data
    }

    return NextResponse.json({ kpis })
  } catch (error) {
    console.error('Error in getFinancialKPIs:', error)
    return NextResponse.json({ error: 'Failed to get financial KPIs' }, { status: 500 })
  }
}
