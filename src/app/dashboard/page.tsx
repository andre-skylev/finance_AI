"use client"

import { NetWorth } from "@/components/widgets/NetWorth";
import { AccountBalances } from "@/components/widgets/AccountBalances";
import { RecentTransactions } from "@/components/widgets/RecentTransactions";
import { CashFlow } from "@/components/widgets/CashFlow";
import { ExpensesByCategory } from "@/components/widgets/ExpensesByCategory";
import { GoalsProgress } from "@/components/widgets/GoalsProgress";
import { BudgetVsActual } from "@/components/widgets/BudgetVsActual";
import { FinancialKPIs } from "@/components/widgets/FinancialKPIs";
import { FixedCosts } from "@/components/widgets/FixedCosts";
import { CreditCardForecast } from "@/components/widgets/CreditCardForecast";
import ProtectedRoute from "@/components/ProtectedRoute";
import CoachWidget from "@/components/widgets/CoachWidget";
import RepassesWidget from "@/components/widgets/RepassesWidget";
import WidgetGrid, { WidgetDef } from "@/components/widgets/WidgetGrid";
import CurrencyDropdown from "@/components/CurrencyDropdown";
import { Loader2 } from "lucide-react";
import { useCurrency as useCurrencyContext } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo, useState, useEffect } from "react";

export default function DashboardPage() {
  const [switching, setSwitching] = useState(false)
  const { displayCurrency, rates } = useCurrencyContext() // Para o dropdown e info de câmbio
  
  const RateInfo = () => {
    const { language } = useLanguage()
    if (!rates) return null
    const last = rates.fetched_at ? new Date(rates.fetched_at) : new Date(rates.date)
    const locale = language === 'pt' ? 'pt-PT' : 'en-US'
    const when = last.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
    const labels = {
      rates: language === 'pt' ? 'Taxas de câmbio' : 'Exchange rates',
      updated: language === 'pt' ? 'Atualizado' : 'Updated',
      stale: language === 'pt' ? 'cache antigo' : 'stale cache',
      source: language === 'pt' ? 'Fonte' : 'Source'
    }

    type Pair = { from: 'EUR'|'BRL'|'USD'; to: 'EUR'|'BRL'|'USD'; value: number }
    const pairs: Pair[] = []
    if (displayCurrency === 'EUR') {
      if (rates.brl_to_eur) pairs.push({ from: 'BRL', to: 'EUR', value: rates.brl_to_eur })
      if (rates.usd_to_eur) pairs.push({ from: 'USD', to: 'EUR', value: rates.usd_to_eur as number })
    } else if (displayCurrency === 'BRL') {
      if (rates.eur_to_brl) pairs.push({ from: 'EUR', to: 'BRL', value: rates.eur_to_brl })
      if (rates.usd_to_brl) pairs.push({ from: 'USD', to: 'BRL', value: rates.usd_to_brl as number })
    } else if (displayCurrency === 'USD') {
      if (rates.eur_to_usd) pairs.push({ from: 'EUR', to: 'USD', value: rates.eur_to_usd as number })
      if (rates.brl_to_usd) pairs.push({ from: 'BRL', to: 'USD', value: rates.brl_to_usd as number })
    }
    if (pairs.length === 0) return null

    return (
      <div className="text-xs text-muted-foreground flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1">{labels.rates}</div>
          <div className="flex flex-wrap gap-1.5">
            {pairs.map((p, idx) => (
              <span key={`${p.from}-${p.to}-${idx}`} className="inline-flex items-center gap-1 rounded border bg-white/70 px-1.5 py-0.5">
                <span>1 {p.from}</span>
                <span className="opacity-60">=</span>
                <span>{p.value.toFixed(4)} {p.to}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-right whitespace-nowrap">
          <span>{labels.updated}: {when}</span>
          {rates.stale && <span> • {labels.stale}</span>}
          {rates.source && <span> • {labels.source}: {rates.source}</span>}
        </div>
      </div>
    )
  }
  // Dropdown-based currency selector
  const CurrencyToggle = () => (
    <div className="flex items-center justify-end">
      <CurrencyDropdown
        disabled={switching}
  loading={switching}
        onChangeStart={() => setSwitching(true)}
        onChangeEnd={() => setSwitching(false)}
      />
    </div>
  )
  return (
    <ProtectedRoute>
      <div className="space-y-6 relative">
        {switching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <CurrencyToggle />
          <RateInfo />
        </div>
  {/* Dashboard widgets - draggable/addable */}
  <DashboardWidgets />
      </div>
    </ProtectedRoute>
  );
}

function DashboardWidgets() {
  const widgets: WidgetDef[] = [
    { id: 'financial-kpis', title: 'KPIs Financeiros', size: 'large', component: FinancialKPIs },
    { id: 'net-worth', title: 'Patrimônio Líquido', size: 'small', component: NetWorth },
    { id: 'account-balances', title: 'Saldos de Contas', size: 'small', component: AccountBalances },
    { id: 'credit-card-forecast', title: 'Fatura do Cartão', size: 'medium', component: CreditCardForecast },
  { id: 'repasses', title: 'Repasses', size: 'medium', component: RepassesWidget as any },
    { id: 'cash-flow', title: 'Fluxo de Caixa', size: 'medium', component: CashFlow },
    { id: 'expenses-by-category', title: 'Gastos por Categoria', size: 'medium', component: ExpensesByCategory },
    { id: 'goals-progress', title: 'Metas', size: 'medium', component: GoalsProgress },
    { id: 'budget-vs-actual', title: 'Orçamento vs Realizado', size: 'medium', component: BudgetVsActual },
    { id: 'fixed-costs', title: 'Custos Fixos', size: 'medium', component: FixedCosts },
    { id: 'recent-transactions', title: 'Transações Recentes', size: 'large', component: RecentTransactions },
    { id: 'coach', title: 'Sugestões', size: 'small', component: CoachWidget },
  ]
  const defaultLayout = [
    { id: 'financial-kpis', size: 'large' as const },
    { id: 'net-worth', size: 'small' as const },
    { id: 'account-balances', size: 'small' as const },
    { id: 'credit-card-forecast', size: 'medium' as const },
  { id: 'repasses', size: 'medium' as const },
    { id: 'cash-flow', size: 'medium' as const },
    { id: 'expenses-by-category', size: 'medium' as const },
    { id: 'goals-progress', size: 'medium' as const },
    { id: 'budget-vs-actual', size: 'medium' as const },
    { id: 'fixed-costs', size: 'medium' as const },
    { id: 'recent-transactions', size: 'large' as const },
    { id: 'coach', size: 'small' as const },
  ]
  return <WidgetGrid available={widgets} defaultLayout={defaultLayout} />
}