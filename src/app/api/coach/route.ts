import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(){
  try{
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return NextResponse.json({ tips: [] }, { status: 401 })

    // Compute budget vs actual (last 30 days) directly
    const { data: budgetsRaw } = await supabase
      .from('budgets')
      .select('id, user_id, category_id, amount, currency, period, start_date, end_date')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const categoryIds = Array.from(new Set((budgetsRaw || []).map((b: any) => b.category_id).filter(Boolean)))
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
    const catMap = new Map((cats || []).map((c: any) => [c.id, c]))

    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    const { data: activeAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
    const activeIds = (activeAccounts || []).map((a: any) => a.id)

    const { data: txs } = await supabase
      .from('bank_account_transactions')
      .select('amount, currency, category_id')
      .eq('user_id', user.id)
      .in('account_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('transaction_type', 'debit')
      .gte('transaction_date', start.toISOString().split('T')[0])
      .lt('transaction_date', end.toISOString().split('T')[0])

    const spentByCategory = new Map<string, { total: number; currency: 'EUR'|'BRL' }>()
    for (const t of txs || []) {
      if (!t.category_id) continue
      const cur: 'EUR'|'BRL' = (t.currency || 'EUR')
      const prev = spentByCategory.get(t.category_id) || { total: 0, currency: cur }
      spentByCategory.set(t.category_id, { total: prev.total + Number(t.amount || 0), currency: cur })
    }

    const budgets = (budgetsRaw || []).map((b: any) => {
      const cat = (b.category_id ? (catMap.get(b.category_id) as any) : null) as any
      const spent = b.category_id ? spentByCategory.get(b.category_id) : { total: 0, currency: b.currency || 'EUR' }
      const spentAmount = spent ? Number(spent.total) : 0
      const budgeted = Number(b.amount || 0)
      const usage = budgeted > 0 ? (spentAmount / budgeted) * 100 : 0
      return {
        category: cat?.name || 'uma categoria',
        usage_percentage: usage
      }
    }).sort((a: any, b: any) => (b.usage_percentage - a.usage_percentage))

    // Goals
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', false)

    let tips: string[] = []

    // Budget tips
    for (const b of (budgets || [])) {
      const usage = Number((b as any).usage_percentage || 0)
      const name = (b as any).category || 'uma categoria'
      if (usage >= 100) {
        tips.push(`Você estourou o orçamento de ${name}. Tente reduzir gastos nessa categoria.`)
      } else if (usage >= 80) {
        tips.push(`Atenção: você já usou ${usage.toFixed(0)}% do orçamento de ${name} neste mês.`)
      }
    }

    // Goal tips
    for (const g of (goals || [])) {
      const goal: any = g
      const today = new Date()
      const target = goal.target_date ? new Date(goal.target_date) : null
      if (!target) continue
      const monthsRemaining = Math.max(1, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()))
      const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount || 0))
      const neededMonthly = remaining / monthsRemaining
      if (neededMonthly > 0) {
        const per = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: goal.currency }).format(neededMonthly)
        tips.push(`Para a meta "${goal.name}", guarde cerca de ${per} por mês até ${target.toLocaleDateString('pt-PT')}.`)
      }
    }

    return NextResponse.json({ tips })
  }catch(err){
    console.error(err)
    return NextResponse.json({ tips: [] }, { status: 200 })
  }
}
