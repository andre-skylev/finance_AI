"use client"

import { NetWorth } from "@/components/widgets/NetWorth";
import { AccountBalances } from "@/components/widgets/AccountBalances";
import { RecentTransactions } from "@/components/widgets/RecentTransactions";
import { CashFlow } from "@/components/widgets/CashFlow";
import { ExpensesByCategory } from "@/components/widgets/ExpensesByCategory";
import { GoalsProgress } from "@/components/widgets/GoalsProgress";
import { BudgetVsActual } from "@/components/widgets/BudgetVsActual";
import { FinancialKPIs } from "@/components/widgets/FinancialKPIs";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useState } from "react";

export default function DashboardPage() {
  const [switching, setSwitching] = useState(false)
  const CurrencyToggle = () => {
    const { displayCurrency, setDisplayCurrency } = useCurrency()
    return (
      <div className="flex items-center justify-end">
        <div className="inline-flex gap-2">
          <Button
            variant={displayCurrency === 'EUR' ? 'default' : 'outline'}
            size="sm"
            disabled={switching}
            onClick={() => {
              if (displayCurrency === 'EUR') return
              setSwitching(true)
              setDisplayCurrency('EUR')
              setTimeout(() => setSwitching(false), 500)
            }}
          >
            EUR
          </Button>
          <Button
            variant={displayCurrency === 'BRL' ? 'default' : 'outline'}
            size="sm"
            disabled={switching}
            onClick={() => {
              if (displayCurrency === 'BRL') return
              setSwitching(true)
              setDisplayCurrency('BRL')
              setTimeout(() => setSwitching(false), 500)
            }}
          >
            BRL
          </Button>
        </div>
      </div>
    )
  }
  return (
    <ProtectedRoute>
      <div className="space-y-6 relative">
        {switching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <CurrencyToggle />
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
        
        {/* Terceira linha - Metas Financeiras */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <GoalsProgress />
        </div>
        
        {/* Quarta linha - Orçamento vs Realizado e Transações Recentes */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <BudgetVsActual />
          <div className="col-span-12 lg:col-span-6">
            <RecentTransactions />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}