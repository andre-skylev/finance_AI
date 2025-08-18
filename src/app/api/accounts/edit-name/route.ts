import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { accountId, accountType, newName } = body

    if (!accountId || !accountType || !newName) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: accountId, accountType, newName' }, { status: 400 })
    }

    let updateResult
    
    if (accountType === 'credit_card') {
      const { data, error } = await supabase
        .from('credit_cards')
        .update({ card_name: newName })
        .eq('id', accountId)
        .eq('user_id', user.id)
        .select()
      
      updateResult = { data, error }
    } else {
      const { data, error } = await supabase
        .from('accounts')
        .update({ name: newName })
        .eq('id', accountId)
        .eq('user_id', user.id)
        .select()
      
      updateResult = { data, error }
    }

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 400 })
    }

    if (!updateResult.data || updateResult.data.length === 0) {
      return NextResponse.json({ error: 'Conta/cartão não encontrado ou sem permissão' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Nome atualizado com sucesso',
      account: updateResult.data[0]
    })

  } catch (error: any) {
    console.error('Erro ao atualizar nome da conta:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    }, { status: 500 })
  }
}
