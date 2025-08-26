import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
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

    // Get bank account transactions related to this receipt
  const { data: transactions, error: transactionsError } = await supabase
      .from('bank_account_transactions')
      .select(`
        id,
        amount,
        description,
        transaction_date,
        currency,
        transaction_type,
    category_id,
    categories(name)
      `)
      .eq('receipt_id', receiptId)
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })

    if (transactionsError) {
      console.error('Error fetching receipt transactions:', transactionsError)
      return NextResponse.json({ error: 'Failed to fetch receipt transactions' }, { status: 500 })
    }

    return NextResponse.json({ transactions: transactions || [] })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
