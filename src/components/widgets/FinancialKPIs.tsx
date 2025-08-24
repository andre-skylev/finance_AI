"use client"

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from '../../contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Target, PiggyBank } from 'lucide-react';

type Kpis = {
  totalBalance: number;
  totalBalanceChange: number;
  monthlyIncome: number;
  monthlyIncomeChange: number;
  monthlyExpenses: number;
  monthlyExpensesChange: number;
  savingsRate: number;
  savingsRateChange: number;
}

export function FinancialKPIs() {
  const { t } = useLanguage();
  const { displayCurrency, formatWithConversion } = useCurrency();
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?type=financial-kpis&currency=EUR`) // Sempre buscar em EUR e converter localmente
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        if (!cancelled) setKpis(j.kpis)
      } catch (_) {
        if (!cancelled) setKpis(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // Remover displayCurrency da dependência para evitar reloads desnecessários

  const items = [
    {
      title: t('dashboard.netWorth'),
      value: kpis ? formatWithConversion(kpis.totalBalance, 'EUR') : '—',
      change: kpis ? `${kpis.totalBalanceChange.toFixed(1)}%` : '—',
      positive: (kpis?.totalBalanceChange || 0) >= 0,
      icon: PiggyBank,
      desc: t('dashboard.vsLastMonth')
    },
    {
      title: t('dashboard.income'),
      value: kpis ? formatWithConversion(kpis.monthlyIncome, 'EUR') : '—',
      change: kpis ? `${kpis.monthlyIncomeChange.toFixed(1)}%` : '—',
      positive: (kpis?.monthlyIncomeChange || 0) >= 0,
      icon: DollarSign,
      desc: t('dashboard.vsLastMonth')
    },
    {
      title: t('dashboard.expenses'),
      value: kpis ? formatWithConversion(kpis.monthlyExpenses, 'EUR') : '—',
      change: kpis ? `${kpis.monthlyExpensesChange.toFixed(1)}%` : '—',
      positive: (kpis?.monthlyExpensesChange || 0) < 0 ? true : false,
      icon: CreditCard,
      desc: t('dashboard.vsLastMonth')
    },
    {
      title: t('dashboard.savingsRate'),
      value: kpis ? `${kpis.savingsRate.toFixed(1)}%` : '—',
      change: kpis ? `${kpis.savingsRateChange.toFixed(1)}%` : '—',
      positive: (kpis?.savingsRateChange || 0) >= 0,
      icon: Target,
      desc: t('dashboard.vsLastMonth')
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((it, idx) => {
        const Icon = it.icon
        const TrendIcon = it.positive ? TrendingUp : TrendingDown
        return (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {it.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : it.value}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendIcon className={`h-3 w-3 mr-1 ${it.positive ? 'text-green-600' : 'text-red-600'}`} />
                <span className={`font-medium ${it.positive ? 'text-green-600' : 'text-red-600'}`}>{loading ? '—' : it.change}</span>
                <span className="ml-1">{it.desc}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
