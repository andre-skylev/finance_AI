import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Items are represented by bank_account_transactions linked via receipt_id in the simplified model.
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: receiptId } = await ctx.params

    const { data: txs, error } = await supabase
      .from('bank_account_transactions')
      .select(`
        id,
        description,
        merchant_name,
        amount,
        currency,
        category_id,
        categories(name)
      `)
      .eq('user_id', user.id)
      .eq('receipt_id', receiptId)
      .order('transaction_date', { ascending: true })

    if (error) {
      console.error('Error loading receipt items (tx-as-items):', error)
      return NextResponse.json({ error: 'Failed to load items' }, { status: 500 })
    }

    const items = (txs || []).map((tx: any) => ({
      transaction_id: tx.id,
      description: tx.description || tx.merchant_name || '',
      quantity: 1,
      unit_price: Number(tx.amount) || 0,
      total: Number(tx.amount) || 0,
      currency: tx.currency || 'EUR',
      category_id: tx.category_id || null,
      category_name: tx.categories?.name || null,
      institution: tx.merchant_name || null,
    }))

    return NextResponse.json({ items })
  } catch (e) {
    console.error('Items API unexpected error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: receiptId } = await ctx.params
    const body = await request.json().catch(() => ({})) as any
    const transactionId: string | undefined = body.transaction_id || body.id
    if (!transactionId) {
      return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 })
    }

    // Compute new amount (prefer total, else quantity*unit_price)
    const qty = body.quantity !== undefined ? Number(body.quantity) : undefined
    const unit = body.unit_price !== undefined ? Number(body.unit_price) : undefined
    const total = body.total !== undefined ? Number(body.total) : (qty !== undefined && unit !== undefined ? qty * unit : undefined)

    const updates: any = {
      updated_at: new Date().toISOString(),
    }
    if (body.description !== undefined) updates.description = String(body.description)
    if (body.category_id !== undefined) updates.category_id = body.category_id || null
    if (total !== undefined && !Number.isNaN(total)) updates.amount = Math.abs(Number(total))
    if (body.institution !== undefined) updates.merchant_name = String(body.institution)

    // Ensure the transaction belongs to the user and is linked to this receipt
    const { data: tx, error: txErr } = await supabase
      .from('bank_account_transactions')
      .select('id, user_id, receipt_id')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single()
    if (txErr || !tx || tx.receipt_id !== receiptId) {
      return NextResponse.json({ error: 'Transaction not found for this receipt' }, { status: 404 })
    }

    const { data: updated, error: updErr } = await supabase
      .from('bank_account_transactions')
      .update(updates)
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .select('id, description, merchant_name, amount, currency, category_id, categories(name)')
      .single()

    if (updErr) {
      console.error('Failed to update item (tx):', updErr)
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }

    const item = {
      transaction_id: updated.id,
      description: updated.description || updated.merchant_name || '',
      quantity: qty ?? 1,
      unit_price: Number(updated.amount) || 0,
      total: Number(updated.amount) || 0,
      currency: updated.currency || 'EUR',
      category_id: updated.category_id || null,
      category_name: (updated as any).categories?.name || null,
      institution: updated.merchant_name || null,
    }

    return NextResponse.json({ item })
  } catch (e) {
    console.error('Items API unexpected error (PUT):', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
