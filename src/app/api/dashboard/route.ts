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
      
      case 'fixed-costs':
        return await getFixedCostsData(supabase, user.id)
      
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
  if (from === to) return Math.round(amount * 100) / 100
  if (from === 'EUR' && to === 'BRL') return Math.round(amount * rates.eur_to_brl * 100) / 100
  if (from === 'BRL' && to === 'EUR') return Math.round(amount * rates.brl_to_eur * 100) / 100
  return Math.round(amount * 100) / 100
}

async function getNetWorth(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL') {
  try {
    const rates = await getLatestRates(supabase)

    // Accounts (assets)
    // Use secure view; approximate asset value from balance ranges is not possible directly.
    // So, fall back to accounts table balances for computation, but do NOT expose raw values in responses.
    const { data: accounts } = await supabase
      .from('accounts')
      .select('balance, currency')
      .eq('user_id', userId)
      .eq('is_active', true)
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
        .from('bank_account_transactions')
        .select('transaction_type, amount, currency, transaction_date')
        .eq('user_id', userId)
        .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true })

      if (historyError) {
        console.error('Error fetching historical data:', historyError)
      }

      // Aggregate monthly net from bank_account_transactions
      const byMonth: Record<string, { income: number; expenses: number; currency: 'EUR'|'BRL' }> = {}
      ;(historicalData || []).forEach((t: any) => {
        const d = new Date(t.transaction_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0, currency: (t.currency || 'EUR') }
        if (t.transaction_type === 'credit') byMonth[key].income += Number(t.amount || 0)
        else byMonth[key].expenses += Number(t.amount || 0)
      })
      const months: string[] = []
      const cur = new Date(sixMonthsAgo)
      for (let i=0;i<6;i++) { months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`); cur.setMonth(cur.getMonth()+1) }
      const convertedNets = months.map((key) => {
        const m = byMonth[key] || { income: 0, expenses: 0, currency: 'EUR' as const }
        const net = convertAmount((m.income - m.expenses), m.currency, displayCurrency, rates)
        const [year, month] = key.split('-').map(Number)
        const monthDate = new Date(year, month - 1, 1)
        return { month: monthDate.toISOString(), net }
      })
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
      .from('accounts')
      .select('id, name, bank_name, account_type, currency, balance, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true })

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
    // Determine current month range
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)

    // Get active account ids first
    const { data: activeAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    const activeIds = (activeAccounts || []).map((a: any) => a.id)

    // Fetch this month's debit transactions and group by category in memory
    const { data: txs, error } = await supabase
      .from('bank_account_transactions')
      .select('amount, currency, category_id')
      .eq('user_id', userId)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('transaction_type', 'debit')
      .gte('transaction_date', start.toISOString().split('T')[0])
      .lt('transaction_date', end.toISOString().split('T')[0])

    if (error) {
      console.error('Error fetching expenses by category:', error)
      return NextResponse.json({ error: 'Failed to fetch expenses by category' }, { status: 500 })
    }

    const totals = new Map<string | null, { total: number; currency: 'EUR'|'BRL' }>()
    for (const t of txs || []) {
      const key = t.category_id || null
      const cur: 'EUR'|'BRL' = (t.currency || 'EUR')
      const prev = totals.get(key) || { total: 0, currency: cur }
      // Sum in native then convert at display time
      totals.set(key, { total: prev.total + Number(t.amount || 0), currency: cur })
    }

    // Fetch category metadata including parents
    const categoryIds = Array.from(new Set(Array.from(totals.keys()).filter((k): k is string => !!k)))
    const { data: catsRaw } = await supabase
      .from('categories')
      .select('id, name, color, parent_id')
      .in('id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
    type Cat = { id: string; name: string; color: string; parent_id: string | null }
    const cats = (catsRaw as Cat[] | null) || []
    const initialCatMap = new Map<string, Cat>(cats.map((c) => [c.id, c]))
    // Identify missing parent ids and fetch them to ensure grouping by parent works even if parent had no direct txs
    const missingParentIds = Array.from(new Set(cats
      .map((c) => c.parent_id)
      .filter((pid): pid is string => !!pid && !initialCatMap.has(pid))))
    let parentCats: Cat[] = []
    if (missingParentIds.length) {
      const { data: parentsRaw } = await supabase
        .from('categories')
        .select('id, name, color, parent_id')
        .in('id', missingParentIds)
      parentCats = (parentsRaw as Cat[] | null) || []
    }
    const catMap = new Map<string, Cat>([
      ...Array.from(initialCatMap.entries()),
      ...parentCats.map((p): [string, Cat] => [p.id, p])
    ])

    // Build parent grouping with children breakdown
  type Child = { id: string; name: string; value: number }
  type Group = { id: string | null; name: string; color: string; value: number; children: Child[] }
  const groups = new Map<string | 'uncategorized', Group>()

    for (const [catId, v] of totals.entries()) {
      if (!catId) {
        const key: 'uncategorized' = 'uncategorized'
        const converted = convertAmount(v.total, v.currency, displayCurrency, rates)
        const g = groups.get(key) || { id: null, name: 'Sem Categoria', color: '#6b7280', value: 0, children: [] }
        g.value += converted
        groups.set(key, g)
        continue
      }

  const c = catMap.get(catId) as Cat | undefined
  const parentId = c?.parent_id || c?.id
  const parent = parentId ? (catMap.get(parentId) as Cat | undefined) || c : undefined
  const groupKey: string | 'uncategorized' = parent?.id || 'uncategorized'
  const groupName = parent?.name || 'Sem Categoria'
  const groupColor = parent?.color || '#6b7280'
      const converted = convertAmount(v.total, v.currency, displayCurrency, rates)

  const g: Group = groups.get(groupKey) || { id: parent?.id || null, name: groupName, color: groupColor, value: 0, children: [] }
      g.value += converted
      // Child entry (actual category c)
  g.children.push({ id: catId, name: c?.name || 'Sem Categoria', value: converted })
      groups.set(groupKey, g)
    }

    const formattedData = Array.from(groups.values()).sort((a, b) => b.value - a.value)

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    console.error('Error in getExpensesByCategory:', error)
    return NextResponse.json({ error: 'Failed to get expenses by category' }, { status: 500 })
  }
}

async function getCashFlow(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL') {
  try {
    const rates = await getLatestRates(supabase)
    // Range: last 6 full months including current
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    start.setMonth(start.getMonth() - 5)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 6)

    // Active accounts
    const { data: activeAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    const activeIds = (activeAccounts || []).map((a: any) => a.id)

    // Fetch transactions in range
    const { data: txs, error } = await supabase
      .from('bank_account_transactions')
      .select('amount, currency, transaction_type, transaction_date')
      .eq('user_id', userId)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('transaction_date', start.toISOString().split('T')[0])
      .lt('transaction_date', end.toISOString().split('T')[0])

    if (error) {
      console.error('Error fetching cash flow:', error)
      return NextResponse.json({ error: 'Failed to fetch cash flow' }, { status: 500 })
    }

    // Aggregate by month
    const byMonth: Record<string, { income: number; expenses: number; currency: 'EUR'|'BRL' }> = {}
    for (const t of txs || []) {
      const d = new Date(t.transaction_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth[key]) byMonth[key] = { income: 0, expenses: 0, currency: (t.currency || 'EUR') }
      if (t.transaction_type === 'credit') byMonth[key].income += Number(t.amount || 0)
      else byMonth[key].expenses += Number(t.amount || 0)
    }

    // Build ordered months from start to end
    const months: string[] = []
    const cur = new Date(start)
    while (cur < end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
      cur.setMonth(cur.getMonth() + 1)
    }

    const formattedData = months.map((key) => {
      const m = byMonth[key] || { income: 0, expenses: 0, currency: 'EUR' as const }
      const [year, month] = key.split('-').map(Number)
      const label = new Date(year, month - 1, 1).toLocaleDateString('pt-PT', { month: 'short' })
      const income = convertAmount(m.income, m.currency, displayCurrency, rates)
      const expenses = convertAmount(m.expenses, m.currency, displayCurrency, rates)
      return { month: label, income, expenses, net: income - expenses }
    })

    return NextResponse.json({ data: formattedData })
  } catch (error) {
    console.error('Error in getCashFlow:', error)
    return NextResponse.json({ error: 'Failed to get cash flow data' }, { status: 500 })
  }
}

async function getRecentTransactions(supabase: any, userId: string, limit: number) {
  try {
    // Active accounts
    const { data: activeAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    const activeIds = (activeAccounts || []).map((a: any) => a.id)

    const { data: txs, error } = await supabase
      .from('bank_account_transactions')
      .select('id, amount, currency, description, transaction_date, transaction_type')
      .eq('user_id', userId)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .order('transaction_date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch recent transactions' }, { status: 500 })
    }

    const mapped = (txs || []).map((t: any) => ({
      id: t.id,
      amount: Number(t.amount || 0),
      currency: t.currency || 'EUR',
      description: t.description || '',
      transaction_date: t.transaction_date,
      type: t.transaction_type === 'credit' ? 'income' : 'expense'
    }))

    return NextResponse.json({ transactions: mapped })
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
      .from('bank_account_transactions')
      .select('transaction_type, amount, currency')
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
      .from('bank_account_transactions')
      .select('transaction_type, amount, currency')
      .eq('user_id', userId)
      .gte('transaction_date', lastMonth.toISOString().split('T')[0])
      .lt('transaction_date', currentMonth.toISOString().split('T')[0])

    if (lastMonthError) {
      console.error('Error fetching last month transactions:', lastMonthError)
    }

    // Calculate KPIs including fixed costs
    const thisMonthIncome = thisMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'credit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    const thisMonthExpenses = thisMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'debit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    // Get fixed costs for current month
    const { data: fixedCostsEntries } = await supabase
      .from('fixed_cost_entries')
      .select('amount, currency')
      .eq('user_id', userId)
      .gte('month', currentMonth.toISOString().split('T')[0])
      .lt('month', nextMonth.toISOString().split('T')[0])

    const thisMonthFixedCosts = (fixedCostsEntries || [])
      .reduce((sum: number, entry: any) => sum + convertAmount(Number(entry.amount || 0), (entry.currency || 'EUR'), displayCurrency, rates), 0)

    // Get estimated fixed costs if no entries exist
    const { data: fixedCosts } = await supabase
      .from('fixed_costs')
      .select('estimated_amount, currency')
      .eq('user_id', userId)
      .eq('is_active', true)

    const estimatedFixedCosts = (fixedCosts || [])
      .reduce((sum: number, cost: any) => sum + convertAmount(Number(cost.estimated_amount || 0), (cost.currency || 'EUR'), displayCurrency, rates), 0)

    // Use actual fixed costs if available, otherwise use estimated
    const totalFixedCosts = thisMonthFixedCosts > 0 ? thisMonthFixedCosts : estimatedFixedCosts
    const totalMonthlyExpenses = thisMonthExpenses + totalFixedCosts

    const lastMonthIncome = lastMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'credit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    const lastMonthExpenses = lastMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'debit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    // Get last month fixed costs
    const { data: lastMonthFixedCostsEntries } = await supabase
      .from('fixed_cost_entries')
      .select('amount, currency')
      .eq('user_id', userId)
      .gte('month', lastMonth.toISOString().split('T')[0])
      .lt('month', currentMonth.toISOString().split('T')[0])

    const lastMonthFixedCosts = (lastMonthFixedCostsEntries || [])
      .reduce((sum: number, entry: any) => sum + convertAmount(Number(entry.amount || 0), (entry.currency || 'EUR'), displayCurrency, rates), 0)

    const lastTotalFixedCosts = lastMonthFixedCosts > 0 ? lastMonthFixedCosts : estimatedFixedCosts
    const lastTotalMonthlyExpenses = lastMonthExpenses + lastTotalFixedCosts

    // Calculate growth rates
    const incomeGrowth = lastMonthIncome > 0 
      ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 
      : 0

    const expenseGrowth = lastTotalMonthlyExpenses > 0 
      ? ((totalMonthlyExpenses - lastTotalMonthlyExpenses) / lastTotalMonthlyExpenses) * 100 
      : 0

    const savingsRate = thisMonthIncome > 0 
      ? ((thisMonthIncome - totalMonthlyExpenses) / thisMonthIncome) * 100 
      : 0

    // Get total net worth
    // Net worth in selected currency
    const { data: accs } = await supabase
      .from('accounts')
      .select('balance, currency')
      .eq('user_id', userId)
      .eq('is_active', true)
    const assets = (accs || []).reduce((s: number, a: any) => s + convertAmount(Number(a.balance || 0), (a.currency || 'EUR'), displayCurrency, rates), 0)
    const { data: ccs } = await supabase
      .from('credit_cards')
      .select('current_balance, currency')
      .eq('user_id', userId)
    const liabilities = (ccs || []).reduce((s: number, c: any) => s + convertAmount(Number(c.current_balance || 0), (c.currency || 'EUR'), displayCurrency, rates), 0)

    const kpis = {
      // Primary KPI reflects income - all expenses (including fixed costs)
      totalBalance: thisMonthIncome - totalMonthlyExpenses,
      totalBalanceChange: 0, // TODO: Calculate based on historical data
      monthlyIncome: thisMonthIncome,
      monthlyIncomeChange: incomeGrowth,
      monthlyExpenses: totalMonthlyExpenses,
      monthlyExpensesChange: expenseGrowth,
      variableExpenses: thisMonthExpenses,
      fixedCosts: totalFixedCosts,
      estimatedFixedCosts: estimatedFixedCosts,
      actualFixedCosts: thisMonthFixedCosts,
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
    const rates = await getLatestRates(supabase)
    // Load active budgets and categories
    const { data: budgets, error: bErr } = await supabase
      .from('budgets')
      .select('id, user_id, category_id, amount, currency, period, start_date, end_date, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (bErr) {
      console.error('Error fetching budgets:', bErr)
      return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
    }

    const categoryIds = Array.from(new Set((budgets || []).map((b: any) => b.category_id).filter(Boolean)))
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, color')
      .in('id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
    const catMap = new Map((cats || []).map((c: any) => [c.id, c]))

    if (!budgets || budgets.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Define spend window to cover all budgets' ranges
    const parseDate = (d: string) => new Date(d + 'T00:00:00')
    const minStart = budgets.reduce((min: Date, b: any) => {
      const d = parseDate(b.start_date)
      return d < min ? d : min
    }, parseDate(budgets[0].start_date))
    const maxEnd = budgets.reduce((max: Date, b: any) => {
      const d = parseDate(b.end_date)
      return d > max ? d : max
    }, parseDate(budgets[0].end_date))

    // Active accounts
    const { data: activeAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    const activeIds = (activeAccounts || []).map((a: any) => a.id)

    // Fetch expenses in window grouped in memory by category
    const { data: txs } = await supabase
      .from('bank_account_transactions')
      .select('amount, currency, category_id, transaction_date')
      .eq('user_id', userId)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('transaction_type', 'debit')
  .gte('transaction_date', minStart.toISOString().split('T')[0])
  .lt('transaction_date', new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate() + 1).toISOString().split('T')[0])

    // Compute actuals per budget range
  const txList = (txs || []) as any[]
    const formatted = (budgets || []).map((b: any) => {
      const cat = (b.category_id ? (catMap.get(b.category_id) as any) : null) as any
      const startB = parseDate(b.start_date)
      const endB = parseDate(b.end_date)
      const endBPlus = new Date(endB.getFullYear(), endB.getMonth(), endB.getDate() + 1)
      const relevant = txList.filter((t: any) => {
        if (!t.category_id) return false
        if (t.category_id !== b.category_id) return false
        const dt = parseDate(t.transaction_date)
        return dt >= startB && dt < endBPlus
      })
  const spentInBudgetCur = relevant.reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount || 0), (t.currency || 'EUR'), (b.currency || 'EUR'), rates as any), 0)
      const budgeted = Number(b.amount || 0)
      const variance = budgeted > 0 ? ((spentInBudgetCur - budgeted) / budgeted) * 100 : 0
      return {
        id: b.id,
        category_id: b.category_id,
        category: cat?.name || 'Outros',
        budgeted,
        actual: spentInBudgetCur,
        usage_percentage: budgeted > 0 ? (spentInBudgetCur / budgeted) * 100 : 0,
        variance,
        color: cat?.color || '#6b7280',
        currency: b.currency || 'EUR',
        period: b.period || 'monthly',
        start_date: b.start_date,
        end_date: b.end_date,
      }
    }).sort((a: any, b: any) => (b.variance - a.variance))

    return NextResponse.json({ data: formatted })
  } catch (error) {
    console.error('Error in getBudgetVsActual:', error)
    return NextResponse.json({ error: 'Failed to get budget vs actual' }, { status: 500 })
  }
}

async function getFixedCostsData(supabase: any, userId: string) {
  try {
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Get active fixed costs
    const { data: fixedCosts, error: fixedCostsError } = await supabase
      .from('fixed_costs')
      .select(`
        id,
        name,
        cost_type,
        estimated_amount,
        currency,
        provider,
        due_day,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true)

    if (fixedCostsError) {
      console.error('Error fetching fixed costs:', fixedCostsError)
      return NextResponse.json({ error: 'Failed to fetch fixed costs' }, { status: 500 })
    }

    // Get current month entries
    const { data: monthlyEntries, error: entriesError } = await supabase
      .from('fixed_cost_entries')
      .select(`
        fixed_cost_id,
        amount,
        status,
        payment_date,
        provider_name
      `)
      .eq('user_id', userId)
      .gte('month', currentMonth.toISOString().split('T')[0])
      .lt('month', nextMonth.toISOString().split('T')[0])

    if (entriesError) {
      console.error('Error fetching monthly entries:', entriesError)
    }

    // Combine data
    const entriesMap = new Map()
    ;(monthlyEntries || []).forEach((entry: any) => {
      entriesMap.set(entry.fixed_cost_id, entry)
    })

    const dashboard = {
      totalEstimated: 0,
      totalActual: 0,
      paidCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      byType: {} as Record<string, {
        estimated: number,
        actual: number,
        count: number
      }>
    }

    const costs = (fixedCosts || []).map((cost: any) => {
      const entry = entriesMap.get(cost.id)
      const estimated = parseFloat(cost.estimated_amount || 0)
      const actual = entry ? parseFloat(entry.amount || 0) : 0
      
      dashboard.totalEstimated += estimated
      
      if (entry) {
        dashboard.totalActual += actual
        
        if (entry.status === 'paid') {
          dashboard.paidCount++
        } else if (entry.status === 'pending') {
          dashboard.pendingCount++
        } else if (entry.status === 'overdue') {
          dashboard.overdueCount++
        }
      } else {
        // Not tracked this month, count as pending
        dashboard.pendingCount++
      }

      // Group by type
      if (!dashboard.byType[cost.cost_type]) {
        dashboard.byType[cost.cost_type] = { estimated: 0, actual: 0, count: 0 }
      }
      dashboard.byType[cost.cost_type].estimated += estimated
      dashboard.byType[cost.cost_type].actual += actual
      dashboard.byType[cost.cost_type].count++

      return {
        id: cost.id,
        name: cost.name,
        type: cost.cost_type,
        estimated: estimated,
        actual: actual,
        currency: cost.currency,
        provider: entry?.provider_name || cost.provider,
        dueDay: cost.due_day,
        status: entry?.status || 'pending',
        paymentDate: entry?.payment_date,
        variance: estimated > 0 ? ((actual - estimated) / estimated) * 100 : 0
      }
    })

    return NextResponse.json({ 
      dashboard,
      costs,
      month: currentMonth.toISOString().split('T')[0]
    })
  } catch (error) {
    console.error('Error in getFixedCostsData:', error)
    return NextResponse.json({ error: 'Failed to get fixed costs data' }, { status: 500 })
  }
}
