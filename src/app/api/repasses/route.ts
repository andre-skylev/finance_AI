import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

// Helper: profit until endDate in display currency, optionally filtered by list of account_ids; includes scheduled fixed costs (unpaid) and fixed incomes due.
async function getProfitUntil(supabase: any, userId: string, endDate: string, displayCurrency: 'EUR'|'BRL'|'USD', opts?: { accountIds?: string[]; creditCardIds?: string[] }) {
  const rates = await getLatestRates(supabase)
  const to = endDate

  // Actual transactions until date
  const [bankInRes, bankOutRes, cardPaysRes, cardPurchRes] = await Promise.all([
    supabase.schema('public').from('bank_account_transactions').select('amount, currency, account_id').eq('user_id', userId).eq('transaction_type', 'credit').lte('transaction_date', to),
    supabase.schema('public').from('bank_account_transactions').select('amount, currency, account_id').eq('user_id', userId).eq('transaction_type', 'debit').lte('transaction_date', to),
    supabase.schema('public').from('credit_card_transactions').select('amount, currency, credit_card_id').eq('user_id', userId).eq('transaction_type', 'payment').lte('transaction_date', to),
    supabase.schema('public').from('credit_card_transactions').select('amount, currency, credit_card_id').eq('user_id', userId).eq('transaction_type', 'purchase').lte('transaction_date', to),
  ])
  const filterAcc = (rows?: any[]) => {
    const ids = opts?.accountIds
    if (!ids || !ids.length) return rows || []
    return (rows || []).filter((r: any) => ids.includes(r.account_id))
  }
  const filterCards = (rows?: any[]) => {
    const ids = opts?.creditCardIds
    if (!ids || !ids.length) return rows || []
    return (rows || []).filter((r: any) => ids.includes(r.credit_card_id))
  }
  const mapSum = (rows?: any[]) => (rows || []).reduce((s, r) => s + convertAmount(Number(r.amount || 0), (r.currency || 'EUR'), displayCurrency, rates), 0)
  const hasAccFilter = !!(opts?.accountIds && opts.accountIds.length)
  const hasCardFilter = !!(opts?.creditCardIds && opts.creditCardIds.length)
  const actualIncome = mapSum(filterAcc(bankInRes.data)) + (hasCardFilter ? mapSum(filterCards(cardPaysRes.data)) : (!hasAccFilter ? mapSum(cardPaysRes.data) : 0))
  const actualExpense = mapSum(filterAcc(bankOutRes.data)) + (hasCardFilter ? mapSum(filterCards(cardPurchRes.data)) : (!hasAccFilter ? mapSum(cardPurchRes.data) : 0))

  // Scheduled: fixed cost entries due and not paid
  // Load entries and map currencies from fixed_costs separately to avoid nested selects
  const { data: fce } = await supabase
    .schema('public')
    .from('fixed_cost_entries')
    .select('fixed_cost_id, amount, actual_amount, due_date, status, payment_date')
    .eq('user_id', userId)
    .lte('due_date', to)
    .in('status', ['pending', 'overdue'])
  let scheduledExpenses = 0
  if (fce && fce.length) {
    const fcIds = Array.from(new Set((fce as any[]).map((e: any) => e.fixed_cost_id).filter(Boolean)))
    let curMap = new Map<string, 'EUR'|'BRL'|'USD'>()
    if (fcIds.length) {
      const { data: fcs } = await supabase
        .schema('public')
        .from('fixed_costs')
        .select('id, currency')
        .in('id', fcIds)
      curMap = new Map((fcs || []).map((r: any) => [r.id, (r.currency || 'EUR')]))
    }
    scheduledExpenses = (fce || []).reduce((s: number, e: any) => {
      const amt = Number(e.actual_amount ?? e.amount ?? 0)
      const cur = curMap.get(e.fixed_cost_id) || 'EUR'
      return s + convertAmount(amt, cur, displayCurrency, rates)
    }, 0)
  }

  // Scheduled: fixed incomes due by date (approximation)
  const { data: fi } = await supabase
    .schema('public')
    .from('fixed_incomes')
    .select('amount, currency, billing_period, start_date, end_date, pay_day, next_pay_date, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
  const d = new Date(to + 'T00:00:00')
  const day = d.getDate()
  const month = d.getMonth()
  const year = d.getFullYear()
  const scheduledIncomes = (fi || []).reduce((s: number, it: any) => {
    const cur = (it.currency || 'EUR') as 'EUR'|'BRL'|'USD'
    const amt = Number(it.amount || 0)
    const hasNext = it.next_pay_date ? new Date(it.next_pay_date + 'T00:00:00') <= d : false
    let due = false
    if (it.next_pay_date) {
      due = hasNext
    } else {
      const start = new Date((it.start_date || '1970-01-01') + 'T00:00:00')
      const ended = it.end_date ? new Date(it.end_date + 'T00:00:00') < d : false
      if (start <= d && !ended) {
        if (it.billing_period === 'monthly') {
          due = !it.pay_day || Number(it.pay_day) <= day
        } else if (it.billing_period === 'yearly') {
          due = (d.getMonth() > start.getMonth()) || (d.getMonth() === start.getMonth() && d.getDate() >= start.getDate())
        } else if (it.billing_period === 'weekly') {
          // If at least one full week elapsed since the start within this month
          const monthStart = new Date(year, month, 1)
          const base = start > monthStart ? start : monthStart
          const diffDays = Math.floor((d.getTime() - base.getTime()) / (1000*60*60*24))
          due = diffDays >= 0 && Math.floor(diffDays / 7) >= 0
        }
      }
    }
    return due ? s + convertAmount(amt, cur, displayCurrency, rates) : s
  }, 0)

  const profit = Math.round(((actualIncome - actualExpense) + (scheduledIncomes - scheduledExpenses)) * 100) / 100
  return { profit, currency: displayCurrency }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') // list-rules | forecast | executions
  try {
    if (action === 'executions') {
      const limit = parseInt(searchParams.get('limit') || '10')
      const { data: execs, error } = await supabase
        .from('repasse_executions')
        .select('id, rule_id, execution_date, amount, currency, account_id, notes, created_at')
        .eq('user_id', user.id)
        .order('execution_date', { ascending: false })
        .limit(limit)
      if (error) {
        console.error('repasses executions: list error', error)
        return NextResponse.json({ executions: [] })
      }
      return NextResponse.json({ executions: execs || [] })
    }

    if (action === 'forecast') {
      const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
      const displayCurrency = (searchParams.get('currency') as 'EUR'|'BRL'|'USD') || 'EUR'
      // Load active rules
      const { data: rules, error: rulesErr } = await supabase
        .from('repasse_rules')
        .select('id, name, percentage, payout_day, is_active, is_recurring')
        .eq('user_id', user.id)
        .eq('is_active', true)
      if (rulesErr) {
        console.error('repasses forecast: load rules error', rulesErr)
      }

      // Only consider rules whose payout_day <= day(date)
      const d = new Date(date + 'T00:00:00')
      const day = d.getDate()
      const applicable = (rules || []).filter((r: any) => Number(r.payout_day) <= day)

      // Load sources (accounts or credit cards) for applicable rules
      const { data: srcAll, error: srcErr } = await supabase
        .from('repasse_rule_sources')
        .select('rule_id, account_id, credit_card_id')
        .eq('user_id', user.id)
      if (srcErr) {
        console.error('repasses forecast: load sources error', srcErr)
      }

      // Helper to compute the next payout date for a rule based on the reference date
      const toIso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
      const nextPayoutDate = (refIso: string, payoutDay: number): string => {
        const ref = new Date(refIso + 'T00:00:00')
        const curDay = ref.getDate()
        const addMonth = payoutDay <= curDay ? 1 : 0
        const target = new Date(ref.getFullYear(), ref.getMonth() + addMonth, payoutDay)
        return toIso(target)
      }

      // Preload executions on the horizon dates for these rules
      const horizonDates = (applicable || []).map((r: any) => nextPayoutDate(date, Number(r.payout_day)))
      const uniqueHorizon = Array.from(new Set(horizonDates))
      const { data: executedRows, error: execErr } = await supabase
        .from('repasse_executions')
        .select('rule_id, amount, currency, execution_date')
        .eq('user_id', user.id)
        .in('execution_date', uniqueHorizon.length ? uniqueHorizon : ['1970-01-01'])
      if (execErr) {
        console.error('repasses forecast: load executions error', execErr)
      }

      const rates = await getLatestRates(supabase)
      const sumExecutedInDisplay = (rows?: any[]) => (rows || []).reduce((s, r) => s + convertAmount(Number(r.amount||0), (r.currency||'EUR'), displayCurrency, rates), 0)

      const forecasts = await Promise.all((applicable || []).map(async (r: any, idx: number) => {
        const selectedSources = (srcAll || []).filter((s: any) => s.rule_id === r.id)
        const srcIds = selectedSources.map((s: any) => s.account_id).filter(Boolean)
        const srcCardIds = selectedSources.map((s: any) => s.credit_card_id).filter(Boolean)
        const horizon = horizonDates[idx] || nextPayoutDate(date, Number(r.payout_day))
        // If no explicit sources configured, default to all active accounts
        let baseProfit = 0
        if (!srcIds.length && !srcCardIds.length) {
          const { data: allAccs } = await supabase.from('accounts').select('id').eq('user_id', user.id).eq('is_active', true)
          const allIds = (allAccs || []).map((a: any) => a.id)
          // Default: consider all active accounts; debit cards excluded unless explicitly chosen
          baseProfit = (await getProfitUntil(supabase, user.id, horizon, displayCurrency, { accountIds: allIds.length ? allIds : undefined, creditCardIds: undefined })).profit
        } else {
          // Use both profit base accounts and debit base credit cards
          baseProfit = (await getProfitUntil(supabase, user.id, horizon, displayCurrency, { accountIds: srcIds.length ? srcIds : undefined, creditCardIds: srcCardIds.length ? srcCardIds : undefined })).profit
        }
        const executed = sumExecutedInDisplay((executedRows || []).filter((e: any) => e.rule_id === r.id && e.execution_date === horizon))
        const available = Math.max(0, Math.round((baseProfit - executed) * 100) / 100)
        const amount = Math.max(0, Math.round((available * (Number(r.percentage) / 100)) * 100) / 100)
        return {
          rule_id: r.id,
          name: r.name,
          percentage: r.percentage,
          payout_day: r.payout_day,
          is_recurring: r.is_recurring,
          amount,
          currency: displayCurrency,
          base_profit: baseProfit,
          executed,
          available,
          horizon,
        }
      }))
      const total = Math.round((forecasts || []).reduce((s, f) => s + f.amount, 0) * 100) / 100

      // Overall base profit reference until the furthest horizon
      const maxHorizon = uniqueHorizon.sort().slice(-1)[0] || date
      const { profit: globalProfit } = await getProfitUntil(supabase, user.id, maxHorizon, displayCurrency)
      return NextResponse.json({ date, profit: globalProfit, currency: displayCurrency, forecasts, total, global: { label: 'Total', amount: total, currency: displayCurrency } })
    }

    // Default: list rules
    const { data, error } = await supabase
      .from('repasse_rules')
      .select('id, name, percentage, payout_day, is_active, is_recurring, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('repasses list: load rules error', error)
      return NextResponse.json({ rules: [] })
    }
    return NextResponse.json({ rules: data || [] })
  } catch (err) {
    console.error('repasses GET unhandled error', err)
    const displayCurrency = (searchParams.get('currency') as 'EUR'|'BRL'|'USD') || 'EUR'
    const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
    if (action === 'forecast') {
      return NextResponse.json({ date, profit: 0, currency: displayCurrency, forecasts: [], total: 0, global: { label: 'Total', amount: 0, currency: displayCurrency } })
    }
    if (action === 'executions') {
      return NextResponse.json({ executions: [] })
    }
    return NextResponse.json({ rules: [] })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { id, targets, sources, ...rest } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  if (Array.isArray(targets)) {
    const sum = targets.reduce((s: number, t: any) => s + (Number(t?.share_percent) || 0), 0)
    if (targets.length > 0 && Math.abs(sum - 100) > 0.001) {
      return NextResponse.json({ error: 'Targets must sum to 100%' }, { status: 400 })
    }
  }
  const { data, error } = await supabase
    .from('repasse_rules')
    .update({ ...rest })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  // Replace targets if provided
  if (Array.isArray(targets)) {
    await supabase.from('repasse_rule_targets').delete().eq('rule_id', id).eq('user_id', user.id)
    const rows = targets
      .filter((t: any) => t?.account_id && Number(t?.share_percent) > 0)
      .map((t: any) => ({ user_id: user.id, rule_id: id, account_id: t.account_id, share_percent: Number(t.share_percent) }))
    if (rows.length) await supabase.from('repasse_rule_targets').insert(rows)
  }
  // Replace sources if provided
  if (Array.isArray(sources)) {
    await supabase.from('repasse_rule_sources').delete().eq('rule_id', id).eq('user_id', user.id)
    const rows = sources
      .filter((s: any) => s?.account_id || s?.credit_card_id)
      .map((s: any) => ({ user_id: user.id, rule_id: id, account_id: s.account_id || null, credit_card_id: s.credit_card_id || null }))
    if (rows.length) await supabase.from('repasse_rule_sources').insert(rows)
  }
  return NextResponse.json({ rule: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { name, percentage, payout_day, is_active = true, is_recurring = false, targets, sources } = body
  if (!name || percentage == null || !payout_day) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (Array.isArray(targets) && targets.length > 0) {
    const sum = targets.reduce((s: number, t: any) => s + (Number(t?.share_percent) || 0), 0)
    if (Math.abs(sum - 100) > 0.001) {
      return NextResponse.json({ error: 'Targets must sum to 100%' }, { status: 400 })
    }
  }
  const { data, error } = await supabase
    .from('repasse_rules')
    .insert({ user_id: user.id, name, percentage: Number(percentage), payout_day: Number(payout_day), is_active: !!is_active, is_recurring: !!is_recurring })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  // Save targets if provided
  if (Array.isArray(targets) && targets.length > 0) {
    const rows = targets
      .filter((t: any) => t?.account_id && Number(t?.share_percent) > 0)
      .map((t: any) => ({ user_id: user.id, rule_id: (data as any).id, account_id: t.account_id, share_percent: Number(t.share_percent) }))
    if (rows.length) {
      const { error: tErr } = await supabase.from('repasse_rule_targets').insert(rows)
      if (tErr) {
        console.error('repasses create: targets insert error', tErr)
        return NextResponse.json({ error: 'Failed to save targets' }, { status: 500 })
      }
    }
  }
  // Save sources if provided
  if (Array.isArray(sources) && sources.length > 0) {
    const rows = sources
      .filter((s: any) => s?.account_id || s?.credit_card_id)
      .map((s: any) => ({ user_id: user.id, rule_id: (data as any).id, account_id: s.account_id || null, credit_card_id: s.credit_card_id || null }))
    if (rows.length) {
      const { error: sErr } = await supabase.from('repasse_rule_sources').insert(rows)
      if (sErr) {
        console.error('repasses create: sources insert error', sErr)
        return NextResponse.json({ error: 'Failed to save sources' }, { status: 500 })
      }
    }
  }

  // Create planned credit entries on target accounts for next payout horizon
  try {
    // Load targets and sources to compute planned amounts
    const [{ data: tAll }, { data: sAll }] = await Promise.all([
      supabase.from('repasse_rule_targets').select('account_id, share_percent').eq('rule_id', (data as any).id).eq('user_id', user.id),
      supabase.from('repasse_rule_sources').select('account_id, credit_card_id').eq('rule_id', (data as any).id).eq('user_id', user.id)
    ])
    const targetsList = (tAll || []) as { account_id: string; share_percent: number }[]
  const sourcesList = (sAll || []).map((r: any) => r.account_id).filter(Boolean)
  const sourceCards = (sAll || []).map((r: any) => r.credit_card_id).filter(Boolean)
    if (targetsList.length) {
      // Compute horizon date
      const todayIso = new Date().toISOString().slice(0,10)
      const toIso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
      const nextPayoutDate = (refIso: string, payoutDay: number): string => {
        const ref = new Date(refIso + 'T00:00:00')
        const curDay = ref.getDate()
        const addMonth = Number(payout_day) <= curDay ? 1 : 0
        const target = new Date(ref.getFullYear(), ref.getMonth() + addMonth, Number(payout_day))
        return toIso(target)
      }
      const horizon = nextPayoutDate(todayIso, Number(payout_day))

      // Compute base profit until horizon in EUR (or USD if needed)
      const display: 'EUR'|'BRL'|'USD' = 'EUR'
      let baseProfit = 0
      if (sourcesList.length === 0 && sourceCards.length === 0) {
        const { data: allAccs } = await supabase.from('accounts').select('id').eq('user_id', user.id).eq('is_active', true)
        const allIds = (allAccs || []).map((a: any) => a.id)
        baseProfit = (await getProfitUntil(supabase, user.id, horizon, display, { accountIds: allIds.length ? allIds : undefined, creditCardIds: undefined })).profit
      } else {
        baseProfit = (await getProfitUntil(supabase, user.id, horizon, display, { accountIds: sourcesList.length ? sourcesList : undefined, creditCardIds: sourceCards.length ? sourceCards : undefined })).profit
      }
      const totalForRule = Math.max(0, Math.round((baseProfit * (Number(percentage) / 100)) * 100) / 100)

      // Load accounts to get currencies
      const { data: acctRows } = await supabase.from('accounts').select('id, currency').eq('user_id', user.id).in('id', targetsList.map(t=>t.account_id))
      const acctMap = new Map((acctRows || []).map((a: any) => [a.id, a]))
      const rates = await getLatestRates(supabase)

      // For each target, upsert a planned credit on that account
      for (const t of targetsList) {
        const acct = acctMap.get(t.account_id)
        if (!acct) continue
        const acctCur: 'EUR'|'BRL'|'USD' = (acct.currency || 'EUR')
        const portion = Math.round((totalForRule * (Number(t.share_percent) / 100)) * 100) / 100
        const portionInAcct = convertAmount(portion, display, acctCur, rates)
        // Check if a planned exists for this (based on notes marker)
        const marker = `rule:${(data as any).id};planned:true;horizon:${horizon}`
        const { data: existing } = await supabase
          .from('bank_account_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('account_id', t.account_id)
          .eq('transaction_date', horizon)
          .eq('transaction_type', 'credit')
          .like('notes', `%rule:${(data as any).id}%`)
          .maybeSingle()
        if (existing?.id) {
          await supabase
            .from('bank_account_transactions')
            .update({ amount: portionInAcct, currency: acctCur, description: `Repasse planejado ${new Date(horizon).toLocaleDateString('pt-PT')}`, notes: marker })
            .eq('id', existing.id)
            .eq('user_id', user.id)
        } else {
          await supabase
            .from('bank_account_transactions')
            .insert({
              user_id: user.id,
              account_id: t.account_id,
              category_id: null,
              amount: portionInAcct,
              currency: acctCur,
              description: `Repasse planejado ${new Date(horizon).toLocaleDateString('pt-PT')}`,
              transaction_date: horizon,
              transaction_type: 'credit',
              notes: marker
            })
        }
      }
    }
  } catch (e) {
    console.warn('repasses create: failed to create planned entries (non-blocking)', e)
  }
  return NextResponse.json({ rule: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  // First, clean up any planned placeholder transactions for this rule
  await supabase
    .from('bank_account_transactions')
    .delete()
    .eq('user_id', user.id)
    .eq('transaction_type', 'credit')
    .like('notes', `%rule:${id}%`)

  // Then, delete executions and their bank transactions
  const { data: execs } = await supabase
    .from('repasse_executions')
    .select('id, bank_transaction_id')
    .eq('user_id', user.id)
    .eq('rule_id', id)
  const bankIds = (execs || []).map((e: any) => e.bank_transaction_id).filter(Boolean)
  if (bankIds.length) {
    await supabase
      .from('bank_account_transactions')
      .delete()
      .eq('user_id', user.id)
      .in('id', bankIds)
  }
  await supabase
    .from('repasse_executions')
    .delete()
    .eq('user_id', user.id)
    .eq('rule_id', id)

  const { error } = await supabase
    .from('repasse_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Execute a repasse: records execution and withdraws from target account as expense
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { rule_id, date, amount, account_id, notes, op, source_currency } = body
  // Maintenance op: recompute or refresh planned placeholders for a rule (or all) after upstream data changes
  if (op === 'refresh-planned') {
    const display: 'EUR'|'BRL'|'USD' = 'EUR'
    const targetRuleId = rule_id || null
    // Load rules to refresh
    const { data: rules } = await supabase
      .from('repasse_rules')
      .select('id, percentage, payout_day, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
    const toIso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    const nextPayoutDate = (refIso: string, payoutDay: number): string => {
      const ref = new Date(refIso + 'T00:00:00')
      const curDay = ref.getDate()
      const addMonth = Number(payoutDay) <= curDay ? 1 : 0
      const target = new Date(ref.getFullYear(), ref.getMonth() + addMonth, Number(payoutDay))
      return toIso(target)
    }
    const todayIso = new Date().toISOString().slice(0,10)
    const rates = await getLatestRates(supabase)
    const selected = (rules || []).filter(r => !targetRuleId || r.id === targetRuleId)
    for (const r of selected) {
      // Gather rule targets and sources
      const [{ data: tAll }, { data: sAll }] = await Promise.all([
        supabase.from('repasse_rule_targets').select('account_id, share_percent').eq('rule_id', r.id).eq('user_id', user.id),
        supabase.from('repasse_rule_sources').select('account_id, credit_card_id').eq('rule_id', r.id).eq('user_id', user.id)
      ])
      const targets = (tAll || []) as { account_id: string; share_percent: number }[]
      const sources = (sAll || []).map((x: any) => x.account_id).filter(Boolean)
      const sourceCards = (sAll || []).map((x: any) => x.credit_card_id).filter(Boolean)
      if (!targets.length) continue
      const horizon = nextPayoutDate(todayIso, Number(r.payout_day))
      let baseProfit = 0
      if (sources.length === 0 && sourceCards.length === 0) {
        const { data: allAccs } = await supabase.from('accounts').select('id').eq('user_id', user.id).eq('is_active', true)
        const allIds = (allAccs || []).map((a: any) => a.id)
        baseProfit = (await getProfitUntil(supabase, user.id, horizon, display, { accountIds: allIds.length ? allIds : undefined, creditCardIds: undefined })).profit
      } else {
        baseProfit = (await getProfitUntil(supabase, user.id, horizon, display, { accountIds: sources.length ? sources : undefined, creditCardIds: sourceCards.length ? sourceCards : undefined })).profit
      }
      const totalForRule = Math.max(0, Math.round((baseProfit * (Number(r.percentage) / 100)) * 100) / 100)
      const { data: acctRows } = await supabase.from('accounts').select('id, currency').eq('user_id', user.id).in('id', targets.map(t=>t.account_id))
      const acctMap = new Map((acctRows || []).map((a: any) => [a.id, a]))
      for (const t of targets) {
        const acct = acctMap.get(t.account_id)
        if (!acct) continue
        const acctCur: 'EUR'|'BRL'|'USD' = (acct.currency || 'EUR')
        const portion = Math.round((totalForRule * (Number(t.share_percent) / 100)) * 100) / 100
        const portionInAcct = convertAmount(portion, display, acctCur, rates)
        const marker = `rule:${r.id};planned:true;horizon:${horizon}`
        const { data: existing } = await supabase
          .from('bank_account_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('account_id', t.account_id)
          .eq('transaction_date', horizon)
          .eq('transaction_type', 'credit')
          .like('notes', `%rule:${r.id}%`)
          .maybeSingle()
        if (existing?.id) {
          await supabase
            .from('bank_account_transactions')
            .update({ amount: portionInAcct, currency: acctCur, description: `Repasse planejado ${new Date(horizon).toLocaleDateString('pt-PT')}`, notes: marker })
            .eq('id', existing.id)
            .eq('user_id', user.id)
        } else {
          await supabase
            .from('bank_account_transactions')
            .insert({
              user_id: user.id,
              account_id: t.account_id,
              category_id: null,
              amount: portionInAcct,
              currency: acctCur,
              description: `Repasse planejado ${new Date(horizon).toLocaleDateString('pt-PT')}`,
              transaction_date: horizon,
              transaction_type: 'credit',
              notes: marker
            })
        }
      }
    }
    return NextResponse.json({ ok: true })
  }
  if (op === 'delete-execution') {
    const execId = body.execution_id
    if (!execId) return NextResponse.json({ error: 'execution_id required' }, { status: 400 })
    // Load execution to ensure ownership and get bank tx id
    const { data: exec } = await supabase
      .from('repasse_executions')
      .select('id, user_id, bank_transaction_id')
      .eq('id', execId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!exec) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Delete associated bank transaction if exists
    if (exec.bank_transaction_id) {
      await supabase.from('bank_account_transactions').delete().eq('id', exec.bank_transaction_id as any).eq('user_id', user.id)
    }
    await supabase.from('repasse_executions').delete().eq('id', execId).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }
  if (!rule_id || !date || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Load rule
  const { data: rule } = await supabase
    .from('repasse_rules')
    .select('id, user_id')
    .eq('id', rule_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  // Determine targets: either explicit account_id, rule target, or multi-targets
  let targets: { account_id: string; share_percent: number }[] = []
  if (account_id) targets = [{ account_id, share_percent: 100 }]
  else {
    const { data: t } = await supabase
      .from('repasse_rule_targets')
      .select('account_id, share_percent')
      .eq('rule_id', rule_id)
      .eq('user_id', user.id)
    if (t && t.length) targets = t as any
  }
  // If no targets configured, fallback: try to find an internal account to receive; otherwise allow marking as paid without a bank transaction
  if (!targets.length) {
    // Try internal account
    const { data: internal } = await supabase
      .from('accounts')
      .select('id, currency')
      .eq('user_id', user.id)
      .eq('auto_created', true)
      .limit(1)
    if (internal && internal.length) {
      targets = [{ account_id: internal[0].id, share_percent: 100 }]
    } else {
      // Record execution without bank transaction (status-only)
      const srcCur: 'EUR'|'BRL'|'USD' = (source_currency || 'EUR')
      const { data: exec, error: execErr } = await supabase
        .from('repasse_executions')
        .insert([{ user_id: user.id, rule_id, execution_date: date, amount: Number(amount), currency: srcCur, account_id: null, notes: notes || 'status-only' }])
        .select('*')
        .single()
      if (execErr) return NextResponse.json({ error: 'Failed to record execution' }, { status: 500 })
      return NextResponse.json({ executions: [exec] })
    }
  }

  // Split the amount by targets and create one execution per target with correct currency per account
  const rates = await getLatestRates(supabase)
  const { data: accts } = await supabase
    .from('accounts')
    .select('id, currency')
    .eq('user_id', user.id)
    .in('id', targets.map(t => t.account_id))
  const acctMap = new Map((accts || []).map((a: any) => [a.id, a]))

  // Cap by available: baseProfit (sources) - already executed for date
  const srcIdsForCap = await supabase
    .from('repasse_rule_sources')
    .select('account_id, credit_card_id')
    .eq('rule_id', rule_id)
    .eq('user_id', user.id)
  const srcList = (srcIdsForCap.data || []).map((s: any) => s.account_id).filter(Boolean)
  const srcCardList = (srcIdsForCap.data || []).map((s: any) => s.credit_card_id).filter(Boolean)
  let baseProfitForCap = 0
  if (!srcList.length && !srcCardList.length) {
    const { data: allAccs } = await supabase.from('accounts').select('id').eq('user_id', user.id).eq('is_active', true)
    const allIds = (allAccs || []).map((a: any) => a.id)
    baseProfitForCap = (await getProfitUntil(supabase, user.id, date, (source_currency || 'EUR'), { accountIds: allIds.length ? allIds : undefined, creditCardIds: undefined })).profit
  } else {
    baseProfitForCap = (await getProfitUntil(supabase, user.id, date, (source_currency || 'EUR'), { accountIds: srcList.length ? srcList : undefined, creditCardIds: srcCardList.length ? srcCardList : undefined })).profit
  }
  const { data: executedRows } = await supabase
    .from('repasse_executions')
    .select('amount, currency')
    .eq('user_id', user.id)
    .eq('rule_id', rule_id)
    .eq('execution_date', date)
  const alreadyExecuted = (executedRows || []).reduce((s: number, e: any) => s + convertAmount(Number(e.amount||0), (e.currency||'EUR'), (source_currency||'EUR'), rates), 0)
  const availableForCap = Math.max(0, Math.round((baseProfitForCap - alreadyExecuted) * 100) / 100)
  const requested = Math.abs(Number(amount))
  const capped = Math.min(requested, availableForCap)
  const created: any[] = []
  for (const t of targets) {
    const acct = acctMap.get(t.account_id)
    if (!acct) continue
    const portion = Math.round((capped * (Number(t.share_percent) / 100)) * 100) / 100
    const acctCur: 'EUR'|'BRL'|'USD' = (acct.currency || 'EUR')
    const srcCur: 'EUR'|'BRL'|'USD' = (source_currency || 'EUR')
    const portionInAcct = convertAmount(portion, srcCur, acctCur, rates)
    // Insert bank transaction first to get id
    const { data: tx, error: txErr } = await supabase
      .from('bank_account_transactions')
      .insert({
        user_id: user.id,
        account_id: t.account_id,
        category_id: null,
        amount: portionInAcct,
        currency: acctCur,
        description: `Repasse ${new Date(date).toLocaleDateString('pt-PT')}`,
        transaction_date: date,
        transaction_type: 'credit'
      })
      .select('id')
      .single()
    if (txErr) return NextResponse.json({ error: 'Failed to withdraw from account' }, { status: 500 })

    // Try to find a planned placeholder to update
    const markerLike = `%rule:${rule_id}%`
    const { data: planned } = await supabase
      .from('bank_account_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('account_id', t.account_id)
      .eq('transaction_date', date)
      .eq('transaction_type', 'credit')
      .like('notes', markerLike)
      .maybeSingle()
    if (planned?.id) {
      await supabase
        .from('bank_account_transactions')
        .update({ amount: portionInAcct, currency: acctCur, description: `Repasse ${new Date(date).toLocaleDateString('pt-PT')}`, notes: `rule:${rule_id};planned:false` })
        .eq('id', planned.id)
        .eq('user_id', user.id)
    }

    const { data: exec, error: execErr } = await supabase
      .from('repasse_executions')
      .insert([{ user_id: user.id, rule_id, execution_date: date, amount: portionInAcct, currency: acctCur, account_id: t.account_id, notes: notes || null, bank_transaction_id: planned?.id || tx?.id }])
      .select('*')
      .single()
    if (execErr) return NextResponse.json({ error: 'Failed to record execution' }, { status: 500 })
    created.push(exec)
  }

  return NextResponse.json({ executions: created })
}
