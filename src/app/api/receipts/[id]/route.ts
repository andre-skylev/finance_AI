import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const { id: receiptId } = await ctx.params

    // Verify receipt belongs to user
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('id, merchant_name')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single()

    if (receiptError || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Delete in correct order due to foreign key constraints
    
    // 1. Delete related bank account transactions first
    const { error: transactionsError } = await supabase
      .from('bank_account_transactions')
      .delete()
      .eq('receipt_id', receiptId)
      .eq('user_id', user.id)

    if (transactionsError) {
      console.error('Error deleting transactions:', transactionsError)
      return NextResponse.json({ error: 'Failed to delete related transactions' }, { status: 500 })
    }

  // 2. No longer using receipt_items in simplified model

    // 3. Finally delete the receipt itself
    const { error: receiptDeleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('user_id', user.id)

    if (receiptDeleteError) {
      console.error('Error deleting receipt:', receiptDeleteError)
      return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: `Recibo "${receipt.merchant_name}" e todas as transações relacionadas foram excluídos com sucesso.`,
      success: true 
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: receiptId } = await ctx.params

    const body = await request.json().catch(() => ({})) as any
    const rawName: string | undefined = body?.merchant_name || body?.merchant || body?.institution
    const applyToItems: boolean = body?.applyToItems !== undefined ? Boolean(body.applyToItems) : true

    const merchant_name = (rawName || '').trim()
    if (!merchant_name) {
      return NextResponse.json({ error: 'merchant_name is required' }, { status: 400 })
    }

    // Verify receipt belongs to user
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('id')
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single()

    if (receiptError || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Update receipt merchant name
    const { error: updateErr } = await supabase
      .from('receipts')
      .update({ merchant_name, updated_at: new Date().toISOString() })
      .eq('id', receiptId)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('Error updating receipt merchant_name:', updateErr)
      return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 })
    }

    // Cascade to receipt_items.institution if table/column exists
    if (applyToItems) {
      try {
        const { error: cascadeErr } = await supabase
          .from('receipt_items')
          .update({ institution: merchant_name, updated_at: new Date().toISOString() })
          .eq('receipt_id', receiptId)

        if (cascadeErr) {
          // If table/column doesn't exist in simplified model, ignore
          console.warn('Cascade to receipt_items failed (may be expected):', cascadeErr)
        }
      } catch (e) {
        // Swallow errors if table doesn't exist
        console.warn('Cascade to receipt_items not applied:', e)
      }
    }

    return NextResponse.json({ id: receiptId, merchant_name })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
