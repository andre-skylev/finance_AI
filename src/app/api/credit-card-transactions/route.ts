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

    // Preflight: ensure tables are visible to PostgREST from this runtime
    const [cardsHead, cctxHead] = await Promise.all([
      supabase.schema('public').from('credit_cards').select('id', { head: true, count: 'exact' }),
      supabase.schema('public').from('credit_card_transactions').select('id', { head: true, count: 'exact' }),
    ])
    if (cardsHead.error) {
      return NextResponse.json({ error: 'credit_cards not accessible', details: { code: (cardsHead.error as any).code, message: (cardsHead.error as any).message } }, { status: 500 })
    }
    if (cctxHead.error) {
      return NextResponse.json({ error: 'credit_card_transactions not accessible', details: { code: (cctxHead.error as any).code, message: (cctxHead.error as any).message } }, { status: 500 })
    }

    // Validate card belongs to user
    const { data: card, error: cardErr } = await supabase
      .schema('public')
      .from('credit_cards')
      .select('id, current_balance, currency')
      .eq('id', credit_card_id)
      .eq('user_id', user.id)
      .single()
    if (cardErr || !card) {
      console.error('Card lookup failed:', cardErr)
      // Surface exact DB error
      return NextResponse.json({ error: 'Invalid credit card' }, { status: 400 })
    }

    // Optional: validate category belongs to user or is a default
    let validCategoryId: string | null = null
    if (category_id) {
      const { data: category, error: catErr } = await supabase
        .schema('public')
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
      .schema('public')
      .from('credit_card_transactions')
      .insert({
        user_id: user.id,
        credit_card_id,
        transaction_date,
        merchant_name: (description && description.trim()) ? description : (merchant_name || 'Manual entry'),
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
      // Return richer details to identify root cause (e.g., trigger referencing missing relation)
      const errAny = insErr as any
      const status = errAny?.code === '23514' ? 400 : 500
      return NextResponse.json({ error: errAny?.message || 'Failed to create credit card transaction', code: errAny?.code, details: errAny }, { status })
    }

    // Update current balance: purchases add, payments subtract
    const delta = transaction_type === 'purchase' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount))
    const newBalance = (card.current_balance ?? 0) + delta
    const { error: updErr } = await supabase
      .schema('public')
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

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      id,
      transaction_date,
      merchant_name,
      description,
      amount,
      currency,
      transaction_type,
      installments,
      installment_number,
      category_id,
    } = body

    if (!id) return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 })
    if (transaction_type && !['purchase', 'payment'].includes(transaction_type)) {
      return NextResponse.json({ error: 'Invalid transaction_type' }, { status: 400 })
    }

    // Ensure the transaction belongs to the user and get card id
    const { data: existing, error: getErr } = await supabase
      .schema('public')
      .from('credit_card_transactions')
      .select('id, credit_card_id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (getErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Validate category if provided
    let validCategoryId: string | null | undefined = undefined
    if (category_id !== undefined) {
      if (category_id === null) {
        validCategoryId = null
      } else {
        const { data: category, error: catErr } = await supabase
          .schema('public')
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
    }

    const updates: any = {}
    if (transaction_date !== undefined) updates.transaction_date = transaction_date
    if (description !== undefined) updates.description = description
    if (merchant_name !== undefined) updates.merchant_name = (merchant_name && String(merchant_name).trim()) || (description && String(description).trim()) || 'Manual entry'
    if (amount !== undefined) updates.amount = Math.abs(parseFloat(amount))
    if (currency !== undefined) updates.currency = currency
    if (transaction_type !== undefined) updates.transaction_type = transaction_type
    if (installments !== undefined) updates.installments = installments
    if (installment_number !== undefined) updates.installment_number = installment_number
    if (validCategoryId !== undefined) updates.category_id = validCategoryId

    const { data: updated, error: updErr } = await supabase
      .schema('public')
      .from('credit_card_transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (updErr) {
      const anyErr = updErr as any
      return NextResponse.json({ error: anyErr?.message || 'Failed to update credit card transaction', code: anyErr?.code, details: anyErr }, { status: 500 })
    }

    // Fallback: recompute balance in case triggers are absent
    const { data: sumRows, error: sumErr } = await supabase
      .schema('public')
      .from('credit_card_transactions')
      .select('amount, transaction_type')
      .eq('credit_card_id', existing.credit_card_id)
      .eq('user_id', user.id)
    if (!sumErr && sumRows) {
      const newBal = (sumRows as any[]).reduce((acc, r) => acc + (['purchase', 'fee', 'interest'].includes(r.transaction_type) ? Number(r.amount) : -Number(r.amount)), 0)
      await supabase
        .schema('public')
        .from('credit_cards')
        .update({ current_balance: newBal })
        .eq('id', existing.credit_card_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ transaction: updated })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { id } = body as { id?: string }
    if (!id) return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 })

    // Fetch transaction to ensure ownership and get card id
    const { data: existing, error: getErr } = await supabase
      .schema('public')
      .from('credit_card_transactions')
      .select('id, credit_card_id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (getErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error: delErr } = await supabase
      .schema('public')
      .from('credit_card_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (delErr) {
      const anyErr = delErr as any
      return NextResponse.json({ error: anyErr?.message || 'Failed to delete transaction', code: anyErr?.code, details: anyErr }, { status: 500 })
    }

    // Fallback: recompute card balance after delete
    const { data: sumRows, error: sumErr } = await supabase
      .schema('public')
      .from('credit_card_transactions')
      .select('amount, transaction_type')
      .eq('credit_card_id', existing.credit_card_id)
      .eq('user_id', user.id)
    if (!sumErr && sumRows) {
      const newBal = (sumRows as any[]).reduce((acc, r) => acc + (['purchase', 'fee', 'interest'].includes(r.transaction_type) ? Number(r.amount) : -Number(r.amount)), 0)
      await supabase
        .schema('public')
        .from('credit_cards')
        .update({ current_balance: newBal })
        .eq('id', existing.credit_card_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
