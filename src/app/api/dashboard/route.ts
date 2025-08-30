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
  const displayCurrency = (searchParams.get('currency') as 'EUR' | 'BRL' | 'USD') || 'EUR'

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
        return await getBudgetVsActual(supabase, user.id, displayCurrency)
      
      case 'fixed-costs':
        return await getFixedCostsData(supabase, user.id, displayCurrency)
      
      case 'credit-card-forecast':
        return await getCreditCardForecast(supabase, user.id, displayCurrency)
      
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type Rates = { eur_to_brl: number; brl_to_eur: number; eur_to_usd?: number|null; usd_to_eur?: number|null; usd_to_brl?: number|null; brl_to_usd?: number|null }

async function getLatestRates(supabase: any): Promise<Rates> {
  const { data: today } = await supabase
    .schema('public')
    .from('exchange_rates')
    .select('*')
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (today?.eur_to_brl && today?.brl_to_eur) {
    return { 
      eur_to_brl: Number(today.eur_to_brl), 
      brl_to_eur: Number(today.brl_to_eur),
      eur_to_usd: today.eur_to_usd != null ? Number(today.eur_to_usd) : null,
      usd_to_eur: today.usd_to_eur != null ? Number(today.usd_to_eur) : (today.eur_to_usd ? 1/Number(today.eur_to_usd) : null),
      usd_to_brl: today.usd_to_brl != null ? Number(today.usd_to_brl) : null,
      brl_to_usd: today.brl_to_usd != null ? Number(today.brl_to_usd) : (today.usd_to_brl ? 1/Number(today.usd_to_brl) : null),
    }
  }
  const envEUR = Number(process.env.EXCHANGE_FALLBACK_EUR_TO_BRL)
  if (isFinite(envEUR) && envEUR > 0) return { eur_to_brl: envEUR, brl_to_eur: 1 / envEUR }
  return { eur_to_brl: 1, brl_to_eur: 1 }
}

function convertAmount(amount: number, from: 'EUR'|'BRL'|'USD', to: 'EUR'|'BRL'|'USD', rates: Rates) {
  if (from === to) return Math.round(amount * 100) / 100
  if (from === 'EUR' && to === 'BRL') return Math.round(amount * rates.eur_to_brl * 100) / 100
  if (from === 'BRL' && to === 'EUR') return Math.round(amount * rates.brl_to_eur * 100) / 100
  if (from === 'EUR' && to === 'USD') {
    const rate = (rates.eur_to_usd ?? (rates.usd_to_eur ? 1/(rates.usd_to_eur as number) : null)) || 1
    return Math.round(amount * rate * 100) / 100
  }
  if (from === 'USD' && to === 'EUR') {
    const rate = (rates.usd_to_eur ?? (rates.eur_to_usd ? 1/(rates.eur_to_usd as number) : null)) || 1
    return Math.round(amount * rate * 100) / 100
  }
  if (from === 'USD' && to === 'BRL') {
    const rate = (rates.usd_to_brl ?? ((rates.eur_to_brl && rates.eur_to_usd) ? (rates.eur_to_brl / (rates.eur_to_usd as number)) : null)) || 1
    return Math.round(amount * rate * 100) / 100
  }
  if (from === 'BRL' && to === 'USD') {
    const rate = (rates.brl_to_usd ?? (rates.usd_to_brl ? 1/(rates.usd_to_brl as number) : ((rates.brl_to_eur && rates.usd_to_eur) ? (rates.brl_to_eur * (rates.usd_to_eur as number)) : null))) || 1
    return Math.round(amount * rate * 100) / 100
  }
  return Math.round(amount * 100) / 100
}

function safeClosingDate(year: number, monthIndex0: number, closingDay: number): Date {
  // monthIndex0: 0-11
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate()
  const day = Math.min(Math.max(1, closingDay || 1), lastDay)
  return new Date(year, monthIndex0, day)
}

function safeDueDate(year: number, monthIndex0: number, dueDay: number): Date {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate()
  const day = Math.min(Math.max(1, dueDay || 1), lastDay)
  return new Date(year, monthIndex0, day)
}

