import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const host = (() => {
      try {
        const u = new URL(url)
        return u.host
      } catch {
        return url
      }
    })()

    // Lightweight HEAD queries to test table visibility from this runtime
    const [cards, cctx] = await Promise.all([
      supabase
        .schema('public')
        .from('credit_cards')
        .select('id', { head: true, count: 'exact' }),
      supabase
        .schema('public')
        .from('credit_card_transactions')
        .select('id', { head: true, count: 'exact' }),
    ])

    return NextResponse.json({
      supabaseHost: host,
      tables: {
        credit_cards: {
          ok: !cards.error,
          error: cards.error ? { code: (cards.error as any).code, message: (cards.error as any).message } : null,
        },
        credit_card_transactions: {
          ok: !cctx.error,
          error: cctx.error ? { code: (cctx.error as any).code, message: (cctx.error as any).message } : null,
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'debug-failed', message: e?.message }, { status: 500 })
  }
}
