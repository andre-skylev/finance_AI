import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const receiptId = params.id

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