function getOpenCycleWindow(today: Date, closingDay: number) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const thisClose = safeClosingDate(y, m, closingDay)
  // normalize times
  thisClose.setHours(0,0,0,0)
  const prevMonth = new Date(y, m - 1, 1)
  const prevClose = safeClosingDate(prevMonth.getFullYear(), prevMonth.getMonth(), closingDay)
  prevClose.setHours(0,0,0,0)
  const nextMonth = new Date(y, m + 1, 1)
  const nextClose = safeClosingDate(nextMonth.getFullYear(), nextMonth.getMonth(), closingDay)
  nextClose.setHours(0,0,0,0)

  let start: Date, endExclusive: Date, statementClose: Date
  if (today <= thisClose) {
    // open cycle: day after last close .. this close inclusive
    start = new Date(prevClose)
    start.setDate(start.getDate() + 1)
    start.setHours(0,0,0,0)
    endExclusive = new Date(thisClose)
    endExclusive.setDate(endExclusive.getDate() + 1)
    endExclusive.setHours(0,0,0,0)
    statementClose = thisClose
  } else {
    // after this close: open cycle: day after this close .. next close inclusive
    start = new Date(thisClose)
    start.setDate(start.getDate() + 1)
    start.setHours(0,0,0,0)
    endExclusive = new Date(nextClose)
    endExclusive.setDate(endExclusive.getDate() + 1)
    endExclusive.setHours(0,0,0,0)
    statementClose = nextClose
  }
  return { start, endExclusive, statementClose }
}

// Upcoming payment window: if the current month's due date hasn't passed, the upcoming payment
// corresponds to the statement that closed last month. Otherwise, it corresponds to the current
// month's closing statement with due date next month.
function getUpcomingPaymentWindow(today: Date, closingDay: number, dueDay: number) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const thisClose = safeClosingDate(y, m, closingDay)
  thisClose.setHours(0,0,0,0)
  const prevMonth = new Date(y, m - 1, 1)
  const prevClose = safeClosingDate(prevMonth.getFullYear(), prevMonth.getMonth(), closingDay)
  prevClose.setHours(0,0,0,0)
  const prevPrevMonth = new Date(y, m - 2, 1)
  const prevPrevClose = safeClosingDate(prevPrevMonth.getFullYear(), prevPrevMonth.getMonth(), closingDay)
  prevPrevClose.setHours(0,0,0,0)
  const nextMonth = new Date(y, m + 1, 1)
  const nextClose = safeClosingDate(nextMonth.getFullYear(), nextMonth.getMonth(), closingDay)
  nextClose.setHours(0,0,0,0)

  const thisDue = safeDueDate(y, m, dueDay)
  thisDue.setHours(0,0,0,0)
  const nextDue = safeDueDate(nextMonth.getFullYear(), nextMonth.getMonth(), dueDay)
  nextDue.setHours(0,0,0,0)

  let start: Date, endExclusive: Date, statementClose: Date, dueDate: Date
  if (today <= thisDue) {
    // Next payment is this month's due; related statement closed last month
    start = new Date(prevPrevClose)
    start.setDate(start.getDate() + 1)
    start.setHours(0,0,0,0)
    endExclusive = new Date(prevClose)
    endExclusive.setDate(endExclusive.getDate() + 1)
    endExclusive.setHours(0,0,0,0)
    statementClose = prevClose
    dueDate = thisDue
  } else {
    // Next payment is next month's due; related statement closes this month
    start = new Date(prevClose)
    start.setDate(start.getDate() + 1)
    start.setHours(0,0,0,0)
    endExclusive = new Date(thisClose)
    endExclusive.setDate(endExclusive.getDate() + 1)
    endExclusive.setHours(0,0,0,0)
    statementClose = thisClose
    dueDate = nextDue
  }
  return { start, endExclusive, statementClose, dueDate }
}

