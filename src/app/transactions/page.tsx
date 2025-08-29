"use client"

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAccounts } from '@/hooks/useFinanceData'
import { useLanguage } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { buildColumns, Transaction, TransactionTableActions } from './components/columns'
import { DataTable } from './components/data-table'
import { MobileTransactionCard } from './components/mobile-transaction-card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function TransactionsPageContent() {
  const { user } = useAuth()
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  // Display-only: no editing state
  const searchParams = useSearchParams()
  const accountId = searchParams?.get('account_id') || undefined
  const router = useRouter()
  const { accounts } = useAccounts()
  const { language } = useLanguage()
  const selectedAccount = accounts.find((a: any) => a.id === accountId)
  const title = language === 'pt' ? 'Transações' : 'Transactions'
  const subtitle = language === 'pt' ? 'Gerencie suas transações financeiras.' : 'Manage your financial transactions.'

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (accountId) params.append('account_id', accountId)
      const res = await fetch(`/api/transactions?${params.toString()}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to fetch transactions')
      setTransactions(j.transactions || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    if (user) {
      fetchTransactions()
    }
  }, [user, accountId, fetchTransactions])

  const filteredTransactions = transactions.filter(t =>
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Display-only: no edit preselection

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
  <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"></div>
      </div>
    )
  }

  // Display-only: no actions
  const actions: TransactionTableActions | undefined = undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{subtitle}</p>
          {accountId && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
              <span className="text-gray-600">
                {language === 'pt' ? 'Filtrando por conta:' : 'Filtered by account:'}
              </span>
              <span className="font-medium">
                {selectedAccount ? `${selectedAccount.name}${selectedAccount.bank_name ? ' — ' + selectedAccount.bank_name : ''}` : accountId}
              </span>
              <button
                onClick={() => router.push('/transactions')}
                className="ml-2 rounded border px-2 py-0.5 hover:bg-gray-50"
              >
                {language === 'pt' ? 'Limpar filtro' : 'Clear filter'}
              </button>
            </div>
          )}
        </div>
  {/* Display-only: add button removed */}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder={language === 'pt' ? 'Filtrar por descrição...' : 'Filter by description...'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full sm:max-w-sm"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable columns={buildColumns(actions)} data={filteredTransactions} />
      </div>
      
      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === 'pt' ? 'Nenhuma transação encontrada' : 'No transactions found'}
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <MobileTransactionCard
              key={transaction.id}
              transaction={transaction}
            />
          ))
        )}
      </div>

  {/* Display-only: edit dialog removed */}
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Carregando…</div>}>
      <TransactionsPageContent />
    </Suspense>
  )
}