"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { AddTransactionButton } from '@/components/TransactionForm'
import { columns, Transaction } from './components/columns'
import { DataTable } from './components/data-table'
import { MobileTransactionCard } from './components/mobile-transaction-card'
import { Input } from '@/components/ui/input'

export default function TransactionsPage() {
  const { user } = useAuth()
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
  <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage your financial transactions.</p>
        </div>
        <AddTransactionButton onCreated={fetchTransactions} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Filter by description..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full sm:max-w-sm"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <DataTable columns={columns} data={filteredTransactions} />
      </div>
      
      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <MobileTransactionCard key={transaction.id} transaction={transaction} />
          ))
        )}
      </div>
    </div>
  )
}