async function getCreditCardForecast(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
  try {
    const rates = await getLatestRates(supabase)
    const today = new Date()
    today.setHours(0,0,0,0)
    // Load user cards with needed fields
    const { data: cards, error: cardsErr } = await supabase
      .from('credit_cards')
      .select('id, card_name, bank_name, currency, closing_day, due_day, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (cardsErr) {
      console.error('Error fetching cards for forecast:', cardsErr)
      return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Build per-card upcoming payment windows
    const windows = new Map<string, { start: string; endExclusive: string; statementClose: string; dueDate: string }>()
    cards.forEach((c: any) => {
      const { start, endExclusive, statementClose, dueDate } = getUpcomingPaymentWindow(today, Number(c.closing_day || 1), Number(c.due_day || 1))
      windows.set(c.id, {
        start: start.toISOString().split('T')[0],
        endExclusive: endExclusive.toISOString().split('T')[0],
        statementClose: statementClose.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0]
      })
    })

    // Single query for all cards within their windows is tricky because windows differ.
    // Do per-card queries to keep it simple and correct.
    const results: any[] = []
    for (const c of cards) {
  const w = windows.get(c.id)!
      // Sum all movements between statement close and due date to simulate invoice: purchases minus payments
      const { data: txs, error: txErr } = await supabase
        .from('credit_card_transactions')
        .select('amount, currency, transaction_type, transaction_date')
        .eq('user_id', userId)
        .eq('credit_card_id', c.id)
        .gte('transaction_date', w.statementClose)
        .lte('transaction_date', w.dueDate)

      if (txErr) {
        console.error('Error fetching cc tx for forecast:', txErr)
      }

      // Purchases increase, payments decrease within close->due window
      const totalWindow = (txs || []).reduce((sum: number, t: any) => {
        const amt = Number(t.amount || 0)
        if ((t.transaction_type || 'purchase') === 'payment') return sum - amt
        return sum + amt
      }, 0)
      const totalCardCurrency = Math.max(0, Math.round(totalWindow * 100) / 100)

      const totalDisplay = convertAmount(totalCardCurrency, (c.currency || 'EUR'), displayCurrency, rates)

      results.push({
        card_id: c.id,
        card_name: c.card_name,
        bank_name: c.bank_name,
        currency: c.currency || 'EUR',
        closing_day: c.closing_day,
        due_day: c.due_day,
        cycle_start: w.start,
        cycle_end_exclusive: w.endExclusive,
        statement_close: w.statementClose,
        upcoming_due_date: w.dueDate,
  forecast_amount: Math.round(totalCardCurrency * 100) / 100,
        forecast_converted: Math.round(totalDisplay * 100) / 100,
        display_currency: displayCurrency,
      })
    }

    // Also include overall total in display currency
    const totalAll = results.reduce((s, r) => s + (r.forecast_converted || 0), 0)
    return NextResponse.json({ data: results, total_converted: Math.round(totalAll * 100) / 100, currency: displayCurrency })
  } catch (error) {
    console.error('Error in getCreditCardForecast:', error)
    return NextResponse.json({ error: 'Failed to get credit card forecast' }, { status: 500 })
  }
}

