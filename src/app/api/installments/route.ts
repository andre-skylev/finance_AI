import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Body = {
  source_type: 'credit_card' | 'direct_debit' | 'financing'
  credit_card_id?: string
  account_id?: string
  merchant_name: string
  original_amount: number
  total_installments: number
  first_payment_date: string // YYYY-MM-DD
  currency?: 'EUR'|'BRL'|'USD'
  tan_rate?: number
  description?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as Body
  const { source_type, credit_card_id, account_id, merchant_name, original_amount, total_installments, first_payment_date, currency, tan_rate, description } = body
    if (!merchant_name || !original_amount || !total_installments || !first_payment_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (total_installments < 1) {
      return NextResponse.json({ error: 'total_installments must be >= 1' }, { status: 400 })
    }

    // Helper to add months
    const addMonths = (dateStr: string, months: number) => {
      const d = new Date(dateStr + 'T00:00:00')
      d.setMonth(d.getMonth() + months)
      return d.toISOString().slice(0,10)
    }
    // Split amount with rounding and adjust last installment
    const per = Math.round((Number(original_amount) / total_installments) * 100) / 100
    const amounts: number[] = Array.from({ length: total_installments }, (_, i) => per)
    const totalSoFar = Math.round(amounts.reduce((s,a)=>s+a,0) * 100) / 100
    const diff = Math.round((Number(original_amount) - totalSoFar) * 100) / 100
    amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1] + diff) * 100) / 100

    if (source_type === 'credit_card') {
      if (!credit_card_id) return NextResponse.json({ error: 'credit_card_id is required' }, { status: 400 })
      // Validate card ownership and get currency
      const { data: card } = await supabase
        .from('credit_cards')
        .select('id, user_id, currency')
        .eq('id', credit_card_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

      // Insert N rows in credit_card_transactions
      const rows = amounts.map((amt, idx) => ({
        user_id: user.id,
        credit_card_id,
        transaction_date: addMonths(first_payment_date, idx),
        merchant_name: merchant_name || 'Manual entry',
        description: description || null,
        amount: Math.abs(amt),
        currency: (card as any).currency || 'EUR',
        transaction_type: 'purchase',
        installments: total_installments,
        installment_number: idx + 1,
        original_amount: Number(original_amount),
        tan_rate: tan_rate ?? null,
      }))
      const { error: insErr } = await supabase
        .from('credit_card_transactions')
        .insert(rows)
      if (insErr) {
        console.error('Insert CC installments error:', insErr)
        return NextResponse.json({ error: 'Failed to create credit card installments' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    } else {
      // Manual: store in installments table with a shared reference_number
      const ref = crypto.randomUUID()
      const cur = currency || 'EUR'
      if (!account_id) return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
      // Validate account belongs to user
      const { data: acct } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', account_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!acct) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      const src: 'direct_debit'|'financing' = source_type === 'direct_debit' ? 'direct_debit' : 'financing'
      const rows = amounts.map((amt, idx) => ({
        user_id: user.id,
        account_id,
        reference_number: ref,
        merchant_name,
        original_amount: Number(original_amount),
        installment_amount: Math.abs(amt),
        current_installment: idx + 1,
        total_installments,
        interest_rate: tan_rate ?? null,
        transaction_date: addMonths(first_payment_date, idx),
        first_payment_date: idx === 0 ? first_payment_date : null,
        last_payment_date: null,
        status: 'active',
        currency: cur,
        source_type: src,
      }))
      const { error: insErr } = await supabase
        .from('installments')
        .insert(rows)
      if (insErr) {
        console.error('Insert manual installments error:', insErr)
        return NextResponse.json({ error: 'Failed to create installments' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }
  } catch (e) {
    console.error('POST /api/installments error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
