"use client"

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';

export function CashFlow() {
  const { t } = useLanguage();
  const { displayCurrency, formatWithConversion } = useCurrency();
  const [data, setData] = useState<Array<{month:string; income:number; expenses:number; net:number}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?type=cash-flow&currency=${displayCurrency}`)
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) setData(j.data || [])
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
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader>
        <CardTitle>{t('dashboard.cashFlow')}</CardTitle>
      </CardHeader>
      <CardContent>
        {(!loading && data.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noData') || 'No data yet'}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--foreground))" 
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--foreground))" 
              fontSize={12}
              tickFormatter={(value) => formatWithConversion(value, 'EUR').replace(/[€R\$\s]/g, '')}  // Clean format for axis
            />
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px"
              }}
              formatter={(value: number, name: string) => {
                const labels: { [key: string]: string } = {
                  income: t('dashboard.income'),
                  expenses: t('dashboard.expenses'), 
                  net: t('dashboard.netBalance')
                };
                const symbol = displayCurrency === 'EUR' ? '€' : 'R$'
                return [formatWithConversion(value, 'EUR'), labels[name] || name];
              }}
            />
            <Bar dataKey="income" fill="url(#incomeGradient)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="url(#expenseGradient)" radius={[4, 4, 0, 0]} />
            <Line 
              type="monotone" 
              dataKey="net" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
