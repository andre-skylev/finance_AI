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
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import CurrencyDropdown from "@/components/CurrencyDropdown";
import { FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo, useState, useEffect } from "react";

export default function DashboardPage() {
  const [switching, setSwitching] = useState(false)
  const RateInfo = () => {
    const { displayCurrency, rates } = useCurrency()
    const { language } = useLanguage()
    const text = useMemo(() => {
      if (!rates) return null
      const last = rates.fetched_at ? new Date(rates.fetched_at) : new Date(rates.date)
      const locale = language === 'pt' ? 'pt-PT' : 'en-US'
      const when = last.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
      const rate = displayCurrency === 'EUR' ? rates.brl_to_eur : rates.eur_to_brl
      const pair = displayCurrency === 'EUR' ? 'BRL→EUR' : 'EUR→BRL'
      const stale = rates.stale ? (language === 'pt' ? ' • cache antigo' : ' • stale cache') : ''
      const src = rates.source ? ` • ${rates.source}` : ''
      const updated = language === 'pt' ? ' • atualizado ' : ' • updated '
      return `${pair}: ${rate.toFixed(4)}${updated}${when}${stale}${src}`
    }, [rates, displayCurrency, language])
    if (!text) return null
    return (
      <div className="text-xs text-muted-foreground text-right">{text}</div>
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
        {/* KPIs principais */}
        <FinancialKPIs />
        
        {/* Botão de Importação (minimal) */}
        <div className="flex justify-end">
          <Button asChild variant="outline" className="rounded-lg gap-2 border-gray-300 hover:bg-gray-50">
            <Link href="/import">
              <span className="inline-flex items-center gap-2">
                <FileUp className="h-4 w-4 text-gray-600" />
                <span className="text-gray-800">Importar documento</span>
              </span>
            </Link>
          </Button>
        </div>
        
        {/* Primeira linha - Patrimônio e Saldos */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <NetWorth />
          <AccountBalances />
        </div>
        
        {/* Segunda linha - Fluxo de Caixa e Gastos por Categoria */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <CashFlow />
          <ExpensesByCategory />
        </div>
        
        {/* Terceira linha - Metas Financeiras + Coach */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <GoalsProgress />
          <CoachWidget />
        </div>
        
        {/* Quarta linha - Orçamento vs Realizado e Custos Fixos */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <BudgetVsActual />
          <FixedCosts />
        </div>
        
        {/* Quinta linha - Transações Recentes */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12">
            <RecentTransactions />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function CoachWidget(){
  const { t } = useLanguage();
  const [tips, setTips] = useState<string[]>([])
  useEffect(()=>{
    let cancelled = false
    const load = async ()=>{
      try{
        const res = await fetch('/api/coach');
        if(!res.ok){ setTips([]); return }
        const j = await res.json()
        if(!cancelled) setTips(j.tips||[])
      }catch{ if(!cancelled) setTips([]) }
    }
    load();
    return ()=>{ cancelled = true }
  },[])
  return (
    <div className="col-span-12 lg:col-span-4 bg-white rounded-lg border p-4">
      <div className="font-medium mb-2">{t('dashboard.coach') || 'Sugestões inteligentes'}</div>
      {tips.length===0 ? (
        <div className="text-sm text-muted-foreground">{t('dashboard.noCoachTips') || 'Sem sugestões no momento'}</div>
      ) : (
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {tips.map((s, i)=> (<li key={i}>{s}</li>))}
        </ul>
      )}
    </div>
  )
}