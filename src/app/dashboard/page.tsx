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
import { FileUp } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
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