import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const { id: transactionId } = await params
    const body = await request.json()
    
    // Verify transaction belongs to user
      const { data: transaction, error: transactionError } = await supabase
        .from('bank_account_transactions')
      .select('id')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single()

    if (transactionError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Update the transaction
      const { data: updatedTransaction, error: updateError } = await supabase
        .from('bank_account_transactions')
      .update({
        amount: body.amount,
        description: body.description,
        transaction_date: body.transaction_date,
        type: body.type,
        category_id: body.category_id || null
      })
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating transaction:', updateError)
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Transação atualizada com sucesso.',
      transaction: updatedTransaction,
      success: true 
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

  const { id: transactionId } = await params

    // Verify transaction belongs to user and get details
      const { data: transaction, error: transactionError } = await supabase
        .from('bank_account_transactions')
      .select('id, description, amount')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single()

    if (transactionError || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Delete the transaction
      const { error: deleteError } = await supabase
        .from('bank_account_transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting transaction:', deleteError)
      return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: `Transação "${transaction.description}" excluída com sucesso.`,
      success: true 
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
