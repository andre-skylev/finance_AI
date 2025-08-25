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

    // Base receipts list
    const { data: receipts, error: rErr } = await supabase
      .from('receipts')
      .select('id, merchant_name, receipt_date, subtotal, tax, total, currency')
      .eq('user_id', user.id)
      .order('receipt_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (rErr) {
      console.error('Error fetching receipts:', rErr)
      return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
    }

    const ids = (receipts || []).map((r: any) => r.id)
    if (!ids.length) return NextResponse.json({ receipts: [] })

    // Map receipt_id -> bank name (accounts)
    const { data: bankLinks } = await supabase
      .from('bank_account_transactions')
      .select('receipt_id, account:accounts(name, bank_name)')
      .eq('user_id', user.id)
      .in('receipt_id', ids)
      .order('transaction_date', { ascending: false })

    // Map receipt_id -> card bank name (credit_cards)
    const { data: cardLinks } = await supabase
      .from('credit_card_transactions')
      .select('receipt_id, card:credit_cards(card_name, bank_name)')
      .eq('user_id', user.id)
      .in('receipt_id', ids)
      .order('transaction_date', { ascending: false })

    const sourceMap = new Map<string, { type: 'bank'|'card'; institution: string }>()
  ;(bankLinks || []).forEach((row: any) => {
      if (row.receipt_id && row.account) {
        sourceMap.set(row.receipt_id, { type: 'bank', institution: row.account.bank_name || row.account.name || 'Bank' })
      }
    })
  ;(cardLinks || []).forEach((row: any) => {
      const existing = sourceMap.get(row.receipt_id)
      if (!existing && row.receipt_id && row.card) {
        sourceMap.set(row.receipt_id, { type: 'card', institution: row.card.bank_name || row.card.card_name || 'Card' })
      }
    })

    const enriched = (receipts || []).map((r: any) => ({
      ...r,
      source: sourceMap.get(r.id) || null
    }))

    return NextResponse.json({ receipts: enriched })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
