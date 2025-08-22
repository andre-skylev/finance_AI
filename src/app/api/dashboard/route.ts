import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
  const supabase = await createClient()
    
    // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const displayCurrency = (searchParams.get('currency') as 'EUR' | 'BRL') || 'EUR'

    switch (type) {
      case 'net-worth':
        return await getNetWorth(supabase, user.id, displayCurrency)
      
      case 'account-balances':
        return await getAccountBalances(supabase, user.id)
      
      case 'expenses-by-category':
        return await getExpensesByCategory(supabase, user.id, displayCurrency)
      
      case 'cash-flow':
        return await getCashFlow(supabase, user.id, displayCurrency)
      
      case 'recent-transactions':
        const limit = parseInt(searchParams.get('limit') || '5')
        return await getRecentTransactions(supabase, user.id, limit)
      
      case 'financial-kpis':
        return await getFinancialKPIs(supabase, user.id, displayCurrency)
      
      case 'budget-vs-actual':
        return await getBudgetVsActual(supabase, user.id)
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type Rates = { eur_to_brl: number; brl_to_eur: number }

async function getLatestRates(supabase: any): Promise<Rates> {
  const { data: today } = await supabase
    .from('exchange_rates')
    .select('*')
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (today?.eur_to_brl && today?.brl_to_eur) {
    return { eur_to_brl: Number(today.eur_to_brl), brl_to_eur: Number(today.brl_to_eur) }
  }
  const envEUR = Number(process.env.EXCHANGE_FALLBACK_EUR_TO_BRL)
  if (isFinite(envEUR) && envEUR > 0) return { eur_to_brl: envEUR, brl_to_eur: 1 / envEUR }
  return { eur_to_brl: 1, brl_to_eur: 1 }
}

function convertAmount(amount: number, from: 'EUR'|'BRL', to: 'EUR'|'BRL', rates: Rates) {
  if (from === to) return amount
  if (from === 'EUR' && to === 'BRL') return amount * rates.eur_to_brl
  if (from === 'BRL' && to === 'EUR') return amount * rates.brl_to_eur
  return amount
}

async function getNetWorth(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL') {
  try {
    const rates = await getLatestRates(supabase)

    // Accounts (assets)
    const { data: accounts } = await supabase
      .from('account_balances_view')
      .select('balance, currency')
      .eq('user_id', userId)
    const totalAssets = (accounts || []).reduce((sum: number, a: any) => sum + convertAmount(Number(a.balance || 0), (a.currency || 'EUR'), displayCurrency, rates), 0)

    // Credit cards (liabilities)
    const { data: cards } = await supabase
      .from('credit_cards')
      .select('current_balance, currency')
      .eq('user_id', userId)
    const totalLiabilities = (cards || []).reduce((sum: number, c: any) => sum + convertAmount(Number(c.current_balance || 0), (c.currency || 'EUR'), displayCurrency, rates), 0)

    const netWorth = totalAssets - totalLiabilities

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

    // Calculate cumulative net worth over time (best-effort with conversion)
    const convertedNets = (historicalData || []).map((m: any) => ({
      month: m.month,
      net: convertAmount(Number(m.net || 0), 'EUR', displayCurrency, rates),
    }))
    const totalPeriodNet = convertedNets.reduce((s: number, m: any) => s + m.net, 0)
    const startBalance = netWorth - totalPeriodNet
    let runningBalance = startBalance
    const netWorthHistory = convertedNets.map((m: any) => {
      runningBalance += m.net
      return {
        month: new Date(m.month).toLocaleDateString('pt-PT', { month: 'short' }),
        value: runningBalance,
      }
    })

    return NextResponse.json({
      current: { net_worth: netWorth, total_assets: totalAssets, total_liabilities: totalLiabilities, currency: displayCurrency },
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

async function getExpensesByCategory(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL') {
  try {
  const rates = await getLatestRates(supabase)
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
    const formattedData = expenses?.map((expense: any) => {
      const raw = Number(expense.total_amount)
      const fromCur: 'EUR'|'BRL' = (expense.currency || 'EUR')
      const value = convertAmount(raw, fromCur, displayCurrency, rates)
      return {
        name: expense.category_name || 'Sem Categoria',
        value,
        color: expense.category_color || '#6b7280'
      }
    }) || []

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    console.error('Error in getExpensesByCategory:', error)
    return NextResponse.json({ error: 'Failed to get expenses by category' }, { status: 500 })
  }
}

async function getCashFlow(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL') {
  try {
  const rates = await getLatestRates(supabase)
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
    const formattedData = cashFlow?.map((m: any) => {
      const income = convertAmount(Number(m.income), 'EUR', displayCurrency, rates)
      const expenses = convertAmount(Number(m.expenses), 'EUR', displayCurrency, rates)
      const net = convertAmount(Number(m.net), 'EUR', displayCurrency, rates)
      return {
        month: new Date(m.month).toLocaleDateString('pt-PT', { month: 'short' }),
        income,
        expenses,
        net
      }
    }) || []

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

async function getFinancialKPIs(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL') {
  try {
  const rates = await getLatestRates(supabase)
    // Get current month data
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Get this month's transactions
    const { data: thisMonthTransactions, error: thisMonthError } = await supabase
      .from('transactions')
      .select('type, amount, currency')
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
      .select('type, amount, currency')
      .eq('user_id', userId)
      .gte('transaction_date', lastMonth.toISOString().split('T')[0])
      .lt('transaction_date', currentMonth.toISOString().split('T')[0])

    if (lastMonthError) {
      console.error('Error fetching last month transactions:', lastMonthError)
    }

    // Calculate KPIs
    const thisMonthIncome = thisMonthTransactions
      ?.filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    const thisMonthExpenses = thisMonthTransactions
      ?.filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    const lastMonthIncome = lastMonthTransactions
      ?.filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    const lastMonthExpenses = lastMonthTransactions
      ?.filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

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
    // Net worth in selected currency
    const { data: accs } = await supabase
      .from('account_balances_view')
      .select('balance, currency')
      .eq('user_id', userId)
    const assets = (accs || []).reduce((s: number, a: any) => s + convertAmount(Number(a.balance || 0), (a.currency || 'EUR'), displayCurrency, rates), 0)
    const { data: ccs } = await supabase
      .from('credit_cards')
      .select('current_balance, currency')
      .eq('user_id', userId)
    const liabilities = (ccs || []).reduce((s: number, c: any) => s + convertAmount(Number(c.current_balance || 0), (c.currency || 'EUR'), displayCurrency, rates), 0)

    const kpis = {
      // As requested: primary KPI reflects income - expenses (period net)
      totalBalance: thisMonthIncome - thisMonthExpenses,
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

async function getBudgetVsActual(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('budget_vs_actual')
      .select('*')
      .eq('user_id', userId)
      .order('usage_percentage', { ascending: false })

    if (error) {
      console.error('Error fetching budget vs actual:', error)
      return NextResponse.json({ error: 'Failed to fetch budget vs actual' }, { status: 500 })
    }

    const formatted = (data || []).map((row: any) => {
      const budgeted = parseFloat(row.budget_amount || 0)
      const actual = parseFloat(row.spent_amount || 0)
      const variance = budgeted > 0 ? ((actual - budgeted) / budgeted) * 100 : 0
      return {
        category: row.category_name || 'Outros',
        budgeted,
        actual,
        variance,
        color: row.category_color || '#6b7280',
        currency: row.currency || 'EUR',
        period: row.period || 'monthly',
        start_date: row.start_date,
        end_date: row.end_date,
      }
    })

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('Error in getBudgetVsActual:', error)
    return NextResponse.json({ error: 'Failed to get budget vs actual' }, { status: 500 })
  }
}
