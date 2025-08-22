import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Contract
// GET /api/exchange?base=EUR|BRL -> { date: 'YYYY-MM-DD', eur_to_brl: number, brl_to_eur: number }
// Caches per calendar day (UTC) in table public.exchange_rates

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()

    // Compute today's date in UTC (string YYYY-MM-DD)
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const todayStr = today.toISOString().split('T')[0]

    // 1) Try cache
    const { data: cached, error: cacheErr } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('rate_date', todayStr)
      .maybeSingle()

    if (!cacheErr && cached) {
      return NextResponse.json({
        date: cached.rate_date,
        eur_to_brl: Number(cached.eur_to_brl),
        brl_to_eur: Number(cached.brl_to_eur),
        cached: true,
      })
    }

    // 2) Fetch fresh rates from public sources (cascade) to minimize failures
    // Provider A: exchangerate.host (free), Provider B: frankfurter.app (free)
    let eur_to_brl: number | null = null
    let brl_to_eur: number | null = null
    try {
      const eurRes = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=BRL', { cache: 'no-store' })
      if (eurRes.ok) {
        const eurJson = await eurRes.json()
        eur_to_brl = Number(eurJson?.rates?.BRL)
        if (isFinite(eur_to_brl) && eur_to_brl > 0) {
          brl_to_eur = 1 / eur_to_brl
        } else {
          eur_to_brl = null
        }
      }
    } catch (e) {
      // ignore, fallback below
    }

    // Provider B fallback if A failed
    if (!eur_to_brl || !brl_to_eur) {
      try {
        const eurRes2 = await fetch('https://api.frankfurter.app/latest?from=EUR&to=BRL', { cache: 'no-store' })
        if (eurRes2.ok) {
          const eurJson2 = await eurRes2.json()
          const candidate = Number(eurJson2?.rates?.BRL)
          if (isFinite(candidate) && candidate > 0) {
            eur_to_brl = candidate
            brl_to_eur = 1 / candidate
          }
        }
      } catch (e) {
        // ignore, fallback below
      }
    }

    // If live fetch failed, fallback to most recent cached rate (even if not today)
    if (!eur_to_brl || !brl_to_eur) {
      const { data: latest, error: latestErr } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('rate_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest && !latestErr) {
        return NextResponse.json({
          date: latest.rate_date,
          eur_to_brl: Number(latest.eur_to_brl),
          brl_to_eur: Number(latest.brl_to_eur),
          cached: true,
          stale: true,
        })
      }

      // Env-based static fallback as last resort (e.g., when egress is blocked)
      const envEUR = Number(process.env.EXCHANGE_FALLBACK_EUR_TO_BRL)
      if (isFinite(envEUR) && envEUR > 0) {
        return NextResponse.json({
          date: todayStr,
          eur_to_brl: envEUR,
          brl_to_eur: 1 / envEUR,
          cached: false,
          stale: true,
          source: 'env'
        })
      }

      // No fallback available
      return NextResponse.json({ error: 'No exchange rates available' }, { status: 503 })
    }

    // 3) Upsert into cache
  const { error: upsertErr } = await supabase
      .from('exchange_rates')
      .upsert({ rate_date: todayStr, eur_to_brl, brl_to_eur, fetched_at: new Date().toISOString() }, { onConflict: 'rate_date' })
      .select()
      .maybeSingle()

    if (upsertErr) {
      // If caching fails, still return the rates
      console.error('Failed to cache exchange rates:', upsertErr)
    }

    return NextResponse.json({
      date: todayStr,
      eur_to_brl,
      brl_to_eur,
      cached: false,
    })
  } catch (e) {
    console.error('Exchange API error', e)
    return NextResponse.json({ error: 'Failed to load exchange rates' }, { status: 500 })
  }
}