async function getNetWorth(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
  try {
    const rates = await getLatestRates(supabase)

    // Accounts (assets)
    // Use secure view; approximate asset value from balance ranges is not possible directly.
    // So, fall back to accounts table balances for computation, but do NOT expose raw values in responses.
    const { data: accounts } = await supabase
    .schema('public')
    .from('accounts')
      .select('balance, currency')
      .eq('user_id', userId)
      .eq('is_active', true)
    const totalAssets = (accounts || []).reduce((sum: number, a: any) => sum + convertAmount(Number(a.balance || 0), (a.currency || 'EUR'), displayCurrency, rates), 0)

    // Credit cards (liabilities)
    const { data: cards } = await supabase
    .schema('public')
    .from('credit_cards')
      .select('current_balance, currency')
      .eq('user_id', userId)
    const totalLiabilities = (cards || []).reduce((sum: number, c: any) => sum + convertAmount(Number(c.current_balance || 0), (c.currency || 'EUR'), displayCurrency, rates), 0)

    const netWorth = totalAssets - totalLiabilities

    // Get historical data (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: historicalData, error: historyError } = await supabase
    .schema('public')
    .from('bank_account_transactions')
        .select('transaction_type, amount, currency, transaction_date')
        .eq('user_id', userId)
        .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true })

      if (historyError) {
        console.error('Error fetching historical data:', historyError)
      }

      // Aggregate monthly net from bank_account_transactions
  const byMonth: Record<string, { income: number; expenses: number; currency: 'EUR'|'BRL'|'USD' }> = {}
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
    // Load active accounts
    const { data: accounts, error } = await supabase
      .from('accounts')
  .select('id, name, bank_name, account_type, currency, balance, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching account balances:', error)
      return NextResponse.json({ error: 'Failed to fetch account balances' }, { status: 500 })
    }
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ accounts: [] })
    }

    // Adjust authoritative balance by excluding future-dated real txs and any planned placeholders
    const rates = await getLatestRates(supabase)
    const todayIso = new Date().toISOString().split('T')[0]
    const accIds = accounts.map((a: any) => a.id)

    // Future transactions after today (we'll exclude planned in code to avoid null-handling issues)
    const { data: futureTxs } = await supabase
      .schema('public')
      .from('bank_account_transactions')
      .select('account_id, amount, currency, transaction_type, transaction_date, notes')
      .eq('user_id', userId)
      .in('account_id', accIds.length ? accIds : ['00000000-0000-0000-0000-000000000000'])
      .gt('transaction_date', todayIso)

    // Planned placeholders (any date, still marked planned:true)
    const { data: plannedTxs } = await supabase
      .schema('public')
      .from('bank_account_transactions')
      .select('account_id, amount, currency, transaction_type')
      .eq('user_id', userId)
      .in('account_id', accIds.length ? accIds : ['00000000-0000-0000-0000-000000000000'])
      .ilike('notes', '%planned:true%')

    const futureAdj = new Map<string, number>()
    for (const t of futureTxs || []) {
      const notes = String((t as any).notes || '').toLowerCase()
      if (notes.includes('planned:true')) continue
      const acc = (accounts as any[]).find((a) => a.id === t.account_id)
      if (!acc) continue
      const cur: 'EUR'|'BRL'|'USD' = (t.currency || 'EUR')
      const accCur: 'EUR'|'BRL'|'USD' = (acc.currency || 'EUR')
      const amt = convertAmount(Number(t.amount || 0), cur, accCur, rates)
      const sign = (t.transaction_type === 'credit') ? 1 : -1
      futureAdj.set(t.account_id, (futureAdj.get(t.account_id) || 0) + sign * amt)
    }

    const plannedAdj = new Map<string, number>()
    for (const t of plannedTxs || []) {
      const acc = (accounts as any[]).find((a) => a.id === t.account_id)
      if (!acc) continue
      const cur: 'EUR'|'BRL'|'USD' = (t.currency || 'EUR')
      const accCur: 'EUR'|'BRL'|'USD' = (acc.currency || 'EUR')
      const amt = convertAmount(Number(t.amount || 0), cur, accCur, rates)
      const sign = (t.transaction_type === 'credit') ? 1 : -1
      plannedAdj.set(t.account_id, (plannedAdj.get(t.account_id) || 0) + sign * amt)
    }

    const result = (accounts || []).map((a: any) => {
      const base = Number(a.balance || 0)
      const adj = (futureAdj.get(a.id) || 0) + (plannedAdj.get(a.id) || 0)
      // Exclude future and planned amounts from displayed balance
      const display = Math.round((base - adj) * 100) / 100
      return {
        name: a.name,
        currency: a.currency || 'EUR',
        balance: display,
      }
    })

    return NextResponse.json({ accounts: result })
  } catch (error) {
    console.error('Error in getAccountBalances:', error)
    return NextResponse.json({ error: 'Failed to get account balances' }, { status: 500 })
  }
}

