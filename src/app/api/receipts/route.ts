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

    if (error) {
      console.error('Receipts query error:', error)
      // If table/view doesn't exist (e.g., migration not applied yet), return empty list gracefully
      const code = String((error as any)?.code || '')
      const msg = String((error as any)?.message || '').toLowerCase()
      const isMissingRelation = msg.includes('relation') && msg.includes('does not exist')
      const isSchemaCacheMissing = code.startsWith('PGRST') && msg.includes("could not find the table 'public.receipts'")
      if (code === '42P01' || isMissingRelation || isSchemaCacheMissing) {
        return NextResponse.json({ receipts: [] })
      }
      return NextResponse.json({ error: 'Falha ao carregar recibos' }, { status: 500 })
    }

    return NextResponse.json({ receipts: data || [] })
  } catch (e) {
    console.error('Receipts API unexpected error:', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
