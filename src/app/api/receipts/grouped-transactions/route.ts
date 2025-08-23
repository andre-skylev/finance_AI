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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Buscar transações agrupadas por recibo
    const { data: groupedTransactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        description,
        transaction_date,
        currency,
        type,
        receipt_id,
        receipt:receipts!receipt_id (
          id,
          merchant_name,
          receipt_date,
          total,
          subtotal,
          tax
        ),
        category:categories(name, color, icon),
        account:accounts(name, bank_name)
      `)
      .eq('user_id', user.id)
      .not('receipt_id', 'is', null)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching grouped transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Agrupar transações por recibo
    const receiptGroups = new Map()
    
    groupedTransactions?.forEach(transaction => {
      const receiptId = transaction.receipt_id
      const receipt = Array.isArray(transaction.receipt) ? transaction.receipt[0] : transaction.receipt
      if (!receiptId || !receipt) return
      
      if (!receiptGroups.has(receiptId)) {
        receiptGroups.set(receiptId, {
          receipt_id: receiptId,
          merchant_name: receipt.merchant_name,
          receipt_date: receipt.receipt_date,
          total: receipt.total,
          subtotal: receipt.subtotal,
          tax: receipt.tax,
          transactions: [],
          transaction_count: 0,
          total_amount: 0
        })
      }
      
      const group = receiptGroups.get(receiptId)
      group.transactions.push({
        id: transaction.id,
        amount: transaction.amount,
        description: transaction.description,
        transaction_date: transaction.transaction_date,
        currency: transaction.currency,
        type: transaction.type,
        category: transaction.category,
        account: transaction.account
      })
      group.transaction_count++
      group.total_amount += transaction.amount || 0
    })

    // Converter para array e ordenar por data
    const results = Array.from(receiptGroups.values()).sort((a, b) => 
      new Date(b.receipt_date).getTime() - new Date(a.receipt_date).getTime()
    )

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length
    })

  } catch (error) {
    console.error('Error in grouped transactions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
