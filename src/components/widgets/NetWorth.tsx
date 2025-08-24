"use client"

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';

export function NetWorth() {
  const { t } = useLanguage();
  const { displayCurrency, formatWithConversion } = useCurrency();
  const [data, setData] = useState<Array<{name:string; value:number}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    const load = async () => {
      try {
      const res = await fetch(`/api/dashboard?type=net-worth&currency=${displayCurrency}`)
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        const history = (j.history || []).map((d: any) => ({ name: d.month, value: d.value }))
        if (!cancelled) setData(history)
      } catch (_) {
        if (!cancelled) setData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    }, [displayCurrency])
  return (
    <Card className="col-span-12 lg:col-span-7">
      <CardHeader>
        <CardTitle>{t('dashboard.netWorth')}</CardTitle>
      </CardHeader>
      <CardContent>
        {(!loading && data.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noData') || 'No data yet'}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
            <YAxis stroke="hsl(var(--foreground))" tickFormatter={(v) => formatWithConversion(v, 'EUR').replace(/[€R\$\s]/g, '')} />
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
              }}
              formatter={(value: number) => [formatWithConversion(Number(value), 'EUR'), t('dashboard.netWorth')]}
            />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
