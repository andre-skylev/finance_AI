import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { transactions, accountId } = await request.json()

    if (!transactions || !Array.isArray(transactions) || !accountId) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Verificar se a conta pertence ao usuário
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    }

    // Buscar categorias para mapear
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')

    const categoryMap = new Map(categories?.map(cat => [cat.name.toLowerCase(), cat.id]) || [])

    // Preparar transações para inserção
    const transactionsToInsert = transactions.map((transaction: any) => {
      // Mapear categoria sugerida para ID
      let categoryId = null
      if (transaction.suggestedCategory) {
        const suggestedLower = transaction.suggestedCategory.toLowerCase()
        // Buscar categoria exata ou similar
        for (const [catName, catId] of categoryMap.entries()) {
          if (catName.includes(suggestedLower) || suggestedLower.includes(catName)) {
            categoryId = catId
            break
          }
        }
      }

      return {
        user_id: user.id,
        account_id: accountId,
        amount: parseFloat(transaction.amount),
        description: transaction.description,
        category_id: categoryId,
        date: transaction.date,
        type: parseFloat(transaction.amount) >= 0 ? 'income' : 'expense',
        created_at: new Date().toISOString(),
      }
    })

    // Inserir transações no banco
    const { data: insertedTransactions, error: insertError } = await supabase
      .from('transactions')
      .insert(transactionsToInsert)
      .select()

    if (insertError) {
      console.error('Erro ao inserir transações:', insertError)
      return NextResponse.json({ error: 'Erro ao salvar transações' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${insertedTransactions.length} transações adicionadas com sucesso`,
      transactions: insertedTransactions
    })

  } catch (error) {
    console.error('Erro ao confirmar transações:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
