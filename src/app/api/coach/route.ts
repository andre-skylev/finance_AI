import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(){
  try{
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return NextResponse.json({ tips: [] }, { status: 401 })

    // Budgets status
    const { data: budgets } = await supabase
      .from('budget_vs_actual')
      .select('*')
      .eq('user_id', user.id)
      .order('usage_percentage', { ascending: false })

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
      const name = (b as any).category_name || 'uma categoria'
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
