import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      credit_card_id,
      transaction_date,
      description,
      amount,
      currency,
      transaction_type,
      installments = 1,
      installment_number = 1,
      merchant_name = null,
      category_id = null
    } = body

    if (!credit_card_id || !transaction_date || !amount || !currency || !transaction_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['purchase', 'payment'].includes(transaction_type)) {
      return NextResponse.json({ error: 'Invalid transaction_type' }, { status: 400 })
    }

    // Validate card belongs to user
    const { data: card, error: cardErr } = await supabase
      .from('credit_cards')
      .select('id, current_balance, currency')
      .eq('id', credit_card_id)
      .eq('user_id', user.id)
      .single()
    if (cardErr || !card) return NextResponse.json({ error: 'Invalid credit card' }, { status: 400 })

    // Optional: validate category belongs to user or is a default
    let validCategoryId: string | null = null
    if (category_id) {
      const { data: category, error: catErr } = await supabase
        .from('categories')
        .select('id, user_id, is_default')
        .eq('id', category_id)
        .or(`user_id.eq.${user.id},is_default.eq.true`)
        .single()
      if (!catErr && category) {
        validCategoryId = category.id
      } else {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
    }

    // Insert transaction
    const { data: inserted, error: insErr } = await supabase
      .from('credit_card_transactions')
      .insert({
        user_id: user.id,
        credit_card_id,
        transaction_date,
        merchant_name: description || merchant_name,
        description,
        amount: Math.abs(parseFloat(amount)),
        currency,
        transaction_type,
        installments,
        installment_number,
        category_id: validCategoryId
      })
      .select('*')
      .single()
    if (insErr) {
      console.error('Error inserting cc transaction:', insErr)
      return NextResponse.json({ error: 'Failed to create credit card transaction' }, { status: 500 })
    }

    // Update current balance: purchases add, payments subtract
    const delta = transaction_type === 'purchase' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount))
    const newBalance = (card.current_balance ?? 0) + delta
    const { error: updErr } = await supabase
      .from('credit_cards')
      .update({ current_balance: newBalance })
      .eq('id', credit_card_id)
      .eq('user_id', user.id)
    if (updErr) {
      console.error('Error updating card balance:', updErr)
      // Not fatal but report 207-like multi-status
    }

    return NextResponse.json({ transaction: inserted }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
