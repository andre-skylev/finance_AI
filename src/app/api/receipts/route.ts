import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data, error } = await supabase
      .from('receipts')
      .select('id, merchant_name, receipt_date, subtotal, tax, total')
      .eq('user_id', user.id)
      .order('receipt_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Falha ao carregar recibos' }, { status: 500 })

    return NextResponse.json({ receipts: data || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