async function getExpensesByCategory(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
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
    .schema('public')
    .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    const activeIds = (activeAccounts || []).map((a: any) => a.id)

  // Fetch this month's bank debits and group by category in memory
  const { data: txs, error } = await supabase
  .schema('public')
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

    // Also fetch this month's credit card purchases
    const { data: ccTxs, error: ccErr } = await supabase
    .schema('public')
    .from('credit_card_transactions')
      .select('amount, currency, category_id, transaction_type, transaction_date')
      .eq('user_id', userId)
      .eq('transaction_type', 'purchase')
      .gte('transaction_date', start.toISOString().split('T')[0])
      .lt('transaction_date', end.toISOString().split('T')[0])

    if (ccErr) {
      console.error('Error fetching CC purchases by category:', ccErr)
    }

    const totals = new Map<string | null, { total: number; currency: 'EUR'|'BRL'|'USD' }>()
    for (const t of txs || []) {
      const key = t.category_id || null
  const cur: 'EUR'|'BRL'|'USD' = (t.currency || 'EUR')
      const prev = totals.get(key) || { total: 0, currency: cur }
      // Sum in native then convert at display time
      totals.set(key, { total: prev.total + Number(t.amount || 0), currency: cur })
    }

    // Merge CC purchases
    for (const t of ccTxs || []) {
      const key = t.category_id || null
      const cur: 'EUR'|'BRL'|'USD' = (t.currency || 'EUR')
      const prev = totals.get(key) || { total: 0, currency: cur }
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

async function getCashFlow(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
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
    .schema('public')
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
  const byMonth: Record<string, { income: number; expenses: number; currency: 'EUR'|'BRL'|'USD' }> = {}
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
    .schema('public')
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

async function getFinancialKPIs(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
  try {
  const rates = await getLatestRates(supabase)
    // Get current month data
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

  // Get this month's bank transactions
    const { data: thisMonthTransactions, error: thisMonthError } = await supabase
      .from('bank_account_transactions')
      .select('transaction_type, amount, currency')
      .eq('user_id', userId)
      .gte('transaction_date', currentMonth.toISOString().split('T')[0])
      .lt('transaction_date', nextMonth.toISOString().split('T')[0])

    if (thisMonthError) {
      console.error('Error fetching this month transactions:', thisMonthError)
    }

  // Get last month bank data for comparison
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

    // Include CC purchases for this month expenses
    const { data: ccThisMonth } = await supabase
      .from('credit_card_transactions')
      .select('amount, currency, transaction_type')
      .eq('user_id', userId)
      .eq('transaction_type', 'purchase')
      .gte('transaction_date', currentMonth.toISOString().split('T')[0])
      .lt('transaction_date', nextMonth.toISOString().split('T')[0])

    const thisMonthExpenses = thisMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'debit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0
      + (ccThisMonth || []).reduce((s: number, t: any) => s + convertAmount(Number(t.amount || 0), (t.currency || 'EUR'), displayCurrency, rates), 0)

    // Load fixed costs metadata (for currency) and estimated fallback
    const { data: fixedCosts } = await supabase
      .from('fixed_costs')
      .select('estimated_amount, currency')
      .eq('user_id', userId)
      .eq('is_active', true)

    const estimatedFixedCosts = (fixedCosts || [])
      .reduce((sum: number, cost: any) => sum + convertAmount(Number(cost.estimated_amount || 0), (cost.currency || 'EUR'), displayCurrency, rates), 0)

    // Build map fixed_cost_id -> currency
    const fixedCostCurrency = new Map<string, 'EUR'|'BRL'|'USD'>()
    ;(fixedCosts || []).forEach((fc: any) => {
      // We don't have id in this select; fetch ids too in a light query
    })

    // Re-fetch with ids minimal to map currencies if needed
    if (!fixedCostCurrency.size) {
      const { data: fixedCostsIds } = await supabase
        .from('fixed_costs')
        .select('id, currency')
        .eq('user_id', userId)
        .eq('is_active', true)
      ;(fixedCostsIds || []).forEach((fc: any) => fixedCostCurrency.set(fc.id, (fc.currency || 'EUR')))
    }

    // Get fixed costs entries for current month (using month_year)
    const { data: fixedCostsEntries } = await supabase
      .from('fixed_cost_entries')
      .select('fixed_cost_id, amount, actual_amount')
      .eq('user_id', userId)
      .eq('month_year', currentMonth.toISOString().split('T')[0])

    const thisMonthFixedCosts = (fixedCostsEntries || [])
      .reduce((sum: number, entry: any) => {
        const native = Number((entry.actual_amount ?? entry.amount) || 0)
        const cur = fixedCostCurrency.get(entry.fixed_cost_id) || 'EUR'
        return sum + convertAmount(native, cur, displayCurrency, rates)
      }, 0)

    // Use actual fixed costs if available, otherwise use estimated
    const totalFixedCosts = thisMonthFixedCosts > 0 ? thisMonthFixedCosts : estimatedFixedCosts
    const totalMonthlyExpenses = thisMonthExpenses + totalFixedCosts

    const lastMonthIncome = lastMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'credit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0

    // Include CC purchases for last month expenses
    const { data: ccLastMonth } = await supabase
      .from('credit_card_transactions')
      .select('amount, currency, transaction_type')
      .eq('user_id', userId)
      .eq('transaction_type', 'purchase')
      .gte('transaction_date', lastMonth.toISOString().split('T')[0])
      .lt('transaction_date', currentMonth.toISOString().split('T')[0])

    const lastMonthExpenses = lastMonthTransactions
      ?.filter((t: any) => t.transaction_type === 'debit')
      .reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount), (t.currency || 'EUR'), displayCurrency, rates), 0) || 0
      + (ccLastMonth || []).reduce((s: number, t: any) => s + convertAmount(Number(t.amount || 0), (t.currency || 'EUR'), displayCurrency, rates), 0)

    // Get last month fixed costs entries
    const { data: lastMonthFixedCostsEntries } = await supabase
      .from('fixed_cost_entries')
      .select('fixed_cost_id, amount, actual_amount')
      .eq('user_id', userId)
      .eq('month_year', lastMonth.toISOString().split('T')[0])

    const lastMonthFixedCosts = (lastMonthFixedCostsEntries || [])
      .reduce((sum: number, entry: any) => {
        const native = Number((entry.actual_amount ?? entry.amount) || 0)
        const cur = fixedCostCurrency.get(entry.fixed_cost_id) || 'EUR'
        return sum + convertAmount(native, cur, displayCurrency, rates)
      }, 0)

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
    .schema('public')
    .from('accounts')
      .select('balance, currency')
      .eq('user_id', userId)
      .eq('is_active', true)
    const assets = (accs || []).reduce((s: number, a: any) => s + convertAmount(Number(a.balance || 0), (a.currency || 'EUR'), displayCurrency, rates), 0)
    const { data: ccs } = await supabase
    .schema('public')
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

async function getBudgetVsActual(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
  try {
  const rates = await getLatestRates(supabase)
    // Load active budgets and categories
    const { data: budgets, error: bErr } = await supabase
    .schema('public')
    .from('budgets')
      .select('id, user_id, category_id, amount, currency, period, start_date, end_date, is_active, mode, percent')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (bErr) {
      console.error('Error fetching budgets:', bErr)
      return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
    }

    const categoryIds = Array.from(new Set((budgets || []).map((b: any) => b.category_id).filter(Boolean)))
    const { data: cats } = await supabase
    .schema('public')
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

  // Fetch bank expenses in window grouped in memory by category
    const { data: txs } = await supabase
      .from('bank_account_transactions')
      .select('amount, currency, category_id, transaction_date')
      .eq('user_id', userId)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('transaction_type', 'debit')
  .gte('transaction_date', minStart.toISOString().split('T')[0])
  .lt('transaction_date', new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate() + 1).toISOString().split('T')[0])

    // Fetch credit card purchases in the same window
    const { data: ccTxs } = await supabase
      .from('credit_card_transactions')
      .select('amount, currency, category_id, transaction_date, transaction_type')
      .eq('user_id', userId)
      .eq('transaction_type', 'purchase')
      .gte('transaction_date', minStart.toISOString().split('T')[0])
      .lt('transaction_date', new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate() + 1).toISOString().split('T')[0])

    // Also fetch bank incomes (credits) in the same window for percent-based modes
    const { data: creditTxs } = await supabase
      .from('bank_account_transactions')
      .select('amount, currency, transaction_date')
      .eq('user_id', userId)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('transaction_type', 'credit')
      .gte('transaction_date', minStart.toISOString().split('T')[0])
      .lt('transaction_date', new Date(maxEnd.getFullYear(), maxEnd.getMonth(), maxEnd.getDate() + 1).toISOString().split('T')[0])

    // Compute actuals per budget range
  const txList = ([...(txs || []), ...(ccTxs || [])]) as any[]
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
      // First, sum actuals in the budget currency
      const spentInBudgetCur = relevant.reduce((sum: number, t: any) => sum + convertAmount(Number(t.amount || 0), (t.currency || 'EUR'), (b.currency || 'EUR'), rates as any), 0)
      // Compute budget base depending on mode
      let budgetedRaw = Number(b.amount || 0)
      const mode: 'absolute'|'percent_income'|'percent_profit' = (b.mode || 'absolute')
      const pct = Number(b.percent || 0)
      if (mode !== 'absolute' && pct > 0) {
        // Compute window income and expenses in budget currency
        const windowStart = startB
        const windowEndExclusive = endBPlus
        const incomeSum = (creditTxs || []).reduce((sum: number, t: any) => {
          const dt = parseDate(t.transaction_date)
          if (dt >= windowStart && dt < windowEndExclusive) {
            return sum + convertAmount(Number(t.amount || 0), (t.currency || 'EUR'), (b.currency || 'EUR'), rates)
          }
          return sum
        }, 0)
        const expenseSum = (txList || []).reduce((sum: number, t: any) => {
          const dt = parseDate(t.transaction_date)
          if (dt >= windowStart && dt < windowEndExclusive) {
            return sum + convertAmount(Number(t.amount || 0), (t.currency || 'EUR'), (b.currency || 'EUR'), rates)
          }
          return sum
        }, 0)
        if (mode === 'percent_income') {
          budgetedRaw = (incomeSum * pct) / 100
        } else if (mode === 'percent_profit') {
          const profit = incomeSum - expenseSum
          budgetedRaw = profit > 0 ? (profit * pct) / 100 : 0
        }
      }
      // Then, convert both budget and actual to the requested display currency for consistent charting
      const actual = convertAmount(spentInBudgetCur, (b.currency || 'EUR'), displayCurrency, rates)
      const budgeted = convertAmount(budgetedRaw, (b.currency || 'EUR'), displayCurrency, rates)
  const variance = budgeted > 0 ? ((actual - budgeted) / budgeted) * 100 : 0
      return {
        id: b.id,
        category_id: b.category_id,
        category: cat?.name || 'Outros',
        budgeted,
        actual,
        usage_percentage: budgeted > 0 ? (actual / budgeted) * 100 : 0,
        variance,
        color: cat?.color || '#6b7280',
        currency: displayCurrency,
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

async function getFixedCostsData(supabase: any, userId: string, displayCurrency: 'EUR'|'BRL'|'USD') {
  try {
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

  const rates = await getLatestRates(supabase)

  // Get active fixed costs
    const { data: fixedCosts, error: fixedCostsError } = await supabase
    .schema('public')
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

  // Get current month entries (schema uses month_year, not month). We match YYYY-MM-01 exactly.
  const currentMonthStr = currentMonth.toISOString().split('T')[0]
  const { data: monthlyEntries, error: entriesError } = await supabase
      .from('fixed_cost_entries')
      .select(`
    id,
        fixed_cost_id,
        amount,
        actual_amount,
        status,
    due_date,
        payment_date
      `)
      .eq('user_id', userId)
      .eq('month_year', currentMonthStr)

    if (entriesError) {
      console.error('Error fetching monthly entries:', entriesError)
    }

    // Index fixed costs by id for enrichment
  type FixedCostRow = { id: string; name: string; cost_type: string; estimated_amount?: number|null; currency: 'EUR'|'BRL'|'USD'; provider?: string|null; due_day?: number|null }
  const costIndex = new Map<string, FixedCostRow>((fixedCosts as FixedCostRow[] || []).map((c) => [c.id, c]))

    // Build entries list enriched with cost metadata and converted amounts
    type EntryRow = { id: string; fixed_cost_id: string; amount: number|null; actual_amount: number|null; status: 'paid'|'pending'|'overdue'|null; due_date?: string|null }
    type EnrichedEntry = { id: string; fixed_cost_id: string; name: string; type: string; provider: string|null; dueDate: string|null; status: 'paid'|'pending'|'overdue'; amount_planned: number; amount_actual: number; currency: 'EUR'|'BRL'|'USD' }
    const entries: EnrichedEntry[] = ((monthlyEntries as EntryRow[] | null) || []).map((e) => {
      const cost = costIndex.get(e.fixed_cost_id)
      const cur: 'EUR'|'BRL'|'USD' = (cost?.currency || 'EUR')
      const planned = Number(e.amount || 0)
      const actualNative = Number(e.actual_amount ?? 0)
      const amountPlannedConv = convertAmount(planned, cur, displayCurrency, rates)
      const amountActualConv = convertAmount(actualNative, cur, displayCurrency, rates)
      return {
        id: e.id,
        fixed_cost_id: e.fixed_cost_id,
        name: cost?.name || '—',
        type: cost?.cost_type || 'other',
        provider: cost?.provider || null,
        dueDate: (e.due_date as string | null) || null,
        status: ((e.status as any) || 'pending') as 'paid'|'pending'|'overdue',
        amount_planned: amountPlannedConv,
        amount_actual: amountActualConv,
        currency: displayCurrency,
      }
    })

    // Dashboard aggregates derived from entries
    const dashboard = {
      totalEstimated: entries.reduce((s: number, it: EnrichedEntry) => s + (it.amount_planned || 0), 0),
      totalActual: entries.filter((it: EnrichedEntry) => it.status === 'paid').reduce((s: number, it: EnrichedEntry) => s + (it.amount_actual || it.amount_planned || 0), 0),
      paidCount: entries.filter((it: EnrichedEntry) => it.status === 'paid').length,
      pendingCount: entries.filter((it: EnrichedEntry) => it.status === 'pending').length,
      overdueCount: entries.filter((it: EnrichedEntry) => it.status === 'overdue').length,
      totalUnpaid: entries.filter((it: EnrichedEntry) => it.status !== 'paid').reduce((s: number, it: EnrichedEntry) => s + (it.amount_planned || 0), 0),
      byType: {} as Record<string, { estimated: number; actual: number; count: number }>,
    }

  for (const it of entries as EnrichedEntry[]) {
      if (!dashboard.byType[it.type]) {
        dashboard.byType[it.type] = { estimated: 0, actual: 0, count: 0 }
      }
      dashboard.byType[it.type].estimated += (it.amount_planned || 0)
      if (it.status === 'paid') {
        dashboard.byType[it.type].actual += (it.amount_actual || it.amount_planned || 0)
      }
      dashboard.byType[it.type].count += 1
    }

    // Legacy per-cost summary kept for compatibility (derived from entries)
    const costs = Array.from(costIndex.values()).map((cost: FixedCostRow) => {
      const related = entries.filter((e: EnrichedEntry) => e.fixed_cost_id === cost.id)
      const estimated = related.reduce((s: number, e: EnrichedEntry) => s + (e.amount_planned || 0), 0)
      const actual = related.filter((e: EnrichedEntry) => e.status === 'paid').reduce((s: number, e: EnrichedEntry) => s + (e.amount_actual || e.amount_planned || 0), 0)
      const status: 'paid'|'pending'|'overdue' = related.every((e: EnrichedEntry) => e.status === 'paid') ? 'paid' : (related.some((e: EnrichedEntry) => e.status === 'overdue') ? 'overdue' : 'pending')
      const paymentDate = null
      return {
        id: cost.id,
        name: cost.name,
        type: cost.cost_type,
        estimated,
        actual,
        currency: displayCurrency,
        provider: cost.provider,
        dueDay: cost.due_day,
        status,
        paymentDate,
        variance: estimated > 0 ? ((actual - estimated) / estimated) * 100 : 0
      }
    })

    return NextResponse.json({ dashboard, costs, entries, month: currentMonth.toISOString().split('T')[0] })
  } catch (error) {
    console.error('Error in getFixedCostsData:', error)
    return NextResponse.json({ error: 'Failed to get fixed costs data' }, { status: 500 })
  }
}
