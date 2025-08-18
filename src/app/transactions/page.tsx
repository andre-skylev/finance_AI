"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useLanguage } from '../../contexts/LanguageContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { AccountManager } from '@/components/AccountManager'
import { AddTransactionButton } from '@/components/TransactionForm'
import { Plus, FileText } from 'lucide-react'
import Link from 'next/link'
import { columns, Transaction } from './components/columns'
import { DataTable } from './components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TransactionsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (user) {
      fetchTransactions()
    }
  }, [user])

  const fetchTransactions = async () => {
    // TODO: Implement server-side filtering, sorting, and pagination
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          amount,
          currency,
          description,
          transaction_date,
          type,
          categories (name, color),
          accounts (name, bank_name)
        `)
        .eq('user_id', user?.id)
        .order('transaction_date', { ascending: false })

      if (error) throw error

      const transformedTransactions = (data || []).map((t: any) => ({
        ...t,
        category: Array.isArray(t.categories) ? t.categories[0] : t.categories,
        account: Array.isArray(t.accounts) ? t.accounts[0] : t.accounts,
      }))

      setTransactions(transformedTransactions)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(t =>
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        {/* Seção de Gerenciamento de Contas */}
        <AccountManager />
        
        {/* Separador */}
        <div className="border-t" />
        
        {/* Seção de Transações */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{t('transactions.title')}</h2>
              <p className="text-muted-foreground">{t('transactions.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/import">
                  <FileText className="h-5 w-5 mr-2" />
                  Import PDF
                </Link>
              </Button>
              <AddTransactionButton />
              <Button asChild variant="outline">
                <Link href="/import">
                  <Plus className="h-5 w-5 mr-2" />
                  {t('transactions.newTransaction')}
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('transactions.filterByDescription')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>

          <DataTable columns={columns} data={filteredTransactions} />
        </div>
      </div>
    </ProtectedRoute>
  )
}