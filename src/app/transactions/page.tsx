"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAccounts } from '@/hooks/useFinanceData'
import { useLanguage } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { AddTransactionButton } from '@/components/TransactionForm'
import { buildColumns, Transaction, TransactionTableActions } from './components/columns'
import { DataTable } from './components/data-table'
import { MobileTransactionCard } from './components/mobile-transaction-card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/hooks/useFinanceData'

export default function TransactionsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    transaction_date: '',
    category_id: ''
  })
  const { categories } = useCategories()
  const searchParams = useSearchParams()
  const accountId = searchParams?.get('account_id') || undefined
  const router = useRouter()
  const { accounts } = useAccounts()
  const { language } = useLanguage()
  const selectedAccount = accounts.find((a: any) => a.id === accountId)
  const title = language === 'pt' ? 'Transações' : 'Transactions'
  const subtitle = language === 'pt' ? 'Gerencie suas transações financeiras.' : 'Manage your financial transactions.'

  useEffect(() => {
    if (user) {
      fetchTransactions()
    }
  }, [user, accountId])

  const fetchTransactions = async () => {
    // TODO: Implement server-side filtering, sorting, and pagination
    try {
      let query = supabase
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

      if (accountId) {
        // @ts-ignore: chainable filter
        query = query.eq('account_id', accountId)
      }

      const { data, error } = await query

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

  // Try to preselect category by name when opening edit dialog
  useEffect(() => {
    if (editing && categories?.length) {
      const match = categories.find((c: any) => c.name === editing.category?.name)
      if (match) setEditForm((p) => ({ ...p, category_id: match.id }))
    }
  }, [editing, categories])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
  <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-primary"></div>
      </div>
    )
  }

  const actions: TransactionTableActions = {
    onEdit: (t) => {
      setEditing(t)
      setEditForm({
        description: t.description || '',
        amount: String(Math.abs(t.amount)),
  transaction_date: t.transaction_date?.slice(0,10) || '',
  category_id: ''
      })
    },
    onDelete: async (t) => {
      try {
        await fetch(`/api/transactions?id=${t.id}`, { method: 'DELETE' })
        await fetchTransactions()
      } catch (e) {
        console.error(e)
      }
    },
    onView: (t) => {
      // For now, reuse edit dialog as view
      setEditing(t)
      setEditForm({
        description: t.description || '',
        amount: String(Math.abs(t.amount)),
        transaction_date: t.transaction_date?.slice(0,10) || '',
        category_id: ''
      })
    }
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
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
        <AddTransactionButton onCreated={fetchTransactions} />
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
            <MobileTransactionCard key={transaction.id} transaction={transaction} onEdit={actions.onEdit} onDelete={actions.onDelete} onView={actions.onView} />
          ))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'pt' ? 'Editar transação' : 'Edit transaction'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{language === 'pt' ? 'Descrição' : 'Description'}</Label>
                <Input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{language === 'pt' ? 'Valor' : 'Amount'}</Label>
                  <Input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'pt' ? 'Data' : 'Date'}</Label>
                  <Input type="date" value={editForm.transaction_date} onChange={(e) => setEditForm((p) => ({ ...p, transaction_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'pt' ? 'Categoria' : 'Category'}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.category_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, category_id: e.target.value }))}
                >
                  <option value="">{language === 'pt' ? 'Sem categoria' : 'No category'}</option>
                  {categories
                    .filter((c: any) => c.type === editing.type)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>{language === 'pt' ? 'Cancelar' : 'Cancel'}</Button>
                <Button onClick={async () => {
                  try {
                    await fetch('/api/transactions', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: editing.id,
                        description: editForm.description,
                        amount: parseFloat(editForm.amount) * (editing.type === 'expense' ? -1 : 1),
                        transaction_date: editForm.transaction_date,
                        category_id: editForm.category_id || undefined
                      })
                    })
                    setEditing(null)
                    await fetchTransactions()
                  } catch (e) {
                    console.error(e)
                  }
                }}>{language === 'pt' ? 'Salvar' : 'Save'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}