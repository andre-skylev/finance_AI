'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Rates = {
  date: string
  eur_to_brl: number
  brl_to_eur: number
  eur_to_usd?: number | null
  usd_to_eur?: number | null
  usd_to_brl?: number | null
  brl_to_usd?: number | null
  fetched_at?: string | null
  stale?: boolean
  source?: string
}

type Currency = 'EUR' | 'BRL' | 'USD'

type CurrencyContextType = {
  displayCurrency: Currency
  setDisplayCurrency: (c: Currency) => void
  rates: Rates | null
  convert: (amount: number, from: Currency, to?: Currency) => number
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}

export function CurrencyProvider({ children, defaultCurrency = 'EUR' as Currency }: { children: React.ReactNode, defaultCurrency?: Currency }) {
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(defaultCurrency)
  const [rates, setRates] = useState<Rates | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/exchange')
        if (!res.ok) {
          // Don't hard throw; log and keep rates null so UI can still render.
          const txt = await res.text().catch(() => '')
          console.warn('Exchange rates not available yet:', res.status, txt)
          return
        }
        const j = await res.json()
        if (!cancelled) setRates({
          date: j.date,
          eur_to_brl: Number(j.eur_to_brl),
          brl_to_eur: Number(j.brl_to_eur),
          eur_to_usd: j.eur_to_usd != null ? Number(j.eur_to_usd) : null,
          usd_to_eur: j.usd_to_eur != null ? Number(j.usd_to_eur) : (j.eur_to_usd ? 1/Number(j.eur_to_usd) : null),
          usd_to_brl: j.usd_to_brl != null ? Number(j.usd_to_brl) : null,
          brl_to_usd: j.brl_to_usd != null ? Number(j.brl_to_usd) : (j.usd_to_brl ? 1/Number(j.usd_to_brl) : null),
          fetched_at: j.fetched_at || null,
          stale: Boolean(j.stale),
          source: j.source
        })
      } catch (e) {
        console.warn('Rates load error (non-fatal)', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const convert = useMemo(() => (amount: number, from: Currency, to: Currency = displayCurrency) => {
    if (from === to) return amount
    if (!rates) return amount
    // Helper to get pair or derive via cross
    const getPair = (f: Currency, t: Currency): number | null => {
      if (f === t) return 1
      // Direct known pairs
      if (f === 'EUR' && t === 'BRL') return rates.eur_to_brl
      if (f === 'BRL' && t === 'EUR') return rates.brl_to_eur
      if (f === 'EUR' && t === 'USD') return rates.eur_to_usd ?? (rates.usd_to_eur ? 1 / (rates.usd_to_eur as number) : null)
      if (f === 'USD' && t === 'EUR') return rates.usd_to_eur ?? (rates.eur_to_usd ? 1 / (rates.eur_to_usd as number) : null)
      if (f === 'USD' && t === 'BRL') return rates.usd_to_brl ?? ((rates.eur_to_brl && rates.eur_to_usd) ? (rates.eur_to_brl / (rates.eur_to_usd as number)) : null)
      if (f === 'BRL' && t === 'USD') return rates.brl_to_usd ?? ((rates.usd_to_brl && (rates.usd_to_brl as number) > 0) ? 1 / (rates.usd_to_brl as number) : ((rates.brl_to_eur && rates.usd_to_eur) ? (rates.brl_to_eur * (rates.usd_to_eur as number)) : null))
      return null
    }
    const pair = getPair(from, to)
    if (pair && isFinite(pair)) return amount * pair
    // Fallback: convert via EUR
    const toEur = getPair(from, 'EUR')
    const fromEur = getPair('EUR', to)
    if (toEur && fromEur) return amount * toEur * fromEur
    return amount
  }, [rates, displayCurrency])

  const value: CurrencyContextType = {
    displayCurrency,
    setDisplayCurrency,
    rates,
    convert,
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}
