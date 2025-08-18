import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: job, error } = await supabase
      .from('document_jobs')
      .select('id, status, error, result, created_at, updated_at, started_at, finished_at')
      .eq('id', id)
      .single()
    if (error || !job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
    }
    return NextResponse.json(job)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 })
  }
}
