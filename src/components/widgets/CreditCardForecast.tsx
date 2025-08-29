"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/LanguageContext"
import { useCurrency } from "@/hooks/useCurrency"
import { CreditCard, CalendarDays } from "lucide-react"

type ForecastItem = {
  card_id: string
  card_name: string
  bank_name: string
  currency: 'EUR'|'BRL'|'USD'
  closing_day: number | null
  due_day: number | null
  cycle_start: string
  cycle_end_exclusive: string
  statement_close: string
  upcoming_due_date?: string
  forecast_amount: number // in card currency
  forecast_converted: number // in EUR (API query currency)
}

export function CreditCardForecast() {
  const { t: translate, language } = useLanguage()
  const { formatWithConversion } = useCurrency()
  const [items, setItems] = useState<ForecastItem[]>([])
  const [totalEUR, setTotalEUR] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?type=credit-card-forecast&currency=EUR`)
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) {
          setItems(j.data || [])
          setTotalEUR(j.total_converted || 0)
        }
      } catch (_) {
        if (!cancelled) {
          setItems([])
          setTotalEUR(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const title = useMemo(() => translate('dashboard.ccForecast') || 'Previsão da próxima fatura', [translate])

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(language === 'pt' ? 'pt-PT' : 'en-US')
    } catch { return iso }
  }

  return (
    <Card className="bg-white rounded-lg border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {title}
        </CardTitle>
        <div className="text-2xl font-bold">
          {loading ? '—' : formatWithConversion(totalEUR, 'EUR')}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 && !loading ? (
          <div className="text-sm text-muted-foreground">
            {translate('dashboard.noCCForecast') || 'Sem dados de cartão no ciclo atual.'}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.card_id} className="flex items-start justify-between gap-4 border-b last:border-0 pb-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.bank_name} {it.card_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <CalendarDays className="h-3 w-3" />
                    <span>
                      {translate('dashboard.closesOn') || 'Fecha em'} {fmtDate(it.statement_close)}
                    </span>
                    {it.upcoming_due_date && (
                      <>
                        <span className="mx-2">•</span>
                        <span>
                          {translate('dashboard.dueOn') || 'Vence em'} {fmtDate(it.upcoming_due_date)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold">
                    {loading ? '—' : formatWithConversion(it.forecast_converted || 0, 'EUR')}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {translate('dashboard.inCardCurrency') || 'na moeda do cartão'}: {it.currency} {Math.round((it.forecast_amount||0)*100)/100}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CreditCardForecast
