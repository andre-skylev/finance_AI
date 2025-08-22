'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Rates = {
  date: string
  eur_to_brl: number
  brl_to_eur: number
}

type Currency = 'EUR' | 'BRL'

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
        if (!cancelled) setRates({ date: j.date, eur_to_brl: Number(j.eur_to_brl), brl_to_eur: Number(j.brl_to_eur) })
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
    if (from === 'EUR' && to === 'BRL') return amount * rates.eur_to_brl
    if (from === 'BRL' && to === 'EUR') return amount * rates.brl_to_eur
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
